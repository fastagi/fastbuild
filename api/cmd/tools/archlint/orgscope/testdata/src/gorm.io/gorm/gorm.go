// Package gorm is the smallest stand-in for gorm.io/gorm that the analyzer tests need.
package gorm

type DB struct{ Error error }

func (db *DB) Model(value any) *DB                { return db }
func (db *DB) Where(query any, args ...any) *DB   { return db }
func (db *DB) Order(value any) *DB                { return db }
func (db *DB) Take(dest any, conds ...any) *DB    { return db }
func (db *DB) First(dest any, conds ...any) *DB   { return db }
func (db *DB) Find(dest any, conds ...any) *DB    { return db }
func (db *DB) Save(value any) *DB                 { return db }
func (db *DB) Create(value any) *DB               { return db }
func (db *DB) Delete(value any, conds ...any) *DB { return db }
func (db *DB) Updates(values any) *DB             { return db }
func (db *DB) Count(count *int64) *DB             { return db }
