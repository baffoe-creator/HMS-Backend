export type Role =
  | 'admin'
  | 'receptionist'
  | 'clinician'
  | 'lab_tech'
  | 'pharmacy_tech'
  | 'accountant'
  | 'auditor';

export const ALL_ROLES: Role[] = [
  'admin',
  'receptionist',
  'clinician',
  'lab_tech',
  'pharmacy_tech',
  'accountant',
  'auditor',
];

// Roles that must complete TOTP MFA before receiving a usable session (Spec §4, §12)
export const MFA_REQUIRED_ROLES: Role[] = ['admin', 'clinician'];

export interface AccessTokenPayload {
  sub: number;
  username: string;
  role: Role;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: number;
  type: 'refresh';
}

export interface MfaSetupTokenPayload {
  sub: number;
  type: 'mfa_setup';
}

export interface MfaVerifyTokenPayload {
  sub: number;
  type: 'mfa_verify';
}
