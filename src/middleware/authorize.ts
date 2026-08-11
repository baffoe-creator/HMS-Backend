import { Request, Response, NextFunction } from 'express';
import { Role } from '../modules/auth/types';

/**
 * Step 1.2: role-based route guard. Must run after `authenticate`, which
 * populates req.user. Returns 403 for any role not in the allow-list,
 * including requests with no authenticated user at all.
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({ error: 'Forbidden: insufficient role' });
      return;
    }
    next();
  };
}
