import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function artifactsRouter(): Router {
  const router = makeRouter();

  // GET / (list artifacts)
  router.get('/', async (req: Request, res: Response) => {
    try {
      // For now, return empty list for testing
      return json(res, 200, { items: [] });
    } catch (e: any) {
      return json(res, 500, { error: 'list-failed', message: String(e?.message || e) });
    }
  });

  // GET /:id (get specific artifact)
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const artifactId = req.params.id;
      // For now, always return 404 since no artifacts are implemented
      return json(res, 404, { error: 'not-found', message: `Artifact ${artifactId} not found` });
    } catch (e: any) {
      return json(res, 500, { error: 'get-failed', message: String(e?.message || e) });
    }
  });

  return router;
}