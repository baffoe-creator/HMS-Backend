import { Request, Response } from 'express';
import * as prescriptionService from './prescription.service';

export async function createHandler(req: Request, res: Response): Promise<Response> {
  try {
    const result = await prescriptionService.createPrescription(req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    if (
      err instanceof prescriptionService.ValidationError ||
      err instanceof prescriptionService.AllergyBlockError
    ) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
}
