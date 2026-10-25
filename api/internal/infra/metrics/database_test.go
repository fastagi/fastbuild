package metrics

import (
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type metricsProbePO struct {
	ID   uint
	Name string
}

func (metricsProbePO) TableName() string { return "metrics_probe_items" }

// dryRunDB builds a PostgreSQL-dialect GORM handle that never connects: DryRun renders statements
// without executing them, while every registered callback still runs.
func dryRunDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  "host=127.0.0.1 port=1 user=fastbuild dbname=fastbuild sslmode=disable",
		WithoutQuotingCheck:  true,
		PreferSimpleProtocol: true,
	}), &gorm.Config{DryRun: true, DisableAutomaticPing: true})
	if err != nil {
		t.Fatalf("open dry-run database: %v", err)
	}
	return db
}

func TestInstrumentDatabaseRecordsOperationAndTableWithoutSQLText(t *testing.T) {
	db := dryRunDB(t)
	if err := InstrumentDatabase(db); err != nil {
		t.Fatalf("InstrumentDatabase() error = %v", err)
	}
	// A second call on the same handle is idempotent.
	if err := InstrumentDatabase(db); err != nil {
		t.Fatalf("second InstrumentDatabase() error = %v", err)
	}

	queryBefore := queryCount(t, "query")
	createBefore := queryCount(t, "create")

	var rows []metricsProbePO
	db.Where("name = ?", "value-that-must-not-become-a-label").Find(&rows)
	db.Create(&metricsProbePO{Name: "another-secret-value"})

	if got := queryCount(t, "query") - queryBefore; got != 1 {
		t.Fatalf("query count delta = %v, want 1", got)
	}
	if got := queryCount(t, "create") - createBefore; got != 1 {
		t.Fatalf("create count delta = %v, want 1", got)
	}

	families, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		t.Fatalf("gather: %v", err)
	}
	for _, family := range families {
		if !strings.HasPrefix(family.GetName(), "db_") {
			continue
		}
		for _, metric := range family.GetMetric() {
			for _, label := range metric.GetLabel() {
				value := label.GetValue()
				if strings.Contains(value, "secret") || strings.Contains(value, "value-that") || strings.Contains(strings.ToUpper(value), "SELECT") {
					t.Fatalf("%s label %s=%q leaks statement content", family.GetName(), label.GetName(), value)
				}
			}
		}
	}
}

func TestInstrumentDatabaseExportsPoolStatsAtScrape(t *testing.T) {
	db := dryRunDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("db.DB(): %v", err)
	}
	sqlDB.SetMaxOpenConns(7)
	if err := InstrumentDatabase(db); err != nil {
		t.Fatalf("InstrumentDatabase() error = %v", err)
	}

	if got := gaugeValue(t, "db_connections_max_open"); got != 7 {
		t.Fatalf("db_connections_max_open = %v, want 7", got)
	}
	if got := gaugeValue(t, "db_connections_open"); got != 0 {
		t.Fatalf("db_connections_open = %v, want 0", got)
	}
}

func queryCount(t *testing.T, operation string) float64 {
	t.Helper()
	families, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		t.Fatalf("gather: %v", err)
	}
	for _, family := range families {
		if family.GetName() != "db_queries_total" {
			continue
		}
		for _, metric := range family.GetMetric() {
			labels := map[string]string{}
			for _, label := range metric.GetLabel() {
				labels[label.GetName()] = label.GetValue()
			}
			if labels["operation"] == operation && labels["table"] == "metrics_probe_items" {
				return metric.GetCounter().GetValue()
			}
		}
	}
	return 0
}

func gaugeValue(t *testing.T, name string) float64 {
	t.Helper()
	families, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		t.Fatalf("gather: %v", err)
	}
	for _, family := range families {
		if family.GetName() == name && len(family.GetMetric()) == 1 {
			return family.GetMetric()[0].GetGauge().GetValue()
		}
	}
	t.Fatalf("metric %s not exported", name)
	return 0
}

func TestDBTableLabelBoundsCardinality(t *testing.T) {
	for _, test := range []struct {
		table string
		want  string
	}{
		{table: "", want: unknownTableLabel},
		{table: "users", want: "users"},
		{table: "public.users", want: "public.users"},
		{table: `users"; DROP TABLE users; --`, want: otherTableLabel},
		{table: "Users", want: otherTableLabel},
		{table: strings.Repeat("a", maxTableLabelBytes+1), want: otherTableLabel},
	} {
		if got := dbTableLabel(test.table); got != test.want {
			t.Fatalf("dbTableLabel(%q) = %q, want %q", test.table, got, test.want)
		}
	}

	for index := 0; index < maxDistinctTableLabels+10; index++ {
		dbTableLabel("partition_" + strings.Repeat("x", index%40) + string(rune('a'+index%26)) + string(rune('a'+index/26%26)))
	}
	if count := tableLabelCount.Load(); count > maxDistinctTableLabels {
		t.Fatalf("distinct table labels = %d, want at most %d", count, maxDistinctTableLabels)
	}
	if got := dbTableLabel("never_seen_after_cap"); got != otherTableLabel {
		t.Fatalf("label after cap = %q, want %q", got, otherTableLabel)
	}
}

func BenchmarkGormPluginQuery(b *testing.B) {
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN: "host=127.0.0.1 port=1 user=fastbuild dbname=fastbuild sslmode=disable",
	}), &gorm.Config{DryRun: true, DisableAutomaticPing: true})
	if err != nil {
		b.Fatal(err)
	}
	if err := db.Use(GormPlugin{}); err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	for b.Loop() {
		var rows []metricsProbePO
		db.Find(&rows)
	}
}
