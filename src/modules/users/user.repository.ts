import { db } from '../../db/connection';
import { Role } from '../auth/types';

export interface UserRecord {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  mfa_secret: string | null;
  mfa_confirmed: boolean;
  is_active: boolean;
}

export async function findByUsername(username: string): Promise<UserRecord | undefined> {
  return db<UserRecord>('users').where({ username }).first();
}

export async function findById(id: number): Promise<UserRecord | undefined> {
  return db<UserRecord>('users').where({ id }).first();
}

export async function createUser(input: {
  username: string;
  passwordHash: string;
  role: Role;
}): Promise<UserRecord> {
  const [id] = await db('users').insert({
    username: input.username,
    password_hash: input.passwordHash,
    role: input.role,
  });
  const created = await findById(id);
  if (!created) {
    throw new Error('Failed to load newly created user');
  }
  return created;
}

export async function setMfaSecret(id: number, secret: string): Promise<void> {
  await db('users').where({ id }).update({ mfa_secret: secret, mfa_confirmed: false });
}

export async function confirmMfa(id: number): Promise<void> {
  await db('users').where({ id }).update({ mfa_confirmed: true });
}

export async function setActiveStatus(id: number, isActive: boolean): Promise<void> {
  await db('users').where({ id }).update({ is_active: isActive });
}
