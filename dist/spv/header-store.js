"use strict";
/**
 * HeaderStore: reads a compact headers.json (array of {raw,hash,prevHash,merkleRoot,height,time})
 * from HEADERS_FILE, validates linkage, and exposes bestHeight/confirmations/getHeader.
 *
 * Option 1 (MVP): keep HEADERS_FILE fresh via scripts/headers-mirror.ts (public relay → local file).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadHeadersFile = loadHeadersFile;
exports.getBestHeight = getBestHeight;
exports.getTipHash = getTipHash;
exports.getHeaderByHash = getHeaderByHash;
exports.getConfirmations = getConfirmations;
exports.startHeaderHotReload = startHeaderHotReload;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const state = { headers: [], byHash: new Map(), bestHeight: 0, tipHash: '' };
function isHex(s, len) {
    const ss = s?.startsWith('0x') ? s.slice(2) : s;
    if (!/^[0-9a-fA-F]+$/.test(ss))
        return false;
    return len == null ? true : ss.length === len;
}
function isHeader(h) {
    return (h &&
        typeof h === 'object' &&
        typeof h.raw === 'string' &&
        typeof h.hash === 'string' &&
        typeof h.prevHash === 'string' &&
        typeof h.merkleRoot === 'string' &&
        Number.isInteger(h.height) &&
        Number.isInteger(h.time) &&
        isHex(h.raw, 160) &&
        isHex(h.hash, 64) &&
        isHex(h.prevHash, 64) &&
        isHex(h.merkleRoot, 64));
}
function validateChain(headers) {
    if (!Array.isArray(headers) || headers.length === 0)
        throw new Error('empty headers');
    for (let i = 1; i < headers.length; i++) {
        const cur = headers[i], prev = headers[i - 1];
        if (!isHeader(prev) || !isHeader(cur))
            throw new Error(`invalid header at ${i}`);
        if (cur.prevHash.toLowerCase() !== prev.hash.toLowerCase()) {
            throw new Error(`chain break at ${i}: ${cur.prevHash} != ${prev.hash}`);
        }
        if (cur.height !== prev.height + 1)
            throw new Error(`bad height at ${i}: ${cur.height} vs ${prev.height}`);
    }
}
async function loadHeadersFile(file) {
    const txt = await promises_1.default.readFile(node_path_1.default.resolve(file), 'utf8');
    const arr = JSON.parse(txt);
    if (!Array.isArray(arr))
        throw new Error('headers.json not an array');
    arr.forEach((h, i) => {
        if (!isHeader(h))
            throw new Error(`invalid header at ${i}`);
    });
    const headers = arr;
    validateChain(headers);
    // Index
    state.headers = headers;
    state.byHash = new Map(headers.map((h) => [h.hash.toLowerCase(), h]));
    const tip = headers[headers.length - 1];
    state.bestHeight = tip.height;
    state.tipHash = tip.hash.toLowerCase();
}
function getBestHeight() {
    return state.bestHeight;
}
function getTipHash() {
    return state.tipHash;
}
function getHeaderByHash(hash) {
    return state.byHash.get(hash.toLowerCase());
}
function getConfirmations(blockHash) {
    const h = getHeaderByHash(blockHash);
    if (!h)
        return 0;
    return Math.max(0, state.bestHeight - h.height + 1);
}
/**
 * Hot reload on interval. Call from overlay bootstrap:
 *   await startHeaderHotReload(process.env.HEADERS_FILE!, 5000)
 */
async function startHeaderHotReload(file, intervalMs = 5000) {
    let last = '';
    async function tick() {
        try {
            const txt = await promises_1.default.readFile(node_path_1.default.resolve(file), 'utf8');
            if (txt !== last) {
                // only parse/validate if changed
                const arr = JSON.parse(txt);
                if (Array.isArray(arr) && arr.length) {
                    arr.forEach((h, i) => {
                        if (!isHeader(h))
                            throw new Error(`invalid header at ${i}`);
                    });
                    validateChain(arr);
                    // commit
                    await loadHeadersFile(file);
                    last = txt;
                    console.log(JSON.stringify({
                        t: new Date().toISOString(),
                        msg: 'headers.reloaded',
                        bestHeight: state.bestHeight,
                        tip: state.tipHash,
                    }));
                }
            }
        }
        catch (e) {
            console.error(JSON.stringify({
                t: new Date().toISOString(),
                msg: 'headers.reload.error',
                err: e?.message || String(e),
            }));
        }
        finally {
            setTimeout(tick, intervalMs).unref?.();
        }
    }
    // initial load
    await loadHeadersFile(file);
    setTimeout(tick, intervalMs).unref?.();
}
//# sourceMappingURL=header-store.js.map