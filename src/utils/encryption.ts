import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from 'crypto';
import { env } from '../config/env';

/**
 * Phase 7.1: field-level encryption for PII/PHI columns (Spec §12, Act 843).
 * Scope is deliberately narrow — see PHASE_7.1_ENCRYPTION_IMPLEMENTATION_SPEC.md.
 *
 * Ciphertext format: "v1:<iv_base64>:<ciphertext+tag_base64>"
 * The "v1" prefix lets decryptField dispatch on algorithm/key version later
 * without needing a flag day when keys rotate.
 */

const CURRENT_VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const FIELD_KEY = createHash('sha256').update(env.encryption.fieldKey).digest();
const BLIND_INDEX_KEY = env.encryption.blindIndexKey;

export class DecryptionError extends Error {
  constructor(message = 'Failed to decrypt field: ciphertext missing, corrupted, or wrong key') {
    super(message);
  }
}

export function encryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, FIELD_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([ciphertext, authTag]).toString('base64');
  return `${CURRENT_VERSION}:${iv.toString('base64')}:${payload}`;
}

export function decryptField(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === '') return null;

  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new DecryptionError('Ciphertext is not in the expected v1:iv:payload format');
  }

  const [version, ivB64, payloadB64] = parts;
  if (version !== CURRENT_VERSION) {
    throw new DecryptionError(`Unsupported ciphertext version "${version}"`);
  }

  try {
    const iv = Buffer.from(ivB64, 'base64');
    const payload = Buffer.from(payloadB64, 'base64');
    const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
    const ciphertext = payload.subarray(0, payload.length - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, FIELD_KEY, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new DecryptionError();
  }
}

export function blindIndex(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const normalized = value.trim().toLowerCase();
  return createHmac('sha256', BLIND_INDEX_KEY).update(normalized).digest('hex');
}