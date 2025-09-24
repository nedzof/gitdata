"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.txidFromRawTx = txidFromRawTx;
exports.parseBlockHeader = parseBlockHeader;
exports.verifyMerklePath = verifyMerklePath;
exports.loadHeaders = loadHeaders;
exports.getHeader = getHeader;
exports.getConfirmationCount = getConfirmationCount;
exports.verifyEnvelopeAgainstHeaders = verifyEnvelopeAgainstHeaders;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/* ------------------------ helpers ------------------------ */
function normHex(h) {
    return (h || '').toLowerCase();
}
function hexToBytesBE(hex) {
    if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0)
        throw new Error('invalid hex');
    return Buffer.from(hex, 'hex');
}
function bytesToHexBE(buf) {
    return buf.toString('hex');
}
function rev(buf) {
    const c = Buffer.from(buf);
    c.reverse();
    return c;
}
function sha256d(buf) {
    const a = (0, crypto_1.createHash)('sha256').update(buf).digest();
    const b = (0, crypto_1.createHash)('sha256').update(a).digest();
    return b;
}
/* ------------------------ txid & header parsing ------------------------ */
function txidFromRawTx(rawTxHex) {
    const raw = hexToBytesBE(normHex(rawTxHex));
    const le = sha256d(raw);
    return bytesToHexBE(rev(le)); // display big-endian
}
function parseBlockHeader(raw80Hex) {
    const raw = hexToBytesBE(normHex(raw80Hex));
    if (raw.length !== 80)
        throw new Error('blockHeader must be 80 bytes');
    const versionLE = raw.readInt32LE(0);
    const prevHashLE = raw.subarray(4, 36);
    const merkleRootLE = raw.subarray(36, 68);
    const timeLE = raw.readUInt32LE(68);
    const bitsLE = raw.readUInt32LE(72);
    const nonceLE = raw.readUInt32LE(76);
    const blockHashLE = sha256d(raw);
    return {
        blockHash: bytesToHexBE(rev(blockHashLE)),
        merkleRoot: bytesToHexBE(rev(merkleRootLE)),
        prevHash: bytesToHexBE(rev(prevHashLE)),
        version: versionLE,
        time: timeLE,
        bits: bitsLE,
        nonce: nonceLE,
    };
}
/* ------------------------ merkle verification ------------------------ */
function verifyMerklePath(leafTxidHexBE, path, merkleRootHexBE) {
    const leafBE = normHex(leafTxidHexBE);
    const rootBE = normHex(merkleRootHexBE);
    if (!/^[0-9a-fA-F]{64}$/.test(leafBE) || !/^[0-9a-fA-F]{64}$/.test(rootBE))
        return false;
    // Start with LE bytes for hashing
    let accLE = rev(hexToBytesBE(leafBE));
    for (const step of path) {
        const nodeLE = rev(hexToBytesBE(normHex(step.hash)));
        const concat = step.position === 'left' ? Buffer.concat([nodeLE, accLE]) : Buffer.concat([accLE, nodeLE]);
        accLE = sha256d(concat);
    }
    const accBE = bytesToHexBE(rev(accLE));
    return accBE === rootBE;
}
/* ------------------------ headers loader ------------------------ */
/*
  Supported JSON mirror formats:
  A) {
       "bestHeight": 800000,
       "tipHash": "....",
       "headers": [
         { "hash": "...", "prevHash": "...", "merkleRoot": "...", "height": 799999 }
       ]
     }
  B) {
       "bestHeight": 800000,
       "tipHash": "...",
       "byHash": {
         "<hash>": { "prevHash": "...", "merkleRoot": "...", "height": 799999 }
       }
     }
*/
function loadHeaders(filePath) {
    const abs = path_1.default.resolve(filePath);
    if (!fs_1.default.existsSync(abs))
        throw new Error(`headers file not found: ${abs}`);
    const json = JSON.parse(fs_1.default.readFileSync(abs, 'utf8'));
    const byHash = new Map();
    const byHeight = new Map();
    const tipHash = normHex(json.tipHash || '');
    const bestHeight = typeof json.bestHeight === 'number' ? json.bestHeight : 0;
    if (Array.isArray(json.headers)) {
        for (const h of json.headers) {
            const rec = {
                hash: normHex(h.hash),
                prevHash: normHex(h.prevHash),
                merkleRoot: normHex(h.merkleRoot),
                height: h.height,
            };
            byHash.set(rec.hash, rec);
            byHeight.set(rec.height, rec);
        }
    }
    else if (json.byHash && typeof json.byHash === 'object') {
        for (const [hash, v] of Object.entries(json.byHash)) {
            const rec = {
                hash: normHex(hash),
                prevHash: normHex(v.prevHash),
                merkleRoot: normHex(v.merkleRoot),
                height: v.height,
            };
            byHash.set(rec.hash, rec);
            byHeight.set(rec.height, rec);
        }
    }
    else {
        throw new Error('unsupported headers format');
    }
    return { bestHeight, tipHash, byHash, byHeight };
}
function getHeader(idx, blockHashBE) {
    return idx.byHash.get(normHex(blockHashBE));
}
function getConfirmationCount(idx, blockHashBE) {
    const rec = getHeader(idx, blockHashBE);
    if (!rec)
        return 0;
    return idx.bestHeight - rec.height + 1;
}
/* ------------------------ envelope verification ------------------------ */
async function verifyEnvelopeAgainstHeaders(env, idx, minConfs) {
    // txid consistency
    const derived = txidFromRawTx(env.rawTx);
    const proofTxid = normHex(env.proof.txid);
    if (env.txid && normHex(env.txid) !== proofTxid) {
        return { ok: false, reason: 'txid-mismatch-top-level-vs-proof' };
    }
    if (derived !== proofTxid) {
        return { ok: false, reason: 'txid-mismatch-rawtx-vs-proof' };
    }
    // Resolve merkleRoot
    let merkleRootBE;
    let blockHashForConfs;
    if ('blockHeader' in env.block) {
        try {
            const parsed = parseBlockHeader(env.block.blockHeader);
            merkleRootBE = parsed.merkleRoot;
            blockHashForConfs = parsed.blockHash;
        }
        catch {
            return { ok: false, reason: 'invalid-block-header' };
        }
    }
    else if ('blockHash' in env.block) {
        const rec = getHeader(idx, env.block.blockHash);
        if (!rec)
            return { ok: false, reason: 'unknown-block-hash' };
        if (typeof env.block.blockHeight === 'number' && env.block.blockHeight !== rec.height) {
            return { ok: false, reason: 'block-height-mismatch' };
        }
        merkleRootBE = rec.merkleRoot;
        blockHashForConfs = rec.hash;
    }
    if (!merkleRootBE)
        return { ok: false, reason: 'merkle-root-unavailable' };
    // Merkle inclusion
    const ok = verifyMerklePath(proofTxid, env.proof.path, merkleRootBE);
    if (!ok)
        return { ok: false, reason: 'invalid-merkle-path' };
    // Confirmations
    const confs = blockHashForConfs ? getConfirmationCount(idx, blockHashForConfs) : 0;
    if (confs < minConfs)
        return { ok: false, reason: 'insufficient-confs', confirmations: confs };
    return { ok: true, confirmations: confs };
}
//# sourceMappingURL=verify-envelope.js.map