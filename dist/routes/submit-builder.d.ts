import type { Router } from 'express';
/**
 * Factory: create a router with a single POST /submit/dlm1 route
 * Body:
 * {
 *   "manifest": <object conforming to dlm1-manifest.schema.json>
 * }
 *
 * Response (200):
 * {
 *   "status": "ok",
 *   "versionId": "<64-hex>",
 *   "manifestHash": "<64-hex>",
 *   "parents": ["<64-hex>", ...],
 *   "outputs": [{ "scriptHex": "<hex>", "satoshis": 0 }],
 *   "opReturnScriptHex": "<hex>",
 *   "opReturnOutputBytes": <number>
 * }
 */
export declare function submitDlm1Router(opts?: {
    manifestSchemaPath?: string;
}): Router;
export declare const submitBuilderRouter: typeof submitDlm1Router;
