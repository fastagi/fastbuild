package commands

import "strings"

// Templates for `make:module --scope=organization`: every read and write of the generated starter
// is confined to the verified active organization, and the generated tests prove it.

const scopedDomainTemplate = `package domain

import (
	"context"
	"time"
)

// {{.ModelName}} is an organization-owned entity of the {{.Package}} module.
type {{.ModelName}} struct {
	ID             uint      ` + "`" + `json:"id"` + "`" + `
	OrganizationID uint      ` + "`" + `json:"organization_id"` + "`" + `
	Name           string    ` + "`" + `json:"name"` + "`" + `
	CreatedAt      time.Time ` + "`" + `json:"created_at"` + "`" + `
	UpdatedAt      time.Time ` + "`" + `json:"updated_at"` + "`" + `
}

// {{.ModelName}}Repository persists {{.ModelName}}. Every method is confined to one organization:
// a record of another organization is reported as ErrNotFound, never read or changed.
type {{.ModelName}}Repository interface {
	Create(ctx context.Context, item *{{.ModelName}}) error
	Update(ctx context.Context, item *{{.ModelName}}) error
	Delete(ctx context.Context, organizationID, id uint) error
	FindByID(ctx context.Context, organizationID, id uint) (*{{.ModelName}}, error)
	FindAll(ctx context.Context, organizationID uint, page, pageSize int) ([]*{{.ModelName}}, int64, error)
}
`

const scopedModelTemplate = `package {{.PackageName}}

import (
	"time"

	"gorm.io/gorm"

	"github.com/fastagi/fastbuild/api/internal/domain"
)

// {{.ModelName}}PO is the persistent object for {{.ModelName}}.
type {{.ModelName}}PO struct {
	ID             uint           ` + "`" + `gorm:"primaryKey"` + "`" + `
	OrganizationID uint           ` + "`" + `gorm:"not null;index"` + "`" + `
	Name           string         ` + "`" + `gorm:"size:255;not null"` + "`" + `
	CreatedAt      time.Time
	UpdatedAt      time.Time
	DeletedAt      gorm.DeletedAt ` + "`" + `gorm:"index"` + "`" + `
}

func ({{.ModelName}}PO) TableName() string {
	return "{{.TableName}}"
}

func (po *{{.ModelName}}PO) toDomain() *domain.{{.ModelName}} {
	if po == nil {
		return nil
	}

	return &domain.{{.ModelName}}{
		ID:             po.ID,
		OrganizationID: po.OrganizationID,
		Name:           po.Name,
		CreatedAt:      po.CreatedAt,
		UpdatedAt:      po.UpdatedAt,
	}
}

func new{{.ModelName}}PO(item *domain.{{.ModelName}}) *{{.ModelName}}PO {
	if item == nil {
		return nil
	}

	return &{{.ModelName}}PO{
		ID:             item.ID,
		OrganizationID: item.OrganizationID,
		Name:           item.Name,
		CreatedAt:      item.CreatedAt,
		UpdatedAt:      item.UpdatedAt,
	}
}
`

