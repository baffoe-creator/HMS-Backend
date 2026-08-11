# HMS Backend — Phase 0 Scaffold

Foundation scaffold for the Hospital Management System backend, covering Steps 0.1–0.3
of the HMS Build Execution Plan. See `PROGRESS_LOG.md` for current status.

## What's included
- Node.js + TypeScript + Express, with a `/health` endpoint
- ESLint + Prettier + Husky pre-commit hook
- Docker Compose (MySQL 8 + Redis 7) for local dev
- Knex migrations for all 14 tables in the Technical Spec ERD
- Jest test suite: `test/health.test.ts` (unit, no DB) and `test/schema.test.ts` (integration, needs DB)
- GitHub Actions CI pipeline (`.github/workflows/ci.yml`)

## Windows + VS Code setup — run these in order

See `WINDOWS_VSCODE_SETUP.md` for the full step-by-step walkthrough with exact commands.
