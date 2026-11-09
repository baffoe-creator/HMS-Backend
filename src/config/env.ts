import dotenv from 'dotenv';
import path from 'path';

const envFile = `.env.${process.env.NODE_ENV ?? 'development'}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Local/test runs may fall back to a dev JWT secret. Anything else must set one.
const isLocal = ['development', 'test'].includes(process.env.NODE_ENV ?? 'development');

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  // Phase 7.2: number of proxy hops in front of the API (load balancer, Spec §11).
  trustProxyHops: parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10),
  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    user: required('DB_USER', 'hms_user'),
    password: required('DB_PASSWORD', 'hms_password'),
    name: required('DB_NAME', 'hms_dev'),
  },
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  jwt: {
    secret: isLocal ? (process.env.JWT_SECRET ?? 'change_me_in_local_env') : required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  encryption: {
    // Phase 7.1: no fallback defaults. The app refuses to boot without these.
    fieldKey: required('HMS_FIELD_ENCRYPTION_KEY'),
    blindIndexKey: required('HMS_BLIND_INDEX_KEY'),
  },
  // Phase 7.4 hardening: comma-separated list of allowed browser origins.
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim()),
};

if (!isLocal && env.jwt.secret === 'change_me_in_local_env') {
  throw new Error('JWT_SECRET must be set to a real secret outside development/test');
}