const scopedServiceTemplate = `package {{.PackageName}}

import (
	"context"
	"strings"

	"github.com/fastagi/fastbuild/api/internal/domain"
)

// Service defines the business interface for {{.ModelName}}. Every method takes the verified
// organization membership of the request: members read, owners and admins write.
type Service interface {
	Create(ctx context.Context, organization domain.OrganizationContext, req *Create{{.ModelName}}Request) (*domain.{{.ModelName}}, error)
	Update(ctx context.Context, organization domain.OrganizationContext, id uint, req *Update{{.ModelName}}Request) (*domain.{{.ModelName}}, error)
	Delete(ctx context.Context, organization domain.OrganizationContext, id uint) error
	GetByID(ctx context.Context, organization domain.OrganizationContext, id uint) (*domain.{{.ModelName}}, error)
	List(ctx context.Context, organization domain.OrganizationContext, page, pageSize int) ([]*domain.{{.ModelName}}, int64, error)
}

type service struct {
	repo domain.{{.ModelName}}Repository
}

var _ Service = (*service)(nil)

// NewService creates a new {{.Package}} service.
func NewService(repo domain.{{.ModelName}}Repository) *service {
	return &service{repo: repo}
}

func authorizeWrite(organization domain.OrganizationContext) error {
	if !organization.IsValid() {
		return domain.ErrOrganizationContextRequired
	}
	if !organization.Role.CanManageOrganization() {
		return domain.ErrPermissionDenied
	}
	return nil
}

func authorizeRead(organization domain.OrganizationContext) error {
	if !organization.IsValid() {
		return domain.ErrOrganizationContextRequired
	}
	return nil
}

func (s *service) Create(ctx context.Context, organization domain.OrganizationContext, req *Create{{.ModelName}}Request) (*domain.{{.ModelName}}, error) {
	if err := authorizeWrite(organization); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, domain.ErrInvalidInput
	}

	item := &domain.{{.ModelName}}{
		OrganizationID: organization.OrganizationID,
		Name:           name,
	}

	if err := s.repo.Create(ctx, item); err != nil {
		return nil, err
	}

	return item, nil
}

func (s *service) Update(ctx context.Context, organization domain.OrganizationContext, id uint, req *Update{{.ModelName}}Request) (*domain.{{.ModelName}}, error) {
	if err := authorizeWrite(organization); err != nil {
		return nil, err
	}
	item, err := s.repo.FindByID(ctx, organization.OrganizationID, id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, domain.ErrInvalidInput
		}
		item.Name = name
	}

	if err := s.repo.Update(ctx, item); err != nil {
		return nil, err
	}

	return item, nil
}

func (s *service) Delete(ctx context.Context, organization domain.OrganizationContext, id uint) error {
	if err := authorizeWrite(organization); err != nil {
		return err
	}
	return s.repo.Delete(ctx, organization.OrganizationID, id)
}

func (s *service) GetByID(ctx context.Context, organization domain.OrganizationContext, id uint) (*domain.{{.ModelName}}, error) {
	if err := authorizeRead(organization); err != nil {
		return nil, err
	}
	return s.repo.FindByID(ctx, organization.OrganizationID, id)
}

func (s *service) List(ctx context.Context, organization domain.OrganizationContext, page, pageSize int) ([]*domain.{{.ModelName}}, int64, error) {
	if err := authorizeRead(organization); err != nil {
		return nil, 0, err
	}
	return s.repo.FindAll(ctx, organization.OrganizationID, page, pageSize)
}
`

