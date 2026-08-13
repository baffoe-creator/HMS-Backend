import * as clinicalRecordService from '../src/modules/clinicalRecords/clinicalRecord.service';
import * as clinicalRecordRepo from '../src/modules/clinicalRecords/clinicalRecord.repository';
import { ClinicalRecord } from '../src/modules/clinicalRecords/clinicalRecord.repository';
import * as auditService from '../src/modules/audit/audit.service';

jest.mock('../src/modules/clinicalRecords/clinicalRecord.repository');
jest.mock('../src/modules/audit/audit.service');
const mockedRepo = clinicalRecordRepo as jest.Mocked<typeof clinicalRecordRepo>;
const mockedAudit = auditService as jest.Mocked<typeof auditService>;

function fakeRecord(overrides: Partial<ClinicalRecord> = {}): ClinicalRecord {
  return {
    id: 1,
    patient_id: 1,
    clinician_id: 10,
    vitals: null,
    history: null,
    diagnosis_icd_code: null,
    notes: null,
    encounter_date: '2026-08-13',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('ClinicalRecordService - Step 3.2 gate', () => {
  afterEach(() => jest.resetAllMocks());

  it('creates a record and writes a matching audit log entry', async () => {
    mockedRepo.create.mockResolvedValue(fakeRecord());

    await clinicalRecordService.createRecord(
      { patientId: 1, clinicianId: 10, encounterDate: '2026-08-13' },
      10,
    );

    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 10, action: 'CREATE', tableName: 'clinical_records' }),
    );
  });

  it('rejects a record missing required fields', async () => {
    await expect(
      clinicalRecordService.createRecord(
        { clinicianId: 10 } as unknown as Parameters<typeof clinicalRecordService.createRecord>[0],
        10,
      ),
    ).rejects.toBeInstanceOf(clinicalRecordService.ValidationError);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });
});
