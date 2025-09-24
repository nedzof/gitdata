Got it. Below is a clean, Bitcoin-compliant spec and set of JSON Schemas you can drop into your overlay to store a file (as a DLM1 manifest) and reference it on-chain with SPV. It aligns with your current /submit/dlm1 flow (CBOR-tagged “DLM1” OP_RETURN), your ManifestRow columns, and an SPV-first verification model.

What you get
- Deterministic manifest rules (how to hash and version a DLM1).
- JSON Schemas (Ajv-ready) for:
  - primitives (shared $defs)
  - dlm1-manifest-v1 (JSON mirror of what’s encoded into CBOR)
  - dlm1-opreturn-v1 (how the OP_RETURN envelope is represented)
  - spv-proof-bundle-v1 (wallet-verifiable SPV proof)
- A minimal file manifest example (“upload something simple like a file”).
- Response shape for /submit/dlm1 with OP_RETURN scriptHex and how it maps to DB.
- Verification flow (client-side SPV only).
- One end-to-end example (manifest → OP_RETURN → SPV bundle → DB row).

Normative rules (determinism)
- Canonical JSON: keys sorted lexicographically, UTF-8, timestamps RFC 3339.
- contentHash (Hex32):
  - If you carry file bytes off-chain: contentHash = sha256(file_bytes). Put file URI and size in content.url/sizeBytes.
- manifestHash (Hex32):
  - manifestHash = sha256(canonical_json_of_dlm1_manifest_v1)
- versionId (Hex32):
  - versionId = manifestHash (use as version_id in DB).
- OP_RETURN:
  - Single data-carrier output, tag “DLM1”, followed by canonical CBOR encoding of the manifest (exactly the JSON fields below, encoded deterministically into CBOR).
- SPV:
  - Trust derives from bundle: leaf=manifestHash → tx → block → headers chain, not from DB.

Schemas
1) schemas/v1/primitives.json
{
  "$id": "https://your-domain/schemas/v1/primitives.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$defs": {
    "Hex32": { "type": "string", "pattern": "^[0-9a-fA-F]{64}$" },
    "PubKey": { "type": "string", "pattern": "^(02|03)[0-9a-fA-F]{64}$" },
    "ISOTime": { "type": "string", "format": "date-time" },
    "Url": { "type": "string", "format": "uri" },
    "UInt": { "type": "integer", "minimum": 0 }
  }
}

2) schemas/v1/dlm1-manifest-v1.json
- This is the JSON mirror of the CBOR payload you OP_RETURN as “DLM1”. Keep fields minimal and stable.

{
  "$id": "https://your-domain/schemas/v1/dlm1-manifest-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DLM1 Manifest v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["datasetId","provenance","content"],
  "properties": {
    "datasetId": { "type": "string", "minLength": 1 },
    "description": { "type": "string" },

    "provenance": {
      "type": "object",
      "additionalProperties": false,
      "required": ["createdAt","issuer"],
      "properties": {
        "createdAt": { "$ref": "primitives.json#/$defs/ISOTime" },
        "issuer": { "$ref": "primitives.json#/$defs/PubKey" }
      }
    },

    "policy": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "license": { "type": "string" },
        "classification": { "type": "string" }
      }
    },

    "content": {
      "type": "object",
      "additionalProperties": false,
      "required": ["contentHash"],
      "properties": {
        "contentHash": { "$ref": "primitives.json#/$defs/Hex32" },
        "mediaType": { "type": "string" },
        "sizeBytes": { "$ref": "primitives.json#/$defs/UInt" },
        "url": { "$ref": "primitives.json#/$defs/Url" }
      }
    },

    "parents": {
      "type": "array",
      "items": { "$ref": "primitives.json#/$defs/Hex32" },
      "default": []
    },

    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    }
  }
}

3) schemas/v1/dlm1-opreturn-v1.json
- How the OP_RETURN envelope is represented off-chain (what you already return as opReturnScriptHex).

{
  "$id": "https://your-domain/schemas/v1/dlm1-opreturn-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DLM1 OP_RETURN Envelope v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["tag","cbor","scriptHex"],
  "properties": {
    "tag": { "type": "string", "const": "DLM1" },
    "cbor": { "type": "string", "contentEncoding": "base64" },
    "scriptHex": { "type": "string", "pattern": "^[0-9a-fA-F]+$" }
  }
}

