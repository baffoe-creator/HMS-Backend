import { Request, Response } from 'express';
import * as labOrderService from './labOrder.service';
import { LabOrderStatus } from './labOrder.repository';

function handleError(err: unknown, res: Response): Response {
  if (err instanceof labOrderService.ValidationError || err instanceof labOrderService.NotFoundError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  throw err;
}

export async function createHandler(req: Request, res: Response): Promise<Response> {
  try {
    const order = await labOrderService.createOrder(req.body ?? {});
    return res.status(201).json(order);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function getHandler(req: Request, res: Response): Promise<Response> {
  try {
    const order = await labOrderService.getOrder(parseInt(req.params.id, 10));
    return res.status(200).json(order);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function updateStatusHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { status, result } = req.body ?? {};
    const order = await labOrderService.transitionStatus(
      parseInt(req.params.id, 10),
      status as LabOrderStatus,
      result,
    );
    return res.status(200).json(order);
  } catch (err) {
    return handleError(err, res);
  }
}
