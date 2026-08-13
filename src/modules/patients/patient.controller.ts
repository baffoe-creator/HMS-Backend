import { Request, Response } from 'express';
import * as patientService from './patient.service';
import * as emergencyMonitor from './emergencyMonitor.service';

function handleError(err: unknown, res: Response): Response {
  if (err instanceof patientService.ValidationError || err instanceof patientService.NotFoundError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  throw err;
}

export async function registerHandler(req: Request, res: Response): Promise<Response> {
  try {
    const result = await patientService.registerPatient(req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function registerEmergencyHandler(req: Request, res: Response): Promise<Response> {
  try {
    const patient = await patientService.registerEmergencyPatient(req.body ?? {});
    return res.status(201).json(patient);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function completeEmergencyHandler(req: Request, res: Response): Promise<Response> {
  try {
    const id = parseInt(req.params.id, 10);
    const patient = await patientService.completeEmergencyRegistration(id, req.body ?? {});
    return res.status(200).json(patient);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function flagOverdueEmergencyHandler(_req: Request, res: Response): Promise<Response> {
  const flagged = await emergencyMonitor.flagOverdueEmergencyRegistrations();
  return res.status(200).json({ flaggedCount: flagged.length, flagged });
}

export async function getHandler(req: Request, res: Response): Promise<Response> {
  try {
    const id = parseInt(req.params.id, 10);
    const patient = await patientService.getPatient(id);
    return res.status(200).json(patient);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function updateHandler(req: Request, res: Response): Promise<Response> {
  try {
    const id = parseInt(req.params.id, 10);
    const patient = await patientService.updatePatient(id, req.body ?? {});
    return res.status(200).json(patient);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function deleteHandler(req: Request, res: Response): Promise<Response> {
  try {
    const id = parseInt(req.params.id, 10);
    await patientService.deletePatient(id);
    return res.status(204).send();
  } catch (err) {
    return handleError(err, res);
  }
}

export async function syncHandler(req: Request, res: Response): Promise<Response> {
  const entries = req.body?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries (non-empty array) is required' });
  }
  try {
    const results = await patientService.syncBatch(entries);
    return res.status(200).json({ results });
  } catch (err) {
    return handleError(err, res);
  }
}