const scopedHandlerTemplate = `package {{.PackageName}}

import (
	"github.com/gin-gonic/gin"

	"github.com/fastagi/fastbuild/api/internal/domain"
	"github.com/fastagi/fastbuild/api/internal/infra/config"
	"github.com/fastagi/fastbuild/api/internal/starter/assembly"
	httphandler "github.com/fastagi/fastbuild/api/pkg/handler"
	"github.com/fastagi/fastbuild/api/pkg/pagination"
	"github.com/fastagi/fastbuild/api/pkg/response"
)

// Handler handles organization-scoped HTTP requests for {{.ModelName}}.
type Handler struct {
	service Service
}

var (
	_ assembly.Module      = (*Handler)(nil)
	_ assembly.RouteModule = (*Handler)(nil)
	_ assembly.ErrorModule = (*Handler)(nil)
)

// NewHandler creates a new handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// Name returns the starter name.
func (h *Handler) Name() string {
	return config.{{.StarterConst}}
}

// activeOrganization returns the membership that the organization_context middleware verified.
// It is the only source of the organization: never read an organization ID from the header, the
// path, the query, or the body.
func activeOrganization(c *gin.Context) (domain.OrganizationContext, bool) {
	organization, ok := domain.OrganizationContextFromContext(c.Request.Context())
	if !ok {
		response.HandleError(c, "Organization context required", domain.ErrOrganizationContextRequired)
		return domain.OrganizationContext{}, false
	}
	return organization, true
}

func (h *Handler) List(c *gin.Context) {
	organization, ok := activeOrganization(c)
	if !ok {
		return
	}
	req := pagination.FromContext(c)

	items, total, err := h.service.List(c.Request.Context(), organization, req.GetPage(), req.GetPerPage())
	if err != nil {
		response.HandleError(c, "Failed to list {{.RouteCollection}}", err)
		return
	}

	paginator := pagination.NewPaginator(to{{.ModelName}}Responses(items), total, req.GetPage(), req.GetPerPage())
	paginator.SetPath(c.Request.URL.Path)
	response.Success(c, paginator)
}

func (h *Handler) Get(c *gin.Context) {
	organization, ok := activeOrganization(c)
	if !ok {
		return
	}
	id, ok := httphandler.ParseID(c, "id")
	if !ok {
		return
	}

	item, err := h.service.GetByID(c.Request.Context(), organization, id)
	if err != nil {
		response.HandleError(c, "Failed to get {{.Package}}", err)
		return
	}

	response.Success(c, to{{.ModelName}}Response(item))
}

func (h *Handler) Create(c *gin.Context) {
	organization, ok := activeOrganization(c)
	if !ok {
		return
	}
	var req Create{{.ModelName}}Request
	if !httphandler.BindJSON(c, &req) {
		return
	}

	item, err := h.service.Create(c.Request.Context(), organization, &req)
	if err != nil {
		response.HandleError(c, "Failed to create {{.Package}}", err)
		return
	}

	response.Created(c, to{{.ModelName}}Response(item))
}

func (h *Handler) Update(c *gin.Context) {
	organization, ok := activeOrganization(c)
	if !ok {
		return
	}
	id, ok := httphandler.ParseID(c, "id")
	if !ok {
		return
	}

	var req Update{{.ModelName}}Request
	if !httphandler.BindJSON(c, &req) {
		return
	}

	item, err := h.service.Update(c.Request.Context(), organization, id, &req)
	if err != nil {
		response.HandleError(c, "Failed to update {{.Package}}", err)
		return
	}

	response.Success(c, to{{.ModelName}}Response(item))
}

func (h *Handler) Delete(c *gin.Context) {
	organization, ok := activeOrganization(c)
	if !ok {
		return
	}
	id, ok := httphandler.ParseID(c, "id")
	if !ok {
		return
	}

	if err := h.service.Delete(c.Request.Context(), organization, id); err != nil {
		response.HandleError(c, "Failed to delete {{.Package}}", err)
		return
	}

	response.NoContent(c)
}
`

