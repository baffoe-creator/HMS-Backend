import { Request, Response } from 'express';
import * as roomBedService from './roomBed.service';

function handleError(err: unknown, res: Response): Response {
  if (
    err instanceof roomBedService.ValidationError ||
    err instanceof roomBedService.NotFoundError ||
    err instanceof roomBedService.ConflictError
  ) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  throw err;
}

export async function getHandler(req: Request, res: Response): Promise<Response> {
  try {
    const record = await roomBedService.getRoomBed(parseInt(req.params.id, 10));
    return res.status(200).json(record);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function admitHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { patientId } = req.body ?? {};
    const record = await roomBedService.admitPatient(parseInt(req.params.id, 10), patientId);
    return res.status(200).json(record);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function dischargeHandler(req: Request, res: Response): Promise<Response> {
  try {
    const record = await roomBedService.dischargePatient(parseInt(req.params.id, 10));
    return res.status(200).json(record);
  } catch (err) {
    return handleError(err, res);
  }
}
