import { Request, Response } from 'express';
import * as claimBundleRepo from './claimBundle.repository';
import * as xmlGenerator from './xmlGenerator.service';
import * as validationService from './validation.service';
import * as feedbackService from './feedback.service';

export async function generateClaimXmlHandler(req: Request, res: Response): Promise<Response> {
  const claimId = parseInt(req.params.claimId, 10);
  const bundle = await claimBundleRepo.fetchClaimBundle(claimId);
  if (!bundle) {
    return res.status(404).json({ error: 'Claim not found' });
  }

  const issues = validationService.validateClaimBundle(bundle);
  if (issues.length > 0) {
    return res.status(400).json({ error: 'Claim failed pre-submission validation', issues });
  }

  const xml = xmlGenerator.generateClaimXml(bundle);
  res.setHeader('Content-Type', 'application/xml');
  return res.status(200).send(xml);
}

export async function generateBatchXmlHandler(req: Request, res: Response): Promise<Response> {
  const { claimIds, batchNumber } = req.body ?? {};
  if (!Array.isArray(claimIds) || claimIds.length === 0 || !batchNumber) {
    return res.status(400).json({ error: 'claimIds (non-empty array) and batchNumber are required' });
  }

  const bundles = await claimBundleRepo.fetchClaimBundles(claimIds);
  if (bundles.length === 0) {
    return res.status(404).json({ error: 'None of the given claim IDs were found' });
  }

  const invalidBundles = bundles
    .map((b) => ({ claimId: b.claim.id, issues: validationService.validateClaimBundle(b) }))
    .filter((r) => r.issues.length > 0);

  if (invalidBundles.length > 0) {
    return res.status(400).json({
      error: 'One or more claims failed pre-submission validation',
      invalidClaims: invalidBundles,
    });
  }

  const xml = xmlGenerator.generateBatchXml(bundles, { batchNumber });
  res.setHeader('Content-Type', 'application/xml');
  return res.status(200).send(xml);
}

export async function validateClaimHandler(req: Request, res: Response): Promise<Response> {
  const claimId = parseInt(req.params.claimId, 10);
  const bundle = await claimBundleRepo.fetchClaimBundle(claimId);
  if (!bundle) {
    return res.status(404).json({ error: 'Claim not found' });
  }
  const issues = validationService.validateClaimBundle(bundle);
  return res.status(200).json({ valid: issues.length === 0, issues });
}

export async function uploadFeedbackHandler(req: Request, res: Response): Promise<Response> {
  const { xml } = req.body ?? {};
  if (!xml || typeof xml !== 'string') {
    return res.status(400).json({ error: 'xml (string) is required' });
  }

  let parsed;
  try {
    parsed = feedbackService.parseFeedbackXml(xml);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to parse Feedback XML' });
  }

  const results = await feedbackService.reconcileFeedback(parsed);
  return res.status(200).json({ firstLevel: parsed.firstLevel, results });
}
