import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';
import { XMLParser } from 'fast-xml-parser';

const app = createApp();

describe('NHIA eClaims integration (integration, requires DB) - Phase 6 gates', () => {
  let accountantToken: string;
  let adminToken: string;
  let providerId: number;
  let patientId: number;
  let claimId: number;

  beforeAll(async () => {
    await db('users').whereIn('username', ['phase6_accountant', 'phase6_admin']).del();
    await db('claims').where({ claim_identification_number: 'P6-CLAIM-001' }).del();
    await db('providers').where({ accreditation_number: 'P6-PROV-01' }).del();

    const hash = await authService.hashPassword('Pass123!');
    const [uid] = await db('users').insert({
      username: 'phase6_accountant',
      password_hash: hash,
      role: 'accountant',
      is_active: true,
    });
    accountantToken = authService.issueTokenPair({
      id: uid,
      username: 'phase6_accountant',
      role: 'accountant',
    }).accessToken;

    const [aid] = await db('users').insert({
      username: 'phase6_admin',
      password_hash: hash,
      role: 'admin',
      is_active: true,
    });
    adminToken = authService.issueTokenPair({ id: aid, username: 'phase6_admin', role: 'admin' })
      .accessToken;

    const [pid] = await db('providers').insert({
      accreditation_number: 'P6-PROV-01',
      eclaims_auth_number: '999999',
      name: 'Phase 6 Test Hospital',
    });
    providerId = pid;

    const [patId] = await db('patients').insert({
      surname: 'Nhia',
      other_name: 'TestCase',
      dob: '1990-01-01',
      gender: 'female',
      member_number: '87654321',
    });
    patientId = patId;

    const [cid] = await db('claims').insert({
      patient_id: patientId,
      provider_id: providerId,
      claim_identification_number: 'P6-CLAIM-001',
      service_type: 'INP',
      pharmacy_included: true,
      all_inclusive: true,
      outcome_type: 'DIS',
      duration_length: 2,
      admission_type: 'EME',
      speciality_code: 'ORTH',
      admission_date: '2026-08-14',
      discharge_date: '2026-08-16',
      in_patient_tariff_amount: 100,
      in_patient_code: 'ORTH06C',
      total_cost: 100,
      status: 'draft',
    });
    claimId = cid;

    await db('treatments').insert({
      claim_id: claimId,
      date: '2026-08-14',
      type: 'Diagnosis',
      treatment_code: 'ORTH06C',
      icd_code: 'A00.9',
      tariff: 100,
    });
  });

  afterAll(async () => {
    await db('treatments').where({ claim_id: claimId }).del();
    await db('claims').where({ id: claimId }).del();
    await db('patients').where({ id: patientId }).del();
    await db('providers').where({ id: providerId }).del();
    await db('users').whereIn('username', ['phase6_accountant', 'phase6_admin']).del();
    await db.destroy();
  });

  it('Step 6.3: validates the claim as clean (no issues)', async () => {
    const res = await request(app)
      .get(`/nhia/claims/${claimId}/validate`)
      .set('Authorization', `Bearer ${accountantToken}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.issues).toEqual([]);
  });

  it('Step 6.2: generates well-formed XML matching the real spec structure', async () => {
    const res = await request(app)
      .get(`/nhia/claims/${claimId}/xml`)
      .set('Authorization', `Bearer ${accountantToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');

    const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });
    const parsed = parser.parse(res.text);
    expect(parsed.Batch.GeneralInformation.VersionInformation.XMLFormatVersion).toBe('8.6');
    expect(parsed.Batch.Patients.PatientData.Claims.Claim.ClaimIdentificationNumber).toBe('P6-CLAIM-001');
  });

  it('Step 6.4: ingests Feedback XML and reconciles claim status by ClaimIdentificationNumber', async () => {
    const feedbackXml = `<?xml version="1.0" encoding="utf-8" ?>
<Batch>
  <Patients>
    <PatientData>
      <Claims>
        <Claim>
          <ClaimIdentificationNumber>P6-CLAIM-001</ClaimIdentificationNumber>
          <SecondVerificationLevel>
            <Accepted>YES</Accepted>
          </SecondVerificationLevel>
        </Claim>
      </Claims>
    </PatientData>
  </Patients>
</Batch>`;

    const res = await request(app)
      .post('/nhia/feedback')
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({ xml: feedbackXml });

    // Feedback upload is admin-only per routes - accountant should be denied.
    expect(res.status).toBe(403);
  });

  it('Step 6.4: admin can upload feedback, and it reconciles the claim status', async () => {
    const feedbackXml = `<?xml version="1.0" encoding="utf-8" ?>
<Batch>
  <Patients>
    <PatientData>
      <Claims>
        <Claim>
          <ClaimIdentificationNumber>P6-CLAIM-001</ClaimIdentificationNumber>
          <SecondVerificationLevel>
            <Accepted>YES</Accepted>
          </SecondVerificationLevel>
        </Claim>
      </Claims>
    </PatientData>
  </Patients>
</Batch>`;

    const res = await request(app)
      .post('/nhia/feedback')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ xml: feedbackXml });

    expect(res.status).toBe(200);
    expect(res.body.results[0].matched).toBe(true);
    expect(res.body.results[0].newStatus).toBe('submitted');

    const updated = await db('claims').where({ id: claimId }).first();
    expect(updated.status).toBe('submitted');
  });

  it('Step 6.1: an invalid claim is rejected before XML generation, with issue codes surfaced', async () => {
    await db('claims').where({ id: claimId }).update({ total_cost: 99999 });

    const res = await request(app)
      .get(`/nhia/claims/${claimId}/xml`)
      .set('Authorization', `Bearer ${accountantToken}`);

    expect(res.status).toBe(400);
    expect(res.body.issues.some((i: { code: string }) => i.code === '238')).toBe(true);

    await db('claims').where({ id: claimId }).update({ total_cost: 100 });
  });
});
