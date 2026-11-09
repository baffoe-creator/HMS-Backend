import request from 'supertest';
import { createApp } from '../src/app';
import { db } from '../src/db/connection';
import * as authService from '../src/modules/auth/auth.service';

const app = createApp();

/**
 * Removes this suite's fixtures in FK-safe order (bookings first, because
 * ot_bookings references users/rooms/patients with RESTRICT). Runs before AND
 * after, so an interrupted earlier run can never block the next one.
 */
async function purgeFixtures(): Promise<void> {
  const staleUsers = db('users').select('id').where({ username: 'phase4_ot_clinician' });
  const staleRooms = db('rooms_beds').select('id').whereIn('room_number', ['OT-P4', 'W-P4']);
  await db('ot_bookings').whereIn('surgeon_id', staleUsers).orWhereIn('room_id', staleRooms).del();
  await db('rooms_beds').whereIn('room_number', ['OT-P4', 'W-P4']).del();
  await db('patients').where({ surname: 'OT', other_name: 'Case' }).del();
  await db('users').where({ username: 'phase4_ot_clinician' }).del();
}

describe('OT booking (integration, requires DB) - Step 4.2 gate', () => {
  let clinicianToken: string;
  let surgeonId: number;
  let patientId: number;
  let otRoomId: number;
  let wardRoomId: number;

  beforeAll(async () => {
    await purgeFixtures();

    const hash = await authService.hashPassword('Pass123!');
    const [cid] = await db('users').insert({
      username: 'phase4_ot_clinician',
      password_hash: hash,
      role: 'clinician',
      is_active: true,
    });
    surgeonId = cid;
    clinicianToken = authService.issueTokenPair({
      id: cid,
      username: 'phase4_ot_clinician',
      role: 'clinician',
    }).accessToken;

    const [pid] = await db('patients').insert({ surname: 'OT', other_name: 'Case', gender: 'male' });
    patientId = pid;

    const [otId] = await db('rooms_beds').insert({
      room_number: 'OT-P4',
      bed_number: '-',
      status: 'available',
      room_type: 'ot',
    });
    otRoomId = otId;

    const [wardId] = await db('rooms_beds').insert({
      room_number: 'W-P4',
      bed_number: 'A',
      status: 'available',
      room_type: 'ward',
    });
    wardRoomId = wardId;
  });

  afterAll(async () => {
    await purgeFixtures();
    await db.destroy();
  });

  it('books an OT slot successfully', async () => {
    const res = await request(app)
      .post('/ot-bookings')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({
        roomId: otRoomId,
        patientId,
        surgeonId,
        scheduledStart: '2026-09-05T09:00:00.000Z',
        scheduledEnd: '2026-09-05T11:00:00.000Z',
      });
    expect(res.status).toBe(201);
  });

  it('rejects an overlapping booking in the same theatre (409)', async () => {
    const res = await request(app)
      .post('/ot-bookings')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({
        roomId: otRoomId,
        patientId,
        surgeonId,
        scheduledStart: '2026-09-05T10:00:00.000Z', // overlaps the 9-11 booking
        scheduledEnd: '2026-09-05T12:00:00.000Z',
      });
    expect(res.status).toBe(409);
  });

  it('allows a non-overlapping booking in the same theatre', async () => {
    const res = await request(app)
      .post('/ot-bookings')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({
        roomId: otRoomId,
        patientId,
        surgeonId,
        scheduledStart: '2026-09-05T11:00:00.000Z', // starts exactly when the first ends
        scheduledEnd: '2026-09-05T13:00:00.000Z',
      });
    expect(res.status).toBe(201);
  });

  it('rejects booking a non-OT room', async () => {
    const res = await request(app)
      .post('/ot-bookings')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({
        roomId: wardRoomId,
        patientId,
        surgeonId,
        scheduledStart: '2026-09-06T09:00:00.000Z',
        scheduledEnd: '2026-09-06T11:00:00.000Z',
      });
    expect(res.status).toBe(400);
  });
});