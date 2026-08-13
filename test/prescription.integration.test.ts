import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

describe('Prescriptions (integration, requires DB) - Step 3.4 gate', () => {
  let clinicianToken: string;
  let clinicianId: number;
  let allergyPatientId: number;
  let interactionPatientId: number;
  const createdPrescriptionIds: number[] = [];

  beforeAll(async () => {
    await db('users').where({ username: 'phase3_rx_clinician' }).del();
    await db('drug_interactions')
      .where({ medicine_code_a: 'WARFARIN', medicine_code_b: 'ASPIRIN' })
      .del();

    const hash = await authService.hashPassword('Pass123!');
    const [cid] = await db('users').insert({
      username: 'phase3_rx_clinician',
      password_hash: hash,
      role: 'clinician',
      is_active: true,
    });
    clinicianId = cid;
    clinicianToken = authService.issueTokenPair({
      id: cid,
      username: 'phase3_rx_clinician',
      role: 'clinician',
    }).accessToken;

    const [aid] = await db('patients').insert({
      surname: 'Allergy',
      other_name: 'Case',
      gender: 'female',
      dob: '1980-01-01',
    });
    allergyPatientId = aid;
    await db('patient_allergies').insert({ patient_id: allergyPatientId, allergen: 'PENICILLIN' });

    const [iid] = await db('patients').insert({
      surname: 'Interaction',
      other_name: 'Case',
      gender: 'male',
      dob: '1975-01-01',
    });
    interactionPatientId = iid;

    await db('drug_interactions').insert({
      medicine_code_a: 'WARFARIN',
      medicine_code_b: 'ASPIRIN',
      severity: 'severe',
      description: 'Increased risk of bleeding when combined',
    });
  });

  afterAll(async () => {
    if (createdPrescriptionIds.length > 0) {
      await db('prescriptions').whereIn('id', createdPrescriptionIds).del();
    }
    await db('patient_allergies').where({ patient_id: allergyPatientId }).del();
    await db('drug_interactions')
      .where({ medicine_code_a: 'WARFARIN', medicine_code_b: 'ASPIRIN' })
      .del();
    await db('patients').whereIn('id', [allergyPatientId, interactionPatientId]).del();
    await db('users').where({ username: 'phase3_rx_clinician' }).del();
    await db.destroy();
  });

  it('hard-blocks a prescription against a logged allergy (409)', async () => {
    const res = await request(app)
      .post('/prescriptions')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({
        patientId: allergyPatientId,
        clinicianId,
        medicineCode: 'PENICILLIN',
        dosage: '500mg 3x daily',
        prescribedDate: '2026-08-13',
      });
    expect(res.status).toBe(409);
  });

  it('warns but still creates when a drug interaction is found', async () => {
    const first = await request(app)
      .post('/prescriptions')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({
        patientId: interactionPatientId,
        clinicianId,
        medicineCode: 'ASPIRIN',
        dosage: '75mg daily',
        prescribedDate: '2026-08-13',
      });
    expect(first.status).toBe(201);
    createdPrescriptionIds.push(first.body.prescription.id);

    const second = await request(app)
      .post('/prescriptions')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({
        patientId: interactionPatientId,
        clinicianId,
        medicineCode: 'WARFARIN',
        dosage: '5mg daily',
        prescribedDate: '2026-08-13',
      });
    expect(second.status).toBe(201); // NOT blocked
    expect(second.body.interactionWarning).not.toBeNull();
    expect(second.body.interactionWarning.withMedicineCode).toBe('ASPIRIN');
    createdPrescriptionIds.push(second.body.prescription.id);
  });
});
