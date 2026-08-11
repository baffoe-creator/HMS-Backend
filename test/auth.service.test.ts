import jwt from 'jsonwebtoken';
import * as authService from '../src/modules/auth/auth.service';
import * as userRepo from '../src/modules/users/user.repository';
import { env } from '../src/config/env';
import { UserRecord } from '../src/modules/users/user.repository';

jest.mock('../src/modules/users/user.repository');
const mockedRepo = userRepo as jest.Mocked<typeof userRepo>;

function fakeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 1,
    username: 'reception1',
    password_hash: '',
    role: 'receptionist',
    mfa_secret: null,
    mfa_confirmed: false,
    is_active: true,
    ...overrides,
  };
}

describe('AuthService', () => {
  afterEach(() => jest.resetAllMocks());

  describe('password hashing', () => {
    it('hashes a password and verifies it correctly', async () => {
      const hash = await authService.hashPassword('Sup3rSecret!');
      expect(hash).not.toBe('Sup3rSecret!');
      expect(await authService.comparePassword('Sup3rSecret!', hash)).toBe(true);
      expect(await authService.comparePassword('wrong-password', hash)).toBe(false);
    });
  });

  describe('login - non-MFA roles', () => {
    it('returns an access + refresh token for valid credentials (200 case)', async () => {
      const hash = await authService.hashPassword('password123');
      mockedRepo.findByUsername.mockResolvedValue(fakeUser({ password_hash: hash }));

      const result = await authService.login('reception1', 'password123');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('rejects an invalid password with AuthError (401 case)', async () => {
      const hash = await authService.hashPassword('password123');
      mockedRepo.findByUsername.mockResolvedValue(fakeUser({ password_hash: hash }));

      await expect(authService.login('reception1', 'wrong-password')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('rejects an unknown username with AuthError (401 case)', async () => {
      mockedRepo.findByUsername.mockResolvedValue(undefined);

      await expect(authService.login('ghost-user', 'whatever')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('rejects a deactivated account', async () => {
      const hash = await authService.hashPassword('password123');
      mockedRepo.findByUsername.mockResolvedValue(
        fakeUser({ password_hash: hash, is_active: false }),
      );

      await expect(authService.login('reception1', 'password123')).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe('login - MFA-required roles (admin, clinician)', () => {
    it('returns mfaSetupRequired when an admin has no confirmed MFA secret', async () => {
      const hash = await authService.hashPassword('adminpass');
      mockedRepo.findByUsername.mockResolvedValue(
        fakeUser({ username: 'admin1', role: 'admin', password_hash: hash }),
      );

      const result = await authService.login('admin1', 'adminpass');

      expect(result.mfaSetupRequired).toBe(true);
      expect(result.setupToken).toBeDefined();
      expect(result.accessToken).toBeUndefined();
    });

    it('returns mfaRequired when an admin already has a confirmed MFA secret', async () => {
      const hash = await authService.hashPassword('adminpass');
      mockedRepo.findByUsername.mockResolvedValue(
        fakeUser({
          username: 'admin1',
          role: 'admin',
          password_hash: hash,
          mfa_secret: 'JBSWY3DPEHPK3PXP',
          mfa_confirmed: true,
        }),
      );

      const result = await authService.login('admin1', 'adminpass');

      expect(result.mfaRequired).toBe(true);
      expect(result.mfaToken).toBeDefined();
      expect(result.accessToken).toBeUndefined();
    });
  });

  describe('token verification', () => {
    it('rejects an expired access token on a protected route', () => {
      const expiredToken = jwt.sign(
        { sub: 1, username: 'x', role: 'admin', type: 'access' },
        env.jwt.secret,
        { expiresIn: -10 },
      );

      expect(() => authService.verifyToken(expiredToken)).toThrow();
    });

    it('accepts a valid, unexpired token', () => {
      const { accessToken } = authService.issueTokenPair({
        id: 1,
        username: 'reception1',
        role: 'receptionist',
      });

      expect(() => authService.verifyToken(accessToken)).not.toThrow();
    });
  });
});
