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

  return router;
}