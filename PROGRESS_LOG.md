# HMS Progress Log

Per the HMS Build Execution Plan, Section 0 (Resume Protocol): before starting any work,
read this file, find the last step marked `DONE`, and re-run its test gate to confirm it
still passes before moving on.

| Step ID | Title | Status | Date | Test Gate Result | Notes / Blockers |
|---|---|---|---|---|---|
| 0.1 | Repo & Tooling Init | DONE | 2026-08-13 | PASS - `docker-compose up`, lint, typecheck all verified on developer machine (Windows + Docker Desktop) | |
| 0.2 | DB Schema & Migrations | DONE | 2026-08-13 | PASS - `schema.test.ts` confirms all tables/FKs, `migrate:up`/`migrate:down` both verified | 16 migrations total (14 initial ERD tables + `mfa_confirmed` + sync/emergency fields on patients) |
| 0.3 | CI/CD Pipeline & Environments | IN PROGRESS | | GitHub Actions workflow verified locally (lint/typecheck/build all pass); not yet confirmed green on actual GitHub Actions run | `deploy-staging` job is still a placeholder pending a real staging host decision |
| 1.1 | User model, bcrypt hashing, JWT auth | DONE | 2026-08-13 | PASS - Unit 9/9 (100% line coverage on AuthService); Integration (`auth.integration.test.ts`) 3/3 on developer machine | **Deviation from spec**: used `bcryptjs` (pure JS) instead of `bcrypt` (native bindings) to avoid requiring node-gyp/build tools on Windows. Same hashing algorithm and API; no functional change |
| 1.2 | RBAC middleware | DONE | 2026-08-13 | PASS - Unit 3/3, full 7-role matrix covered | No DB dependency |
| 1.3 | MFA (TOTP) for Admin/Clinician | DONE | 2026-08-13 | PASS - Unit 4/4 | Used `otplib` v12 (not v13) - v13's async/plugin API is a bigger rewrite than warranted right now; flagged as a future improvement, not a blocker |
| 1.4 | Audit logging middleware | DONE | 2026-08-13 | PASS - Integration (`audit.integration.test.ts`) 2/2 on developer machine | Implemented via admin-only `PATCH /users/:id/status` endpoint - a real, reusable feature. Same `logAudit()` reused in Phase 2 |
| 2.1 | Standard patient registration | DONE | 2026-08-13 | PASS - Unit 12/12; Integration (`patient.integration.test.ts`) 4/4 on developer machine | Duplicate detection surfaces `duplicateOf` rather than blocking creation - staff make the final call |
| 2.2 | Emergency fast-track + 24h overdue monitor | DONE | 2026-08-13 | PASS - Unit 9/9; Integration (`patient.emergency.integration.test.ts`) 3/3 on developer machine | `flagOverdueEmergencyRegistrations()` is pure decision logic, callable via `POST /patients/emergency/flag-overdue` (admin-only, on-demand). A real recurring scheduler/cron is still deferred to DevOps infra work in a later phase |
| 2.3 (backend half) | Offline write queue - sync endpoint | DONE | 2026-08-13 | PASS - Unit 4/4; Integration (`patient.sync.integration.test.ts`) 3/3 on developer machine | Only the backend is built (`POST /patients/sync`, idempotent + conflict-detecting) |
| 2.0 | Frontend application scaffold | DONE | 2026-08-12 | PASS - lint, typecheck, `npm test` (1/1), `npm run build` all verified clean in sandbox | Vite + React 18 + TS, chosen over newer majors for ecosystem stability. Lives in separate `hms-frontend` project |
| 2.3 (frontend half) | Offline write-queue UI | NOT STARTED | | | Depends on 2.0 (done). The registration form + local write-queue UI itself hasn't been built yet - next piece of work |
| 2.4 | Appointment scheduling | DONE | 2026-08-13 | PASS - Unit 5/5; Integration (`appointment.integration.test.ts`) 3/3 on developer machine (confirmed in isolation after a flaky run under system load - see note below) | Fixed 30-min slots, 08:00-17:00 window (not configurable per doctor/department yet) |

## Debugging notes worth keeping

- **Boolean columns**: `mysql2` returns `TINYINT(1)` (how knex stores booleans) as raw `0`/`1` by
  default. Fixed via a `typeCast` function on the connection (`src/db/connection.ts`) so every
  boolean field returns a real `true`/`false` everywhere in the app, not just at one call site.
- **Date/time columns**: `mysql2` returns `DATE`/`DATETIME` as JS `Date` objects by default, which
  caused a false-positive "conflict" in the offline-sync idempotency check (string `'1980-07-07'` !==
  a `Date` object). Fixed via `dateStrings: true` on the connection, plus a `mysqlDatetimeToIsoUtc()`
  helper (`src/utils/datetime.ts`) for safely treating the resulting timezone-less strings as UTC.
  MySQL's strict mode also rejects ISO strings with `T`/`Z` written directly into a `DATETIME` column -
  fixed by converting to real `Date` objects before every write.
- **Test flakiness on Windows + Docker Desktop**: integration test hooks occasionally exceeded even a
  20s timeout under system load (confirmed via one run where every suite's duration inflated 2-3x
  uniformly, not just one). Raised to 40s and reduced DB pool `min` from 2 to 1 to reduce per-file
  connection overhead. If a suite times out, try running it in isolation first
  (`npx jest --runInBand --testTimeout=40000 test/<file>.test.ts`) before assuming a code regression.

## Phase 3 — Clinical Workflow

| Step ID | Title | Status | Date | Test Gate Result | Notes |
|---|---|---|---|---|---|
| 3.1 | ICD-10 reference tables + versioning | IN PROGRESS | 2026-08-13 | Unit 4/4 PASS. Integration (`icd.integration.test.ts`): NOT YET RUN, needs Docker DB | Seed script (`npm run seed:icd-codes`) loads a small starter set, NOT the full NHIA/WHO code list - flagged as a real-deployment gap, not a shortcut to silently forget about |
| 3.2 | EMR (diagnosis, vitals, history) | IN PROGRESS | 2026-08-13 | Unit 2/2 PASS. Integration (`clinicalRecord.integration.test.ts`): NOT YET RUN, needs Docker DB | Write access restricted to clinician/admin at the route level; every creation writes an audit_logs row via the same `logAudit()` from Step 1.4 |
| 3.3 | Lab order & results | IN PROGRESS | 2026-08-13 | Unit 6/6 PASS. Integration (`labOrder.integration.test.ts`): NOT YET RUN, needs Docker DB | Explicit state machine: ordered→{in_progress,cancelled}, in_progress→{completed,cancelled}, both completed/cancelled are terminal. Result required to complete |
| 3.4 | Prescription management + interaction/allergy checks | IN PROGRESS | 2026-08-13 | Unit 5/5 PASS. Integration (`prescription.integration.test.ts`): NOT YET RUN, needs Docker DB | Allergy match = hard block (409). Drug-interaction match = warning only, prescription still created - deliberately different behaviors per the spec wording. Seed script (`npm run seed:drug-interactions`) loads a tiny starter interaction set, not a real pharmacology database |
