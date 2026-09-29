import { XMLParser } from 'fast-xml-parser';
import { db } from '../../db/connection';

// Tags that repeat in the real Feedback XML but may serialize as a single
// object (not an array) when there's only one instance - force them to
// always parse as arrays so downstream code doesn't need two code paths.
const ALWAYS_ARRAY = new Set([
  'PatientData',
  'Claim',
  'Treatment',
  'Medicine',
  'ErrorCode',
  'OutPatientTariffAmountValidation',
  'InPatientTariffAmountValidation',
  'TotalCostValidation',
  'TariffValidation',
  'MedicineTotalValidation',
]);

const parser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => ALWAYS_ARRAY.has(name),
  // Identifiers (ClaimIdentificationNumber, ReasonCode, ClaimRejectionReason)
  // must round-trip as strings - a naive numeric parse would silently turn
  // reason code "023" into 23, dropping the leading zero. Every field that
  // genuinely IS numeric (AdjustmentValue) is explicitly Number()-converted
  // below, so disabling this globally costs nothing.
  parseTagValue: false,
});

interface AdjustmentEntry {
  reasonCode?: string;
  adjustmentValue?: number;
}

export interface ParsedClaimFeedback {
  claimIdentificationNumber: string;
  secondLevel?: { accepted: boolean; errorCodes: string[] };
  thirdLevel?: {
    accepted: boolean;
    claimRejectionReason?: string;
    adjustments: AdjustmentEntry[];
  };
}

export interface ParsedFeedback {
  firstLevel?: { accepted: boolean; errorCodes: string[] };
  claims: ParsedClaimFeedback[];
}

function toBool(value: unknown): boolean {
  return String(value).toUpperCase() === 'YES';
}

function collectAdjustments(node: Record<string, unknown> | undefined): AdjustmentEntry[] {
  if (!node) return [];
  const keys = [
    'OutPatientTariffAmountValidation',
    'InPatientTariffAmountValidation',
    'TotalCostValidation',
  ];
  const entries: AdjustmentEntry[] = [];
  for (const key of keys) {
    const rows = (node[key] as Record<string, unknown>[]) ?? [];
    for (const row of rows) {
      entries.push({
        reasonCode: row.ReasonCode ? String(row.ReasonCode) : undefined,
        adjustmentValue: row.AdjustmentValue !== undefined ? Number(row.AdjustmentValue) : undefined,
      });
    }
  }
  return entries;
}

/**
 * Step 6.4 gate: parses a Feedback XML document (real structure - see spec
 * §VII and Appendix X.4/X.6/X.7) into a shape the reconciliation step can
 * act on. Handles both the "rejected at 2nd level" and "processed to 3rd
 * level" feedback shapes described in the spec.
 */
export function parseFeedbackXml(xml: string): ParsedFeedback {
  const parsed = parser.parse(xml);
  const batch = parsed?.Batch;
  if (!batch) {
    throw new Error('Feedback XML is missing the root <Batch> element');
  }

  const result: ParsedFeedback = { claims: [] };

  if (batch.FirstVerificationLevel) {
    const fl = batch.FirstVerificationLevel;
    result.firstLevel = {
      accepted: toBool(fl.Accepted),
      errorCodes: (fl.ErrorCode ?? []).map(String),
    };
  }

  const patientDataList: Record<string, unknown>[] = (batch.Patients?.PatientData ?? []) as Record<
    string,
    unknown
  >[];
  for (const patientData of patientDataList) {
    const claims = ((patientData.Claims as Record<string, unknown> | undefined)?.Claim ?? []) as Record<
      string,
      unknown
    >[];

    for (const claimNode of claims) {
      const claimId = String(claimNode.ClaimIdentificationNumber ?? '');
      if (!claimId) continue;

      const entry: ParsedClaimFeedback = { claimIdentificationNumber: claimId };

      const secondLevel = claimNode.SecondVerificationLevel as Record<string, unknown> | undefined;
      if (secondLevel) {
        entry.secondLevel = {
          accepted: toBool(secondLevel.Accepted),
          errorCodes: ((secondLevel.ErrorCode as unknown[]) ?? []).map(String),
        };
      }

      const thirdLevel = claimNode.ThirdVerificationLevel as Record<string, unknown> | undefined;
      if (thirdLevel) {
        entry.thirdLevel = {
          accepted: toBool(thirdLevel.Accepted),
          claimRejectionReason: thirdLevel.ClaimRejectionReason
            ? String(thirdLevel.ClaimRejectionReason)
            : undefined,
          adjustments: collectAdjustments(thirdLevel),
        };
      }

      result.claims.push(entry);
    }
  }

  return result;
}

export interface ReconcileResult {
  claimIdentificationNumber: string;
  matched: boolean;
  newStatus?: string;
}

/**
 * Step 6.4 gate: applies parsed feedback to the claims table, matching by
 * ClaimIdentificationNumber. Third-level feedback (with adjustments) takes
 * precedence over second-level when both are present, since third-level is
 * the later stage in the real verification pipeline (§VII.1).
 */
export async function reconcileFeedback(parsed: ParsedFeedback): Promise<ReconcileResult[]> {
  const results: ReconcileResult[] = [];

  for (const claimFeedback of parsed.claims) {
    const existing = await db('claims')
      .where({ claim_identification_number: claimFeedback.claimIdentificationNumber })
      .first();

    if (!existing) {
      results.push({ claimIdentificationNumber: claimFeedback.claimIdentificationNumber, matched: false });
      continue;
    }

    const update: Record<string, unknown> = {};

    if (claimFeedback.thirdLevel) {
      const hasAdjustment = claimFeedback.thirdLevel.adjustments.some(
        (a) => a.adjustmentValue !== undefined && a.adjustmentValue !== 0,
      );
      update.status = hasAdjustment ? 'adjusted' : claimFeedback.thirdLevel.accepted ? 'accepted' : 'rejected';
      update.nhia_reason_code = claimFeedback.thirdLevel.claimRejectionReason ?? null;
      const firstAdjustment = claimFeedback.thirdLevel.adjustments.find((a) => a.adjustmentValue !== undefined);
      update.nhia_adjustment_value = firstAdjustment?.adjustmentValue ?? null;
    } else if (claimFeedback.secondLevel) {
      update.status = claimFeedback.secondLevel.accepted ? 'submitted' : 'rejected';
      update.nhia_error_code = claimFeedback.secondLevel.errorCodes[0] ?? null;
    }

    if (Object.keys(update).length > 0) {
      await db('claims').where({ id: existing.id }).update(update);
    }

    results.push({
      claimIdentificationNumber: claimFeedback.claimIdentificationNumber,
      matched: true,
      newStatus: update.status as string | undefined,
    });
  }

  return results;
}
