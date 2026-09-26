# Contributing

Four people, seven hours, one `main`. These rules exist so nobody spends hour 6 resolving merge conflicts.

## 1. Golden rules
1. **Edit only files you own** ([ownership map](docs/TEAM_PLAN.md#file-ownership)). CODEOWNERS will auto-request the owner's review if you don't.
2. **Never commit to `main` directly.** Work on your branch, merge through a PR.
3. **Rebase often** (about every 45 minutes) and push small PRs early.
4. **The API contract is frozen** ([docs/API.md](docs/API.md)). Changing a field name means telling the team and updating the doc in the same PR.
5. **No stock arithmetic in the frontend.** Stock changes only through `POST /api/operations/{id}/validate`.
6. **Commit from your own GitHub account.** The judges look at who did what.

## 2. Branches

| Member | Branch |
|---|---|
| M1 | `feat/backend-core` (later `feat/inventory-engine`, `feat/ledger`, …) |
| M2 | `feat/frontend-shell` (later `feat/products-ui`, `feat/warehouses-ui`, …) |
| M3 | `feat/operations-ui` |
| M4 | `feat/auth-dashboard` (later `feat/move-history`, `feat/otp-reset`, …) |

Short-lived is better: one branch per feature, merged within ~1 hour.

## 3. Daily loop

```bash
# start a feature
git switch main && git pull
git switch -c feat/<name>

# ... work, commit small and often ...
git add <your files>            # never `git add -A` blindly; check `git status` first
git commit -m "feat(products): add SKU search"

# sync with main (every ~45 min and before opening a PR)
git fetch origin
git rebase origin/main          # resolve conflicts (should be rare if you stay in your files)
git push --force-with-lease     # safe force push of your own rebased branch

# open PR → CI green → owner/teammate approves → "Rebase and merge" (or "Create a merge commit")
```

**Never "Squash and merge".** It collapses your commits into one authored by whoever clicks the button, which erases per-member history.

If a rebase goes wrong: `git rebase --abort` and ask for help. Don't force-push `main`, ever.

## 4. Commit messages ([Conventional Commits](https://www.conventionalcommits.org/))

```
<type>(<scope>): <imperative summary, ≤ 72 chars>

optional body: what and why
```

| type | use for |
|---|---|
| `feat` | new user-visible behavior |
| `fix` | bug fix |
| `refactor` | code change without behavior change |
| `test` | tests only |
| `docs` | documentation only |
| `style` | formatting, no logic |
| `chore` | deps, config, tooling |
| `ci` | GitHub Actions |

Scopes: `backend`, `db`, `inventory`, `operations`, `ledger`, `products`, `warehouses`, `auth`, `dashboard`, `ui`, `deploy`.

Examples: `feat(inventory): validate deliveries with row locks`, `fix(auth): lock account after 5 failed logins`, `feat(ui): add status badges to receipts list`.

## 5. Pull requests
- Use the PR template checklist.
- Keep a PR under ~300 changed lines when possible.
- UI PRs include a screenshot.
- Review within 10 minutes when tagged. A quick "LGTM + run it" beats a perfect review at hour 6.
- CI (lint + tests + build) must be green before merge.

## 6. Code style

### Python (backend)
- Python 3.12, type hints everywhere, **ruff** for lint + format (`ruff check . && ruff format .`).
- Layers: `routes → services → models` (see [ARCHITECTURE](docs/ARCHITECTURE.md#3-backend-layers)). Routes never touch the DB session for writes; services never raise `HTTPException`.
- Names: `snake_case` functions/vars, `PascalCase` classes, plural table names, `*_id` for FKs.
- Raise domain errors (`InsufficientStock`, `InvalidState`, …) from services; `errors.py` maps them to HTTP.
- Every service function that changes stock has a pytest.

### TypeScript (frontend)
- Strict TS, **eslint** (Next.js config) + **prettier**.
- Components `PascalCase.tsx`; hooks `useThing.ts`; route folders kebab-case.
- API calls only via `lib/api.ts`; types only from `lib/types.ts` (they mirror `docs/API.md`, snake_case fields as-is, no renaming).
- Forms: react-hook-form + zod; show server `field_errors` on the matching fields.
- Use shadcn/ui primitives and Tailwind tokens. No ad-hoc colors (see UI conventions in ARCHITECTURE).

## 7. Dependencies
All expected dependencies are added in the scaffold commits. Need a new one? Ask the file owner (M1 for `requirements.txt`, M2 for `package.json`). They add it in a tiny separate PR, so lockfile conflicts never happen in feature branches.

## 8. Database changes
Only **Member 1** changes models or creates Alembic migrations (avoids "multiple heads"). Need a column? Ask M1.

## 9. Secrets
Never commit `.env`, keys, passwords or database files. Copy `.env.example` → `.env` locally. If a secret is committed by mistake: tell the team, rotate it, then remove it from the repo.
