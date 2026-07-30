---
description: Stage and commit changes following the project's conventional commit format, with a required Co-Author footer.
---

Commit all staged and unstaged changes following the project's commit conventions.

## Commit Conventions                                                                                                                         
                
Format: `type(scope): short description`

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code change that neither fixes a bug nor adds a feature
- `test` — adding or updating tests
- `docs` — documentation changes
- `chore` — build, tooling, config, or dependency changes
- `style` — formatting, whitespace (no logic change)

**Rules:**
- Subject line: imperative mood, lowercase, no period, max 72 characters
- Scope: optional, refers to the affected area (e.g. `api`, `frontend`, `docker`, `chart`)
- Body: optional, explains *why* not *what*, wrapped at 72 characters
- Reference the spec iteration or task ID where applicable (e.g. `refs T023`)

## Required Footer

Every commit must include a Co-Author footer:

`Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

## Steps

1. Run `git status` to see all changes
2. Run `git diff` to understand what changed
3. Stage relevant files — never stage `.env`, secrets, or unrelated changes
4. Draft a commit message following the conventions above
5. Commit with the required Co-Author footer
6. Run `git status` to confirm the commit succeeded