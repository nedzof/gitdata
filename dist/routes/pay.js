"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.payRouter = payRouter;
const crypto_1 = __importDefault(require("crypto"));
const express_1 = require("express");
const db_1 = require("../db");
// Read dynamically to support test environment variables
function getPriceDefaultSats() {
    return Number(process.env.PRICE_DEFAULT_SATS || 5000);
}
function getReceiptTtlSec() {
    return Number(process.env.RECEIPT_TTL_SEC || 1800); // 30 minutes
}
function isHex64(s) {
    return /^[0-9a-fA-F]{64}$/.test(s);
}
function randomId(prefix) {
    return `${prefix}_${crypto_1.default.randomBytes(8).toString('hex')}`;
}
function json(res, code, body) {
    return res.status(code).json(body);
}
function payRouter() {
    const router = (0, express_1.Router)();
    // POST /pay { versionId, quantity }
    router.post('/pay', async (req, res) => {
        try {
            const { versionId, quantity } = req.body || {};
            if (!isHex64(String(versionId || ''))) {
                return json(res, 400, { error: 'bad-request', hint: 'versionId=64-hex' });
            }
            if (!Number.isInteger(quantity) || quantity <= 0) {
                return json(res, 400, { error: 'bad-request', hint: 'quantity must be integer > 0' });
            }
            const man = await (0, db_1.getManifest)(String(versionId).toLowerCase());
            if (!man) {
                return json(res, 404, { error: 'not-found', hint: 'manifest missing' });
            }
            const unit = (await (0, db_1.getPrice)(String(versionId).toLowerCase())) ?? getPriceDefaultSats();
            const amount = unit * Number(quantity);
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = now + getReceiptTtlSec();
            const receiptId = randomId('rcpt');
            await (0, db_1.insertReceipt)({
                receipt_id: receiptId,
                version_id: String(versionId).toLowerCase(),
                quantity: Number(quantity),
                content_hash: man.content_hash || null,
                amount_sat: amount,
                status: 'pending',
                created_at: now,
                expires_at: expiresAt,
                bytes_used: 0,
                last_seen: null,
            });
            // TODO: Implement revenue logging for PostgreSQL if needed
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
        }
        catch (e) {
            return json(res, 500, { error: 'pay-failed', message: String(e?.message || e) });
        }
    });
    // GET /receipt?receiptId=...
    router.get('/receipt', async (req, res) => {
        const receiptId = String(req.query.receiptId || '');
        if (!receiptId || receiptId.length < 8) {
            return json(res, 400, { error: 'bad-request', hint: 'receiptId required' });
        }
        const r = await (0, db_1.getReceipt)(receiptId);
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
//# sourceMappingURL=pay.js.map