import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { searchManifests, getManifest } from '../db';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function listingsRouter(db: Database.Database): Router {
  const router = makeRouter();

  // GET /?q=&datasetId=&producerId=&limit=&offset=
  router.get('/', (req: Request, res: Response) => {
    try {
      const q = req.query.q ? String(req.query.q) : undefined;
      const datasetId = req.query.datasetId ? String(req.query.datasetId) : undefined;
      const producerId = req.query.producerId ? String(req.query.producerId) : undefined;
      const limit = Math.min(Number(req.query.limit || 50), 200);
      const offset = Math.max(Number(req.query.offset || 0), 0);

      const rows = searchManifests(db, { q, datasetId, limit: limit + offset });
      const items = rows.slice(offset).map(m => ({
        versionId: m.version_id,
        name: m.title || null,
        description: null, // Could extract from manifest_json if needed
        datasetId: m.dataset_id || null,
        producerId: m.producer_id || null,
        tags: null, // Could extract from manifest_json if needed
        updatedAt: m.created_at || null
      }));

      return json(res, 200, { items, limit, offset });
    } catch (e: any) {
      return json(res, 500, { error: 'search-failed', message: String(e?.message || e) });
    }
  });

  // GET /:versionId
  router.get('/:versionId', (req: Request, res: Response) => {
    try {
      const versionId = String(req.params.versionId);
      const manifest = getManifest(db, versionId);

      if (!manifest) {
        return json(res, 404, { error: 'not-found', hint: 'versionId not found' });
      }

      let manifestData: any = {};
      try {
        manifestData = JSON.parse(manifest.manifest_json || '{}');
      } catch {
        // ignore parse errors
      }

      const detail = {
        versionId: manifest.version_id,
        manifest: {
          name: manifest.title || manifestData.name || null,
          description: manifestData.description || null,
          datasetId: manifest.dataset_id || null,
          contentHash: manifest.content_hash || null,
          license: manifest.license || null,
          classification: manifest.classification || null,
          createdAt: manifest.created_at || null
        }
        // Note: price snippet would be added here with feature flag
      };

      return json(res, 200, detail);
    } catch (e: any) {
      return json(res, 500, { error: 'get-failed', message: String(e?.message || e) });
    }
  });

  return router;
}
