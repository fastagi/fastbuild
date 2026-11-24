# Domain Skills (`.agents/skills/domain/`)

Place product-specific domain knowledge and workflows here after initializing a
downstream application with `make init-project`.

## What Belongs Here

- Product domain models, state machines, and invariants (for example, billing
  ledgers, order fulfillment, or scheduling rules)
- Product-specific integration workflows and third-party API conventions
- Domain acceptance checks and regression playbooks

## Structure

Each skill lives in its own kebab-case directory with a `SKILL.md` and
`agents/openai.yaml`:

```text
.agents/skills/domain/<skill-name>/
  SKILL.md
  agents/openai.yaml
```

After adding a skill, validate it with:

```bash
bash .agents/skills/scripts/validate-skill.sh .agents/skills/domain/<skill-name>/SKILL.md
```
