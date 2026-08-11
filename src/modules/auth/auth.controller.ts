import { Request, Response } from 'express';
import * as authService from './auth.service';
import * as mfaService from './mfa.service';
import * as userRepo from '../users/user.repository';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

export async function loginHandler(req: Request, res: Response): Promise<Response> {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  try {
    const result = await authService.login(username, password);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof authService.AuthError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
}

export async function refreshHandler(req: Request, res: Response): Promise<Response> {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  let payload: { sub: number; type: string };
  try {
    payload = authService.verifyToken(refreshToken);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
  if (payload.type !== 'refresh') {
    return res.status(401).json({ error: 'Invalid token type' });
  }

  const user = await userRepo.findById(payload.sub);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'User not found or inactive' });
  }

  return res.status(200).json(authService.issueTokenPair(user));
}

/** Step 1.3: begin MFA enrollment. Requires a short-lived mfa_setup token from /login. */
export async function mfaEnrollHandler(req: Request, res: Response): Promise<Response> {
  const token = extractBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing setup token' });

  let payload: { sub: number; type: string };
  try {
    payload = authService.verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired setup token' });
  }
  if (payload.type !== 'mfa_setup') {
    return res.status(401).json({ error: 'Invalid token type' });
  }

  const user = await userRepo.findById(payload.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const secret = mfaService.generateSecret();
  await userRepo.setMfaSecret(user.id, secret);
  const otpauthUrl = mfaService.generateOtpauthUrl(user.username, secret);

  return res.status(200).json({ secret, otpauthUrl });
}

/** Step 1.3: confirm the TOTP code for a freshly enrolled secret, then issue real tokens. */
export async function mfaConfirmHandler(req: Request, res: Response): Promise<Response> {
  const token = extractBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing setup token' });
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'code is required' });

  let payload: { sub: number; type: string };
  try {
    payload = authService.verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired setup token' });
  }
  if (payload.type !== 'mfa_setup') {
    return res.status(401).json({ error: 'Invalid token type' });
  }

  const user = await userRepo.findById(payload.sub);
  if (!user || !user.mfa_secret) {
    return res.status(400).json({ error: 'MFA has not been enrolled yet' });
  }
  if (!mfaService.verifyTotp(user.mfa_secret, code)) {
    return res.status(401).json({ error: 'Invalid MFA code' });
  }

  await userRepo.confirmMfa(user.id);
  return res.status(200).json(authService.issueTokenPair(user));
}

/** Step 1.3: verify TOTP on an already-confirmed account, completing login. */
export async function mfaVerifyHandler(req: Request, res: Response): Promise<Response> {
  const token = extractBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing MFA token' });
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'code is required' });

  let payload: { sub: number; type: string };
  try {
    payload = authService.verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired MFA token' });
  }
  if (payload.type !== 'mfa_verify') {
    return res.status(401).json({ error: 'Invalid token type' });
  }

  const user = await userRepo.findById(payload.sub);
  if (!user || !user.mfa_secret || !user.mfa_confirmed) {
    return res.status(400).json({ error: 'MFA is not set up for this account' });
  }
  if (!mfaService.verifyTotp(user.mfa_secret, code)) {
    return res.status(401).json({ error: 'Invalid MFA code' });
  }

  return res.status(200).json(authService.issueTokenPair(user));
}
