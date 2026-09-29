import { db } from '../../db/connection';

export interface ClaimRow {
  id: number;
  patient_id: number;
  provider_id: number;
  claim_identification_number: string;
  claim_check_code: string | null;
  service_type: 'OUT' | 'INP' | 'DIA' | 'CAP';
  pharmacy_included: boolean;
  all_inclusive: boolean;
  outcome_type: string;
  duration_length: number | null;
  admission_type: 'CRO' | 'EME' | 'ACU' | null;
  speciality_code: string | null;
  admission_date: string | null;
  discharge_date: string | null;
  out_patient_tariff_amount: number | null;
  in_patient_tariff_amount: number | null;
  out_patient_code: string | null;
  in_patient_code: string | null;
  investigation_code: string | null;
  total_cost: number;
  referral_no: string | null;
  status: string;
  nhia_error_code: string | null;
  nhia_reason_code: string | null;
  nhia_adjustment_value: number | null;
}

export interface PatientRow {
  id: number;
  surname: string;
  other_name: string;
  dob: string | null;
  gender: string;
  member_number: string | null;
  temp_card_number: string | null;
  hospital_record_number: string | null;
  card_serial: string | null;
  is_infant: boolean;
}

export interface ProviderRow {
  id: number;
  accreditation_number: string;
  eclaims_auth_number: string;
  name: string;
  address: string | null;
  contact: string | null;
}

export interface TreatmentRow {
  id: number;
  claim_id: number;
  date: string;
  type: 'Diagnosis' | 'Procedure' | 'Investigation';
  treatment_code: string;
  icd_code: string | null;
  tariff: number;
}

export interface MedicineRow {
  id: number;
  claim_id: number;
  medicine_code: string;
  quantity: number;
  unit_price: number;
  medicine_total: number;
  medicine_date: string;
}

export interface ClaimBundle {
  claim: ClaimRow;
  patient: PatientRow;
  provider: ProviderRow;
  treatments: TreatmentRow[];
  medicines: MedicineRow[];
}

export async function fetchClaimBundle(claimId: number): Promise<ClaimBundle | undefined> {
  const claim = await db<ClaimRow>('claims').where({ id: claimId }).first();
  if (!claim) return undefined;

  const patient = await db<PatientRow>('patients').where({ id: claim.patient_id }).first();
  const provider = await db<ProviderRow>('providers').where({ id: claim.provider_id }).first();
  if (!patient || !provider) return undefined;

  const treatments = await db<TreatmentRow>('treatments').where({ claim_id: claimId });
  const medicines = await db<MedicineRow>('claim_medicines').where({ claim_id: claimId });

  return { claim, patient, provider, treatments, medicines };
}

export async function fetchClaimBundles(claimIds: number[]): Promise<ClaimBundle[]> {
  const bundles: ClaimBundle[] = [];
  for (const id of claimIds) {
    const bundle = await fetchClaimBundle(id);
    if (bundle) bundles.push(bundle);
  }
  return bundles;
}
