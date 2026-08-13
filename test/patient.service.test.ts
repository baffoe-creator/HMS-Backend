import * as patientService from '../src/modules/patients/patient.service';
import * as patientRepo from '../src/modules/patients/patient.repository';
import { PatientRecord } from '../src/modules/patients/patient.repository';

jest.mock('../src/modules/patients/patient.repository');
const mockedRepo = patientRepo as jest.Mocked<typeof patientRepo>;

function fakePatient(overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id: 1,
    surname: 'Mensah',
    other_name: 'Ama',
    dob: '1990-01-01',
    gender: 'female',
    member_number: null,
    temp_card_number: null,
    card_serial: null,
    hospital_record_number: null,
    is_infant: false,
    is_emergency: false,
    emergency_completed_at: null,
    emergency_flagged_at: null,
    client_temp_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('PatientService', () => {
  afterEach(() => jest.resetAllMocks());

  describe('registerPatient - Step 2.1', () => {
    it('rejects registration missing a required field', async () => {
      await expect(
        patientService.registerPatient({ surname: 'Mensah' } as unknown as Parameters<
          typeof patientService.registerPatient
        >[0]),
      ).rejects.toBeInstanceOf(patientService.ValidationError);
      expect(mockedRepo.create).not.toHaveBeenCalled();
    });

    it('creates the patient and reports no duplicate when none exists', async () => {
      mockedRepo.findPossibleDuplicate.mockResolvedValue(undefined);
      mockedRepo.create.mockResolvedValue(fakePatient({ id: 5 }));

      const result = await patientService.registerPatient({
        surname: 'Mensah',
        otherName: 'Ama',
        dob: '1990-01-01',
        gender: 'female',
      });

      expect(result.patient.id).toBe(5);
      expect(result.duplicateOf).toBeNull();
    });

    it('flags duplicateOf when an existing patient matches surname+otherName+dob', async () => {
      const existing = fakePatient({ id: 1 });
      mockedRepo.findPossibleDuplicate.mockResolvedValue(existing);
      mockedRepo.create.mockResolvedValue(fakePatient({ id: 2 }));

      const result = await patientService.registerPatient({
        surname: 'Mensah',
        otherName: 'Ama',
        dob: '1990-01-01',
        gender: 'female',
      });

      // still creates the record - staff make the final call, per Step 2.1 design
      expect(mockedRepo.create).toHaveBeenCalled();
      expect(result.duplicateOf).toBe(1);
    });
  });

  describe('registerEmergencyPatient - Step 2.2', () => {
    it('accepts minimal fields (surname + gender only)', async () => {
      mockedRepo.create.mockResolvedValue(fakePatient({ is_emergency: true }));

      const result = await patientService.registerEmergencyPatient({
        surname: 'Unknown Patient',
        gender: 'male',
      });

      expect(mockedRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ surname: 'Unknown Patient', isEmergency: true }),
      );
      expect(result.is_emergency).toBe(true);
    });

    it('rejects emergency registration missing gender', async () => {
      await expect(
        patientService.registerEmergencyPatient({ surname: 'X' } as unknown as Parameters<
          typeof patientService.registerEmergencyPatient
        >[0]),
      ).rejects.toBeInstanceOf(patientService.ValidationError);
    });
  });

  describe('completeEmergencyRegistration - Step 2.2', () => {
    it('rejects completing a record that is not an open emergency', async () => {
      mockedRepo.findById.mockResolvedValue(fakePatient({ is_emergency: false }));

      await expect(
        patientService.completeEmergencyRegistration(1, { dob: '1990-01-01' }),
      ).rejects.toBeInstanceOf(patientService.ValidationError);
    });

    it('rejects completing a record that does not exist', async () => {
      mockedRepo.findById.mockResolvedValue(undefined);

      await expect(
        patientService.completeEmergencyRegistration(999, {}),
      ).rejects.toBeInstanceOf(patientService.NotFoundError);
    });
  });

  describe('offline sync reconciliation - Step 2.3', () => {
    const entry = {
      tempId: 'temp-abc-123',
      patient: { surname: 'Owusu', otherName: 'Kwabena', gender: 'male', dob: '1985-05-05' },
    };

    it('creates a new record and maps tempId -> permanent id on first sync', async () => {
      mockedRepo.findByClientTempId.mockResolvedValue(undefined);
      mockedRepo.create.mockResolvedValue(fakePatient({ id: 42 }));

      const result = await patientService.syncEntry(entry);

      expect(result.status).toBe('synced');
      expect(result.patientId).toBe(42);
      expect(mockedRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientTempId: 'temp-abc-123' }),
      );
    });

    it('is idempotent when the same tempId is resynced with identical data', async () => {
      mockedRepo.findByClientTempId.mockResolvedValue(
        fakePatient({ id: 42, surname: 'Owusu', other_name: 'Kwabena', dob: '1985-05-05' }),
      );

      const result = await patientService.syncEntry(entry);

      expect(result.status).toBe('already_synced');
      expect(result.patientId).toBe(42);
      expect(mockedRepo.create).not.toHaveBeenCalled();
    });

    it('flags a conflict when the same tempId is resynced with DIFFERENT data', async () => {
      mockedRepo.findByClientTempId.mockResolvedValue(
        fakePatient({ id: 42, surname: 'Owusu', other_name: 'Kwabena', dob: '1985-05-05' }),
      );

      const conflictingEntry = {
        tempId: 'temp-abc-123',
        patient: { surname: 'Owusu', otherName: 'Kwabena', gender: 'male', dob: '1999-09-09' },
      };

      const result = await patientService.syncEntry(conflictingEntry);

      expect(result.status).toBe('conflict');
      expect(result.conflictWithId).toBe(42);
      expect(mockedRepo.create).not.toHaveBeenCalled();
    });

    it('processes a batch sequentially and reports a result per entry', async () => {
      mockedRepo.findByClientTempId.mockResolvedValue(undefined);
      mockedRepo.create
        .mockResolvedValueOnce(fakePatient({ id: 1 }))
        .mockResolvedValueOnce(fakePatient({ id: 2 }));

      const results = await patientService.syncBatch([
        { tempId: 't1', patient: { surname: 'A', otherName: 'B', gender: 'male' } },
        { tempId: 't2', patient: { surname: 'C', otherName: 'D', gender: 'female' } },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('synced');
      expect(results[1].status).toBe('synced');
    });
  });
});
