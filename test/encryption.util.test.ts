import { encryptField, decryptField, blindIndex, DecryptionError } from '../src/utils/encryption';

describe('encryption utility - Phase 7.1 gate', () => {
  it('round-trips a value through encrypt/decrypt', () => {
    const original = 'GH-12345678';
    const ciphertext = encryptField(original);
    expect(ciphertext).not.toBe(original);
    expect(decryptField(ciphertext)).toBe(original);
  });

  it('produces different ciphertext for the same plaintext on repeated calls', () => {
    const a = encryptField('GH-12345678');
    const b = encryptField('GH-12345678');
    expect(a).not.toBe(b);
  });

  it('returns null for null/undefined/empty input without throwing', () => {
    expect(encryptField(null)).toBeNull();
    expect(encryptField(undefined)).toBeNull();
    expect(encryptField('')).toBeNull();
    expect(decryptField(null)).toBeNull();
  });

  it('throws DecryptionError on tampered ciphertext rather than returning garbage', () => {
    const ciphertext = encryptField('GH-12345678')!;
    const tampered = ciphertext.slice(0, -4) + 'abcd';
    expect(() => decryptField(tampered)).toThrow(DecryptionError);
  });

  it('throws DecryptionError on malformed input', () => {
    expect(() => decryptField('not-the-right-format')).toThrow(DecryptionError);
  });

  it('blindIndex is deterministic and normalizes case/whitespace', () => {
    expect(blindIndex('GH-12345678')).toBe(blindIndex('  gh-12345678  '));
  });

  it('blindIndex output is a 64-char hex string (HMAC-SHA256)', () => {
    const idx = blindIndex('GH-12345678')!;
    expect(idx).toMatch(/^[a-f0-9]{64}$/);
  });
});