4) schemas/v1/spv-proof-bundle-v1.json
- Wallet/verifier consumes this to prove the presence of your DLM1 OP_RETURN in a block on BSV.

{
  "$id": "https://your-domain/schemas/v1/spv-proof-bundle-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SPV Proof Bundle v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["version","network","leaf","tx","block","headersChain","policy"],
  "properties": {
    "version": { "const": "spv-1" },
    "network": { "type": "string", "enum": ["mainnet","testnet","stn"] },

    "leaf": {
      "type": "object",
      "additionalProperties": false,
      "required": ["hash"],
      "properties": {
        "hash": { "$ref": "primitives.json#/$defs/Hex32" }
      },
      "description": "leaf.hash MUST equal manifestHash (aka versionId)"
    },

    "tx": {
      "type": "object",
      "additionalProperties": false,
      "required": ["txid","vout","scriptPubKey"],
      "properties": {
        "txid": { "$ref": "primitives.json#/$defs/Hex32" },
        "vout": { "$ref": "primitives.json#/$defs/UInt" },
        "scriptPubKey": { "type": "string", "pattern": "^[0-9a-fA-F]+$" },
        "value": { "$ref": "primitives.json#/$defs/UInt" }
      }
    },

    "block": {
      "type": "object",
      "additionalProperties": false,
      "required": ["height","header","txMerkle"],
      "properties": {
        "height": { "$ref": "primitives.json#/$defs/UInt" },
        "header": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" },
        "txMerkle": {
          "type": "object",
          "additionalProperties": false,
          "required": ["siblings","index"],
          "properties": {
            "siblings": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
            "index": { "$ref": "primitives.json#/$defs/UInt" }
          }
        }
      }
    },

    "headersChain": {
      "type": "array",
      "minItems": 1,
      "items": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" }
    },

    "policy": {
      "type": "object",
      "additionalProperties": false,
      "required": ["minConfs","anchoredAt"],
      "properties": {
        "minConfs": { "$ref": "primitives.json#/$defs/UInt" },
        "anchoredAt": { "$ref": "primitives.json#/$defs/ISOTime" }
      }
    },

    "meta": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "batchId": { "type": "string", "format": "uuid" }
      }
    }
  }
}

Minimal “upload a file” flow (aligns with your /submit/dlm1)
Client side (before POST)
- Compute file sha256 and size:
  - contentHash = sha256(file_bytes) → 64-hex
  - sizeBytes = file_bytes.length
- Create a minimal DLM1 manifest (JSON) and keep it stable (keys sorted).
- Optionally upload file to object storage and set content.url to the presigned URL.
- POST to /submit/dlm1 { manifest }.

Minimal DLM1 manifest (example)
{
  "datasetId": "my-files",
  "description": "Single file test",
  "provenance": {
    "createdAt": "2025-01-01T12:00:00Z",
    "issuer": "02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
  },
  "policy": {
    "license": "cc-by-4.0",
    "classification": "public"
  },
  "content": {
    "contentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "mediaType": "text/plain",
    "sizeBytes": 42,
    "url": "https://cdn.example.com/files/hello.txt"
  }
}

Overlay behavior (your code already does this)
- validateDlm1Manifest(manifest) → validate against dlm1-manifest-v1.json above.
- deriveManifestIds(manifest):
  - Canonicalize JSON → manifestHash = sha256(bytes) → versionId = manifestHash.
- buildDlm1AnchorFromManifest(manifest):
  - Produce CBOR for exactly the JSON above (stable CBOR, e.g., DAG-CBOR or canonical CBOR).
  - Compose OP_RETURN as: OP_FALSE OP_RETURN "DLM1" <CBOR_bytes>
  - Return scriptHex.

Server response (example)
{
  "status": "ok",
  "versionId": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "manifestHash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "parents": [],
  "outputs": [
    { "scriptHex": "006a04444c4d31<...CBOR HEX...>", "satoshis": 0 }
  ],
  "opReturnScriptHex": "006a04444c4d31<...CBOR HEX...>",
  "opReturnOutputBytes": 123
}

Populate DB (ManifestRow mapping)
- version_id = versionId (manifestHash)
- manifest_hash = manifestHash
- dataset_id = manifest.datasetId
- content_hash = manifest.content.contentHash
- title = manifest.description
- license = manifest.policy?.license
- classification = manifest.policy?.classification
- created_at = manifest.provenance.createdAt
- manifest_json = JSON.stringify(manifest)
- producer_id = null

