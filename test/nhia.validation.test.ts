import { validateClaimBundle, isClaimValid } from '../src/modules/nhia/validation.service';
import { fixtureInpatientBundle } from './helpers/nhiaFixtures';

describe('NHIA pre-submission validation - Step 6.3 gate', () => {
  it('passes a fully valid claim with zero issues', () => {
    const bundle = fixtureInpatientBundle();
    expect(validateClaimBundle(bundle)).toEqual([]);
    expect(isClaimValid(bundle)).toBe(true);
  });

  it('203/236: flags a patient with neither MemberNumber nor TemporaryCardNumber', () => {
    const bundle = fixtureInpatientBundle();
    bundle.patient.member_number = null;
    bundle.patient.temp_card_number = null;
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).toContain('203');
    expect(codes).toContain('236');
  });

  it('203: flags a MemberNumber shorter than 8 characters', () => {
    const bundle = fixtureInpatientBundle();
    bundle.patient.member_number = '1234';
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).toContain('203');
  });

  it('205: flags an invalid Gender', () => {
    const bundle = fixtureInpatientBundle();
    bundle.patient.gender = 'X';
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).toContain('205');
  });

  it('210: flags an invalid OutcomeType', () => {
    const bundle = fixtureInpatientBundle();
    bundle.claim.outcome_type = 'BOGUS';
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).toContain('210');
  });

  it('221: flags a claim with no Diagnosis treatment', () => {
    const bundle = fixtureInpatientBundle();
    bundle.treatments = [];
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).toContain('221');
  });

  it('230: flags a medicine whose MedicineTotal does not equal Quantity * UnitPrice', () => {
    const bundle = fixtureInpatientBundle();
    bundle.medicines[0].medicine_total = 999;
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).toContain('230');
  });

  it('238: flags a claim whose TotalCost does not reconcile against tariffs + medicines', () => {
    const bundle = fixtureInpatientBundle();
    bundle.claim.total_cost = 999;
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).toContain('238');
  });

  it('238: Diagnosis-type tariffs are correctly excluded from the reconciliation sum', () => {
    // Sanity check on the formula itself: a Diagnosis tariff of 105.75 must
    // NOT be added on top of InPatientTariffAmount, or this valid fixture
    // would wrongly fail.
    const bundle = fixtureInpatientBundle();
    expect(bundle.treatments[0].type).toBe('Diagnosis');
    expect(bundle.treatments[0].tariff).toBe(105.75);
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).not.toContain('238');
  });

  it('244: OUT claim missing OutPatientCode is flagged', () => {
    const bundle = fixtureInpatientBundle({
      service_type: 'OUT',
      duration_length: null,
      discharge_date: null,
      out_patient_code: null,
      out_patient_tariff_amount: 105.75,
      in_patient_code: null,
      in_patient_tariff_amount: null,
    });
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).toContain('244');
  });

  it('246/292: INP claim missing InPatientCode and DurationLength is flagged', () => {
    const bundle = fixtureInpatientBundle({ in_patient_code: null, duration_length: null });
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).toContain('246');
    expect(codes).toContain('292');
  });

  it('240/267/268/269: a DIA claim must have an investigation and nothing else', () => {
    const bundle = fixtureInpatientBundle({
      service_type: 'DIA',
      duration_length: null,
      discharge_date: null,
      in_patient_code: null,
      in_patient_tariff_amount: null,
      out_patient_tariff_amount: null,
      investigation_code: 'INV01',
      total_cost: 7.5, // just the medicine, satisfies 238 trivially since no investigation tariff either
    });
    // Bundle as constructed still has a Diagnosis treatment and a medicine -
    // both of which are forbidden for DIA claims.
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).toContain('240'); // no Investigation treatment present
    expect(codes).toContain('268'); // has a Diagnosis treatment
    expect(codes).toContain('269'); // has a medicine
  });

  it('241: an INP claim with an Investigation treatment is flagged', () => {
    const bundle = fixtureInpatientBundle();
    bundle.treatments.push({
      id: 2,
      claim_id: 1,
      date: '2026-05-15',
      type: 'Investigation',
      treatment_code: 'INV01',
      icd_code: null,
      tariff: 10,
    });
    const codes = validateClaimBundle(bundle).map((i) => i.code);
    expect(codes).toContain('241');
  });
});
