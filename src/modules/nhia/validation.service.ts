import type { ClaimBundle } from './claimBundle.repository';

export interface ValidationIssue {
  code: string;
  message: string;
}

const VALID_SERVICE_TYPES = ['OUT', 'INP', 'DIA', 'CAP'];
const VALID_OUTCOME_TYPES = ['ABS', 'DAA', 'DIE', 'DIS', 'TFR'];
const VALID_ADMISSION_TYPES = ['CRO', 'EME', 'ACU'];

function isValidIsoDate(value: string | null): boolean {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Step 6.3 gate. Error codes below are the real NHIA "2nd verification
 * level" codes from Appendix X.4 of the spec - this is a scoped subset
 * (~24 of the ~100 documented rules), not the full rule set. Chosen for
 * structural/financial correctness checks our schema can actually verify;
 * rules dependent on external master tables (ICD-10, G-DRG, medicine
 * formulary validity - e.g. 265, 275, 281, 285-287) are out of scope until
 * those reference tables are integrated with NHIA's actual published lists.
 */
export function validateClaimBundle(bundle: ClaimBundle): ValidationIssue[] {
  const { claim, patient, treatments, medicines } = bundle;
  const issues: ValidationIssue[] = [];

  function fail(code: string, message: string) {
    issues.push({ code, message });
  }

  // --- Patient-level ---
  if (!patient.temp_card_number) {
    if (!patient.member_number || patient.member_number.length < 8) {
      fail('203', 'MemberNumber is required (min length 8) when TemporaryCardNumber is empty');
    }
  }
  if (!patient.member_number && !patient.temp_card_number) {
    fail('236', 'Neither TemporaryCardNumber nor MemberNumber is filled');
  }
  if (!['F', 'M'].includes(patient.gender.toUpperCase().charAt(0))) {
    fail('205', 'Gender must be F or M');
  }

  // --- Claim-level structural ---
  if (!VALID_SERVICE_TYPES.includes(claim.service_type)) {
    fail('207', `ServiceType "${claim.service_type}" is not one of OUT/INP/DIA/CAP`);
  }
  if (!VALID_OUTCOME_TYPES.includes(claim.outcome_type)) {
    fail('210', `OutcomeType "${claim.outcome_type}" is not one of ABS/DAA/DIE/DIS/TFR`);
  }
  if (claim.admission_type && !VALID_ADMISSION_TYPES.includes(claim.admission_type)) {
    fail('212', `AdmissionType "${claim.admission_type}" is not one of CRO/EME/ACU`);
  }
  if (!isValidIsoDate(claim.admission_date)) {
    fail('214', 'AdmissionDate is missing or not a valid date');
  }
  if (claim.total_cost === null || claim.total_cost === undefined || Number(claim.total_cost) < 0) {
    fail('218', 'TotalCost is missing or negative');
  }

  // --- Diagnosis requirement (221) ---
  if (['OUT', 'INP', 'CAP'].includes(claim.service_type)) {
    const hasDiagnosis = treatments.some((t) => t.type === 'Diagnosis');
    if (!hasDiagnosis) {
      fail('221', 'At least one Treatment with Type "Diagnosis" is required for OUT/INP/CAP claims');
    }
  }

  // --- Medicine total reconciliation (230) ---
  for (const m of medicines) {
    const expected = Number((Number(m.quantity) * Number(m.unit_price)).toFixed(2));
    if (Number(m.medicine_total) !== expected) {
      fail(
        '230',
        `MedicineTotal for ${m.medicine_code} (${m.medicine_total}) does not equal Quantity * UnitPrice (${expected})`,
      );
    }
  }

  // --- TotalCost reconciliation (238) ---
  // Per spec: TotalCost must equal OutPatientTariffAmount + InPatientTariffAmount +
  // Tariff (Investigation-type treatments only) + sum(MedicineTotal).
  const investigationTariffSum = treatments
    .filter((t) => t.type === 'Investigation')
    .reduce((sum, t) => sum + Number(t.tariff ?? 0), 0);
  const medicineTotalSum = medicines.reduce((sum, m) => sum + Number(m.medicine_total), 0);
  const expectedTotalCost = Number(
    (
      Number(claim.out_patient_tariff_amount ?? 0) +
      Number(claim.in_patient_tariff_amount ?? 0) +
      investigationTariffSum +
      medicineTotalSum
    ).toFixed(2),
  );
  if (Number(claim.total_cost) !== expectedTotalCost) {
    fail(
      '238',
      `TotalCost (${claim.total_cost}) does not equal OutPatientTariffAmount + InPatientTariffAmount + Investigation Tariffs + MedicineTotal (${expectedTotalCost})`,
    );
  }

  // --- Service-type-specific structural rules ---
  const hasInvestigation = treatments.some((t) => t.type === 'Investigation');
  const hasProcedure = treatments.some((t) => t.type === 'Procedure');
  const hasDiagnosis = treatments.some((t) => t.type === 'Diagnosis');

  if (claim.service_type === 'DIA') {
    if (!hasInvestigation) fail('240', 'A DIA claim must specify at least one investigation');
    if (hasProcedure) fail('267', 'A DIA claim must not specify a procedure');
    if (hasDiagnosis) fail('268', 'A DIA claim must not specify a diagnosis');
    if (medicines.length > 0) fail('269', 'A DIA claim must not specify a medicine');
    if (claim.duration_length) fail('293', 'A DIA claim must not specify DurationLength');
  }

  if (['OUT', 'INP'].includes(claim.service_type) && hasInvestigation) {
    fail('241', 'An OUT or INP claim must not specify an investigation');
  }

  if (claim.service_type === 'OUT') {
    if (!claim.out_patient_code) fail('244', 'An OUT claim must specify exactly one OutPatientCode');
    if (claim.in_patient_tariff_amount) fail('245', 'An OUT claim must not specify InPatientTariffAmount');
    if (claim.duration_length) fail('293', 'An OUT claim must not specify DurationLength');
  }

  if (claim.service_type === 'INP') {
    if (!claim.in_patient_code) fail('246', 'An INP claim must specify exactly one InPatientCode');
    if (claim.out_patient_tariff_amount) fail('247', 'An INP claim must not specify OutPatientTariffAmount');
    if (!claim.duration_length) fail('292', 'An INP claim must specify DurationLength');
  }

  return issues;
}

export function isClaimValid(bundle: ClaimBundle): boolean {
  return validateClaimBundle(bundle).length === 0;
}
