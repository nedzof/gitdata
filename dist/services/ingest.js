"use strict";
// Using modern database abstraction instead of SQLite
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestSubmission = ingestSubmission;
const db_1 = require("../db");
const codec_1 = require("../dlm1/codec");
const codec_2 = require("../dlm1/codec");
const opreturn_1 = require("../utils/opreturn");
async function ingestSubmission(opts) {
    const { manifest, txid, rawTx, envelopeJson } = opts;
    // 1) Derive canonical IDs (throws if explicit versionId mismatches canonical)
    const { versionId, manifestHash } = (0, codec_1.deriveManifestIds)(manifest);
    const parents = (0, codec_1.extractParents)(manifest);
    // 2) Producer mapping (datasetId + identityKey)
    const datasetId = typeof manifest?.datasetId === 'string' ? manifest.datasetId : undefined;
    const identityKey = typeof manifest?.provenance?.producer?.identityKey === 'string'
        ? String(manifest.provenance.producer.identityKey).toLowerCase()
        : undefined;
    let producerId = undefined;
    if (identityKey) {
        // Optional producer metadata from manifest
        const name = manifest?.provenance?.producer?.name || undefined;
        const website = manifest?.provenance?.producer?.website || undefined;
        producerId = await (0, db_1.upsertProducer)({ identity_key: identityKey, name, website });
    }
    // 3) Parse OP_RETURN and try to decode on-chain DLM1 (consistency check)
    const opret = (0, opreturn_1.findFirstOpReturn)(rawTx);
    let tag = 'UNKNOWN';
    let opretVout = null;
    if (opret) {
        opretVout = opret.vout;
        tag = opret.tagAscii === 'DLM1' ? 'DLM1' : opret.tagAscii === 'TRN1' ? 'TRN1' : 'UNKNOWN';
        if (tag === 'DLM1' && opret.pushesHex.length > 0) {
            // Single-push: "DLM1||CBOR" or Multi-push: "DLM1", CBOR
            const tagHex = Buffer.from('DLM1', 'ascii').toString('hex');
            let cborHex = null;
            if (opret.pushesAscii[0] === 'DLM1' && opret.pushesHex[1])
                cborHex = opret.pushesHex[1];
            else if (opret.pushesHex[0].startsWith(tagHex))
                cborHex = opret.pushesHex[0].slice(tagHex.length);
            if (cborHex && cborHex.length > 0) {
                const decoded = (0, codec_2.decodeDLM1)(Buffer.from(cborHex, 'hex'));
                if (decoded.mh.toLowerCase() !== versionId.toLowerCase()) {
                    throw new Error('onchain-mh-mismatch: DLM1.mh != derived manifest hash');
                }
            }
        }
    }
    // 4) Persist manifest row
    await (0, db_1.upsertManifest)({
        version_id: versionId,
        manifest_hash: manifestHash,
        content_hash: manifest?.content?.contentHash || null,
        title: manifest?.description || null, // map description -> title for UI
        license: manifest?.policy?.license || null,
        classification: manifest?.policy?.classification || null,
        created_at: manifest?.provenance?.createdAt || null,
        manifest_json: JSON.stringify(manifest),
        dataset_id: datasetId || null,
        producer_id: producerId || null,
    });
    // 4) Persist declaration row
    await (0, db_1.upsertDeclaration)({
        version_id: versionId,
        txid: txid.toLowerCase(),
        type: tag,
        status: 'pending',
        created_at: Math.floor(Date.now() / 1000),
        block_hash: null,
        height: null,
        opret_vout: null,
        raw_tx: rawTx,
        proof_json: null,
    });
    if (opretVout !== null) {
        await (0, db_1.setOpretVout)(versionId, opretVout);
    }
    // 5) Persist edges
    if (parents.length) {
        await (0, db_1.replaceEdges)(versionId, parents);
    }
    // 6) Optionally persist SPV envelope (JSON string)
    if (envelopeJson) {
        await (0, db_1.setProofEnvelope)(versionId, JSON.stringify(envelopeJson));
    }
    return { versionId, opretVout, tag };
}
//# sourceMappingURL=ingest.js.map