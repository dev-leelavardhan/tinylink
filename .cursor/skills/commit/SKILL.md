---
name: commit
description: >-
  Draft a Conventional Commits summary into commit.txt only. Use when the user
  runs /commit. Does not stage or create git commits unless the user explicitly
  asks to apply/commit afterward.
disable-model-invocation: true
---

# /commit — Draft commit.txt only

**`/commit` does not create a git commit.**

It only analyzes changes and writes (overwrites) `commit.txt` at the repo root
for the user to review. Do **not** run `git add` or `git commit` during `/commit`.

Read [`.cursor/templates/conventional-commit.md`](../../templates/conventional-commit.md)
before drafting. Follow it exactly.

## Safety (non-negotiable)

- **Do not commit** — no `git add`, no `git commit`, no amend, no push
- **Do not commit `commit.txt`** — never stage it; leave it untracked
- Never update git config
- Never include secret values from `.env` or similar in `commit.txt`

## Workflow

Run these in parallel first:

1. `git status`
2. `git diff` and `git diff --staged`
3. `git log -8 --oneline` (if history exists; still use Conventional Commits)

Then:

4. Read `.cursor/templates/conventional-commit.md`
5. Analyze staged + unstaged changes
6. Draft one or more Conventional Commit messages (split unrelated concerns in Notes)
7. **Write `commit.txt` at the repo root** (overwrite) using the format below
8. Stop. Tell the user `commit.txt` is ready for review

## commit.txt format

```text
Commit summary for current active changes

Proposed message:
<type>(<scope>): <description>

<required body>

Changes:
- <bullet summarizing a distinct change>
- <bullet ...>

Notes:
- <optional: proposed split commits, skipped files, secrets excluded, etc.>
```

Rules:

- Scope is **required**: `type(scope): description`
- Imperative, lowercase description; no trailing period; first line ≤ 72 chars
- Body is **required**
- Outcome-focused bullets (not a raw file dump)
- If unrelated changes exist, list separate proposed messages under Notes — still do not commit

## Message selection guide

| Diff signal | Type |
|-------------|------|
| New endpoint, module, or user-visible behavior | `feat` |
| Corrects broken behavior | `fix` |
| Faster / fewer queries / less allocations | `perf` |
| Restructure with same behavior | `refactor` |
| Formatting / lint-only | `style` |
| README, comments-as-docs | `docs` |
| Specs / e2e only | `test` |
| package.json / lockfile dependency changes | `deps` |
| Nest/TS/Prisma build config | `build` |
| GitHub Actions / pipelines | `ci` |
| Scaffolding, ignore files, non-feature churn | `chore` |

Scopes: `server`, `prisma`, `health`, `logger`, `config`, `auth`, `api`, `deps`, `ci`, `cursor`.

## Applying the commit later

Only if the user **explicitly** asks to apply/create the git commit (e.g. “commit it”, “apply commit.txt”):

1. Follow the user git safety rules
2. Stage the relevant files from `commit.txt` — **never** stage `commit.txt`
3. Commit using the proposed message from `commit.txt`
4. Confirm `commit.txt` remains untracked

Until that explicit ask: **draft only**.

## Output to the user

- Confirm `commit.txt` was written/updated
- Show the proposed subject line(s)
- Remind that nothing was committed