SPV proof (retrieval + validation)
- Expose GET /bundle/:versionId → returns spv-proof-bundle-v1:
  {
    "version": "spv-1",
    "network": "mainnet",
    "leaf": { "hash": "<manifestHash>" },
    "tx": { "txid": "<txid>", "vout": 0, "scriptPubKey": "<hex>", "value": 0 },
    "block": { "height": N, "header": "<80-byte-hex>", "txMerkle": { "siblings": [...], "index": k } },
    "headersChain": ["<80-byte-hex>", "..."],
    "policy": { "minConfs": 1, "anchoredAt": "2025-01-01T12:00:00Z" },
    "meta": { "batchId": "00112233-4455-6677-8899-aabbccddeeff" }
  }

Client verification steps (SPV-only)
- Schema-check spv-proof-bundle-v1.json.
- Confirm leaf.hash == manifestHash (== versionId).
- Confirm OP_RETURN script carries tag “DLM1” and the CBOR decodes to a JSON exactly matching what you catalogued (optional).
- Verify tx inclusion in block via txMerkle, then header is in headersChain (best chain).
- Enforce minConfs.

Notes and tips
- CBOR determinism: Use a canonical CBOR encoding (e.g., DAG-CBOR) for stable manifestHash across systems.
- Size limits: keep OP_RETURN under practical miner limits; large files must be off-chain (only commit the hash + metadata).
- Identity: If you require BRC-31 signatures, add a signature object to the POST body that covers the canonical JSON (server doesn’t need plaintext file).
- Wallets: Return outputs array (as you do) so BRC-100-compatible wallets can assemble and broadcast the tx.

If you’d like, I can:
- Add Ajv validators for these schemas in your repo, plus gold/bad vectors.
- Provide a tiny CBOR encoder/decoder (Node) that stays deterministic for your manifest fields.
- Wire a /bundle/:versionId endpoint stub that serves spv-proof-bundle-v1 with your SPV headers source.


Awesome. Here’s a PR-ready drop-in that adds:
- Ajv validators (strict) and golden/bad vectors for your DLM1 schemas
- A tiny deterministic CBOR encoder/decoder for DLM1 manifests
- A /bundle/:versionId endpoint stub that serves spv-proof-bundle-v1 using your overlay (with a simple SPV headers source)
- Unit and integration tests

Notes
- This is vendor-neutral and SPV-first (BSV-aligned). The SPV bits here are local/deterministic; swap in your real SPV header source in production.
- Please verify schemas and code with your team/community before production.

Repository changes (new/updated)
- package.json
- schemas/v1/ (add)
- scripts/ (add Ajv validators)
- src/cbor/ (add deterministic CBOR)
- src/spv/ (headers stub)
- src/routes/bundle.ts (new route)
- tests/unit and tests/integration
- examples/good and examples/bad (vectors)

package.json (merge or add)
{
  "scripts": {
    "build": "tsc -p .",
    "test": "jest --colors",
    "validate:dlm1": "node ./scripts/ajv-validate.mjs",
    "validate:dlm1-bad": "node ./scripts/ajv-validate-bad.mjs"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/supertest": "^2.0.12",
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "body-parser": "^1.20.2",
    "express": "^4.19.2",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.6.3"
  }
}

tsconfig.json (ensure tests and scripts are compiled/seen)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "rootDir": "./",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": [
    "src/**/*.ts",
    "tests/**/*.ts",
    "scripts/**/*.mjs",
    "schemas/**/*.json",
    "examples/**/*.json"
  ]
}

schemas/v1/primitives.json
{
  "$id": "https://your-domain/schemas/v1/primitives.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$defs": {
    "Hex32": { "type": "string", "pattern": "^[0-9a-fA-F]{64}$" },
    "PubKey": { "type": "string", "pattern": "^(02|03)[0-9a-fA-F]{64}$" },
    "ISOTime": { "type": "string", "format": "date-time" },
    "Url": { "type": "string", "format": "uri" },
    "UInt": { "type": "integer", "minimum": 0 }
  }
}

