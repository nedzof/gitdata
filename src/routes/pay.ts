import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { getManifest, getPrice, insertReceipt, getReceipt, logRevenue } from '../db';

const PRICE_DEFAULT_SATS = Number(process.env.PRICE_DEFAULT_SATS || 5000);
const RECEIPT_TTL_SEC = Number(process.env.RECEIPT_TTL_SEC || 1800); // 30 minutes

function isHex64(s: string): boolean { return /^[0-9a-fA-F]{64}$/.test(s); }

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

export function payRouter(db: Database.Database): Router {
  const router = makeRouter();

  // POST /pay { versionId, quantity }
  router.post('/pay', (req: Request, res: Response) => {
    try {
      const { versionId, quantity } = req.body || {};
      if (!isHex64(String(versionId || ''))) {
        return json(res, 400, { error: 'bad-request', hint: 'versionId=64-hex' });
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return json(res, 400, { error: 'bad-request', hint: 'quantity must be integer > 0' });
      }

      const man = getManifest(db, String(versionId).toLowerCase());
      if (!man) {
        return json(res, 404, { error: 'not-found', hint: 'manifest missing' });
      }

      const unit = getPrice(db, String(versionId).toLowerCase()) ?? PRICE_DEFAULT_SATS;
      const amount = unit * Number(quantity);
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + RECEIPT_TTL_SEC;

      const receiptId = randomId('rcpt');
      insertReceipt(db, {
        receipt_id: receiptId,
        version_id: String(versionId).toLowerCase(),
        quantity: Number(quantity),
        content_hash: man.content_hash || null,
        amount_sat: amount,
        status: 'pending',
        created_at: now,
        expires_at: expiresAt,
      });

      // Simple revenue log entry (pending)
      logRevenue(db, {
        receipt_id: receiptId,
        version_id: String(versionId).toLowerCase(),
        amount_sat: amount,
        quantity: Number(quantity),
        created_at: now,
        type: 'pay',
      });

      // Return receipt JSON (schema-aligned). Signature omitted in MVP.
      return json(res, 200, {
        receiptId,
        versionId: String(versionId).toLowerCase(),
        contentHash: man.content_hash,
        quantity: Number(quantity),
        amountSat: amount,
        status: 'pending',
        createdAt: now,
        expiresAt,
      });
    } catch (e: any) {
      return json(res, 500, { error: 'pay-failed', message: String(e?.message || e) });
    }
  });

  // GET /receipt?receiptId=...
  router.get('/receipt', (req: Request, res: Response) => {
    const receiptId = String(req.query.receiptId || '');
    if (!receiptId || receiptId.length < 8) {
      return json(res, 400, { error: 'bad-request', hint: 'receiptId required' });
    }
    const r = getReceipt(db, receiptId);
    if (!r) {
      return json(res, 404, { error: 'not-found', hint: 'receipt missing' });
    }
    return json(res, 200, {
      receiptId: r.receipt_id,
      versionId: r.version_id,
      contentHash: r.content_hash,
      quantity: r.quantity,
      amountSat: r.amount_sat,
      status: r.status,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    });
  });

  return router;
}