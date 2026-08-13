import * as prescriptionService from '../src/modules/prescriptions/prescription.service';
import * as prescriptionRepo from '../src/modules/prescriptions/prescription.repository';
import { PrescriptionRecord } from '../src/modules/prescriptions/prescription.repository';

jest.mock('../src/modules/prescriptions/prescription.repository');
const mockedRepo = prescriptionRepo as jest.Mocked<typeof prescriptionRepo>;

function fakePrescription(overrides: Partial<PrescriptionRecord> = {}): PrescriptionRecord {
  return {
    id: 1,
    patient_id: 1,
    clinician_id: 10,
    medicine_code: 'ASPIRIN',
    dosage: '75mg daily',
    instructions: null,
    status: 'active',
    prescribed_date: '2026-08-13',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const BASE_INPUT = {
  patientId: 1,
  clinicianId: 10,
  medicineCode: 'WARFARIN',
  dosage: '5mg daily',
  prescribedDate: '2026-08-13',
};

describe('PrescriptionService - Step 3.4 gate', () => {
  afterEach(() => jest.resetAllMocks());

  it('creates a prescription with no warning when nothing conflicts', async () => {
    mockedRepo.findAllergiesByPatient.mockResolvedValue([]);
    mockedRepo.findActiveByPatient.mockResolvedValue([]);
    mockedRepo.create.mockResolvedValue(fakePrescription({ medicine_code: 'WARFARIN' }));

    const result = await prescriptionService.createPrescription(BASE_INPUT);

    expect(result.interactionWarning).toBeNull();
    expect(mockedRepo.create).toHaveBeenCalled();
  });

  it('hard-blocks a prescription when the patient has a logged allergy to it', async () => {
    mockedRepo.findAllergiesByPatient.mockResolvedValue([{ id: 1, allergen: 'WARFARIN' }]);

    await expect(prescriptionService.createPrescription(BASE_INPUT)).rejects.toBeInstanceOf(
      prescriptionService.AllergyBlockError,
    );
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('allergy match is case-insensitive', async () => {
    mockedRepo.findAllergiesByPatient.mockResolvedValue([{ id: 1, allergen: 'warfarin' }]);
    await expect(prescriptionService.createPrescription(BASE_INPUT)).rejects.toBeInstanceOf(
      prescriptionService.AllergyBlockError,
    );
  });

  it('surfaces a drug-interaction warning but still creates the prescription', async () => {
    mockedRepo.findAllergiesByPatient.mockResolvedValue([]);
    mockedRepo.findActiveByPatient.mockResolvedValue([fakePrescription({ medicine_code: 'ASPIRIN' })]);
    mockedRepo.findInteraction.mockResolvedValue({
      severity: 'severe',
      description: 'Increased risk of bleeding when combined',
    });
    mockedRepo.create.mockResolvedValue(fakePrescription({ medicine_code: 'WARFARIN' }));

    const result = await prescriptionService.createPrescription(BASE_INPUT);

    expect(result.interactionWarning).not.toBeNull();
    expect(result.interactionWarning?.withMedicineCode).toBe('ASPIRIN');
    expect(result.interactionWarning?.severity).toBe('severe');
    expect(mockedRepo.create).toHaveBeenCalled(); // NOT blocked, unlike the allergy case
  });

  it('rejects a prescription missing required fields', async () => {
    await expect(
      prescriptionService.createPrescription({ patientId: 1 } as unknown as Parameters<
        typeof prescriptionService.createPrescription
      >[0]),
    ).rejects.toBeInstanceOf(prescriptionService.ValidationError);
  });
});