const scopedRepositoryTemplate = `package {{.PackageName}}

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/fastagi/fastbuild/api/internal/domain"
	infradatabase "github.com/fastagi/fastbuild/api/internal/infra/database"
)

type repository struct {
	db *gorm.DB
}

var _ domain.{{.ModelName}}Repository = (*repository)(nil)

// NewRepository creates a new repository.
func NewRepository(db *gorm.DB) *repository {
	return &repository{db: db}
}

// conn joins the caller's transaction when one is bound to ctx.
func (r *repository) conn(ctx context.Context) (*gorm.DB, error) {
	db := infradatabase.ResolveContextDB(ctx, r.db)
	if db == nil {
		return nil, domain.ErrServiceUnavailable
	}
	return db, nil
}

func (r *repository) Create(ctx context.Context, item *domain.{{.ModelName}}) error {
	if item.OrganizationID == 0 {
		return domain.ErrOrganizationContextRequired
	}
	db, err := r.conn(ctx)
	if err != nil {
		return err
	}
	po := new{{.ModelName}}PO(item)
	if err := db.Create(po).Error; err != nil {
		return err
	}

	item.ID = po.ID
	item.CreatedAt = po.CreatedAt
	item.UpdatedAt = po.UpdatedAt
	return nil
}

// Update changes one record of item.OrganizationID. A record of another organization is not found.
func (r *repository) Update(ctx context.Context, item *domain.{{.ModelName}}) error {
	db, err := r.conn(ctx)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	result := db.Model(&{{.ModelName}}PO{}).
		Where("organization_id = ? AND id = ?", item.OrganizationID, item.ID).
		Updates(map[string]any{"name": item.Name, "updated_at": now})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return domain.ErrNotFound
	}

	item.UpdatedAt = now
	return nil
}

func (r *repository) Delete(ctx context.Context, organizationID, id uint) error {
	db, err := r.conn(ctx)
	if err != nil {
		return err
	}
	result := db.Where("organization_id = ? AND id = ?", organizationID, id).Delete(&{{.ModelName}}PO{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *repository) FindByID(ctx context.Context, organizationID, id uint) (*domain.{{.ModelName}}, error) {
	db, err := r.conn(ctx)
	if err != nil {
		return nil, err
	}
	var po {{.ModelName}}PO
	if err := db.Where("organization_id = ? AND id = ?", organizationID, id).Take(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) FindAll(ctx context.Context, organizationID uint, page, pageSize int) ([]*domain.{{.ModelName}}, int64, error) {
	db, err := r.conn(ctx)
	if err != nil {
		return nil, 0, err
	}
	var (
		rows  []{{.ModelName}}PO
		total int64
	)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 15
	}

	scoped := func() *gorm.DB {
		return db.Model(&{{.ModelName}}PO{}).Where("organization_id = ?", organizationID)
	}
	if err := scoped().Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := scoped().Order("id desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	items := make([]*domain.{{.ModelName}}, 0, len(rows))
	for i := range rows {
		items = append(items, rows[i].toDomain())
	}
	return items, total, nil
}
`

const scopedRoutesTemplate = `package {{.PackageName}}

import "github.com/fastagi/fastbuild/api/internal/infra/router"

// RegisterRoutes registers HTTP routes for the {{.Package}} starter. Every route requires a signed-in
// member of the active organization; the organization_context middleware verifies the membership
// named by the Organization-Id header before a handler runs.
func (h *Handler) RegisterRoutes(r *router.Router) {
	r.Group("/{{.RouteCollection}}", func(group *router.Router) {
		group.WithMiddleware("auth", "organization_context")
		group.GET("", h.List).Name("{{.Package}}.index")
		group.POST("", h.Create).Name("{{.Package}}.store")
		group.GET("/:id", h.Get).Name("{{.Package}}.show").WhereNumber("id")
		group.PUT("/:id", h.Update).Name("{{.Package}}.update").WhereNumber("id")
		group.DELETE("/:id", h.Delete).Name("{{.Package}}.destroy").WhereNumber("id")
	})
}
`

