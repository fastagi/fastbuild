package sample

import "gorm.io/gorm"

type ProjectPO struct {
	ID             uint
	OrganizationID uint
	Name           string
}

type GlobalPO struct {
	ID   uint
	Name string
}

func scopedRead(db *gorm.DB, organizationID, id uint) {
	var row ProjectPO
	db.Where("organization_id = ? AND id = ?", organizationID, id).Take(&row)
}

func scopedAfterModel(db *gorm.DB, organizationID uint) {
	db.Model(&ProjectPO{}).Where("organization_id = ?", organizationID).Updates(map[string]any{"name": "x"})
}

func scopedThroughLocalQuery(db *gorm.DB, organizationID uint) {
	var rows []ProjectPO
	var total int64
	query := db.Model(&ProjectPO{}).Where("organization_id = ?", organizationID)
	query.Count(&total)
	query.Order("id desc").Find(&rows)
}

func scopedThroughLocalFunction(db *gorm.DB, organizationID uint) {
	var rows []ProjectPO
	scoped := func() *gorm.DB {
		return db.Model(&ProjectPO{}).Where("organization_id = ?", organizationID)
	}
	scoped().Find(&rows)
}

func insertIsExempt(db *gorm.DB, row *ProjectPO) {
	db.Create(row)
}

func modelWithoutOwnerIsIgnored(db *gorm.DB, id uint) {
	var row GlobalPO
	db.First(&row, id)
}

func readByPrimaryKeyOnly(db *gorm.DB, id uint) {
	var row ProjectPO
	db.First(&row, id) // want `First on organization-owned ProjectPO has no organization_id predicate`
}

func saveWritesByPrimaryKey(db *gorm.DB, row *ProjectPO) {
	db.Save(row) // want `Save on organization-owned ProjectPO has no organization_id predicate`
}

func deleteByIDOnly(db *gorm.DB, id uint) {
	db.Where("id = ?", id).Delete(&ProjectPO{}) // want `Delete on organization-owned ProjectPO`
}

func unscopedList(db *gorm.DB) {
	var rows []ProjectPO
	query := db.Model(&ProjectPO{}) // want `Model on organization-owned ProjectPO`
	query.Find(&rows)               // want `Find on organization-owned ProjectPO`
}

// retention deletes expired rows of every organization.
//
//archlint:cross-organization retention job
func retention(db *gorm.DB) {
	db.Where("name = ?", "expired").Delete(&ProjectPO{})
}

func listedInBaseline(db *gorm.DB, id uint) {
	var row ProjectPO
	db.First(&row, id)
}
