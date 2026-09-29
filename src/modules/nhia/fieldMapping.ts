import type { ClaimBundle } from './claimBundle.repository';
import { toNhiaDate } from './dateFormat';

/**
 * Step 6.1: the data dictionary. Every NHIA XML element that this system
 * populates has exactly one entry here, mapping it to a resolver function
 * over a ClaimBundle. The `mapping.test.ts` completeness test iterates
 * REQUIRED_FIELDS and fails the build if any of them lacks an entry here -
 * that's the actual mechanism, not just documentation.
 *
 * Field/element names and structure below follow "Standardized e-claims
 * interface for health providers' HIS, XML Methodology (ver. 8.6)",
 * Appendix X.1.
 */
export type FieldResolver = (bundle: ClaimBundle) => string | number | boolean | null;

export const FIELD_MAP: Record<string, FieldResolver> = {
  // GeneralInformation > ProviderInformation
  ProviderAccreditationNumber: (b) => b.provider.accreditation_number,
  eClaimAuthorizationNumber: (b) => b.provider.eclaims_auth_number,

  // Patients > PatientData
  Surname: (b) => b.patient.surname,
  OtherName: (b) => b.patient.other_name,
  DateOfBirth: (b) => toNhiaDate(b.patient.dob),
  Infant: (b) => (b.patient.is_infant ? 'YES' : 'NO'),
  MemberNumber: (b) => b.patient.member_number,
  TemporaryCardNumber: (b) => b.patient.temp_card_number,
  HospitalRecordNumber: (b) => b.patient.hospital_record_number,
  CardSerialNumber: (b) => b.patient.card_serial,
  Gender: (b) => b.patient.gender.toUpperCase().charAt(0),

  // Patients > PatientData > Claims > Claim
  ClaimIdentificationNumber: (b) => b.claim.claim_identification_number,
  ClaimCheckCode: (b) => b.claim.claim_check_code,
  ServiceType: (b) => b.claim.service_type,
  PharmacyIncluded: (b) => (b.claim.pharmacy_included ? 'YES' : 'NO'),
  AllInclusive: (b) => (b.claim.all_inclusive ? 'YES' : 'NO'),
  OutcomeType: (b) => b.claim.outcome_type,
  DurationLength: (b) => b.claim.duration_length,
  AdmissionType: (b) => b.claim.admission_type,
  SpecialityCode: (b) => b.claim.speciality_code,
  AdmissionDate: (b) => toNhiaDate(b.claim.admission_date),
  DischargeDate: (b) => toNhiaDate(b.claim.discharge_date),
  OutPatientTariffAmount: (b) => b.claim.out_patient_tariff_amount,
  InPatientTariffAmount: (b) => b.claim.in_patient_tariff_amount,
  OutPatientCode: (b) => b.claim.out_patient_code,
  InPatientCode: (b) => b.claim.in_patient_code,
  InvestigationCode: (b) => b.claim.investigation_code,
  TotalCost: (b) => b.claim.total_cost,
  ReferralNo: (b) => b.claim.referral_no,
  TreatmentsCount: (b) => b.treatments.length,
  MedicinesCount: (b) => b.medicines.length,

  // Treatments > Treatment (resolved per-row in the XML generator; this
  // entry exists so the completeness check has something to call)
  'Treatment.Date': (b) => toNhiaDate(b.treatments[0]?.date) ?? null,
  'Treatment.Type': (b) => b.treatments[0]?.type ?? null,
  'Treatment.TreatmentCode': (b) => b.treatments[0]?.treatment_code ?? null,
  'Treatment.ICDCode': (b) => b.treatments[0]?.icd_code ?? null,
  'Treatment.Tariff': (b) => b.treatments[0]?.tariff ?? null,

  // Medicines > Medicine
  'Medicine.MedicineCode': (b) => b.medicines[0]?.medicine_code ?? null,
  'Medicine.Quantity': (b) => b.medicines[0]?.quantity ?? null,
  'Medicine.UnitPrice': (b) => b.medicines[0]?.unit_price ?? null,
  'Medicine.MedicineTotal': (b) => b.medicines[0]?.medicine_total ?? null,
  'Medicine.MedicineDate': (b) => toNhiaDate(b.medicines[0]?.medicine_date) ?? null,
};

/**
 * Fields the spec marks Mandatory (M) at the Provider/Patient/Claim level
 * (Appendix X.1). Treatment/Medicine mandatory fields are checked
 * separately per-row in xmlGenerator, since they're repeating groups, not
 * single claim-level values.
 */
export const REQUIRED_FIELDS: string[] = [
  'ProviderAccreditationNumber',
  'eClaimAuthorizationNumber',
  'Surname',
  'OtherName',
  'DateOfBirth',
  'Gender',
  'ClaimIdentificationNumber',
  'ServiceType',
  'PharmacyIncluded',
  'AllInclusive',
  'OutcomeType',
  'AdmissionType',
  'SpecialityCode',
  'AdmissionDate',
  'TotalCost',
  'TreatmentsCount',
  'MedicinesCount',
];

export function resolveField(fieldName: string, bundle: ClaimBundle): unknown {
  const resolver = FIELD_MAP[fieldName];
  if (!resolver) {
    throw new Error(`No field mapping registered for "${fieldName}"`);
  }
  return resolver(bundle);
}
