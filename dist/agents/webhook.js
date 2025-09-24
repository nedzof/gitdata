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
exports.callAgentWebhook = callAgentWebhook;
const crypto_1 = require("crypto");
const secp = __importStar(require("@noble/secp256k1"));
const CALL_PRIV_HEX = (process.env.AGENT_CALL_PRIVKEY || '').toLowerCase();
let CALL_PUB_HEX = (process.env.AGENT_CALL_PUBKEY || '').toLowerCase();
function sha256hex(s) {
    return (0, crypto_1.createHash)('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
}
function ensureKeys() {
    if (!CALL_PRIV_HEX)
        throw new Error('AGENT_CALL_PRIVKEY not set');
    if (!CALL_PUB_HEX) {
        const pub = secp.getPublicKey(Buffer.from(CALL_PRIV_HEX, 'hex'), true);
        CALL_PUB_HEX = Buffer.from(pub).toString('hex');
    }
}
async function callAgentWebhook(url, body, fetchImpl = fetch, timeoutMs = 8000) {
    ensureKeys();
    const nonce = Math.random().toString(16).slice(2) + Date.now().toString(16);
    const msgHash = sha256hex(JSON.stringify(body || {}) + nonce);
    const msgHashBytes = Buffer.from(msgHash, 'hex');
    const privateKeyBytes = Buffer.from(CALL_PRIV_HEX, 'hex');
    const signature = secp.sign(msgHashBytes, privateKeyBytes);
    const sigDer = Buffer.from(signature).toString('hex');
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), timeoutMs);
    try {
        const r = await fetchImpl(url, {
            method: 'POST',
            signal: ctl.signal,
            headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                'X-Identity-Key': CALL_PUB_HEX,
                'X-Nonce': nonce,
                'X-Signature': sigDer,
            },
            body: JSON.stringify(body || {}),
        });
        const txt = await r.text();
        let js;
        try {
            js = JSON.parse(txt);
        }
        catch {
            js = { raw: txt };
        }
        return { status: r.status, body: js };
    }
    finally {
        clearTimeout(tm);
    }
}
//# sourceMappingURL=webhook.js.map