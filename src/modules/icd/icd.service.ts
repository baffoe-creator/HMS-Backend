import * as icdRepo from './icd.repository';
import { IcdCodeRecord } from './icd.repository';

export class NotFoundError extends Error {
  statusCode = 404;
}
export class ValidationError extends Error {
  statusCode = 400;
}

export async function lookupActive(code: string): Promise<IcdCodeRecord> {
  const record = await icdRepo.findActiveByCode(code);
  if (!record) throw new NotFoundError(`No active ICD code found for "${code}"`);
  return record;
}

export async function listVersions(code: string): Promise<IcdCodeRecord[]> {
  return icdRepo.findAllVersions(code);
}

/**
 * Step 3.1 versioning: retires the current active row(s) for a code (without
 * deleting them - historical claims may still reference that version) and
 * activates a new one. Old rows remain queryable via listVersions().
 */
export async function bumpVersion(input: {
  code: string;
  description: string;
  newVersion: string;
}): Promise<IcdCodeRecord> {
  if (!input.code || !input.description || !input.newVersion) {
    throw new ValidationError('code, description, and newVersion are required');
  }
  await icdRepo.deactivateActiveVersions(input.code);
  return icdRepo.insert({
    code: input.code,
    description: input.description,
    version: input.newVersion,
    isActive: true,
  });
}
