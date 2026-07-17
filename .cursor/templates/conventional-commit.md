# Conventional Commit Template

Use this format for every git commit in this repository.

## Message structure

```text
<type>(<optional-scope>): <description>

[optional body]

[optional footer(s)]
```

## Header rules

- **type** (required): one of the allowed types below
- **scope** (optional): short noun for the area touched (`server`, `prisma`, `health`, `logger`, `auth`, `api`, `deps`, `ci`)
- **description** (required):
  - imperative mood (“add”, “fix”, “update” — not “added” / “fixes”)
  - lowercase start
  - no trailing period
  - ≤ 72 characters for the full first line
  - explain **why** / outcome, not a file list

## Allowed types

| Type | When to use |
|------|-------------|
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `refactor` | Code change with no behavior change |
| `style` | Formatting only (no logic change) |
| `docs` | Documentation only |
| `test` | Tests only |
| `build` | Build system, bundler, or native compile config |
| `ci` | CI/CD pipelines and workflows |
| `chore` | Maintenance that is not `feat`/`fix`/`refactor` (tooling, ignore files) |
| `deps` | Dependency adds/updates/removes |
| `revert` | Reverts a previous commit |

## Body (optional)

- Wrap at ~72 characters
- Explain motivation and context the diff does not show
- Use bullet lists for multiple distinct changes in one commit
- Prefer one logical change per commit; split unrelated work

## Footers (optional)

```text
BREAKING CHANGE: <description of the break and migration notes>
Refs: #123
Closes: #456
Co-authored-by: Name <email@example.com>
```

- Breaking changes **must** use a `BREAKING CHANGE:` footer
- Optionally mark the type with `!` as well: `feat(api)!: remove v1 endpoints`

## Good examples

```text
feat(health): add database readiness probe

Expose GET /health that runs SELECT 1 so load balancers can
detect Prisma connectivity failures early.
```

```text
fix(logger): enable pino-pretty in local development

Load dotenv before Nest bootstraps so NODE_ENV is set when
the Pino transport config is evaluated.
```

```text
deps(server): add Prisma PostgreSQL driver adapter

Prisma 7 requires an explicit adapter when constructing
PrismaClient.
```

```text
chore(ts): remove deprecated baseUrl from tsconfig

Replace src/-prefixed imports with relative paths so the
project is ready for TypeScript 7.
```

```text
feat(api)!: drop legacy redirect query params

BREAKING CHANGE: `?to=` is no longer accepted; clients must
use the path-based short-code route only.
```

## Bad examples

```text
# Too vague
update stuff

# Past tense / file dump
Updated prisma.service.ts and package.json

# Wrong type for a user-facing change
chore: add health endpoint

# First line too long / ends with period
feat(server): implement a comprehensive health checking subsystem for production readiness.
```

## Commit hygiene checklist

- [ ] Diff reviewed; no secrets (`.env`, keys, tokens)
- [ ] Single logical change (or clearly related changes)
- [ ] Type/scope match the actual diff
- [ ] Description is imperative and specific
- [ ] Breaking changes called out in footer when applicable
- [ ] Tests or docs updated when behavior/public API changes
