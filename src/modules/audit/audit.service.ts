import { db } from '../../db/connection';

export interface AuditInput {
  userId: number | null;
  action: string;
  tableName: string;
  recordId: string;
  beforeState?: unknown;
  afterState?: unknown;
}

/**
 * Step 1.4: single entry point for writing to audit_logs. Every module that
 * mutates a tracked entity (users now; patients/claims/etc. in later phases)
 * should call this after the mutation succeeds.
 */
export async function logAudit(entry: AuditInput): Promise<void> {
  await db('audit_logs').insert({
    user_id: entry.userId,
    action: entry.action,
    table_name: entry.tableName,
    record_id: entry.recordId,
    before_state: entry.beforeState !== undefined ? JSON.stringify(entry.beforeState) : null,
    after_state: entry.afterState !== undefined ? JSON.stringify(entry.afterState) : null,
  });
}
