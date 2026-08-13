import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

describe('ICD code lookup & versioning (integration, requires DB) - Step 3.1 gate', () => {
  let adminToken: string;
  let clinicianToken: string;

  beforeAll(async () => {
    await db('users').whereIn('username', ['phase3_icd_admin', 'phase3_icd_clinician']).del();
    await db('icd_codes').where({ code: 'TEST99' }).del();

    const hash = await authService.hashPassword('Pass123!');
    const [aid] = await db('users').insert({
      username: 'phase3_icd_admin',
      password_hash: hash,
      role: 'admin',
      is_active: true,
    });
    const [cid] = await db('users').insert({
      username: 'phase3_icd_clinician',
      password_hash: hash,
      role: 'clinician',
      is_active: true,
    });
    adminToken = authService.issueTokenPair({ id: aid, username: 'phase3_icd_admin', role: 'admin' })
      .accessToken;
    clinicianToken = authService.issueTokenPair({
      id: cid,
      username: 'phase3_icd_clinician',
      role: 'clinician',
    }).accessToken;

    await db('icd_codes').insert({
      code: 'TEST99',
      description: 'Test condition v1',
      version: 'v1',
      is_active: true,
    });
  });

  afterAll(async () => {
    await db('icd_codes').where({ code: 'TEST99' }).del();
    await db('users').whereIn('username', ['phase3_icd_admin', 'phase3_icd_clinician']).del();
    await db.destroy();
  });

  it('looks up the active version of a code', async () => {
    const res = await request(app)
      .get('/icd-codes/TEST99')
      .set('Authorization', `Bearer ${clinicianToken}`);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('v1');
  });

  it('bumps the version and retains the old version for history', async () => {
    const bump = await request(app)
      .post('/icd-codes/bump-version')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'TEST99', description: 'Test condition v2', newVersion: 'v2' });
    expect(bump.status).toBe(201);

    const active = await request(app)
      .get('/icd-codes/TEST99')
      .set('Authorization', `Bearer ${clinicianToken}`);
    expect(active.body.version).toBe('v2');

    const versions = await request(app)
      .get('/icd-codes/TEST99/versions')
      .set('Authorization', `Bearer ${clinicianToken}`);
    expect(versions.body.versions.map((v: { version: string }) => v.version)).toEqual(
      expect.arrayContaining(['v1', 'v2']),
    );
  });
});
