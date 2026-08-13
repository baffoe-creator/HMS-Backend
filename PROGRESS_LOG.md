# HMS Progress Log

Per the HMS Build Execution Plan, Section 0 (Resume Protocol): before starting any work,
read this file, find the last step marked `DONE`, and re-run its test gate to confirm it
still passes before moving on.

| Step ID | Title | Status | Date | Test Gate Result | Notes / Blockers |
|---|---|---|---|---|---|
| 0.1 | Repo & Tooling Init | IN PROGRESS | | | Scaffold generated; awaiting local `docker-compose up` + lint/typecheck verification on developer machine |
| 0.2 | DB Schema & Migrations | IN PROGRESS | | | 14 migrations written covering full ERD; awaiting `migrate:up`/`migrate:down` verification against live MySQL |
| 0.3 | CI/CD Pipeline & Environments | IN PROGRESS | | | GitHub Actions workflow created; `deploy-staging` job is a placeholder pending a real staging host decision |
| 1.1 | User model, bcrypt hashing, JWT auth | IN PROGRESS | | Unit: PASS (9/9, 100% line coverage on AuthService) — see `npm run test:unit`. Integration (`auth.integration.test.ts`): NOT YET RUN, needs Docker DB | **Deviation from spec**: used `bcryptjs` (pure JS) instead of `bcrypt` (native bindings) to avoid requiring node-gyp/build tools on Windows. Same hashing algorithm and API; no functional change. |
| 1.2 | RBAC middleware | IN PROGRESS | | Unit: PASS (3/3, full role matrix covered) — see `npm run test:unit` | No DB dependency; fully verified in sandbox |
| 1.3 | MFA (TOTP) for Admin/Clinician | IN PROGRESS | | Unit: PASS (4/4) — see `npm run test:unit` | Used `otplib` v12 (not v13) - v13's async/plugin API is a bigger rewrite than warranted right now; flagged as a future improvement, not a blocker |
| 1.4 | Audit logging middleware | IN PROGRESS | | Integration (`audit.integration.test.ts`): NOT YET RUN, needs Docker DB | Implemented via admin-only `PATCH /users/:id/status` endpoint (deactivate/reactivate account) - a real, reusable feature, not just a test fixture. Same `logAudit()` call will be reused for patients/claims/etc. in later phases |
| 2.1 | Standard patient registration | IN PROGRESS | | Unit: PASS (12/12) — see `npm run test:unit`. Integration (`patient.integration.test.ts`): NOT YET RUN, needs Docker DB | Duplicate detection surfaces `duplicateOf` on the response rather than blocking creation - front-desk staff make the final call, matching real hospital workflow |
| 2.2 | Emergency fast-track + 24h overdue monitor | IN PROGRESS | | Unit: PASS (9/9 across patient.service + emergencyMonitor.service). Integration (`patient.emergency.integration.test.ts`): NOT YET RUN, needs Docker DB | **Scope note**: `flagOverdueEmergencyRegistrations()` is pure decision logic, callable now via `POST /patients/emergency/flag-overdue` (admin-only, on-demand). A real recurring scheduler/cron isn't wired up yet - that's DevOps infra work, deferred to a later phase; this function is what that scheduler will call |
| 2.3 | Offline write queue + sync endpoint | IN PROGRESS | | Unit: PASS (4/4 sync-specific cases). Integration (`patient.sync.integration.test.ts`): NOT YET RUN, needs Docker DB | **Scope note**: only the backend half is built (`POST /patients/sync`, idempotent + conflict-detecting). The frontend local-write-queue (browser-side storage + retry-on-reconnect) has no project to live in yet - no React/SPA has been scaffolded in any phase so far. Flagging this as a gap: a "Phase X: frontend scaffold" step should be added before that half of Step 2.3 can be built |
| 2.4 | Appointment scheduling | IN PROGRESS | | Unit: PASS (5/5). Integration (`appointment.integration.test.ts`): NOT YET RUN, needs Docker DB | Fixed 30-min slots, 08:00-17:00 window (not yet configurable per doctor/department - reasonable Phase 2 scope, revisit if real clinics need custom hours) |
