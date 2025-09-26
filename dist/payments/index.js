"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPaymentsMigrations = runPaymentsMigrations;
exports.generateQuote = generateQuote;
exports.submitPayment = submitPayment;
exports.reconcilePayments = reconcilePayments;
//import { getDatabase, type DeclarationRow, type ManifestRow, getProducerIdForVersion } from '../db';
const db_1 = require("../db");
// Environment config helper
function getEnvConfig() {
    return {
        POLICY_MIN_CONFS: Number(process.env.POLICY_MIN_CONFS || 1),
        RECEIPT_TTL_SEC: Number(process.env.RECEIPT_TTL_SEC || 3600),
        PAYMENT_TIMEOUT_SEC: Number(process.env.PAYMENT_TIMEOUT_SEC || 1800),
    };
}
function nowSec() {
    return Math.floor(Date.now() / 1000);
}
function safeParse(s, fallback) {
    try {
        return JSON.parse(s);
    }
    catch {
        return fallback;
    }
}
// ------------ DB migration helpers ------------
async function tableHasColumn(db, table, column) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = $1 AND column_name = $2
  `, [table, column]);
    return result.rows.length > 0;
}
async function ensureColumn(db, table, column, ddlType) {
    if (!(await tableHasColumn(db, table, column))) {
        const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
        const pgClient = getPostgreSQLClient();
        await pgClient.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`);
    }
}
async function runPaymentsMigrations(db) {
    // Use PostgreSQL for all migrations
    try {
        const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
        const pgClient = getPostgreSQLClient();
        // Fix quote_expires_at column type if it exists as wrong type
        try {
            await pgClient.query('ALTER TABLE receipts DROP COLUMN IF EXISTS quote_expires_at');
        }
        catch (e) {
            /* ignore */
        }
        // receipts: add payment fields if not present
        await ensureColumn(null, 'receipts', 'payment_txid', 'TEXT');
        await ensureColumn(null, 'receipts', 'paid_at', 'INTEGER');
        await ensureColumn(null, 'receipts', 'payment_outputs_json', 'TEXT');
        await ensureColumn(null, 'receipts', 'fee_sat', 'INTEGER');
        await ensureColumn(null, 'receipts', 'quote_template_hash', 'TEXT');
        await ensureColumn(null, 'receipts', 'quote_expires_at', 'INTEGER');
        await ensureColumn(null, 'receipts', 'unit_price_sat', 'INTEGER');
    }
    catch (e) {
        console.warn('[payments.migration] receipts table missing; ensure base schema exists before running payments migrations.');
    }
    try {
        // producers: ensure payout_script_hex
        await ensureColumn(null, 'producers', 'payout_script_hex', 'TEXT');
    }
    catch (e) {
        console.warn('[payments.migration] producers table missing or unmanaged in this scaffold.');
    }
    // Create payment_events table for D21 (separate from existing revenue_events)
    try {
        const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
        const pgClient = getPostgreSQLClient();
        await pgClient.query(`
      CREATE TABLE IF NOT EXISTS payment_events (
        event_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        receipt_id TEXT,
        txid TEXT,
        details_json TEXT,
        created_at BIGINT NOT NULL
      )
    `);
        await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_payment_events_type ON payment_events(type)`);
        await pgClient.query(`CREATE INDEX IF NOT EXISTS idx_payment_events_receipt ON payment_events(receipt_id)`);
    }
    catch (e) {
        console.warn('[payments.migration] payment_events table creation failed:', e);
    }
}
async function getReceipt(receiptId) {
    try {
        const receipt = await (0, db_1.getReceiptFromDb)(receiptId);
        return receipt;
    }
    catch {
        return undefined;
    }
}
async function setReceiptQuote(receiptId, templateHash, expiresAt) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
    const pgClient = getPostgreSQLClient();
    await pgClient.query(`UPDATE overlay_receipts SET quote_template_hash = $1, quote_expires_at = $2 WHERE receipt_id = $3`, [templateHash, expiresAt, receiptId]);
}
async function setReceiptPaid(receiptId, txid, feeSat, outputs) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
    const pgClient = getPostgreSQLClient();
    await pgClient.query(`UPDATE overlay_receipts SET status = 'paid', payment_txid = $1, fee_sat = $2, paid_at = $3, payment_outputs_json = $4 WHERE receipt_id = $5`, [txid, feeSat || 0, nowSec(), JSON.stringify(outputs || []), receiptId]);
}
async function setReceiptConfirmed(receiptId) {
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
    const pgClient = getPostgreSQLClient();
    await pgClient.query(`UPDATE overlay_receipts SET status = 'confirmed' WHERE receipt_id = $1`, [
        receiptId,
    ]);
}
async function logPaymentEvent(type, receiptId, txid, details) {
    const id = 'pay_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
    const pgClient = getPostgreSQLClient();
    await pgClient.query(`INSERT INTO payment_events(event_id, type, receipt_id, txid, details_json, created_at) VALUES ($1, $2, $3, $4, $5, $6)`, [id, type, receiptId, txid, JSON.stringify(details || {}), nowSec()]);
}
async function getProducerByVersion(versionId) {
    // Find producer by joining manifests to producers via producer_id
    try {
        const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
        const pgClient = getPostgreSQLClient();
        const result = await pgClient.query(`SELECT p.* FROM producers p
       JOIN manifests m ON m.producer_id = p.producer_id
       WHERE m.version_id = $1 LIMIT 1`, [versionId]);
        return result.rows[0];
    }
    catch {
        return undefined;
    }
}
// ------------ Template builder (deterministic) ------------
function createPaymentTemplate(producer, satoshis) {
    const script = producer.payout_script_hex || '00'; // fallback to OP_FALSE
    const expiresAt = nowSec() + getEnvConfig().PAYMENT_TIMEOUT_SEC;
    // Create deterministic template hash
    const templateData = {
        script,
        satoshis,
        expiresAt,
        producerId: producer.producer_id,
    };
    const templateHash = require('crypto')
        .createHash('sha256')
        .update(JSON.stringify(templateData))
        .digest('hex');
    return {
        outputScript: script,
        satoshis,
        expiresAt,
        templateHash,
    };
}
function validatePaymentSubmission(submission, template) {
    // 1) Template hash must match
    if (submission.templateHash !== template.templateHash)
        return false;
    // 2) Must not be expired
    if (nowSec() > template.expiresAt)
        return false;
    // 3) Outputs must match template
    const expectedOutput = {
        script: template.outputScript,
        value: template.satoshis,
    };
    const hasMatchingOutput = submission.outputs.some((out) => out.script === expectedOutput.script && out.value === expectedOutput.value);
    return hasMatchingOutput;
}
// ------------ Main payment flow (D21) ------------
async function generateQuote(versionId, satoshis) {
    try {
        const producer = await getProducerByVersion(versionId);
        if (!producer) {
            console.warn('[payments] No producer found for version:', versionId);
            return null;
        }
        // Default pricing or override
        const finalSats = satoshis || 1000; // Default 1000 sats
        const template = createPaymentTemplate(producer, finalSats);
        // Find or create receipt for this version
        const receipt = await getReceipt(versionId);
        if (receipt) {
            await setReceiptQuote(receipt.receipt_id, template.templateHash, template.expiresAt);
            await logPaymentEvent('payment-quoted', receipt.receipt_id, null, {
                satoshis: finalSats,
                templateHash: template.templateHash,
            });
        }
        return template;
    }
    catch (e) {
        console.error('[payments] Quote generation failed:', e?.message || e);
        return null;
    }
}
async function submitPayment(receiptId, submission) {
    try {
        const receipt = await getReceipt(receiptId);
        if (!receipt || receipt.status !== 'quoted') {
            return { success: false, error: 'invalid-receipt-state' };
        }
        // Get the stored quote to validate against
        const producer = await getProducerByVersion(receipt.version_id);
        if (!producer) {
            return { success: false, error: 'producer-not-found' };
        }
        const template = createPaymentTemplate(producer, receipt.satoshis);
        if (!validatePaymentSubmission(submission, template)) {
            return { success: false, error: 'invalid-payment' };
        }
        // Extract TXID from rawTx (simplified - in reality you'd parse the transaction)
        const txid = require('crypto')
            .createHash('sha256')
            .update(Buffer.from(submission.rawTx, 'hex'))
            .digest('hex');
        await setReceiptPaid(receiptId, txid, 0, submission.outputs); // fee calculation TBD
        await logPaymentEvent('payment-submitted', receiptId, txid, {
            rawTxLength: submission.rawTx.length / 2,
            outputCount: submission.outputs.length,
        });
        return { success: true, txid };
    }
    catch (e) {
        console.error('[payments] Payment submission failed:', e?.message || e);
        return { success: false, error: 'submission-failed' };
    }
}
// ------------ Reconcile job (SPV attach + status flip) ------------
async function reconcilePayments() {
    // Select receipts with status='paid' to check confirmations
    const { getPostgreSQLClient } = await Promise.resolve().then(() => __importStar(require('../db/postgresql')));
    const pgClient = getPostgreSQLClient();
    const result = await pgClient.query(`SELECT receipt_id, payment_txid FROM overlay_receipts WHERE status = 'paid' AND payment_txid IS NOT NULL`);
    for (const row of result.rows) {
        const txid = String(row.payment_txid);
        try {
            const confs = await verifyTxSPV(txid);
            const config = getEnvConfig();
            if (confs >= config.POLICY_MIN_CONFS) {
                await setReceiptConfirmed(row.receipt_id);
                await logPaymentEvent('payment-confirmed', row.receipt_id, txid, { confs });
            }
        }
        catch (e) {
            // keep as paid; reconcile will try again later
        }
    }
}
// SPV verification stub - integrate with existing SPV module
async function verifyTxSPV(txid) {
    // TODO: integrate with actual SPV verification logic
    // For now, always return 0 (not confirmed)
    return 0;
}
//# sourceMappingURL=index.js.map