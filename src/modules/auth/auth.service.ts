import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import * as userRepo from '../users/user.repository';
import { MFA_REQUIRED_ROLES, Role } from './types';

const SALT_ROUNDS = 10;

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function signToken(payload: Record<string, unknown>, expiresIn: string): string {
  return jwt.sign(payload, env.jwt.secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken<T>(token: string): T {
  return jwt.verify(token, env.jwt.secret) as T;
}

export function issueTokenPair(user: {
  id: number;
  username: string;
  role: Role;
}): { accessToken: string; refreshToken: string } {
  const accessToken = signToken(
    { sub: user.id, username: user.username, role: user.role, type: 'access' },
    env.jwt.expiresIn,
  );
  const refreshToken = signToken({ sub: user.id, type: 'refresh' }, env.jwt.refreshExpiresIn);
  return { accessToken, refreshToken };
}

export interface LoginResult {
  mfaSetupRequired?: boolean;
  mfaRequired?: boolean;
  setupToken?: string;
  mfaToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Step 1.1 core flow, extended by Step 1.3 for MFA-required roles.
 * Deliberately returns the same "Invalid username or password" message for both
 * an unknown username and a wrong password, to avoid user enumeration.
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  const user = await userRepo.findByUsername(username);
  if (!user || !user.is_active) {
    throw new AuthError('Invalid username or password', 401);
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    throw new AuthError('Invalid username or password', 401);
  }

  if (MFA_REQUIRED_ROLES.includes(user.role)) {
    if (!user.mfa_secret || !user.mfa_confirmed) {
      const setupToken = signToken({ sub: user.id, type: 'mfa_setup' }, '10m');
      return { mfaSetupRequired: true, setupToken };
    }
    const mfaToken = signToken({ sub: user.id, type: 'mfa_verify' }, '10m');
    return { mfaRequired: true, mfaToken };
  }

  return issueTokenPair({ id: user.id, username: user.username, role: user.role });
}
