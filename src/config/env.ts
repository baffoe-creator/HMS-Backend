import dotenv from 'dotenv';
import path from 'path';

const envFile = `.env.${process.env.NODE_ENV ?? 'development'}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  trustProxyHops: parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10),
  port: parseInt(process.env.PORT ?? '4000', 10),
  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    user: required('DB_USER', 'hms_user'),
    password: required('DB_PASSWORD', 'hms_password'),
    name: required('DB_NAME', 'hms_dev'),
  },
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change_me_in_local_env',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  encryption: {
    // Phase 7.1: PII/PHI encryption keys (Act 843 compliance).
    // No fallback defaults — app fails to boot if these are not set,
    // which is intentional. A silently-encrypted database with a hardcoded
    // key is worse than a loudly-refusing app.
    // See PHASE_7_1_ENCRYPTION_IMPLEMENTATION_SPEC.md for key generation.
    fieldKey: required('HMS_FIELD_ENCRYPTION_KEY'),
    blindIndexKey: required('HMS_BLIND_INDEX_KEY'),
  },
};
