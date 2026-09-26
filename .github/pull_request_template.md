## What
<!-- One or two lines: what this PR does. -->

## Why
<!-- Link the requirement (docs/ROADMAP.md P0/P1 item) or bug. -->

## How to test
<!-- Exact steps / curl / page to open. -->

## Checklist
- [ ] Only touches paths I own (see `docs/TEAM_PLAN.md`) — or the owner is tagged
- [ ] Rebased on latest `main` (`git pull --rebase origin main`)
- [ ] Matches the contract in `docs/API.md` (snake_case, error shape)
- [ ] Inputs validated (zod on the form, Pydantic on the API) with friendly messages
- [ ] No stock arithmetic in the frontend
- [ ] No secrets, `.env` or `*.db` committed
- [ ] CI green (lint + tests + build)
- [ ] Screenshot attached for UI changes
