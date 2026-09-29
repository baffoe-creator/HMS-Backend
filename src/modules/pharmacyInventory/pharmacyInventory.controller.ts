import { Request, Response } from 'express';
import * as inventoryService from './pharmacyInventory.service';

function handleError(err: unknown, res: Response): Response {
  if (
    err instanceof inventoryService.ValidationError ||
    err instanceof inventoryService.NotFoundError ||
    err instanceof inventoryService.ConflictError
  ) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  throw err;
}

export async function createHandler(req: Request, res: Response): Promise<Response> {
  try {
    const item = await inventoryService.createItem(req.body ?? {});
    return res.status(201).json(item);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function getHandler(req: Request, res: Response): Promise<Response> {
  try {
    const item = await inventoryService.getItem(req.params.code);
    return res.status(200).json(item);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function lowStockHandler(_req: Request, res: Response): Promise<Response> {
  const items = await inventoryService.getLowStockAlerts();
  return res.status(200).json({ items });
}
