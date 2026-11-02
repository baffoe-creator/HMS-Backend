import { db } from '../src/db/connection';
import * as patientRepo from '../src/modules/patients/patient.repository';

describe('Patient PII encryption at rest (integration, requires DB) - Step 7.1 gate', () => {
  const createdIds: number[] = [];

  afterAll(async () => {
    if (createdIds.length) await db('patients').whereIn('id', createdIds).del();
    await db.destroy();
  });

  it('stores ciphertext, not plaintext, in the raw DB row for protected fields', async () => {
    const patient = await patientRepo.create({
      surname: 'Encrypted',
      otherName: 'Case',
      gender: 'female',
      memberNumber: 'GH-99999999',
      hospitalRecordNumber: 'HRN-0001',
    });
    createdIds.push(patient.id);

    const raw = await db('patients').where({ id: patient.id }).first();
    expect(raw.member_number).not.toContain('GH-99999999');
    expect(raw.hospital_record_number).not.toContain('HRN-0001');
    expect(raw.member_number_bidx).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns decrypted plaintext through the repository read path', async () => {
    const patient = await patientRepo.create({
      surname: 'RoundTrip',
      otherName: 'Case',
      gender: 'male',
      memberNumber: 'GH-11112222',
    });
    createdIds.push(patient.id);

    const fetched = await patientRepo.findById(patient.id);
    expect(fetched?.member_number).toBe('GH-11112222');
  });

  it('enforces uniqueness on hospital_record_number via the blind index', async () => {
    const first = await patientRepo.create({
      surname: 'Dup1',
      otherName: 'Case',
      gender: 'male',
      hospitalRecordNumber: 'HRN-DUP-001',
    });
    createdIds.push(first.id);

    await expect(
      patientRepo.create({
        surname: 'Dup2',
        otherName: 'Case',
        gender: 'female',
        hospitalRecordNumber: 'HRN-DUP-001',
      }),
    ).rejects.toThrow();
  });

  it('finds a patient by hospital record number via blind-index lookup', async () => {
    const patient = await patientRepo.create({
      surname: 'Lookup',
      otherName: 'Case',
      gender: 'female',
      hospitalRecordNumber: 'HRN-LOOKUP-01',
    });
    createdIds.push(patient.id);

    const found = await patientRepo.findByHospitalRecordNumber('HRN-LOOKUP-01');
    expect(found?.id).toBe(patient.id);
  });
});