schemas/v1/dlm1-manifest-v1.json
{
  "$id": "https://your-domain/schemas/v1/dlm1-manifest-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DLM1 Manifest v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["datasetId", "provenance", "content"],
  "properties": {
    "datasetId": { "type": "string", "minLength": 1 },
    "description": { "type": "string" },
    "provenance": {
      "type": "object",
      "additionalProperties": false,
      "required": ["createdAt","issuer"],
      "properties": {
        "createdAt": { "$ref": "primitives.json#/$defs/ISOTime" },
        "issuer": { "$ref": "primitives.json#/$defs/PubKey" }
      }
    },
    "policy": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "license": { "type": "string" },
        "classification": { "type": "string" }
      }
    },
    "content": {
      "type": "object",
      "additionalProperties": false,
      "required": ["contentHash"],
      "properties": {
        "contentHash": { "$ref": "primitives.json#/$defs/Hex32" },
        "mediaType": { "type": "string" },
        "sizeBytes": { "$ref": "primitives.json#/$defs/UInt" },
        "url": { "$ref": "primitives.json#/$defs/Url" }
      }
    },
    "parents": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" }, "default": [] },
    "tags": { "type": "array", "items": { "type": "string" }, "default": [] }
  }
}

schemas/v1/dlm1-opreturn-v1.json
{
  "$id": "https://your-domain/schemas/v1/dlm1-opreturn-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DLM1 OP_RETURN Envelope v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["tag","cbor","scriptHex"],
  "properties": {
    "tag": { "type": "string", "const": "DLM1" },
    "cbor": { "type": "string", "contentEncoding": "base64" },
    "scriptHex": { "type": "string", "pattern": "^[0-9a-fA-F]+$" }
  }
}

schemas/v1/spv-proof-bundle-v1.json
{
  "$id": "https://your-domain/schemas/v1/spv-proof-bundle-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SPV Proof Bundle v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["version","network","leaf","tx","block","headersChain","policy"],
  "properties": {
    "version": { "const": "spv-1" },
    "network": { "type": "string", "enum": ["mainnet","testnet","stn"] },
    "leaf": {
      "type": "object", "additionalProperties": false,
      "required": ["hash"],
      "properties": {
        "hash": { "$ref": "primitives.json#/$defs/Hex32" }
      }
    },
    "tx": {
      "type": "object", "additionalProperties": false,
      "required": ["txid","vout","scriptPubKey"],
      "properties": {
        "txid": { "$ref": "primitives.json#/$defs/Hex32" },
        "vout": { "$ref": "primitives.json#/$defs/UInt" },
        "scriptPubKey": { "type": "string", "pattern": "^[0-9a-fA-F]+$" },
        "value": { "$ref": "primitives.json#/$defs/UInt" }
      }
    },
    "block": {
      "type": "object", "additionalProperties": false,
      "required": ["height","header","txMerkle"],
      "properties": {
        "height": { "$ref": "primitives.json#/$defs/UInt" },
        "header": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" },
        "txMerkle": {
          "type": "object", "additionalProperties": false,
          "required": ["siblings","index"],
          "properties": {
            "siblings": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
            "index": { "$ref": "primitives.json#/$defs/UInt" }
          }
        }
      }
    },
    "headersChain": { "type": "array", "minItems": 1, "items": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" } },
    "policy": {
      "type": "object", "additionalProperties": false,
      "required": ["minConfs","anchoredAt"],
      "properties": {
        "minConfs": { "$ref": "primitives.json#/$defs/UInt" },
        "anchoredAt": { "$ref": "primitives.json#/$defs/ISOTime" }
      }
    },
    "meta": {
      "type": "object", "additionalProperties": false,
      "properties": { "batchId": { "type": "string", "format": "uuid" } }
    }
  }
}

scripts/ajv-validate.mjs
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);

const schemaFiles = [
  'schemas/v1/primitives.json',
  'schemas/v1/dlm1-manifest-v1.json',
  'schemas/v1/dlm1-opreturn-v1.json',
  'schemas/v1/spv-proof-bundle-v1.json'
];
schemaFiles.forEach(p => ajv.addSchema(JSON.parse(fs.readFileSync(p,'utf8')), p));

const vectors = [
  ['schemas/v1/dlm1-manifest-v1.json', 'examples/good/dlm1-manifest.json'],
  ['schemas/v1/dlm1-opreturn-v1.json', 'examples/good/dlm1-opreturn.json'],
  ['schemas/v1/spv-proof-bundle-v1.json', 'examples/good/spv-bundle.json']
];

