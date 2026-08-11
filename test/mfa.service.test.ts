import { authenticator } from 'otplib';
import * as mfaService from '../src/modules/auth/mfa.service';

describe('MFA service (TOTP) - Step 1.3 gate', () => {
  it('generates a usable secret and a well-formed otpauth enrollment URL', () => {
    const secret = mfaService.generateSecret();
    expect(secret).toBeTruthy();

    const url = mfaService.generateOtpauthUrl('admin1', secret);
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain('HMS');
  });

  it('verifies a correct TOTP code generated from the same secret', () => {
    const secret = mfaService.generateSecret();
    const validCode = authenticator.generate(secret);

    expect(mfaService.verifyTotp(secret, validCode)).toBe(true);
  });

  it('rejects an incorrect TOTP code', () => {
    const secret = mfaService.generateSecret();
    expect(mfaService.verifyTotp(secret, '000000')).toBe(false);
  });

  it('rejects a code generated from a different secret', () => {
    const secretA = mfaService.generateSecret();
    const secretB = mfaService.generateSecret();
    const codeFromB = authenticator.generate(secretB);

    expect(mfaService.verifyTotp(secretA, codeFromB)).toBe(false);
  });
});
