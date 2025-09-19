import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getManifest, getReceipt, setReceiptStatus, updateReceiptUsage } from '../db';

// Config (can be tuned via ENV)
const DATA_ROOT = process.env.DATA_ROOT || path.resolve(process.cwd(), 'data', 'blobs');
// Total bytes allowed per receipt (MVP: simple cap)
const BYTES_MAX_PER_RECEIPT = Number(process.env.BYTES_MAX_PER_RECEIPT || 104857600); // 100 MB default
// If true, mark receipt as consumed after first successful delivery
const SINGLE_USE_RECEIPTS = /^true$/i.test(process.env.SINGLE_USE_RECEIPTS || 'false');

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

// Resolve a local file path by contentHash
function resolveBlobPath(contentHash: string): string {
  return path.join(DATA_ROOT, contentHash.toLowerCase());
}

/**
 * GET /v1/data?contentHash=&receiptId=
 * Validates the receipt, enforces TTL and quotas, then streams local file bytes from DATA_ROOT/contentHash.
 * Notes:
 * - For production, prefer presigned URLs to your object store/CDN and update counters when links are redeemed.
 * - This MVP streams from disk to demonstrate quota/TTL enforcement and atomic counters.
 */
export function dataRouter(db: Database.Database): Router {
  const router = makeRouter();

  router.get('/v1/data', async (req: Request, res: Response) => {
    try {
      const contentHash = String(req.query.contentHash || '').toLowerCase();
      const receiptId = String(req.query.receiptId || '');

      if (!/^[0-9a-fA-F]{64}$/.test(contentHash)) {
        return json(res, 400, { error: 'bad-request', hint: 'contentHash=64-hex required' });
      }
      if (!receiptId || receiptId.length < 8) {
        return json(res, 400, { error: 'bad-request', hint: 'receiptId required' });
      }

      // Load receipt and validate
      const rc = getReceipt(db, receiptId);
      if (!rc) return json(res, 404, { error: 'not-found', hint: 'receipt missing' });

      const now = Math.floor(Date.now() / 1000);
      if (now > rc.expires_at) {
        setReceiptStatus(db, receiptId, 'expired');
        return json(res, 403, { error: 'expired', hint: 'receipt expired' });
      }

      if (rc.status === 'consumed') {
        return json(res, 409, { error: 'already-consumed' });
      }
      if (rc.status !== 'pending' && rc.status !== 'paid') {
        return json(res, 403, { error: 'forbidden', hint: `invalid-status:${rc.status}` });
      }
      if (!rc.content_hash || rc.content_hash.toLowerCase() !== contentHash) {
        return json(res, 409, { error: 'content-mismatch' });
      }

      // Optional manifest presence (not strictly required for streaming)
      const man = getManifest(db, rc.version_id);
      if (!man) {
        // Not fatal for streaming, but return a clear message
        return json(res, 409, { error: 'manifest-missing', hint: 'manifest not found for version' });
      }

      // Enforce quota: total bytes per receipt
      const blobPath = resolveBlobPath(contentHash);
      if (!fs.existsSync(blobPath) || !fs.statSync(blobPath).isFile()) {
        return json(res, 404, { error: 'not-found', hint: 'content blob not found on server' });
      }
      const size = fs.statSync(blobPath).size;
      const used = rc.bytes_used || 0;
      if (BYTES_MAX_PER_RECEIPT > 0 && used + size > BYTES_MAX_PER_RECEIPT) {
        return json(res, 409, { error: 'quota-exceeded', hint: `limit=${BYTES_MAX_PER_RECEIPT}, used=${used}, size=${size}` });
      }

      // Stream headers
      res.setHeader('content-type', 'application/octet-stream');
      res.setHeader('content-length', String(size));
      res.setHeader('x-receipt-id', receiptId);
      res.setHeader('x-version-id', rc.version_id);
      res.setHeader('x-bytes-used', String(used));
      res.setHeader('x-bytes-limit', String(BYTES_MAX_PER_RECEIPT));

      // Start streaming
      const rs = fs.createReadStream(blobPath);
      rs.on('error', (err) => {
        if (!res.headersSent) {
          return json(res, 500, { error: 'stream-error', message: String((err as any)?.message || err) });
        }
        try { res.end(); } catch {}
      });
      rs.on('open', () => {
        rs.pipe(res);
      });
      rs.on('end', () => {
        // Update counters atomically after full delivery
        try {
          updateReceiptUsage(db, receiptId, size);
          if (SINGLE_USE_RECEIPTS) {
            setReceiptStatus(db, receiptId, 'consumed');
          }
        } catch {
          // swallow DB errors here; delivery succeeded
        }
      });
    } catch (e: any) {
      return json(res, 500, { error: 'data-failed', message: String(e?.message || e) });
    }
  });

  return router;
}