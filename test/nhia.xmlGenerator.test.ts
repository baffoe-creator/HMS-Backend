import { XMLParser } from 'fast-xml-parser';
import { generateClaimXml, generateBatchXml } from '../src/modules/nhia/xmlGenerator.service';
import { fixtureInpatientBundle } from './helpers/nhiaFixtures';

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });

describe('NHIA XML generator - Step 6.2 gate', () => {
  it('produces a well-formed XML declaration and root <Batch> element', () => {
    const xml = generateClaimXml(fixtureInpatientBundle());
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8" ?>')).toBe(true);
    expect(xml).toContain('<Batch>');
  });

  it('matches the spec structure: GeneralInformation > VersionInformation/BatchInformation/ProviderInformation', () => {
    const xml = generateClaimXml(fixtureInpatientBundle());
    const parsed = parser.parse(xml);
    const general = parsed.Batch.GeneralInformation;

    expect(general.VersionInformation.XMLFormatVersion).toBe('8.6');
    expect(general.ProviderInformation.ProviderAccreditationNumber).toBe('4563');
    expect(general.ProviderInformation.eClaimAuthorizationNumber).toBe('12345567890');
    expect(general.BatchInformation.BatchCurrency).toBe('GHC');
  });

  it('nests the claim under Patients > PatientData > Claims > Claim per spec §III.2', () => {
    const xml = generateClaimXml(fixtureInpatientBundle());
    const parsed = parser.parse(xml);
    const patientData = parsed.Batch.Patients.PatientData;

    expect(patientData.Surname).toBe('MWINYELE');
    expect(patientData.OtherName).toBe('DOMOKYIRE');
    expect(patientData.DateOfBirth).toBe('16/05/1987');
    expect(patientData.Gender).toBe('M');

    const claim = patientData.Claims.Claim;
    expect(claim.ClaimIdentificationNumber).toBe('12345');
    expect(claim.ServiceType).toBe('INP');
    expect(claim.PharmacyIncluded).toBe('YES');
    expect(claim.AllInclusive).toBe('YES');
    expect(Number(claim.TotalCost)).toBe(113.25);
  });

  it('includes DurationLength and DischargeDate for INP claims (mandatory per spec)', () => {
    const xml = generateClaimXml(fixtureInpatientBundle());
    const parsed = parser.parse(xml);
    const claim = parsed.Batch.Patients.PatientData.Claims.Claim;

    expect(Number(claim.DurationLength)).toBe(2);
    expect(claim.DischargeDate).toBe('16/05/2026');
  });

  it('omits DurationLength and DischargeDate entirely for an OUT claim (spec: "should not appear")', () => {
    const bundle = fixtureInpatientBundle({
      service_type: 'OUT',
      duration_length: null,
      discharge_date: null,
      out_patient_code: 'ORTH06C',
      out_patient_tariff_amount: 113.25,
      in_patient_code: null,
      in_patient_tariff_amount: null,
    });
    const xml = generateClaimXml(bundle);
    const parsed = parser.parse(xml);
    const claim = parsed.Batch.Patients.PatientData.Claims.Claim;

    expect(claim.DurationLength).toBeUndefined();
    expect(claim.DischargeDate).toBeUndefined();
    expect(claim.OutPatientCode).toBe('ORTH06C');
  });

  it('renders Treatment with an empty Date for Diagnosis-type entries, per spec', () => {
    const xml = generateClaimXml(fixtureInpatientBundle());
    const parsed = parser.parse(xml);
    const treatment = parsed.Batch.Patients.PatientData.Claims.Claim.Treatments.Treatment;

    expect(treatment.Type).toBe('Diagnosis');
    expect(treatment.ICDCode).toBe('A00.9');
    expect(treatment.Date === '' || treatment.Date === undefined).toBe(true);
  });

  it('renders the Medicine node with correct fields and date format', () => {
    const xml = generateClaimXml(fixtureInpatientBundle());
    const parsed = parser.parse(xml);
    const medicine = parsed.Batch.Patients.PatientData.Claims.Claim.Medicines.Medicine;

    expect(medicine.MedicineCode).toBe('5FLUORIN1');
    expect(Number(medicine.MedicineTotal)).toBe(7.5);
    expect(medicine.MedicineDate).toBe('16/05/2026');
  });

  it('groups multiple claims for the same patient under one PatientData node', () => {
    const bundleA = fixtureInpatientBundle({ id: 1, claim_identification_number: 'A1' });
    const bundleB = fixtureInpatientBundle({ id: 2, claim_identification_number: 'A2' });
    const xml = generateBatchXml([bundleA, bundleB], { batchNumber: '1' });
    const parsed = parser.parse(xml);

    // Single patient -> PatientData is an object, not an array, with two Claim entries
    const claims = parsed.Batch.Patients.PatientData.Claims.Claim;
    expect(Array.isArray(claims)).toBe(true);
    expect(claims).toHaveLength(2);
    expect(Number(parsed.Batch.GeneralInformation.BatchInformation.ClaimsCount)).toBe(2);
  });

  it('sums BatchAmount across all claims in the batch', () => {
    const bundleA = fixtureInpatientBundle({ id: 1, claim_identification_number: 'A1', total_cost: 100 });
    const bundleB = fixtureInpatientBundle({ id: 2, claim_identification_number: 'A2', total_cost: 50 });
    const xml = generateBatchXml([bundleA, bundleB], { batchNumber: '1' });
    const parsed = parser.parse(xml);

    expect(Number(parsed.Batch.GeneralInformation.BatchInformation.BatchAmount)).toBe(150);
  });

  it('throws rather than generating an empty batch', () => {
    expect(() => generateBatchXml([], { batchNumber: '1' })).toThrow();
  });
});
