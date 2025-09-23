import fs from 'fs';
import path from 'path';

import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';

import * as db from '../db';
import { getStorageDriver, parseRange, formatContentRange } from '../storage';

// Config (can be tuned via ENV)
const DATA_ROOT = process.env.DATA_ROOT || path.resolve(process.cwd(), 'data', 'blobs');
// Total bytes allowed per receipt (MVP: simple cap)
const BYTES_MAX_PER_RECEIPT = Number(process.env.BYTES_MAX_PER_RECEIPT || 104857600); // 100 MB default
// If true, mark receipt as consumed after first successful delivery
const SINGLE_USE_RECEIPTS = /^true$/i.test(process.env.SINGLE_USE_RECEIPTS || 'false');
// Storage tier for data delivery (default: hot for fast access)
const DATA_DELIVERY_TIER = (process.env.DATA_DELIVERY_TIER || 'hot') as 'hot' | 'warm' | 'cold';
// Presigned URL mode: direct|presigned|stream (read dynamically for testing)
function getDataDeliveryMode(): string {
  return process.env.DATA_DELIVERY_MODE || 'presigned';
}

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

// Resolve a local file path by contentHash
function resolveBlobPath(contentHash: string): string {
  return path.join(DATA_ROOT, contentHash.toLowerCase());
}

/**
 * GET /v1/data?contentHash=&receiptId=[&redirect=true]
 * D22 modernized data delivery with storage backend integration.
 *
 * Modes:
 * - presigned (default): Returns presigned URL for direct CDN/S3 access
 * - stream: Streams content through the overlay (fallback mode)
 * - direct: Returns CDN URL directly (if available)
 *
 * With redirect=true: automatically redirects to presigned URL
 * Without redirect: returns JSON with presigned URL for client handling
 */
export function dataRouter(): Router {
  const router = makeRouter();

  router.get('/v1/data', async (req: Request, res: Response) => {
    try {
      const contentHash = String(req.query.contentHash || '').toLowerCase();
      const receiptId = String(req.query.receiptId || '');
      const redirect = String(req.query.redirect || '').toLowerCase() === 'true';

      if (!/^[0-9a-fA-F]{64}$/.test(contentHash)) {
        return json(res, 400, { error: 'bad-request', hint: 'contentHash=64-hex required' });
      }
      if (!receiptId || receiptId.length < 8) {
        return json(res, 400, { error: 'bad-request', hint: 'receiptId required' });
      }

      // Load receipt and validate
      const rc = await db.getReceipt(receiptId);
      if (!rc) return json(res, 404, { error: 'not-found', hint: 'receipt missing' });

      const now = Math.floor(Date.now() / 1000);
      if (now > rc.expires_at) {
        // Don't update status, just return error for expired receipt
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

      // Optional manifest validation
      const man = await db.getManifest(rc.version_id);
      if (!man) {
        return json(res, 409, {
          error: 'manifest-missing',
          hint: 'manifest not found for version',
        });
      }

      // Get storage driver and check object existence
      const storage = getStorageDriver();
      const objectExists = await storage.objectExists(contentHash, DATA_DELIVERY_TIER);

      if (!objectExists) {
        return json(res, 404, { error: 'not-found', hint: 'content not found in storage' });
      }

      // Get object metadata for quota checks
      const metadata = await storage.headObject(contentHash, DATA_DELIVERY_TIER);
      const size = metadata.contentLength || 0;
      const used = rc.bytes_used || 0;

      if (BYTES_MAX_PER_RECEIPT > 0 && used + size > BYTES_MAX_PER_RECEIPT) {
        return json(res, 409, {
          error: 'quota-exceeded',
          hint: `limit=${BYTES_MAX_PER_RECEIPT}, used=${used}, size=${size}`,
        });
      }

      // Handle different delivery modes
      const deliveryMode = getDataDeliveryMode();
      if (deliveryMode === 'presigned' || deliveryMode === 'direct') {
        try {
          const presignedUrl = await storage.getPresignedUrl(contentHash, DATA_DELIVERY_TIER);

          // Update usage counters when URL is generated (optimistic counting)
          await db.updateReceiptUsage(receiptId, size);
          if (SINGLE_USE_RECEIPTS) {
            await db.setReceiptStatus(receiptId, 'consumed');
          }

          if (redirect) {
            // Direct redirect to presigned URL
            return res.redirect(302, presignedUrl.url);
          } else {
            // Return URL in JSON response
            return json(res, 200, {
              success: true,
              delivery: {
                method: 'presigned-url',
                url: presignedUrl.url,
                expiresAt: presignedUrl.expiresAt,
                headers: presignedUrl.headers || {},
              },
              metadata: {
                contentHash,
                receiptId,
                versionId: rc.version_id,
                size,
                tier: DATA_DELIVERY_TIER,
                bytesUsed: used + size,
                bytesLimit: BYTES_MAX_PER_RECEIPT,
              },
            });
          }
        } catch (error) {
          // Fallback to streaming if presigned URL fails
          console.warn('Presigned URL generation failed, falling back to streaming:', error);
        }
      }

      // Streaming mode (fallback or explicit)
      const rangeHeader = req.headers.range;
      let range = undefined;

      if (rangeHeader) {
        range = parseRange(rangeHeader, size);
        if (!range) {
          return json(res, 416, { error: 'range-not-satisfiable' });
        }
      }

      const { data, metadata: streamMetadata } = await storage.getObject(
        contentHash,
        DATA_DELIVERY_TIER,
        range,
      );

      // Set response headers
      res.setHeader('content-type', streamMetadata.contentType || 'application/octet-stream');
      res.setHeader('x-receipt-id', receiptId);
      res.setHeader('x-version-id', rc.version_id);
      res.setHeader('x-bytes-used', String(used));
      res.setHeader('x-bytes-limit', String(BYTES_MAX_PER_RECEIPT));
      res.setHeader('x-storage-tier', DATA_DELIVERY_TIER);
      res.setHeader('accept-ranges', 'bytes');

      if (range) {
        res.status(206);
        res.setHeader('content-range', formatContentRange(range.start!, range.end!, size));
        res.setHeader('content-length', String(range.end! - range.start! + 1));
      } else {
        res.setHeader('content-length', String(size));
      }

      // Stream data
      data.on('error', (err) => {
        if (!res.headersSent) {
          return json(res, 500, {
            error: 'stream-error',
            message: String((err as any)?.message || err),
          });
        }
        try {
          res.end();
        } catch {
          // Ignore res.end() errors (client may have disconnected)
        }
      });

      data.on('end', async () => {
        // Update counters after successful delivery
        try {
          await db.updateReceiptUsage(receiptId, range ? range.end! - range.start! + 1 : size);
          if (SINGLE_USE_RECEIPTS && !range) {
            await db.setReceiptStatus(receiptId, 'consumed');
          }
        } catch {
          // swallow DB errors here; delivery succeeded
        }
      });

      data.pipe(res);
    } catch (e: any) {
      return json(res, 500, { error: 'data-failed', message: String(e?.message || e) });
    }
  });

  return router;
}
