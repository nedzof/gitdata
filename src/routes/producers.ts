import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { getProducerById, getProducerByDatasetId } from '../db';

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

/**
 * Producers API
 * - GET /producers/:id
 * - GET /producers?datasetId=...  (resolve mapping)
 * - (Optional) GET /producers?q=... (basic search by name, requires additional DB helper; omitted in MVP)
 */
export function producersRouter(db: Database.Database): Router {
  const router = makeRouter();

  // Resolve by datasetId
  router.get('/producers', (req: Request, res: Response) => {
    const datasetId = String(req.query.datasetId || '').trim();
    if (!datasetId) {
      return json(res, 400, { error: 'bad-request', hint: 'provide datasetId' });
    }
    const p = getProducerByDatasetId(db, datasetId);
    if (!p) return json(res, 404, { error: 'not-found', hint: 'no producer for datasetId' });
    return json(res, 200, {
      producerId: p.producer_id,
      name: p.name,
      website: p.website,
      identityKey: p.identity_key,
      createdAt: p.created_at,
    });
  });

  // Fetch by producer_id
  router.get('/producers/:id', (req: Request, res: Response) => {
    const id = String(req.params.id || '').trim();
    if (!id) return json(res, 400, { error: 'bad-request' });
    const p = getProducerById(db, id);
    if (!p) return json(res, 404, { error: 'not-found' });
    return json(res, 200, {
      producerId: p.producer_id,
      name: p.name,
      website: p.website,
      identityKey: p.identity_key,
      createdAt: p.created_at,
    });
  });

  return router;
}