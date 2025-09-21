import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import crypto from 'crypto';
import { getManifest, getPrice, insertReceipt, getReceipt } from '../db';

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

function getPriceDefaultSats(): number {
  return Number(process.env.PRICE_DEFAULT_SATS || 5000);
}

function getReceiptTtlSec(): number {
  return Number(process.env.RECEIPT_TTL_SEC || 1800);
}

function randomId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function calculateTxid(rawTxHex: string): string {
  return crypto.createHash('sha256').update(Buffer.from(rawTxHex, 'hex')).digest('hex');
}

function parseTxOutputs(rawTxHex: string) {
  // Simplified mock transaction parsing
  // In a real implementation, this would properly parse the transaction
  return [{ scriptHex: '76a914deadbeef88ac', satoshis: 5000 }];
}

export function paymentsRouter(): Router {
  const router = makeRouter();

  // POST /payments/quote
  router.post('/quote', async (req: Request, res: Response) => {
    try {
      const { receiptId } = req.body || {};
      if (!receiptId) {
        return json(res, 400, { error: 'bad-request', hint: 'receiptId required' });
      }

      const receipt = await getReceipt(receiptId);
      if (!receipt) {
        return json(res, 404, { error: 'not-found' });
      }

      if (receipt.status !== 'pending') {
        return json(res, 409, { error: 'invalid-state' });
      }

      // Get producer and create deterministic payment template
      const { getPostgreSQLClient } = await import('../db/postgresql');
      const pgClient = getPostgreSQLClient();

      // Get producer info from manifest
      const manifest = await getManifest(receipt.version_id);
      if (!manifest || !manifest.producer_id) {
        return json(res, 404, { error: 'producer-not-found' });
      }

      const producerResult = await pgClient.query(
        'SELECT payout_script_hex FROM producers WHERE producer_id = $1',
        [manifest.producer_id]
      );

      if (producerResult.rows.length === 0) {
        return json(res, 404, { error: 'producer-not-found' });
      }

      const producer = producerResult.rows[0];
      const payoutScript = producer.payout_script_hex || '76a914deadbeef88ac';

      // Calculate splits
      const splits = JSON.parse(process.env.PAY_SPLITS_JSON || '{"producer": 1.0}');
      const scripts = JSON.parse(process.env.PAY_SCRIPTS_JSON || '{}');

      const outputs = [];
      for (const [entity, ratio] of Object.entries(splits)) {
        const amount = Math.floor(receipt.amount_sat * (ratio as number));
        const scriptHex = entity === 'producer' ? payoutScript : scripts[entity] || payoutScript;
        outputs.push({ scriptHex, satoshis: amount });
      }

      // Create deterministic template hash
      const templateData = {
        receiptId,
        outputs,
        amountSat: receipt.amount_sat,
        expiresAt: Math.floor(Date.now() / 1000) + getReceiptTtlSec()
      };

      const templateHash = crypto.createHash('sha256')
        .update(JSON.stringify(templateData))
        .digest('hex');

      // Update receipt with quote info and change status to 'quoted'
      await pgClient.query(
        'UPDATE receipts SET status = $1, quote_template_hash = $2, quote_expires_at = $3 WHERE receipt_id = $4',
        ['quoted', templateHash, templateData.expiresAt, receiptId]
      );

      // Log payment event
      await pgClient.query(
        `INSERT INTO payment_events(event_id, type, receipt_id, details_json, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          `pay_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          'payment-quoted',
          receiptId,
          JSON.stringify({ templateHash }),
          Math.floor(Date.now() / 1000)
        ]
      );

      return json(res, 200, {
        versionId: receipt.version_id,
        amountSat: receipt.amount_sat,
        outputs,
        templateHash,
        expiresAt: templateData.expiresAt
      });

    } catch (e: any) {
      return json(res, 500, { error: 'quote-failed', message: String(e?.message || e) });
    }
  });

  // POST /payments/submit
  router.post('/submit', async (req: Request, res: Response) => {
    try {
      const { receiptId, rawTxHex } = req.body || {};
      if (!receiptId || !rawTxHex) {
        return json(res, 400, { error: 'bad-request' });
      }

      const receipt = await getReceipt(receiptId);
      if (!receipt) {
        return json(res, 404, { error: 'not-found' });
      }

      // Check if already paid (idempotent)
      if (receipt.status === 'paid') {
        return json(res, 200, {
          status: 'accepted',
          txid: receipt.payment_txid,
          note: 'idempotent-return',
          mapi: { mode: 'dryrun' }
        });
      }

      // Accept both 'quoted' and 'pending' status for flexibility
      if (receipt.status !== 'quoted' && receipt.status !== 'pending') {
        return json(res, 409, { error: 'invalid-state', hint: `Receipt status is ${receipt.status}` });
      }

      // Check quote expiration
      if (receipt.quote_expires_at && Math.floor(Date.now() / 1000) > receipt.quote_expires_at) {
        return json(res, 410, { error: 'quote-expired' });
      }

      // Calculate txid and parse outputs
      const txid = calculateTxid(rawTxHex);
      const outputs = parseTxOutputs(rawTxHex);

      // Update receipt as paid
      const { getPostgreSQLClient } = await import('../db/postgresql');
      const pgClient = getPostgreSQLClient();

      await pgClient.query(
        'UPDATE receipts SET status = $1, payment_txid = $2, paid_at = $3 WHERE receipt_id = $4',
        ['paid', txid, Math.floor(Date.now() / 1000), receiptId]
      );

      // Log payment event
      await pgClient.query(
        `INSERT INTO payment_events(event_id, type, receipt_id, txid, details_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `pay_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          'payment-submitted',
          receiptId,
          txid,
          JSON.stringify({ outputs }),
          Math.floor(Date.now() / 1000)
        ]
      );

      return json(res, 200, {
        status: 'accepted',
        txid,
        mapi: { mode: 'dryrun' }
      });

    } catch (e: any) {
      return json(res, 500, { error: 'submit-failed', message: String(e?.message || e) });
    }
  });

  // GET /payments/:receiptId
  router.get('/:receiptId', async (req: Request, res: Response) => {
    try {
      const receiptId = req.params.receiptId;
      const receipt = await getReceipt(receiptId);

      if (!receipt) {
        return json(res, 404, { error: 'not-found' });
      }

      return json(res, 200, {
        receipt: {
          receiptId: receipt.receipt_id,
          versionId: receipt.version_id,
          status: receipt.status,
          quantity: Number(receipt.quantity),
          amountSat: Number(receipt.amount_sat),
          unitPriceSat: Math.floor(Number(receipt.amount_sat) / Number(receipt.quantity)),
          quote: receipt.quote_template_hash ? {
            templateHash: receipt.quote_template_hash,
            expiresAt: receipt.quote_expires_at
          } : null,
          payment: receipt.payment_txid ? {
            txid: receipt.payment_txid,
            paidAt: receipt.paid_at
          } : null
        }
      });

    } catch (e: any) {
      return json(res, 500, { error: 'get-failed', message: String(e?.message || e) });
    }
  });

  return router;
}