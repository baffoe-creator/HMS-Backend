import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

describe('Offline write-queue sync (integration, requires DB) - Step 2.3 gate', () => {
  let receptionistToken: string;
  const createdPatientIds: number[] = [];

  beforeAll(async () => {
    await db('users').where({ username: 'phase2_sync_receptionist' }).del();

    const hash = await authService.hashPassword('Pass123!');
    const [uid] = await db('users').insert({
      username: 'phase2_sync_receptionist',
      password_hash: hash,
      role: 'receptionist',
      is_active: true,
    });
    receptionistToken = authService.issueTokenPair({
      id: uid,
      username: 'phase2_sync_receptionist',
      role: 'receptionist',
    }).accessToken;
  });

  afterAll(async () => {
    if (createdPatientIds.length > 0) {
      await db('patients').whereIn('id', createdPatientIds).del();
    }
    await db('users').where({ username: 'phase2_sync_receptionist' }).del();
    await db.destroy();
  });

  it('reconciles a queued write into a permanent patient record', async () => {
    const res = await request(app)
      .post('/patients/sync')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({
        entries: [
          {
            tempId: 'offline-temp-001',
            patient: { surname: 'Offline', otherName: 'Patient', gender: 'male', dob: '1992-02-02' },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe('synced');
    expect(res.body.results[0].patientId).toBeDefined();
    createdPatientIds.push(res.body.results[0].patientId);
  });

  it('is idempotent - replaying the same tempId with identical data does not create a duplicate', async () => {
    const payload = {
      entries: [
        {
          tempId: 'offline-temp-002',
          patient: { surname: 'Replay', otherName: 'Case', gender: 'female', dob: '1980-07-07' },
        },
      ],
    };

    const first = await request(app)
      .post('/patients/sync')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send(payload);
    createdPatientIds.push(first.body.results[0].patientId);

    const second = await request(app)
      .post('/patients/sync')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send(payload);

    expect(second.body.results[0].status).toBe('already_synced');
    expect(second.body.results[0].patientId).toBe(first.body.results[0].patientId);

    const count = await db('patients').where({ client_temp_id: 'offline-temp-002' }).count('id as c');
    expect(Number(count[0].c)).toBe(1);
  });

  it('flags a conflict when the same tempId resyncs with different data', async () => {
    const firstEntry = {
      tempId: 'offline-temp-003',
      patient: { surname: 'Conflict', otherName: 'Original', gender: 'male', dob: '1970-01-01' },
    };
    const first = await request(app)
      .post('/patients/sync')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ entries: [firstEntry] });
    createdPatientIds.push(first.body.results[0].patientId);

    const conflictingEntry = {
      tempId: 'offline-temp-003',
      patient: { surname: 'Conflict', otherName: 'Edited', gender: 'male', dob: '1970-01-01' },
    };
    const second = await request(app)
      .post('/patients/sync')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ entries: [conflictingEntry] });

    expect(second.body.results[0].status).toBe('conflict');
    expect(second.body.results[0].conflictWithId).toBe(first.body.results[0].patientId);
  });
});