let ok = true;
for (const [schema, file] of vectors) {
  const validate = ajv.getSchema(schema);
  const data = JSON.parse(fs.readFileSync(file,'utf8'));
  const valid = validate(data);
  if (!valid) {
    ok = false;
    console.error(`FAIL ${file}`, validate.errors);
  } else {
    console.log(`OK ${file}`);
  }
}
process.exit(ok ? 0 : 1);

scripts/ajv-validate-bad.mjs
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);

['schemas/v1/dlm1-manifest-v1.json', 'schemas/v1/spv-proof-bundle-v1.json']
  .forEach(p => ajv.addSchema(JSON.parse(fs.readFileSync(p,'utf8')), p));

const bad = [
  ['schemas/v1/dlm1-manifest-v1.json', 'examples/bad/dlm1-manifest-missing.json'],
  ['schemas/v1/spv-proof-bundle-v1.json', 'examples/bad/spv-bundle-bad.json']
];

let ok = true;
for (const [schema, file] of bad) {
  const validate = ajv.getSchema(schema);
  const data = JSON.parse(fs.readFileSync(file,'utf8'));
  const valid = validate(data);
  if (valid) {
    ok = false;
    console.error(`UNEXPECTED PASS ${file}`);
  } else {
    console.log(`Expected fail ${file}`);
  }
}
process.exit(ok ? 0 : 1);

src/cbor/manifest.ts (deterministic CBOR for DLM1)
import { createHash } from 'crypto';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function sortKeys(obj: Record<string, Json>): [string, Json][] {
  return Object.keys(obj).sort().map(k => [k, obj[k]]);
}

// Minimal canonical CBOR encoder (strings, ints, arrays, maps) used for DLM1 fields.
export function cborEncode(value: Json): Buffer {
  if (value === null) return Buffer.from([0xf6]); // null
  if (typeof value === 'boolean') return Buffer.from([value ? 0xf5 : 0xf4]);
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) throw new Error('only non-negative integers supported');
    return encodeUnsigned(value);
  }
  if (typeof value === 'string') {
    const b = Buffer.from(value, 'utf8');
    return Buffer.concat([encodeTypeLen(3, b.length), b]);
  }
  if (Array.isArray(value)) {
    const parts = (value as Json[]).map(cborEncode);
    return Buffer.concat([encodeTypeLen(4, parts.length), ...parts]);
  }
  if (typeof value === 'object') {
    const entries = sortKeys(value as Record<string, Json>);
    const encoded = entries.map(([k, v]) => {
      const key = cborEncode(k);
      const val = cborEncode(v as Json);
      return Buffer.concat([key, val]);
    });
    return Buffer.concat([encodeTypeLen(5, entries.length), ...encoded]);
  }
  throw new Error('unsupported type');
}

function encodeUnsigned(n: number): Buffer {
  if (n < 24) return Buffer.from([0x00 | n]);
  if (n < 256) return Buffer.from([0x18, n]);
  if (n < 65536) return Buffer.from([0x19, (n >> 8) & 0xff, n & 0xff]);
  throw new Error('int too large');
}

function encodeTypeLen(major: number, len: number): Buffer {
  if (len < 24) return Buffer.from([(major << 5) | len]);
  if (len < 256) return Buffer.from([(major << 5) | 24, len]);
  if (len < 65536) return Buffer.from([(major << 5) | 25, (len >> 8) & 0xff, len & 0xff]);
  throw new Error('length too large');
}

// Deterministic canonical JSON string (keys sorted)
export function canonicalJSONStringify(obj: any): string {
  const str = (v: any): string => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const keys = Object.keys(v).sort();
      return `{${keys.map(k => `"${k}":${str(v[k])}`).join(',')}}`;
    }
    if (Array.isArray(v)) return `[${v.map(str).join(',')}]`;
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (v === null) return 'null';
    return 'null';
  };
  return str(obj);
}

export function manifestHash(manifest: any): string {
  const json = canonicalJSONStringify(manifest);
  return createHash('sha256').update(Buffer.from(json, 'utf8')).digest('hex');
}

src/spv/headers.ts (stub SPV headers source)
export type HeaderInfo = { height: number; headerHex: string };
export async function getBestChainHeaders(): Promise<HeaderInfo[]> {
  // Replace with your real header client (SPV). This is a stub for tests.
  return [{ height: 1, headerHex: '00'.repeat(80) }];
}

src/routes/bundle.ts (endpoint stub)
import { Router, Request, Response } from 'express';
import { getBestChainHeaders } from '../spv/headers';

