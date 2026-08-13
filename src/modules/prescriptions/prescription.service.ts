import * as prescriptionRepo from './prescription.repository';
import { PrescriptionRecord } from './prescription.repository';

export class ValidationError extends Error {
  statusCode = 400;
}
export class AllergyBlockError extends Error {
  statusCode = 409;
}

export interface CreatePrescriptionInput {
  patientId: number;
  clinicianId: number;
  medicineCode: string;
  dosage: string;
  instructions?: string;
  prescribedDate: string;
}

export interface PrescriptionResult {
  prescription: PrescriptionRecord;
  interactionWarning: { withMedicineCode: string; severity: string; description: string } | null;
}

/**
 * Step 3.4 gate: two distinct checks with two distinct outcomes.
 *  - Allergy match -> hard block (never creates the prescription).
 *  - Drug-interaction match against an existing active prescription -> soft
 *    warning surfaced on the response, but the prescription is still created
 *    (matches the same "flag, don't block" pattern used for duplicate
 *    patient detection in Step 2.1 - the clinician makes the final call).
 */
export async function createPrescription(input: CreatePrescriptionInput): Promise<PrescriptionResult> {
  if (!input.patientId || !input.clinicianId || !input.medicineCode || !input.dosage || !input.prescribedDate) {
    throw new ValidationError('patientId, clinicianId, medicineCode, dosage, and prescribedDate are required');
  }

  const allergies = await prescriptionRepo.findAllergiesByPatient(input.patientId);
  const allergyMatch = allergies.find(
    (a) => a.allergen.toLowerCase() === input.medicineCode.toLowerCase(),
  );
  if (allergyMatch) {
    throw new AllergyBlockError(
      `Cannot prescribe ${input.medicineCode}: patient has a logged allergy to this substance`,
    );
  }

  const activePrescriptions = await prescriptionRepo.findActiveByPatient(input.patientId);
  let interactionWarning: PrescriptionResult['interactionWarning'] = null;
  for (const existing of activePrescriptions) {
    const interaction = await prescriptionRepo.findInteraction(input.medicineCode, existing.medicine_code);
    if (interaction) {
      interactionWarning = {
        withMedicineCode: existing.medicine_code,
        severity: interaction.severity,
        description: interaction.description,
      };
      break;
    }
  }

  const prescription = await prescriptionRepo.create(input);
  return { prescription, interactionWarning };
}
