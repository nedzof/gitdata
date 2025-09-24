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
exports.submitBuilderRouter = void 0;
exports.submitDlm1Router = submitDlm1Router;
const express_1 = require("express");
const opreturn_1 = require("../builders/opreturn");
const db = __importStar(require("../db"));
const codec_1 = require("../dlm1/codec");
const identity_1 = require("../middleware/identity");
const validators_1 = require("../validators");
function jsonError(res, code, error, hint, details) {
    return res.status(code).json({ error, hint, details });
}
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
function submitDlm1Router(opts) {
    if (opts?.manifestSchemaPath) {
        (0, validators_1.initValidators)(opts.manifestSchemaPath);
    }
    else {
        (0, validators_1.initValidators)();
    }
    const router = (0, express_1.Router)();
    router.post('/submit/dlm1', (0, identity_1.requireIdentity)(), async (req, res) => {
        try {
            if (!req.is('application/json')) {
                return jsonError(res, 415, 'unsupported-media-type', 'Use application/json');
            }
            const body = req.body || {};
            const manifest = body.manifest;
            if (!manifest || typeof manifest !== 'object') {
                return jsonError(res, 400, 'invalid-input', 'Body.manifest is required (object)');
            }
            // 1) Validate manifest against schema
            const vres = (0, validators_1.validateDlm1Manifest)(manifest);
            if (!vres.ok) {
                return jsonError(res, 422, 'schema-validation-failed', 'Manifest does not conform to schema', vres.errors);
            }
            // 2) Derive versionId with canonicalization (signatures + versionId excluded)
            const { versionId, manifestHash } = (0, codec_1.deriveManifestIds)(manifest);
            // 3) Encode DLM1 CBOR anchor and build OP_RETURN script
            const built = (0, codec_1.buildDlm1AnchorFromManifest)(manifest); // { cbor, versionId, parents }
            if (built.versionId !== versionId) {
                // Defensive check; they should match bit-for-bit
                return jsonError(res, 500, 'derive-mismatch', 'Internal mismatch in versionId derivation');
            }
            const blob = (0, opreturn_1.composeTag)('DLM1', built.cbor);
            const scriptHex = (0, opreturn_1.buildOpReturnScript)(blob);
            // 4) Store the manifest in the database for searching (if db is provided)
            if (db) {
                try {
                    // Handle producer creation/lookup from issuer
                    let producerId = null;
                    if (manifest.provenance?.issuer) {
                        try {
                            producerId = await db.upsertProducer({
                                identity_key: manifest.provenance.issuer,
                                name: `Producer ${manifest.provenance.issuer.slice(0, 8)}...`,
                                website: null,
                            });
                        }
                        catch (error) {
                            console.warn('Failed to create/lookup producer:', error);
                        }
                    }
                    await db.upsertManifest({
                        version_id: versionId,
                        manifest_hash: manifestHash,
                        dataset_id: manifest.datasetId || 'unknown',
                        content_hash: manifest.content?.contentHash || null,
                        title: manifest.description || null,
                        license: manifest.policy?.license || null,
                        classification: manifest.policy?.classification || null,
                        created_at: manifest.provenance?.createdAt || new Date().toISOString(),
                        manifest_json: JSON.stringify(manifest),
                        producer_id: producerId,
                    });
                    // Store parent relationships if provided
                    if (manifest.parents && manifest.parents.length > 0) {
                        await db.replaceEdges(versionId, manifest.parents);
                    }
                    // Create OpenLineage event for lineage tracking
                    try {
                        const olEvent = {
                            eventType: 'COMPLETE',
                            eventTime: manifest.provenance?.createdAt || new Date().toISOString(),
                            producer: 'gitdata-overlay',
                            job: {
                                namespace: 'overlay',
                                name: 'asset-publish',
                                facets: {
                                    sourceCode: {
                                        language: 'typescript',
                                        sourceCodeLocation: 'submit-builder.ts',
                                    },
                                },
                            },
                            run: {
                                runId: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                facets: {
                                    parent: {
                                        run: {
                                            runId: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                        },
                                        job: {
                                            namespace: 'overlay',
                                            name: 'asset-publish',
                                        },
                                    },
                                },
                            },
                            inputs: (manifest.parents || []).map((parentId) => ({
                                namespace: 'overlay',
                                name: parentId,
                                facets: {
                                    dataSource: {
                                        name: parentId,
                                        uri: `asset://${parentId}`,
                                    },
                                },
                            })),
                            outputs: [
                                {
                                    namespace: 'overlay',
                                    name: versionId,
                                    facets: {
                                        dataSource: {
                                            name: manifest.datasetId || versionId,
                                            uri: `asset://${versionId}`,
                                        },
                                        schema: {
                                            fields: [
                                                {
                                                    name: 'contentHash',
                                                    type: 'string',
                                                    description: 'SHA256 hash of asset content',
                                                },
                                                {
                                                    name: 'datasetId',
                                                    type: 'string',
                                                    description: 'Dataset identifier',
                                                },
                                            ],
                                        },
                                    },
                                },
                            ],
                        };
                        await db.ingestOpenLineageEvent(olEvent);
                        console.log('[submit-builder] Created OpenLineage event for asset:', versionId);
                    }
                    catch (olError) {
                        console.warn('[submit-builder] Failed to create OpenLineage event:', olError);
                    }
                }
                catch (error) {
                    // Log error but don't fail the submission since this is for testing
                    console.warn('Failed to store manifest in database:', error);
                }
            }
            // 5) Return wallet-ready outputs (BRC-100 compatible shape)
            const outputs = [{ scriptHex, satoshis: 0 }];
            const outBytes = (0, opreturn_1.opReturnOutputSize)(blob.length);
            const resp = {
                status: 'ok',
                versionId,
                manifestHash,
                parents: manifest.parents || built.parents || [],
                outputs,
                opReturnScriptHex: scriptHex,
                opReturnOutputBytes: outBytes,
            };
            return res.status(200).json(resp);
        }
        catch (e) {
            return jsonError(res, 500, 'submit-dlm1-failed', e?.message || 'unknown-error');
        }
    });
    return router;
}
// Alias for server.ts compatibility
exports.submitBuilderRouter = submitDlm1Router;
//# sourceMappingURL=submit-builder.js.map