export function bundleRouter(getProofByVersionId: (id: string) => any | null) {
  const router = Router();

  router.get('/bundle/:versionId', async (req: Request, res: Response) => {
    try {
      const { versionId } = req.params;
      const proof = getProofByVersionId(versionId);
      if (!proof) return res.status(404).json({ error: 'not_found' });

      const headers = await getBestChainHeaders();
      if (!headers.length) return res.status(503).json({ error: 'tip_unavailable' });

      res.set('Cache-Control', 'public, max-age=60');
      res.set('ETag', `spv-bundle-${versionId}-${headers[0].height}`);
      // Merge best-chain headers into the proof (stub)
      const enriched = { ...proof, headersChain: headers.map(h => h.headerHex) };
      return res.json(enriched);
    } catch (e: any) {
      return res.status(500).json({ error: 'bundle_failed', message: e?.message || 'unknown' });
    }
  });

  return router;
}

How to wire the route
- In your server bootstrap (where you mount routes), provide a store or resolver for proofs:

// example usage
import express from 'express';
import bodyParser from 'body-parser';
import { bundleRouter } from './routes/bundle';

const app = express();
app.use(bodyParser.json());

// simple in-memory map for tests; replace with your store
const proofs = new Map<string, any>();
app.use(bundleRouter((id) => proofs.get(id) || null));

export { app, proofs };

examples/good/dlm1-manifest.json
{
  "datasetId": "my-files",
  "description": "Single file test",
  "provenance": {
    "createdAt": "2025-01-01T12:00:00Z",
    "issuer": "02aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
  },
  "policy": {
    "license": "cc-by-4.0",
    "classification": "public"
  },
  "content": {
    "contentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "mediaType": "text/plain",
    "sizeBytes": 42,
    "url": "https://cdn.example.com/files/hello.txt"
  },
  "parents": [],
  "tags": ["demo"]
}

examples/good/dlm1-opreturn.json
{
  "tag": "DLM1",
  "cbor": "oA==",
  "scriptHex": "006a04444c4d31a0"
}

examples/good/spv-bundle.json
{
  "version": "spv-1",
  "network": "mainnet",
  "leaf": { "hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  "tx": {
    "txid": "1111111111111111111111111111111111111111111111111111111111111111",
    "vout": 0,
    "scriptPubKey": "006a04444c4d31a0",
    "value": 0
  },
  "block": { "height": 1, "header": "00".repeat(80), "txMerkle": { "siblings": [], "index": 0 } },
  "headersChain": ["00".repeat(80)],
  "policy": { "minConfs": 0, "anchoredAt": "2025-01-01T12:00:00Z" },
  "meta": { "batchId": "00112233-4455-6677-8899-aabbccddeeff" }
}

