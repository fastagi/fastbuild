package metrics

import (
	"context"
	"database/sql"
	"errors"
	"sync"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"gorm.io/gorm"
)

const (
	dbMetricsBeforeName    = "metrics:before"
	dbMetricsAfterName     = "metrics:after"
	unknownTableLabel      = "unknown"
	otherTableLabel        = "other"
	maxTableLabelBytes     = 63
	maxDistinctTableLabels = 256
)

// tableLabels remembers accepted table labels so a schema with dynamic table names (for example
// time partitions) cannot grow db_* series without bound. Lookups are lock-free after warm-up.
var (
	tableLabels     sync.Map
	tableLabelCount atomic.Int32
)

// GormPlugin records db_queries_total and db_query_duration_seconds for every GORM statement.
// Labels are the callback operation and the statement's table name only; SQL text and bound values
// are never observed.
type GormPlugin struct{}

// Name implements gorm.Plugin.
func (GormPlugin) Name() string { return "fastbuild-metrics" }

// Initialize implements gorm.Plugin.
func (GormPlugin) Initialize(db *gorm.DB) error {
	callback := db.Callback()
	return errors.Join(
		callback.Create().Before("gorm:create").Register(dbMetricsBeforeName, startDBTimer),
		callback.Create().After("gorm:create").Register(dbMetricsAfterName, observeDBQuery("create")),
		callback.Query().Before("gorm:query").Register(dbMetricsBeforeName, startDBTimer),
		callback.Query().After("gorm:query").Register(dbMetricsAfterName, observeDBQuery("query")),
		callback.Update().Before("gorm:update").Register(dbMetricsBeforeName, startDBTimer),
		callback.Update().After("gorm:update").Register(dbMetricsAfterName, observeDBQuery("update")),
		callback.Delete().Before("gorm:delete").Register(dbMetricsBeforeName, startDBTimer),
		callback.Delete().After("gorm:delete").Register(dbMetricsAfterName, observeDBQuery("delete")),
		callback.Row().Before("gorm:row").Register(dbMetricsBeforeName, startDBTimer),
		callback.Row().After("gorm:row").Register(dbMetricsAfterName, observeDBQuery("row")),
		callback.Raw().Before("gorm:raw").Register(dbMetricsBeforeName, startDBTimer),
		callback.Raw().After("gorm:raw").Register(dbMetricsAfterName, observeDBQuery("raw")),
	)
}

type dbStartKey struct{}

// startDBTimer keeps the start time on the statement context: two small allocations, against
// roughly six for gorm's InstanceSet/InstanceGet key formatting.
func startDBTimer(db *gorm.DB) {
	if db.Statement.Context == nil {
		return
	}
	db.Statement.Context = context.WithValue(db.Statement.Context, dbStartKey{}, time.Now())
}

func observeDBQuery(operation string) func(*gorm.DB) {
	return func(db *gorm.DB) {
		if db.Statement.Context == nil {
			return
		}
		start, ok := db.Statement.Context.Value(dbStartKey{}).(time.Time)
		if !ok {
			return
		}
		observer := dbQueryObserverFor(operation, dbTableLabel(db.Statement.Table))
		observer.count.Inc()
		observer.duration.Observe(time.Since(start).Seconds())
	}
}

type dbQueryKey struct{ operation, table string }

type dbQueryObserver struct {
	count    prometheus.Counter
	duration prometheus.Observer
}

// dbQueryObservers caches resolved label handles; the key space is bounded by the operation set
// times the table-label cap.
var dbQueryObservers sync.Map

func dbQueryObserverFor(operation, table string) dbQueryObserver {
	key := dbQueryKey{operation: operation, table: table}
	if cached, ok := dbQueryObservers.Load(key); ok {
		if observer, ok := cached.(dbQueryObserver); ok {
			return observer
		}
	}
	observer := dbQueryObserver{
		count:    dbQueryTotal.WithLabelValues(operation, table),
		duration: dbQueryDuration.WithLabelValues(operation, table),
	}
	if actual, loaded := dbQueryObservers.LoadOrStore(key, observer); loaded {
		if existing, ok := actual.(dbQueryObserver); ok {
			return existing
		}
	}
	return observer
}

