import { authenticator } from 'otplib';

const ISSUER = 'HMS';

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function generateOtpauthUrl(username: string, secret: string): string {
  return authenticator.keyuri(username, ISSUER, secret);
}

export function verifyTotp(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}