const scopedServiceTestTemplate = `package {{.PackageName}}

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/fastagi/fastbuild/api/internal/domain"
)

// memoryRepository confines every operation to one organization, like the PostgreSQL repository.
type memoryRepository struct {
	items  map[uint]*domain.{{.ModelName}}
	nextID uint
}

var _ domain.{{.ModelName}}Repository = (*memoryRepository)(nil)

func newMemoryRepository() *memoryRepository {
	return &memoryRepository{items: map[uint]*domain.{{.ModelName}}{}}
}

func (m *memoryRepository) Create(_ context.Context, item *domain.{{.ModelName}}) error {
	m.nextID++
	item.ID = m.nextID
	stored := *item
	m.items[item.ID] = &stored
	return nil
}

func (m *memoryRepository) Update(_ context.Context, item *domain.{{.ModelName}}) error {
	stored, ok := m.items[item.ID]
	if !ok || stored.OrganizationID != item.OrganizationID {
		return domain.ErrNotFound
	}
	stored.Name = item.Name
	return nil
}

func (m *memoryRepository) Delete(_ context.Context, organizationID, id uint) error {
	stored, ok := m.items[id]
	if !ok || stored.OrganizationID != organizationID {
		return domain.ErrNotFound
	}
	delete(m.items, id)
	return nil
}

func (m *memoryRepository) FindByID(_ context.Context, organizationID, id uint) (*domain.{{.ModelName}}, error) {
	stored, ok := m.items[id]
	if !ok || stored.OrganizationID != organizationID {
		return nil, domain.ErrNotFound
	}
	found := *stored
	return &found, nil
}

func (m *memoryRepository) FindAll(_ context.Context, organizationID uint, _, _ int) ([]*domain.{{.ModelName}}, int64, error) {
	var items []*domain.{{.ModelName}}
	for _, stored := range m.items {
		if stored.OrganizationID == organizationID {
			found := *stored
			items = append(items, &found)
		}
	}
	return items, int64(len(items)), nil
}

func membership(organizationID uint, role domain.OrganizationRole) domain.OrganizationContext {
	return domain.OrganizationContext{
		OrganizationID: organizationID, OrganizationName: "Organization", OrganizationSlug: "organization",
		MembershipID: organizationID*10 + 1, UserID: organizationID*100 + 1, Role: role,
	}
}

func Test{{.ServiceName}}HidesAnotherOrganizationsRecords(t *testing.T) {
	svc := NewService(newMemoryRepository())
	ctx := context.Background()
	owner := membership(1, domain.OrganizationRoleOwner)
	outsider := membership(2, domain.OrganizationRoleOwner)

	created, err := svc.Create(ctx, owner, &Create{{.ModelName}}Request{Name: "Example"})
	require.NoError(t, err)
	assert.Equal(t, owner.OrganizationID, created.OrganizationID)

	_, err = svc.GetByID(ctx, outsider, created.ID)
	assert.ErrorIs(t, err, domain.ErrNotFound)

	renamed := "Taken"
	_, err = svc.Update(ctx, outsider, created.ID, &Update{{.ModelName}}Request{Name: &renamed})
	assert.ErrorIs(t, err, domain.ErrNotFound)
	assert.ErrorIs(t, svc.Delete(ctx, outsider, created.ID), domain.ErrNotFound)

	items, total, err := svc.List(ctx, outsider, 1, 15)
	require.NoError(t, err)
	assert.Empty(t, items)
	assert.Zero(t, total)

	unchanged, err := svc.GetByID(ctx, owner, created.ID)
	require.NoError(t, err)
	assert.Equal(t, "Example", unchanged.Name)
}

func Test{{.ServiceName}}LetsMembersReadAndOnlyManagersWrite(t *testing.T) {
	svc := NewService(newMemoryRepository())
	ctx := context.Background()
	admin := membership(1, domain.OrganizationRoleAdmin)
	member := membership(1, domain.OrganizationRoleMember)

	created, err := svc.Create(ctx, admin, &Create{{.ModelName}}Request{Name: "Example"})
	require.NoError(t, err)

	read, err := svc.GetByID(ctx, member, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, read.ID)

	_, err = svc.Create(ctx, member, &Create{{.ModelName}}Request{Name: "Denied"})
	assert.ErrorIs(t, err, domain.ErrPermissionDenied)
	assert.ErrorIs(t, svc.Delete(ctx, member, created.ID), domain.ErrPermissionDenied)

	_, err = svc.GetByID(ctx, domain.OrganizationContext{}, created.ID)
	assert.ErrorIs(t, err, domain.ErrOrganizationContextRequired)
}
`

