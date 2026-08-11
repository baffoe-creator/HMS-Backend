import { Role } from '../../modules/auth/types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: Role;
      };
    }
  }
}

export {};
