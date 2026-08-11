import { Request, Response } from 'express';
import * as userRepo from './user.repository';
import { logAudit } from '../audit/audit.service';

/**
 * Admin-only: activate/deactivate a user account. Wrapped with audit logging
 * so this doubles as the concrete mutation the Step 1.4 test gate verifies
 * against - a real admin capability (RBAC lockout by deactivation), not just
 * a test fixture.
 */
export async function updateUserStatusHandler(req: Request, res: Response): Promise<Response> {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  const { isActive } = req.body ?? {};
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive (boolean) is required' });
  }

  const before = await userRepo.findById(id);
  if (!before) {
    return res.status(404).json({ error: 'User not found' });
  }

  await userRepo.setActiveStatus(id, isActive);
  const after = await userRepo.findById(id);

  await logAudit({
    userId: req.user?.id ?? null,
    action: 'UPDATE',
    tableName: 'users',
    recordId: String(id),
    beforeState: { is_active: before.is_active },
    afterState: { is_active: after?.is_active },
  });

  return res.status(200).json(after);
}