const scopedRepositoryTestTemplate = `package {{.PackageName}}

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/fastagi/fastbuild/api/internal/domain"
	testplatform "github.com/fastagi/fastbuild/api/internal/infra/testing"
)

// {{.PackageName}}Table mirrors the starter migration without the organization foreign key, which
// would need the organization tables in this isolated schema.
const {{.PackageName}}Table = ` + "`" + `CREATE TABLE {{.TableName}} (
    id bigserial PRIMARY KEY,
    organization_id bigint NOT NULL,
    name varchar(255) NOT NULL,
    created_at timestamptz,
    updated_at timestamptz,
    deleted_at timestamptz
)` + "`" + `

// TestRepositoryConfinesEveryQueryToOneOrganizationPostgres runs when FASTBUILD_TEST_POSTGRES_DSN
// points at a disposable database. It proves the isolation in SQL, not in a test double.
func TestRepositoryConfinesEveryQueryToOneOrganizationPostgres(t *testing.T) {
	db := testplatform.OpenPostgres(t, nil)
	require.NoError(t, db.Exec({{.PackageName}}Table).Error)
	repo := NewRepository(db)
	ctx := context.Background()

	mine := &domain.{{.ModelName}}{OrganizationID: 1, Name: "Mine"}
	theirs := &domain.{{.ModelName}}{OrganizationID: 2, Name: "Theirs"}
	require.NoError(t, repo.Create(ctx, mine))
	require.NoError(t, repo.Create(ctx, theirs))
	assert.ErrorIs(t, repo.Create(ctx, &domain.{{.ModelName}}{Name: "Unowned"}), domain.ErrOrganizationContextRequired)

	_, err := repo.FindByID(ctx, 2, mine.ID)
	assert.ErrorIs(t, err, domain.ErrNotFound)
	assert.ErrorIs(t, repo.Update(ctx, &domain.{{.ModelName}}{ID: mine.ID, OrganizationID: 2, Name: "Taken"}), domain.ErrNotFound)
	assert.ErrorIs(t, repo.Delete(ctx, 2, mine.ID), domain.ErrNotFound)

	found, err := repo.FindByID(ctx, 1, mine.ID)
	require.NoError(t, err)
	assert.Equal(t, "Mine", found.Name)

	items, total, err := repo.FindAll(ctx, 1, 1, 15)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.EqualValues(t, 1, total)
	assert.Equal(t, mine.ID, items[0].ID)

	mine.Name = "Renamed"
	require.NoError(t, repo.Update(ctx, mine))
	require.NoError(t, repo.Delete(ctx, 1, mine.ID))
	_, err = repo.FindByID(ctx, 1, mine.ID)
	assert.ErrorIs(t, err, domain.ErrNotFound)
}
`

const scopedProviderTemplate = `package {{.PackageName}}

import (
	"github.com/google/wire"

	"github.com/fastagi/fastbuild/api/internal/domain"
	"github.com/fastagi/fastbuild/api/internal/infra/config"
	"github.com/fastagi/fastbuild/api/internal/starter/assembly"
)

// ProviderSet is the provider set for this starter.
var ProviderSet = wire.NewSet(
	NewRepository,
	wire.Bind(new(domain.{{.ModelName}}Repository), new(*repository)),
	NewService,
	wire.Bind(new(Service), new(*service)),
	NewHandler,
)

// NewStarterManifest describes the {{.Package}} starter: its dependencies, routes, and migrations.
// It depends on the organization starter, which owns the organization_context middleware.
func NewStarterManifest(handler *Handler) assembly.StarterManifest {
	return assembly.NewStaticStarterManifest(
		config.{{.StarterConst}},
		assembly.WithStarterSummary("TODO: describe the {{.Package}} starter in one line."),
		assembly.WithStarterDependencies(config.StarterUser, config.StarterAudit, config.StarterOrganization),
		assembly.WithStarterModule(handler),
		assembly.WithStarterMigrationNames("{{.MigrationID}}"),
	)
}
`

