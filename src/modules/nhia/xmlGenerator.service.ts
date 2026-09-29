import { XMLBuilder } from 'fast-xml-parser';
import type { ClaimBundle } from './claimBundle.repository';
import { toNhiaDate } from './dateFormat';

const XML_FORMAT_VERSION = '8.6';

function yn(value: boolean): string {
  return value ? 'YES' : 'NO';
}

/** Empty string for elements the spec shows present-but-empty when unset (e.g. TemporaryCardNumber, IDPayer). */
function orEmpty(value: string | number | null | undefined): string | number {
  return value === null || value === undefined ? '' : value;
}

function buildTreatmentNode(t: ClaimBundle['treatments'][number]) {
  return {
    Date: t.type === 'Diagnosis' ? '' : (toNhiaDate(t.date) ?? ''),
    Type: t.type,
    TreatmentCode: t.treatment_code,
    ICDCode: orEmpty(t.icd_code),
    Tariff: orEmpty(t.tariff),
  };
}

function buildMedicineNode(m: ClaimBundle['medicines'][number]) {
  return {
    MedicineCode: m.medicine_code,
    Quantity: m.quantity,
    UnitPrice: m.unit_price,
    MedicineTotal: m.medicine_total,
    MedicineDate: toNhiaDate(m.medicine_date),
  };
}

function buildClaimNode(bundle: ClaimBundle) {
  const { claim } = bundle;
  const node: Record<string, unknown> = {
    ClaimIdentificationNumber: claim.claim_identification_number,
    ClaimCheckCode: orEmpty(claim.claim_check_code),
    ServiceType: claim.service_type,
    PharmacyIncluded: yn(claim.pharmacy_included),
    AllInclusive: yn(claim.all_inclusive),
    OutcomeType: claim.outcome_type,
    AdmissionType: claim.admission_type,
    SpecialityCode: claim.speciality_code,
    AdmissionDate: toNhiaDate(claim.admission_date),
    TotalCost: claim.total_cost,
    ReferralNo: orEmpty(claim.referral_no),
    TreatmentsCount: bundle.treatments.length,
    MedicinesCount: bundle.medicines.length,
  };

  // DurationLength/DischargeDate: spec says these must NOT appear at all for
  // OUT/CAP/DIA, and are mandatory for INP - so omit the key entirely rather
  // than emit an empty tag, matching the "should not appear" wording.
  if (claim.service_type === 'INP') {
    node.DurationLength = claim.duration_length;
    node.DischargeDate = toNhiaDate(claim.discharge_date);
  }

  if (claim.service_type === 'OUT') {
    node.OutPatientTariffAmount = claim.out_patient_tariff_amount ?? 0;
    node.OutPatientCode = claim.out_patient_code;
  }
  if (claim.service_type === 'INP') {
    node.InPatientTariffAmount = claim.in_patient_tariff_amount ?? 0;
    node.InPatientCode = claim.in_patient_code;
  }
  if (claim.service_type === 'DIA') {
    node.InvestigationCode = claim.investigation_code;
  }

  node.Treatments = { Treatment: bundle.treatments.map(buildTreatmentNode) };
  if (bundle.medicines.length > 0) {
    node.Medicines = { Medicine: bundle.medicines.map(buildMedicineNode) };
  }

  return node;
}

export interface BatchOptions {
  batchNumber: string;
  creationDate?: Date;
}

/**
 * Step 6.2: builds a full Batch XML document from one or more claims,
 * grouping claims under their patient per the real structure (Batch >
 * Patients > PatientData[] > Claims > Claim[]).
 */
export function generateBatchXml(bundles: ClaimBundle[], options: BatchOptions): string {
  if (bundles.length === 0) {
    throw new Error('Cannot generate a Batch XML with zero claims');
  }

  const provider = bundles[0].provider;
  const creationDate = options.creationDate ?? new Date();
  const totalAmount = bundles.reduce((sum, b) => sum + Number(b.claim.total_cost), 0);

  // Group claims by patient, preserving first-seen order.
  const patientOrder: number[] = [];
  const claimsByPatient = new Map<number, ClaimBundle[]>();
  for (const bundle of bundles) {
    const pid = bundle.patient.id;
    if (!claimsByPatient.has(pid)) {
      claimsByPatient.set(pid, []);
      patientOrder.push(pid);
    }
    claimsByPatient.get(pid)!.push(bundle);
  }

  const patientDataNodes = patientOrder.map((pid) => {
    const claimsForPatient = claimsByPatient.get(pid)!;
    const patient = claimsForPatient[0].patient;
    return {
      Surname: patient.surname,
      OtherName: patient.other_name,
      DateOfBirth: toNhiaDate(patient.dob),
      Infant: yn(patient.is_infant),
      MemberNumber: orEmpty(patient.member_number),
      TemporaryCardNumber: orEmpty(patient.temp_card_number),
      HospitalRecordNumber: orEmpty(patient.hospital_record_number),
      CardSerialNumber: orEmpty(patient.card_serial),
      Gender: patient.gender.toUpperCase().charAt(0),
      Claims: { Claim: claimsForPatient.map(buildClaimNode) },
    };
  });

  const tree = {
    Batch: {
      GeneralInformation: {
        VersionInformation: {
          XMLFormatVersion: XML_FORMAT_VERSION,
        },
        BatchInformation: {
          BatchNumber: options.batchNumber,
          BatchAmount: Number(totalAmount.toFixed(2)),
          BatchCurrency: 'GHC',
          ClaimsCount: bundles.length,
          CreationDate: toNhiaDate(creationDate.toISOString().slice(0, 10)),
          ServiceYear: String(creationDate.getFullYear()),
          ServiceMonth: String(creationDate.getMonth() + 1).padStart(2, '0'),
          IDPayer: '',
        },
        ProviderInformation: {
          ProviderAccreditationNumber: provider.accreditation_number,
          eClaimAuthorizationNumber: provider.eclaims_auth_number,
        },
      },
      Patients: { PatientData: patientDataNodes },
    },
  };

  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: true,
    suppressBooleanAttributes: false,
  });

  return `<?xml version="1.0" encoding="utf-8" ?>\n${builder.build(tree)}`;
}

/** Convenience wrapper for a single claim - matches the spec's Appendix X.2 example shape. */
export function generateClaimXml(bundle: ClaimBundle, batchNumber = '1'): string {
  return generateBatchXml([bundle], { batchNumber });
}
