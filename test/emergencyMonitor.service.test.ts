import * as emergencyMonitor from '../src/modules/patients/emergencyMonitor.service';
import * as patientRepo from '../src/modules/patients/patient.repository';
import { PatientRecord } from '../src/modules/patients/patient.repository';

jest.mock('../src/modules/patients/patient.repository');
const mockedRepo = patientRepo as jest.Mocked<typeof patientRepo>;

function fakePatient(overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id: 1,
    surname: 'X',
    other_name: 'Y',
    dob: null,
    gender: 'male',
    member_number: null,
    temp_card_number: null,
    card_serial: null,
    hospital_record_number: null,
    is_infant: false,
    is_emergency: true,
    emergency_completed_at: null,
    emergency_flagged_at: null,
    client_temp_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Emergency registration overdue monitor - Step 2.2 gate', () => {
  afterEach(() => jest.resetAllMocks());

  it('flags a record created more than 24h before "now"', async () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    const overdue = fakePatient({ id: 1, created_at: '2026-08-10T11:00:00.000Z' }); // 25h old
    mockedRepo.findUnflaggedIncompleteEmergencyPatients.mockResolvedValue([overdue]);

    const result = await emergencyMonitor.flagOverdueEmergencyRegistrations(now);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(mockedRepo.flagOverdue).toHaveBeenCalledWith(1);
  });

  it('does NOT flag a record created less than 24h before "now"', async () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    const recent = fakePatient({ id: 2, created_at: '2026-08-11T00:00:00.000Z' }); // 12h old
    mockedRepo.findUnflaggedIncompleteEmergencyPatients.mockResolvedValue([recent]);

    const result = await emergencyMonitor.flagOverdueEmergencyRegistrations(now);

    expect(result).toHaveLength(0);
    expect(mockedRepo.flagOverdue).not.toHaveBeenCalled();
  });

  it('flags exactly at the 24h boundary', async () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    const exactlyBoundary = fakePatient({ id: 3, created_at: '2026-08-10T12:00:00.000Z' });
    mockedRepo.findUnflaggedIncompleteEmergencyPatients.mockResolvedValue([exactlyBoundary]);

    const result = await emergencyMonitor.flagOverdueEmergencyRegistrations(now);

    expect(result.map((p) => p.id)).toEqual([3]);
  });

  it('handles a mix of overdue and non-overdue records in one pass', async () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    mockedRepo.findUnflaggedIncompleteEmergencyPatients.mockResolvedValue([
      fakePatient({ id: 1, created_at: '2026-08-10T00:00:00.000Z' }), // 36h - overdue
      fakePatient({ id: 2, created_at: '2026-08-11T10:00:00.000Z' }), // 2h - not overdue
      fakePatient({ id: 3, created_at: '2026-08-09T00:00:00.000Z' }), // 60h - overdue
    ]);

    const result = await emergencyMonitor.flagOverdueEmergencyRegistrations(now);

    expect(result.map((p) => p.id).sort()).toEqual([1, 3]);
    expect(mockedRepo.flagOverdue).toHaveBeenCalledTimes(2);
  });
});