const scopedMigrationTemplate = `package migrations

import (
	"gorm.io/gorm"

	"github.com/fastagi/fastbuild/api/internal/infra/migration"
)

func init() {
	register("{{.MigrationID}}", &create{{.ModelName}}Table{
		BaseMigration: migration.BaseMigration{UseTransaction: true},
	})
}

type create{{.ModelName}}Table struct {
	migration.BaseMigration
}

// Up creates the organization-owned {{.TableName}} table as frozen SQL; later model changes need a
// new migration.
func (m *create{{.ModelName}}Table) Up(db *gorm.DB) error {
	return execStatements(db,
		` + "`" + `CREATE TABLE {{.TableName}} (
		    id bigserial NOT NULL,
		    organization_id bigint NOT NULL,
		    name varchar(255) NOT NULL,
		    created_at timestamptz,
		    updated_at timestamptz,
		    deleted_at timestamptz,
		    CONSTRAINT {{.TableName}}_pkey PRIMARY KEY (id),
		    CONSTRAINT {{.TableName}}_organization_fkey FOREIGN KEY (organization_id)
		        REFERENCES organizations (id) ON DELETE CASCADE
		)` + "`" + `,
		` + "`" + `CREATE INDEX idx_{{.TableName}}_organization_id ON {{.TableName}} (organization_id, id)` + "`" + `,
		` + "`" + `CREATE INDEX idx_{{.TableName}}_deleted_at ON {{.TableName}} (deleted_at)` + "`" + `,
	)
}

// Down drops the {{.TableName}} table.
func (m *create{{.ModelName}}Table) Down(db *gorm.DB) error {
	return execStatements(db, ` + "`" + `DROP TABLE IF EXISTS {{.TableName}} CASCADE` + "`" + `)
}
`

// scopedOpenAPIFragmentTemplate derives the organization-scoped contract from the unscoped one:
// every operation takes the Organization-Id header and can answer 400 and 403 for the context.
var scopedOpenAPIFragmentTemplate = scopeOpenAPIFragment(openAPIFragmentTemplate)

func scopeOpenAPIFragment(fragment string) string {
	const (
		security     = "      security:\n        - bearerSession: []\n"
		organization = "        - $ref: '#/components/parameters/OrganizationContext'\n"
		unauthorized = "        '401':\n          $ref: '#/components/responses/Unauthorized'\n"
		forbidden    = "        '403':\n          $ref: '#/components/responses/Forbidden'\n"
		invalid      = "        '400':\n          $ref: '#/components/responses/OrganizationContextInvalid'\n"
	)
	replacer := strings.NewReplacer(
		security+"      parameters:\n", security+"      parameters:\n"+organization,
		security+"      requestBody:\n", security+"      parameters:\n"+organization+"      requestBody:\n",
		security+"      responses:\n", security+"      parameters:\n"+organization+"      responses:\n",
		"        '400':\n          $ref: '#/components/responses/InvalidInput'\n", invalid,
		"PageResponse'\n"+unauthorized, "PageResponse'\n"+invalid+unauthorized+forbidden,
		unauthorized, unauthorized+forbidden,
		"resources owned by no one yet; add ownership before production use.",
		"resources owned by the active organization; members read, and owners and admins write.",
	)
	return replacer.Replace(fragment)
}

// scopedModuleTemplates maps each unscoped module template to its organization-scoped variant.
var scopedModuleTemplates = map[string]string{
	domainTemplate:      scopedDomainTemplate,
	modelTemplate:       scopedModelTemplate,
	serviceTemplate:     scopedServiceTemplate,
	handlerTemplate:     scopedHandlerTemplate,
	repositoryTemplate:  scopedRepositoryTemplate,
	routesTemplate:      scopedRoutesTemplate,
	serviceTestTemplate: scopedServiceTestTemplate,
	providerTemplate:    scopedProviderTemplate,
	migrationTemplate:   scopedMigrationTemplate,
}
