import { Request, Response } from 'express';
import * as icdService from './icd.service';

function handleError(err: unknown, res: Response): Response {
  if (err instanceof icdService.NotFoundError || err instanceof icdService.ValidationError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  throw err;
}

export async function lookupHandler(req: Request, res: Response): Promise<Response> {
  try {
    const record = await icdService.lookupActive(req.params.code);
    return res.status(200).json(record);
  } catch (err) {
    return handleError(err, res);
  }
}

export async function versionsHandler(req: Request, res: Response): Promise<Response> {
  const versions = await icdService.listVersions(req.params.code);
  return res.status(200).json({ code: req.params.code, versions });
}

export async function bumpVersionHandler(req: Request, res: Response): Promise<Response> {
  try {
    const updated = await icdService.bumpVersion(req.body ?? {});
    return res.status(201).json(updated);
  } catch (err) {
    return handleError(err, res);
  }
}
