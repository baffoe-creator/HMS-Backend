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

## Phase 4 — Operational Management

| Step ID | Title | Status | Date | Test Gate Result | Notes |
|---|---|---|---|---|---|
| 4.1 | Bed/room management | IN PROGRESS | 2026-08-13 | Unit 5/5 PASS. Integration (`roomBed.integration.test.ts`): NOT YET RUN, needs Docker DB | Double-assignment prevention is enforced atomically at the DB level (UPDATE ... WHERE status='available'), not just checked in application code first - closes the race window between two concurrent admit requests |
| 4.2 | OT scheduling | IN PROGRESS | 2026-08-13 | Unit 6/6 PASS. Integration (`otBooking.integration.test.ts`): NOT YET RUN, needs Docker DB | `rooms_beds` gained a `room_type` column (ward/ot) rather than a separate theatres table, since OT rooms share the same occupancy/identity shape. Overlap check uses standard interval-overlap logic; back-to-back bookings (one ends exactly when the next starts) are allowed, not treated as a conflict |

## Phase 5 — Pharmacy & Billing

| Step ID | Title | Status | Date | Test Gate Result | Notes |
|---|---|---|---|---|---|
| 5.1 | Pharmacy inventory/formulary | IN PROGRESS | 2026-08-14 | Unit 4/4 PASS. Integration (`pharmacyInventory.integration.test.ts`): NOT YET RUN, needs Docker DB | Stock decrement is atomic (conditional UPDATE, same pattern as bed admission in 4.1) - two concurrent dispenses against low stock can't both succeed |
| 5.2 | Dispensing workflow | IN PROGRESS | 2026-08-14 | Unit 4/4 PASS. Integration (`dispense.integration.test.ts`): NOT YET RUN, needs Docker DB | Dispensing checks the prescription is `active` BEFORE touching inventory at all - a missing/inactive Rx never reaches the stock-decrement step. Successful dispense marks the prescription `completed`, so it can't be dispensed twice |
| 5.3 | Automated invoice generation | IN PROGRESS | 2026-08-14 | Unit 4/4 PASS. Integration (`billing.integration.test.ts`): NOT YET RUN, needs Docker DB | `total_amount` is always computed server-side from the line items, never trusted from request input - closes off a class of bug where client and server totals could silently drift apart |

## Phase 6 — NHIA eClaims Integration (Priority Module)

**Note:** Rebuilt against the real "Standardized e-claims interface for health providers' HIS,
XML Methodology (ver. 8.6)" spec document (previously only had a text description of it).
Field names, structure, and error codes below are now traceable to the actual spec, not a
reconstruction.

| Step ID | Title | Status | Date | Test Gate Result | Notes |
|---|---|---|---|---|---|
| 6.1 | Data dictionary & field mapping | IN PROGRESS | 2026-08-14 | Unit 4/4 PASS (`nhia.mapping.test.ts`) | `REQUIRED_FIELDS` list + `FIELD_MAP` registry; completeness test fails if any required field lacks a mapping |
| 6.2 | Async Claim XML generation | IN PROGRESS | 2026-08-14 | Unit 9/9 PASS (`nhia.xmlGenerator.test.ts`). Integration confirms real end-to-end generation | **Scope note**: generation is synchronous, not on a BullMQ/Redis worker queue - Redis has sat unused in docker-compose since Phase 0 with no queue infra ever wired up. Flagging honestly rather than pretending async infra exists. The generation *logic* itself is correct and tested; only the "runs on a background worker" part is deferred |
| 6.3 | Pre-submission validation rules | IN PROGRESS | 2026-08-14 | Unit 13/13 PASS (`nhia.validation.test.ts`) | Implements ~24 of the ~100 documented 2nd-verification-level error codes (203, 205, 207, 210, 212, 214, 218, 221, 230, 238, 240, 241, 244-247, 267-269, 292-293) — the ones our schema can verify without external master-table data (ICD-10/G-DRG/medicine formulary lookups are out of scope until those reference lists are integrated). Uses the REAL documented codes, not invented ones |
| 6.4 | Feedback XML ingestion & reconciliation | IN PROGRESS | 2026-08-14 | Unit 4/4 PASS (`nhia.feedback.test.ts`). Integration confirms real reconciliation end-to-end | Matches by ClaimIdentificationNumber; handles both 2nd-level (ErrorCode) and 3rd-level (ClaimRejectionReason + AdjustmentValue) feedback per the real spec's two Feedback XML shapes |
| 6.5 | NHIA sandbox certification | NOT STARTED | | N/A - no real NHIA sandbox access | Cannot be completed without actual NHIA credentials/environment. This is a genuine, permanent blocker until the hospital has real NHIA onboarding - not something I can simulate meaningfully |

### Real bug caught by writing the tests
`fast-xml-parser`'s default numeric coercion silently stripped leading zeros from
identifiers (e.g. reason code `"023"` → `23`). Fixed by setting `parseTagValue: false`
on the Feedback XML parser - every genuinely-numeric field (`AdjustmentValue`) is already
explicitly `Number()`-converted downstream, so this cost nothing and prevents real data
corruption on ingestion.
