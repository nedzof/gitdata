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
exports.findOpReturnOutputs = findOpReturnOutputs;
exports.findFirstOpReturn = findFirstOpReturn;
exports.detectDlm1OrTrn1 = detectDlm1OrTrn1;
const assert = __importStar(require("assert"));
/**
 * Parse a Bitcoin varint from buffer at o.i. Mutates o.i to the byte after the varint.
 */
function readVarInt(buf, o) {
    assert(o.i < buf.length, 'varint out-of-bounds');
    const first = buf[o.i];
    o.i += 1;
    if (first < 0xfd)
        return BigInt(first);
    if (first === 0xfd) {
        assert(o.i + 2 <= buf.length, 'varint u16 out-of-bounds');
        const v = buf.readUInt16LE(o.i);
        o.i += 2;
        return BigInt(v);
    }
    if (first === 0xfe) {
        assert(o.i + 4 <= buf.length, 'varint u32 out-of-bounds');
        const v = buf.readUInt32LE(o.i);
        o.i += 4;
        return BigInt(v);
    }
    assert(o.i + 8 <= buf.length, 'varint u64 out-of-bounds');
    const lo = buf.readUInt32LE(o.i);
    const hi = buf.readUInt32LE(o.i + 4);
    o.i += 8;
    return (BigInt(hi) << BigInt(32)) + BigInt(lo);
}
function readSlice(buf, o, n) {
    assert(o.i + n <= buf.length, 'slice out-of-bounds');
    const out = buf.subarray(o.i, o.i + n);
    o.i += n;
    return out;
}
function toHex(b) {
    return b.toString('hex');
}
function isPrintableAscii(b) {
    for (let k = 0; k < b.length; k++) {
        const c = b[k];
        if (c < 0x20 || c > 0x7e)
            return false;
    }
    return b.length > 0;
}
function asciiOrNull(b) {
    return isPrintableAscii(b) ? b.toString('ascii') : null;
}
/**
 * Parse an OP_RETURN script and return pushes if it matches:
 * - Optional OP_FALSE (0x00)
 * - OP_RETURN (0x6a)
 * - Zero or more canonical pushes (0x01..0x4b | PUSHDATA1 | PUSHDATA2 | PUSHDATA4)
 * Stops at the first non-push opcode after OP_RETURN.
 */
function parseOpReturnScript(script) {
    const OP_FALSE = 0x00;
    const OP_RETURN = 0x6a;
    let j = 0;
    if (script.length === 0)
        return null;
    let hasOpFalse = false;
    if (script[j] === OP_FALSE) {
        hasOpFalse = true;
        j += 1;
    }
    if (j >= script.length || script[j] !== OP_RETURN)
        return null;
    j += 1;
    const pushes = [];
    while (j < script.length) {
        const op = script[j++];
        if (op === undefined)
            break;
        let len = -1;
        if (op >= 0x01 && op <= 0x4b) {
            len = op;
        }
        else if (op === 0x4c) {
            // PUSHDATA1
            if (j + 1 > script.length)
                break;
            len = script[j];
            j += 1;
        }
        else if (op === 0x4d) {
            // PUSHDATA2
            if (j + 2 > script.length)
                break;
            len = script[j] | (script[j + 1] << 8);
            j += 2;
        }
        else if (op === 0x4e) {
            // PUSHDATA4
            if (j + 4 > script.length)
                break;
            len = script[j] | (script[j + 1] << 8) | (script[j + 2] << 16) | (script[j + 3] << 24);
            j += 4;
        }
        else {
            // Non-push after OP_RETURN: stop
            break;
        }
        if (len < 0 || j + len > script.length) {
            // Malformed push; stop
            break;
        }
        const data = script.subarray(j, j + len);
        pushes.push(data);
        j += len;
    }
    return { hasOpFalse, pushes };
}
/**
 * Parse raw tx hex and return all OP_RETURN-bearing outputs.
 * BSV uses legacy serialization (no segwit). This parser assumes non-segwit format.
 */
function findOpReturnOutputs(rawTxHex) {
    if (!/^[0-9a-fA-F]{2,}$/.test(rawTxHex)) {
        throw new Error('rawTx must be hex');
    }
    const tx = Buffer.from(rawTxHex, 'hex');
    const o = { i: 0 };
    // version
    readSlice(tx, o, 4);
    // vin
    const vin = Number(readVarInt(tx, o));
    for (let n = 0; n < vin; n++) {
        readSlice(tx, o, 32); // prev txid
        readSlice(tx, o, 4); // vout
        const scriptLen = Number(readVarInt(tx, o));
        readSlice(tx, o, scriptLen); // scriptSig
        readSlice(tx, o, 4); // sequence
    }
    // vout
    const vout = Number(readVarInt(tx, o));
    const results = [];
    for (let n = 0; n < vout; n++) {
        // value (8 bytes LE)
        const lo = tx.readUInt32LE(o.i);
        const hi = tx.readUInt32LE(o.i + 4);
        const satoshis = (BigInt(hi) << BigInt(32)) + BigInt(lo);
        o.i += 8;
        const scriptLen = Number(readVarInt(tx, o));
        const script = readSlice(tx, o, scriptLen);
        const parsed = parseOpReturnScript(script);
        if (!parsed)
            continue;
        const pushesHex = parsed.pushes.map(toHex);
        const pushesAscii = parsed.pushes.map(asciiOrNull);
        // Detect DLM1/TRN1 by prefix on first push
        let tagAscii;
        const TAGS = ['DLM1', 'TRN1'];
        if (parsed.pushes.length > 0 && parsed.pushes[0].length >= 4) {
            const first4 = parsed.pushes[0].subarray(0, 4).toString('ascii');
            if (TAGS.includes(first4))
                tagAscii = first4;
        }
        results.push({
            vout: n,
            satoshis,
            scriptHex: toHex(script),
            hasOpFalse: parsed.hasOpFalse,
            pushesHex,
            pushesAscii,
            tagAscii,
        });
    }
    return results;
}
function findFirstOpReturn(rawTxHex) {
    const outs = findOpReturnOutputs(rawTxHex);
    return outs.length ? outs[0] : null;
}
function detectDlm1OrTrn1(rawTxHex) {
    const out = findFirstOpReturn(rawTxHex);
    const tag = out?.tagAscii === 'DLM1' ? 'DLM1' : out?.tagAscii === 'TRN1' ? 'TRN1' : null;
    return { tag, vout: out?.vout ?? null };
}
//# sourceMappingURL=opreturn.js.map