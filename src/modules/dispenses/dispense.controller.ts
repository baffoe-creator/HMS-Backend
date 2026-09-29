import { Request, Response } from 'express';
import * as dispenseService from './dispense.service';
import * as inventoryService from '../pharmacyInventory/pharmacyInventory.service';

export async function createHandler(req: Request, res: Response): Promise<Response> {
  try {
    const record = await dispenseService.dispense(req.body ?? {});
    return res.status(201).json(record);
  } catch (err) {
    if (err instanceof dispenseService.ValidationError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    if (
      err instanceof inventoryService.NotFoundError ||
      err instanceof inventoryService.ConflictError
    ) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
}
