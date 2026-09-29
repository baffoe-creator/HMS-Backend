import { ClaimBundle } from '../../src/modules/nhia/claimBundle.repository';

/**
 * Mirrors the "one claim, one treatment, one medicine" example from the
 * NHIA spec's Appendix X.2, adapted to our schema's field names.
 */
export function fixtureInpatientBundle(overrides: Partial<ClaimBundle['claim']> = {}): ClaimBundle {
  return {
    claim: {
      id: 1,
      patient_id: 1,
      provider_id: 1,
      claim_identification_number: '12345',
      claim_check_code: null,
      service_type: 'INP',
      pharmacy_included: true,
      all_inclusive: true,
      outcome_type: 'DIS',
      duration_length: 2,
      admission_type: 'EME',
      speciality_code: 'ORTH',
      admission_date: '2026-05-14',
      discharge_date: '2026-05-16',
      out_patient_tariff_amount: null,
      in_patient_tariff_amount: 105.75,
      out_patient_code: null,
      in_patient_code: 'ORTH06C',
      investigation_code: null,
      total_cost: 113.25,
      referral_no: '124kk233',
      status: 'draft',
      nhia_error_code: null,
      nhia_reason_code: null,
      nhia_adjustment_value: null,
      ...overrides,
    },
    patient: {
      id: 1,
      surname: 'MWINYELE',
      other_name: 'DOMOKYIRE',
      dob: '1987-05-16',
      gender: 'M',
      member_number: '59340265',
      temp_card_number: null,
      hospital_record_number: '876876',
      card_serial: 'UWJPL120A0093',
      is_infant: false,
    },
    provider: {
      id: 1,
      accreditation_number: '4563',
      eclaims_auth_number: '12345567890',
      name: 'Test Hospital',
      address: null,
      contact: null,
    },
    treatments: [
      {
        id: 1,
        claim_id: 1,
        date: '2026-05-14',
        type: 'Diagnosis',
        treatment_code: 'ORTH06C',
        icd_code: 'A00.9',
        tariff: 105.75,
      },
    ],
    medicines: [
      {
        id: 1,
        claim_id: 1,
        medicine_code: '5FLUORIN1',
        quantity: 15,
        unit_price: 0.5,
        medicine_total: 7.5,
        medicine_date: '2026-05-16',
      },
    ],
  };
}
