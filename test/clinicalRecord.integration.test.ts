import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

describe('Clinical records / EMR (integration, requires DB) - Step 3.2 gate', () => {
  let clinicianToken: string;
  let receptionistToken: string;
  let clinicianId: number;
  let patientId: number;
  const createdRecordIds: number[] = [];

  beforeAll(async () => {
    await db('users').whereIn('username', ['phase3_emr_clinician', 'phase3_emr_receptionist']).del();

    const hash = await authService.hashPassword('Pass123!');
    const [cid] = await db('users').insert({
      username: 'phase3_emr_clinician',
      password_hash: hash,
      role: 'clinician',
      is_active: true,
    });
    clinicianId = cid;
    const [rid] = await db('users').insert({
      username: 'phase3_emr_receptionist',
      password_hash: hash,
      role: 'receptionist',
      is_active: true,
    });
    clinicianToken = authService.issueTokenPair({
      id: cid,
      username: 'phase3_emr_clinician',
      role: 'clinician',
    }).accessToken;
    receptionistToken = authService.issueTokenPair({
      id: rid,
      username: 'phase3_emr_receptionist',
      role: 'receptionist',
    }).accessToken;

    const [pid] = await db('patients').insert({
      surname: 'EMR',
      other_name: 'Test',
      gender: 'female',
      dob: '1990-01-01',
    });
    patientId = pid;
  });

  afterAll(async () => {
    if (createdRecordIds.length > 0) {
      await db('audit_logs').where({ table_name: 'clinical_records' }).whereIn('record_id', createdRecordIds.map(String)).del();
      await db('clinical_records').whereIn('id', createdRecordIds).del();
    }
    await db('patients').where({ id: patientId }).del();
    await db('users').whereIn('username', ['phase3_emr_clinician', 'phase3_emr_receptionist']).del();
    await db.destroy();
  });

  it('lets a clinician create a clinical record', async () => {
    const res = await request(app)
      .post('/clinical-records')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({
        patientId,
        clinicianId,
        encounterDate: '2026-08-13',
        history: 'Presented with cough and fever',
        diagnosisIcdCode: 'J18',
        vitals: { temp_c: 38.5, bp: '120/80' },
      });

    expect(res.status).toBe(201);
    createdRecordIds.push(res.body.id);
  });

  it('blocks a receptionist from creating a clinical record (403)', async () => {
    const res = await request(app)
      .post('/clinical-records')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ patientId, clinicianId, encounterDate: '2026-08-13' });
    expect(res.status).toBe(403);
  });

  it('writes an audit log entry for the created record', async () => {
    const recordId = createdRecordIds[0];
    const logs = await db('audit_logs').where({ table_name: 'clinical_records', record_id: String(recordId) });
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('CREATE');
    expect(logs[0].user_id).toBe(clinicianId);
  });

  it('returns the patient encounter history', async () => {
    const res = await request(app)
      .get(`/clinical-records/patient/${patientId}`)
      .set('Authorization', `Bearer ${clinicianToken}`);
    expect(res.status).toBe(200);
    expect(res.body.records.length).toBeGreaterThanOrEqual(1);
  });
});
