import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { getManifest, setPrice, upsertPriceRule, deletePriceRule, getBestUnitPrice } from '../db';
import { requireIdentity } from '../middleware/identity';

const PRICE_DEFAULT_SATS = Number(process.env.PRICE_DEFAULT_SATS || 5000);
const PRICE_QUOTE_TTL_SEC = Number(process.env.PRICE_QUOTE_TTL_SEC || 1800);

function isHex64(s: string): boolean { return /^[0-9a-fA-F]{64}$/.test(s); }
function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function priceRouter(): Router {
  const router = makeRouter();

  // GET /price?versionId=&quantity=...
  router.get('/price', async (req: Request, res: Response) => {
    const versionId = String(req.query.versionId || '').toLowerCase();
    const qtyParam = req.query.quantity;
    const quantity = Math.max(1, Number(qtyParam || 1));
    if (!isHex64(versionId)) return json(res, 400, { error: 'bad-request', hint: 'versionId=64-hex' });

    const man = await getManifest(versionId);
    if (!man) return json(res, 404, { error: 'not-found', hint: 'manifest missing' });

    // Use PostgreSQL only
    let best: { satoshis: number; source: string; tier_from?: number };
    try {
      best = await getBestUnitPrice(versionId, quantity, PRICE_DEFAULT_SATS);
    } catch (error) {
      return json(res, 500, { error: 'database-error', hint: 'pricing system' });
    }
    const unit = best.satoshis;
    const total = unit * quantity;
    const expiresAt = Math.floor(Date.now() / 1000) + PRICE_QUOTE_TTL_SEC;

    // Backward compatibility: if quantity=1 (default), return old format
    if (quantity === 1 && !req.query.quantity) {
      return json(res, 200, {
        versionId,
        contentHash: man.content_hash,
        satoshis: unit,
        expiresAt,
      });
    }

    // New format with quantity support
    return json(res, 200, {
      versionId,
      contentHash: man.content_hash,
      unitSatoshis: unit,
      quantity,
      totalSatoshis: total,
      ruleSource: best.source,
      tierFrom: best.tier_from ?? 1,
      expiresAt,
    });
  });

  // Legacy: POST /price { versionId, satoshis } - for backward compatibility
  router.post('/price', requireIdentity(), async (req: Request, res: Response) => {
    const { versionId, satoshis } = req.body || {};
    if (!isHex64(String(versionId || ''))) {
      return json(res, 400, { error: 'bad-request', hint: 'versionId=64-hex' });
    }
    if (!Number.isInteger(satoshis) || satoshis <= 0) {
      return json(res, 400, { error: 'bad-request', hint: 'satoshis > 0 (integer)' });
    }

    // Optional: ensure manifest exists before setting price
    const man = await getManifest(String(versionId).toLowerCase());
    if (!man) {
      return json(res, 404, { error: 'not-found', hint: 'manifest missing' });
    }

    await setPrice(String(versionId).toLowerCase(), Number(satoshis));
    return json(res, 200, { status: 'ok' });
  });

  // Admin: POST /price/rules (set/add rule)
  // Body: { versionId?, producerId?, tierFrom, satoshis }
  router.post('/price/rules', requireIdentity(), async (req: Request, res: Response) => {
    const { versionId, producerId, tierFrom, satoshis } = req.body || {};
    if (!versionId && !producerId) return json(res, 400, { error: 'bad-request', hint: 'versionId or producerId required' });
    if (versionId && !isHex64(String(versionId || ''))) return json(res, 400, { error: 'bad-request', hint: 'versionId=64-hex' });
    if (!Number.isInteger(tierFrom) || tierFrom < 1) return json(res, 400, { error: 'bad-request', hint: 'tierFrom >= 1' });
    if (!Number.isInteger(satoshis) || satoshis <= 0) return json(res, 400, { error: 'bad-request', hint: 'satoshis > 0 integer' });

    try {
      if (db) {
        // Use SQLite for test database (synchronous)
        upsertPriceRule(db, {
          version_id: versionId ? String(versionId).toLowerCase() : null,
          producer_id: producerId || null,
          tier_from: Number(tierFrom),
          satoshis: Number(satoshis),
        });
      } else {
        // Use PostgreSQL for production (async)
        await upsertPriceRule({
          version_id: versionId ? String(versionId).toLowerCase() : null,
          producer_id: producerId || null,
          tier_from: Number(tierFrom),
          satoshis: Number(satoshis),
        });
      }
      return json(res, 200, { status: 'ok' });
    } catch (e: any) {
      return json(res, 500, { error: 'set-rule-failed', message: String(e?.message || e) });
    }
  });

  // Admin: DELETE /price/rules?versionId=&producerId=&tierFrom=
  router.delete('/price/rules', requireIdentity(), async (req: Request, res: Response) => {
    const versionId = req.query.versionId ? String(req.query.versionId).toLowerCase() : undefined;
    const producerId = req.query.producerId ? String(req.query.producerId) : undefined;
    const tierFrom = req.query.tierFrom ? Number(req.query.tierFrom) : undefined;
    if (!versionId && !producerId) return json(res, 400, { error: 'bad-request', hint: 'versionId or producerId required' });
    try {
      if (db) {
        // Use SQLite for test database (synchronous)
        deletePriceRule(db, { version_id: versionId, producer_id: producerId, tier_from: tierFrom || null });
      } else {
        // Use PostgreSQL for production (async)
        await deletePriceRule(versionId, producerId, tierFrom);
      }
      return json(res, 200, { status: 'ok' });
    } catch (e: any) {
      return json(res, 500, { error: 'delete-rule-failed', message: String(e?.message || e) });
    }
  });

  return router;
}