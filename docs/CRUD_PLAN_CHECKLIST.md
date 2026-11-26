# CRUD Resource Plan Checklist

The compact plan for one generated resource. It replaces the full
[business implementation plan](BUSINESS_IMPLEMENTATION_PLAN_STANDARD.md) only while every line
under "When this checklist is enough" holds. Answer each item in a sentence or less; an item you
cannot answer means the work needs the full standard.

## When This Checklist Is Enough

- The resource is created by `make:module` and keeps its shape: one table, list, get, create,
  update, delete.
- Ownership is one of the generator's scopes. Organization-owned data uses
  `--scope=organization`: members read, owners and admins write.
- No other module's tables, events, or contracts change.
- No money, credentials, personal data beyond a name, external call, or background job.
- No state machine: a record has no status that restricts what may happen next.

If any line is false, write the full plan.

## Plan

1. **Resource.** Singular name, table name, and the one-sentence reason it exists.
2. **Owner.** Organization or user. Who reads, who writes, and what a non-owner sees (not found).
3. **Fields.** Name, type, required or optional, limits, and uniqueness within the owner.
4. **Deletion.** Soft or hard, and what happens to it when its organization is deleted.
5. **Contract.** Paths and the error codes beyond the shared ones, written in the generated
   OpenAPI fragment before code.
6. **Clients.** Which of Web, Admin, desktop, and mobile show it, and where in the navigation.
7. **Acceptance.** Three to five observable statements, at least one for another organization
   or user being refused.

## Build

```bash
cd api && go run ./cmd/fastbuild make:module <name> --scope=organization
# edit the fragment in packages/contracts/fragments/, the fields, and the migration
make sync
make verify-changed
```

## Proof

- The generated service tests pass unmodified, then with the real fields.
- The generated PostgreSQL repository test passes with `FASTBUILD_TEST_POSTGRES_DSN` set.
- `make verify-changed` passes: it runs the organization-scope analyzer, the route catalog, and
  the contract gate.
- Each acceptance statement is covered by a named test.

## Stop And Write The Full Plan When

- a field needs a rule that depends on another record;
- a second resource must change in the same transaction;
- the resource must be visible across organizations to anyone but an operator;
- a client needs data this resource's contract does not return.
