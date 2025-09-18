import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { getManifest, getPrice, setPrice } from '../db';

const PRICE_DEFAULT_SATS = Number(process.env.PRICE_DEFAULT_SATS || 5000);

export function priceRouter(db: Database.Database): Router {
  const router = makeRouter();

  // GET price?versionId=... (simple)
  router.get('/price', (req: Request, res: Response) => {
    const versionId = String(req.query.versionId || '').toLowerCase();
    if (!/^[0-9a-fA-F]{64}$/.test(versionId)) {
      return res.status(400).json({ error: 'bad-request', hint: 'versionId=64-hex' });
    }
    const man = getManifest(db, versionId);
    if (!man) return res.status(404).json({ error: 'not-found', hint: 'manifest missing' });
    const satoshis = getPrice(db, versionId) ?? PRICE_DEFAULT_SATS;
    return res.status(200).json({
      versionId,
      contentHash: man.content_hash,
      satoshis,
      expiresAt: Math.floor(Date.now() / 1000) + 1800,
    });
  });

  // POST price (admin/publisher can set)
  router.post('/price', (req: Request, res: Response) => {
    const { versionId, satoshis } = req.body || {};
    if (!/^[0-9a-fA-F]{64}$/.test(String(versionId || ''))) {
      return res.status(400).json({ error: 'bad-request', hint: 'versionId=64-hex' });
    }
    if (!Number.isInteger(satoshis) || satoshis <= 0) {
      return res.status(400).json({ error: 'bad-request', hint: 'satoshis > 0' });
    }
    setPrice(db, versionId.toLowerCase(), Number(satoshis));
    return res.status(200).json({ status: 'ok' });
  });

  return router;
}
