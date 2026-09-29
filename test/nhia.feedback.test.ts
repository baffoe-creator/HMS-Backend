import { parseFeedbackXml } from '../src/modules/nhia/feedback.service';

const SECOND_LEVEL_REJECTION_XML = `<?xml version="1.0" encoding="utf-8" ?>
<Batch>
  <FirstVerificationLevel>
    <Accepted>YES</Accepted>
  </FirstVerificationLevel>
  <Patients>
    <PatientData>
      <Surname>Doe</Surname>
      <Claims>
        <Claim>
          <ClaimIdentificationNumber>12345</ClaimIdentificationNumber>
          <SecondVerificationLevel>
            <Accepted>NO</Accepted>
            <ErrorCode>207</ErrorCode>
            <ErrorCode>209</ErrorCode>
          </SecondVerificationLevel>
        </Claim>
      </Claims>
    </PatientData>
  </Patients>
</Batch>`;

const THIRD_LEVEL_ADJUSTED_XML = `<?xml version="1.0" encoding="utf-8" ?>
<Batch>
  <FirstVerificationLevel>
    <Accepted>YES</Accepted>
  </FirstVerificationLevel>
  <Patients>
    <PatientData>
      <Surname>Doe</Surname>
      <Claims>
        <Claim>
          <ClaimIdentificationNumber>12345</ClaimIdentificationNumber>
          <ThirdVerificationLevel>
            <Accepted>NO</Accepted>
            <ClaimRejectionReason>023</ClaimRejectionReason>
            <OutPatientTariffAmountValidation>
              <ReasonCode>023</ReasonCode>
              <AdjustmentValue>8.45</AdjustmentValue>
            </OutPatientTariffAmountValidation>
            <TotalCostValidation>
              <ReasonCode></ReasonCode>
              <AdjustmentValue>23.45</AdjustmentValue>
            </TotalCostValidation>
          </ThirdVerificationLevel>
        </Claim>
      </Claims>
    </PatientData>
  </Patients>
</Batch>`;

const MULTI_CLAIM_XML = `<?xml version="1.0" encoding="utf-8" ?>
<Batch>
  <Patients>
    <PatientData>
      <Surname>Doe</Surname>
      <Claims>
        <Claim>
          <ClaimIdentificationNumber>A1</ClaimIdentificationNumber>
          <SecondVerificationLevel><Accepted>YES</Accepted></SecondVerificationLevel>
        </Claim>
        <Claim>
          <ClaimIdentificationNumber>A2</ClaimIdentificationNumber>
          <SecondVerificationLevel><Accepted>NO</Accepted><ErrorCode>218</ErrorCode></SecondVerificationLevel>
        </Claim>
      </Claims>
    </PatientData>
  </Patients>
</Batch>`;

describe('parseFeedbackXml - Step 6.4 gate', () => {
  it('parses a 2nd-level rejection and surfaces the ErrorCodes correctly', () => {
    const result = parseFeedbackXml(SECOND_LEVEL_REJECTION_XML);
    expect(result.firstLevel?.accepted).toBe(true);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].claimIdentificationNumber).toBe('12345');
    expect(result.claims[0].secondLevel?.accepted).toBe(false);
    expect(result.claims[0].secondLevel?.errorCodes).toEqual(['207', '209']);
  });

  it('parses a 3rd-level feedback with ClaimRejectionReason and AdjustmentValues', () => {
    const result = parseFeedbackXml(THIRD_LEVEL_ADJUSTED_XML);
    const claim = result.claims[0];
    expect(claim.claimIdentificationNumber).toBe('12345');
    expect(claim.thirdLevel?.accepted).toBe(false);
    expect(claim.thirdLevel?.claimRejectionReason).toBe('023');
    expect(claim.thirdLevel?.adjustments).toHaveLength(2);
    expect(claim.thirdLevel?.adjustments.map((a) => a.adjustmentValue)).toEqual([8.45, 23.45]);
  });

  it('matches multiple claims by ClaimIdentificationNumber independently', () => {
    const result = parseFeedbackXml(MULTI_CLAIM_XML);
    expect(result.claims).toHaveLength(2);
    const a1 = result.claims.find((c) => c.claimIdentificationNumber === 'A1');
    const a2 = result.claims.find((c) => c.claimIdentificationNumber === 'A2');
    expect(a1?.secondLevel?.accepted).toBe(true);
    expect(a2?.secondLevel?.accepted).toBe(false);
    expect(a2?.secondLevel?.errorCodes).toEqual(['218']);
  });

  it('throws a clear error when the root <Batch> element is missing', () => {
    expect(() => parseFeedbackXml('<NotABatch></NotABatch>')).toThrow(/Batch/);
  });
});
