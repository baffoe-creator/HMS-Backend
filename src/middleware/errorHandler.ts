import { Request, Response, NextFunction } from 'express';
import { DecryptionError } from '../utils/encryption';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof DecryptionError) {
    console.error('PII decryption failure:', err.message);
    res.status(500).json({ error: 'Record could not be read' });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}