examples/bad/dlm1-manifest-missing.json
{
  "datasetId": "x",
  "content": { "contentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
}

examples/bad/spv-bundle-bad.json
{
  "version": "spv-1",
  "network": "mainnet",
  "leaf": { "hash": "zzzz" }, 
  "tx": { "txid": "11".repeat(32), "vout": 0, "scriptPubKey": "006a", "value": 0 },
  "block": { "height": 1, "header": "00".repeat(80), "txMerkle": { "siblings": [], "index": 0 } },
  "headersChain": ["00".repeat(80)],
  "policy": { "minConfs": 0, "anchoredAt": "2025-01-01T12:00:00Z" }
}

Unit tests
tests/unit/cbor-manifest.test.ts
import { cborEncode, canonicalJSONStringify, manifestHash } from '../../src/cbor/manifest';

describe('DLM1 CBOR + canonical JSON', () => {
  const manifest = {
    datasetId: 'my-files',
    content: { contentHash: 'aa'.repeat(32), mediaType: 'text/plain', sizeBytes: 42 },
    provenance: { createdAt: '2025-01-01T12:00:00Z', issuer: '02'.padEnd(66,'a') },
    parents: [],
    tags: []
  };

  it('canonical JSON is stable and hashed', () => {
    const json = canonicalJSONStringify(manifest);
    expect(typeof json).toBe('string');
    const h = manifestHash(manifest);
    expect(h.length).toBe(64);
  });

  it('CBOR encodes deterministically', () => {
    const a = cborEncode(manifest);
    const b = cborEncode({ ...manifest, tags: [] }); // different insertion order
    expect(a.equals(b)).toBe(true);
  });
});

tests/unit/schemas.test.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';

describe('Ajv validation for DLM1', () => {
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);

  const schemas = [
    'schemas/v1/primitives.json',
    'schemas/v1/dlm1-manifest-v1.json',
    'schemas/v1/dlm1-opreturn-v1.json',
    'schemas/v1/spv-proof-bundle-v1.json'
  ];
  beforeAll(() => {
    schemas.forEach(p => ajv.addSchema(JSON.parse(fs.readFileSync(p, 'utf8')), p));
  });

  it('good vectors pass', () => {
    const man = JSON.parse(fs.readFileSync('examples/good/dlm1-manifest.json','utf8'));
    const opret = JSON.parse(fs.readFileSync('examples/good/dlm1-opreturn.json','utf8'));
    const spv = JSON.parse(fs.readFileSync('examples/good/spv-bundle.json','utf8'));
    expect(ajv.getSchema('schemas/v1/dlm1-manifest-v1.json')!(man)).toBe(true);
    expect(ajv.getSchema('schemas/v1/dlm1-opreturn-v1.json')!(opret)).toBe(true);
    expect(ajv.getSchema('schemas/v1/spv-proof-bundle-v1.json')!(spv)).toBe(true);
  });

  it('bad vectors fail', () => {
    const man = JSON.parse(fs.readFileSync('examples/bad/dlm1-manifest-missing.json','utf8'));
    const spv = JSON.parse(fs.readFileSync('examples/bad/spv-bundle-bad.json','utf8'));
    expect(ajv.getSchema('schemas/v1/dlm1-manifest-v1.json')!(man)).toBe(false);
    expect(ajv.getSchema('schemas/v1/spv-proof-bundle-v1.json')!(spv)).toBe(false);
  });
});

Integration tests (Express + /bundle)
tests/integration/bundle-flow.test.ts
import express from 'express';
import bodyParser from 'body-parser';
import request from 'supertest';
import { bundleRouter } from '../../src/routes/bundle';

describe('/bundle/:versionId integration', () => {
  const app = express();
  app.use(bodyParser.json());
  const proofs = new Map<string, any>();

  // Seed a fake proof (deterministic/local)
  const versionId = 'bb'.repeat(32);
  proofs.set(versionId, {
    "version": "spv-1",
    "network": "mainnet",
    "leaf": { "hash": versionId },
    "tx": {
      "txid": "11".repeat(32),
      "vout": 0,
      "scriptPubKey": "006a04444c4d31a0",
      "value": 0
    },
    "block": { "height": 1, "header": "00".repeat(80), "txMerkle": { "siblings": [], "index": 0 } },
    "headersChain": ["00".repeat(80)],
    "policy": { "minConfs": 0, "anchoredAt": "2025-01-01T12:00:00Z" },
    "meta": { "batchId": "00112233-4455-6677-8899-aabbccddeeff" }
  });

  app.use(bundleRouter((id) => proofs.get(id) || null));

  it('serves an SPV bundle for an existing versionId', async () => {
    const r = await request(app).get(`/bundle/${versionId}`).expect(200);
    expect(r.body.version).toBe('spv-1');
    expect(r.body.leaf.hash).toBe(versionId);
    expect(r.headers['etag']).toMatch(/^spv-bundle-/);
  });

  it('404 for unknown versionId', async () => {
    await request(app).get('/bundle/aa'.repeat(32)).expect(404);
  });
});

How to run
- npm ci
- npm run validate:dlm1
- npm run validate:dlm1-bad
- npm test

Where to swap in production bits
- src/spv/headers.ts: replace stub with your SPV header client (BSV headers).
- The proof resolver in bundleRouter: replace the Map with your proof store (e.g., build from tx index + merkle path + headers).
- buildDlm1AnchorFromManifest(): ensure your CBOR encoder uses the same canonical rules (this cborEncode shows the pattern).

This keeps your overlay Bitcoin-compliant and SPV-first:
- DLM1 manifests are deterministically hashed and CBOR-encoded
- The OP_RETURN carries the DLM1 tag + CBOR payload
- VersionId == manifestHash is the leaf anchor
- /bundle returns a verifiable SPV bundle a client can validate via headers—no indexer trust

If you want, I can fold these into a branch in your repo and align the cborEncode with your existing buildDlm1AnchorFromManifest implementation to guarantee byte-for-byte parity.