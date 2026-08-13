import { Request, Response } from 'express';
import * as clinicalRecordService from './clinicalRecord.service';

function handleError(err: unknown, res: Response): Response {
  if (
    err instanceof clinicalRecordService.ValidationError ||
    err instanceof clinicalRecordService.NotFoundError
  ) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  throw err;
}

export async function createHandler(req: Request, res: Response): Promise<Response> {
  try {
    const record = await clinicalRecordService.createRecord(req.body ?? {}, req.user?.id ?? null);
    return res.status(201).json(record);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function getHandler(req: Request, res: Response): Promise<Response> {
  try {
    const record = await clinicalRecordService.getRecord(parseInt(req.params.id, 10));
    return res.status(200).json(record);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function patientHistoryHandler(req: Request, res: Response): Promise<Response> {
  const records = await clinicalRecordService.getPatientHistory(parseInt(req.params.patientId, 10));
  return res.status(200).json({ records });
}
