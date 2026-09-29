import { Request, Response } from 'express';
import * as billingService from './billing.service';

function handleError(err: unknown, res: Response): Response {
  if (err instanceof billingService.ValidationError || err instanceof billingService.NotFoundError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  throw err;
}

export async function createHandler(req: Request, res: Response): Promise<Response> {
  try {
    const result = await billingService.generateInvoice(req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function getHandler(req: Request, res: Response): Promise<Response> {
  try {
    const result = await billingService.getInvoice(parseInt(req.params.id, 10));
    return res.status(200).json(result);
  } catch (err) {
    return handleError(err, res);
  }
}
