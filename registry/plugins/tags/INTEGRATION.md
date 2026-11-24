# Tags — Integration Steps

`plugin:add` already copied the module, the migration, and the contract, wired the `tag` starter
into the API, and merged the contract fragment when Node.js was available. Complete these steps in
order; each has a check that must pass.

1. **Merge the contract fragment if `plugin:add` could not.** Skip when
   `packages/contracts/fragments/tags.yaml` no longer exists.
   `cd packages/contracts && corepack pnpm install && corepack pnpm merge-fragment fragments/tags.yaml`
2. **Regenerate the browser contract types.**
   `cd packages/contracts && corepack pnpm generate && corepack pnpm check`
3. **Regenerate Wire.** `cd apps/api && make wire`
4. **Enable the starter** in every environment that should serve it, next to `organization`:
   `OPTIONAL_STARTERS=organization,tag` (or `cd apps/api && go run ./cmd/fastbuild starter:enable tag`).
5. **Update generated records.** With a disposable PostgreSQL in `FASTBUILD_TEST_POSTGRES_DSN`:
   `cd apps/api && make starter-catalog && FASTBUILD_UPDATE_GOLDEN_SCHEMA=1 go test ./database/migrations -run Golden`
6. **Verify.** `cd apps/api && go test ./internal/modules/tag/... && make route-catalog-check`, then
   `cd packages/contracts && corepack pnpm check:routes`, then `make check` from the repository root.
7. **Register the resource types the builder wants tagged.** The starter ships with none, so every
   assignment route answers `404 TAG.RESOURCE_NOT_FOUND` until a module registers one. Ask the
   builder which records should carry tags; for each, edit the module that owns them, never the
   `tag` module. The owning module takes `*tag.ResourceTypes` in a Wire constructor and registers a
   lowercase snake_case type with a check that the resource exists in the organization. For the
   `knowledge` starter of the `knowledge-base` plugin:

   ```go
   // apps/api/internal/modules/knowledge/service.go
   func NewService(store store, tagTypes *tag.ResourceTypes) (*service, error) {
       err := tagTypes.Register("knowledge_article", func(ctx context.Context, organizationID uint, resourceID string) (bool, error) {
           id, parseErr := strconv.ParseUint(resourceID, 10, 64)
           if parseErr != nil || id == 0 || uint64(uint(id)) != id {
               return false, nil
           }
           _, getErr := store.Get(ctx, organizationID, uint(id))
           if errors.Is(getErr, ErrArticleNotFound) {
               return false, nil
           }
           return getErr == nil, getErr
       })
       return &service{store: store}, err
   }
   ```

   The check must answer `false` for another organization's resource. To drop a deleted
   resource's tags, inject `tag.Service` the same way and call
   `DetachResource(ctx, organizationID, tag.ResourceRef{Type: "knowledge_article", ID: id})` after
   the delete succeeds. Then `cd apps/api && make wire`, update the module's tests for the new
   constructor, and enable the owning starter wherever `tag` is enabled. Check:
   `cd apps/api && go test ./internal/modules/<module>/... ./internal/wiring/...`.
8. **Optional UI.** To let members see and pick tags, add a Web feature under
   `apps/web/src/features/tags` that calls the routes in `packages/contracts/TAGS.md` with the existing
   primitives, maps each `color` token to the theme, and binds its schemas to the contract with
   `assertContract`. Follow `apps/web/docs/ADDING_FEATURE.md`.

Ask the builder before letting members change assignments: the plugin limits tag and assignment
writes to organization owners and admins on purpose.
