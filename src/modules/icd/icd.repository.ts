import { db } from '../../db/connection';

export interface IcdCodeRecord {
  id: number;
  code: string;
  description: string;
  version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function findActiveByCode(code: string): Promise<IcdCodeRecord | undefined> {
  return db<IcdCodeRecord>('icd_codes').where({ code, is_active: true }).first();
}

export async function findAllVersions(code: string): Promise<IcdCodeRecord[]> {
  return db<IcdCodeRecord>('icd_codes').where({ code }).orderBy('created_at', 'asc');
}

export async function insert(input: {
  code: string;
  description: string;
  version: string;
  isActive: boolean;
}): Promise<IcdCodeRecord> {
  const [id] = await db('icd_codes').insert({
    code: input.code,
    description: input.description,
    version: input.version,
    is_active: input.isActive,
  });
  const created = await db<IcdCodeRecord>('icd_codes').where({ id }).first();
  if (!created) throw new Error('Failed to load newly inserted ICD code');
  return created;
}

export async function deactivateActiveVersions(code: string): Promise<void> {
  await db('icd_codes').where({ code, is_active: true }).update({ is_active: false });
}
