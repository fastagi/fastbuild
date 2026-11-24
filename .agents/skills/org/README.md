# Organization Skills (`.agents/skills/org/`)

Place company-wide engineering standards and compliance workflows here when
building a downstream application on FastBuild.

## What Belongs Here

- Internal security, compliance, or data-classification review workflows
- Organization-specific CI/CD, deployment, or incident-response conventions
- Shared internal SDK, design-system, or observability conventions

## Structure

Each skill lives in its own kebab-case directory with a `SKILL.md` and
`agents/openai.yaml`:

```text
.agents/skills/org/<skill-name>/
  SKILL.md
  agents/openai.yaml
```

After adding a skill, validate it with:

```bash
bash .agents/skills/scripts/validate-skill.sh .agents/skills/org/<skill-name>/SKILL.md
```