// dbTableLabel keeps only plain identifiers and caps the number of distinct labels.
func dbTableLabel(table string) string {
	if table == "" {
		return unknownTableLabel
	}
	if _, ok := tableLabels.Load(table); ok {
		return table
	}
	if !plainIdentifier(table) {
		return otherTableLabel
	}
	if tableLabelCount.Add(1) > maxDistinctTableLabels {
		tableLabelCount.Add(-1)
		return otherTableLabel
	}
	if _, loaded := tableLabels.LoadOrStore(table, struct{}{}); loaded {
		tableLabelCount.Add(-1)
	}
	return table
}

func plainIdentifier(value string) bool {
	if len(value) > maxTableLabelBytes {
		return false
	}
	for index := 0; index < len(value); index++ {
		char := value[index]
		if (char < 'a' || char > 'z') && (char < '0' || char > '9') && char != '_' && char != '.' {
			return false
		}
	}
	return true
}

// dbPoolCollector reads database/sql pool statistics at scrape time, so pool metrics cost nothing
// between scrapes and need no background goroutine.
type dbPoolCollector struct {
	db           atomic.Pointer[sql.DB]
	open         *prometheus.Desc
	inUse        *prometheus.Desc
	idle         *prometheus.Desc
	maxOpen      *prometheus.Desc
	waitCount    *prometheus.Desc
	waitDuration *prometheus.Desc
}

var (
	poolCollector = &dbPoolCollector{
		open:         prometheus.NewDesc("db_connections_open", "Number of open database connections", nil, nil),
		inUse:        prometheus.NewDesc("db_connections_in_use", "Number of database connections in use", nil, nil),
		idle:         prometheus.NewDesc("db_connections_idle", "Number of idle database connections", nil, nil),
		maxOpen:      prometheus.NewDesc("db_connections_max_open", "Configured maximum open database connections", nil, nil),
		waitCount:    prometheus.NewDesc("db_connections_wait_total", "Total number of waits for a database connection", nil, nil),
		waitDuration: prometheus.NewDesc("db_connections_wait_duration_seconds_total", "Total time blocked waiting for a database connection", nil, nil),
	}
	registerPoolCollector sync.Once
)

func (c *dbPoolCollector) Describe(descriptions chan<- *prometheus.Desc) {
	descriptions <- c.open
	descriptions <- c.inUse
	descriptions <- c.idle
	descriptions <- c.maxOpen
	descriptions <- c.waitCount
	descriptions <- c.waitDuration
}

func (c *dbPoolCollector) Collect(metrics chan<- prometheus.Metric) {
	db := c.db.Load()
	if db == nil {
		return
	}
	stats := db.Stats()
	metrics <- prometheus.MustNewConstMetric(c.open, prometheus.GaugeValue, float64(stats.OpenConnections))
	metrics <- prometheus.MustNewConstMetric(c.inUse, prometheus.GaugeValue, float64(stats.InUse))
	metrics <- prometheus.MustNewConstMetric(c.idle, prometheus.GaugeValue, float64(stats.Idle))
	metrics <- prometheus.MustNewConstMetric(c.maxOpen, prometheus.GaugeValue, float64(stats.MaxOpenConnections))
	metrics <- prometheus.MustNewConstMetric(c.waitCount, prometheus.CounterValue, float64(stats.WaitCount))
	metrics <- prometheus.MustNewConstMetric(c.waitDuration, prometheus.CounterValue, stats.WaitDuration.Seconds())
}

// InstrumentDatabase adds query metrics to db and reports its connection pool on the default
// registry. A process exports one pool: a later call replaces the observed pool.
func InstrumentDatabase(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	if err := db.Use(GormPlugin{}); err != nil && !errors.Is(err, gorm.ErrRegistered) {
		return err
	}
	poolCollector.db.Store(sqlDB)
	var registerErr error
	registerPoolCollector.Do(func() {
		registerErr = prometheus.Register(poolCollector)
	})
	return registerErr
}
