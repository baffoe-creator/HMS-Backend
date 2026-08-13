import * as patientRepo from './patient.repository';
import { PatientRecord } from './patient.repository';

const EMERGENCY_COMPLETION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours, per Spec §3.2/§3.8

/**
 * Step 2.2 test gate: finds emergency registrations that are still open
 * (not completed, not already flagged) and older than the 24h window,
 * relative to `now` - which tests inject explicitly instead of relying on
 * wall-clock time, so the 24h boundary is deterministic to test.
 *
 * This is pure decision logic with no scheduling built in. A real cron/
 * worker (Phase 6/DevOps infra) calls this on a timer; for now it's also
 * reachable via POST /patients/emergency/flag-overdue for manual/admin use.
 */
export async function flagOverdueEmergencyRegistrations(
  now: Date = new Date(),
): Promise<PatientRecord[]> {
  const candidates = await patientRepo.findUnflaggedIncompleteEmergencyPatients();
  const overdue = candidates.filter((patient) => {
    const createdAt = new Date(patient.created_at);
    return now.getTime() - createdAt.getTime() >= EMERGENCY_COMPLETION_WINDOW_MS;
  });

  for (const patient of overdue) {
    await patientRepo.flagOverdue(patient.id);
  }

  return overdue;
}
