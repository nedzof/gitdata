import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { getManifest, getPrice, setPrice } from '../db';

const PRICE_DEFAULT_SATS = Number(process.env.PRICE_DEFAULT_SATS || 5000);
// Optional quote TTL (seconds)
const PRICE_QUOTE_TTL_SEC = Number(process.env.PRICE_QUOTE_TTL_SEC || 1800);

function isHex64(s: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(s);
}

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

export function priceRouter(db: Database.Database): Router {
  const router = makeRouter();

  // GET /price?versionId=...
  router.get('/price', (req: Request, res: Response) => {
    const versionId = String(req.query.versionId || '').toLowerCase();
    if (!isHex64(versionId)) {
      return json(res, 400, { error: 'bad-request', hint: 'versionId=64-hex' });
    }

    const man = getManifest(db, versionId);
    if (!man) {
      return json(res, 404, { error: 'not-found', hint: 'manifest missing' });
    }

    const satoshis = getPrice(db, versionId) ?? PRICE_DEFAULT_SATS;
    const expiresAt = Math.floor(Date.now() / 1000) + PRICE_QUOTE_TTL_SEC;

    return json(res, 200, {
      versionId,
      contentHash: man.content_hash,
      satoshis,
      expiresAt,
    });
  });

  // POST /price { versionId, satoshis }
  router.post('/price', (req: Request, res: Response) => {
    const { versionId, satoshis } = req.body || {};
    if (!isHex64(String(versionId || ''))) {
      return json(res, 400, { error: 'bad-request', hint: 'versionId=64-hex' });
    }
    if (!Number.isInteger(satoshis) || satoshis <= 0) {
      return json(res, 400, { error: 'bad-request', hint: 'satoshis > 0 (integer)' });
    }

    // Optional: ensure manifest exists before setting price
    const man = getManifest(db, String(versionId).toLowerCase());
    if (!man) {
      return json(res, 404, { error: 'not-found', hint: 'manifest missing' });
    }

    setPrice(db, String(versionId).toLowerCase(), Number(satoshis));
    return json(res, 200, { status: 'ok' });
  });

  return router;
}
