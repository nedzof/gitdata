Here’s a production‑ready deliverable that lets GitData save, query, and interoperate “AI memory” in a vendor‑neutral, SPV‑first way, aligned with BSV’s UTXO model and your OpenLineage stack. It includes contracts (JSON Schemas), Redis data model, API surfaces, security/encryption guidance (BRC‑31 + ECDH/HKDF), lineage integration, and CI validation. You can implement it alongside D41 (OpenLineage‑only with Redis) and your existing D24 overlay.

D42 — AI Memory Store & Interoperability (SPV-first, OpenLineage-ready)

Labels: ai, memory, security, openlineage, redis, spv, interoperability  
Assignee: TBA  
Estimate: 5–7 PT

Purpose/Scope
- Provide an interoperable, immutable “AI memory” substrate for agents, producers, and consumers.
- Memory fragments are append‑only, hash‑identified content blobs with provenance, optional client‑side encryption, and optional batch anchoring (Merkle root) on BSV. 
- Discovery and visualization flow through OpenLineage (D41); cryptographic truth remains with SPV (/bundle, /ready).
- Implements schemas, APIs, and a Redis keyspace to persist and retrieve memory, plus access policy hooks.

Non‑Goals
- No centralized indexer trust; trust derives from SPV proofs and signed metadata.
- No custodial key management by the server (client‑side encryption recommended).
- No heavy vector DB semantics here (out of scope). You can attach links to vector indexes if needed.

Core concepts
- Memory Fragment (Kᵢ): An immutable, atomically saved unit with:
  - contentHash (sha256 over encryptedPayload or external content)
  - provenance (who wrote it, when, why)
  - optional encryptedPayload (client‑side encrypted, base64) + encryption metadata
  - references (to modelVersionId, dataset versionId, runId, tags)
  - optional SPV anchors (via batch Merkle roots)
- Memory Batch Anchor: Periodic Merkle root commit (D33 pattern) for an interval’s fragments; optional OP_RETURN anchoring with later SPV proof.

1) JSON Schemas (host at https://your-domain/schemas/v1/)

1.1 primitives (re‑use from D41)
- Use primitives.json (Hex32, Hex, ISOTime, Url, PubKey, SigDerHex, NonEmptyString, UInt, UtxoOutputTemplate).

1.2 ai-memory-fragment.json
- Metadata record persisted at write; encryptedPayload optional (prefer client‑side).

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://your-domain/schemas/v1/ai-memory-fragment.json",
  "title": "AI Memory Fragment",
  "type": "object",
  "required": ["fragmentId","contentHash","createdAt","owner","kind"],
  "additionalProperties": false,
  "properties": {
    "fragmentId": { "type": "string", "minLength": 8 },
    "contentHash": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/Hex32" },
    "createdAt": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/ISOTime" },
    "owner": { "$ref": "https://your-domain/schemas/v1/identity.json" },
    "writer": { "$ref": "https://your-domain/schemas/v1/identity.json" },
    "kind": { "type": "string", "enum": ["prompt","completion","embedding","state","log","custom"] },
    "tags": { "type": "array", "items": { "type": "string" }, "maxItems": 32 },

    "modelVersionId": { "type": "string" },
    "datasetVersionId": { "type": "string" },
    "runId": { "type": "string" },

    "encryptedPayload": { "type": "string", "contentEncoding": "base64" },
    "encryption": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "alg": { "type": "string", "enum": ["aes-256-gcm"] },
        "ephemeralPubKey": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/PubKey" },
        "recipientPubKey": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/PubKey" },
        "kdf": { "type": "string", "enum": ["hkdf-sha256"] },
        "nonce": { "type": "string", "pattern": "^[0-9a-f]{24}$" },
        "context": { "type": "string" }
      }
    },

    "external": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "uri": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/Url" },
        "sizeBytes": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/UInt" },
        "mimeType": { "type": "string" }
      }
    },

    "spvAnchors": {
      "type": "array",
      "items": { "$ref": "https://your-domain/schemas/v1/merkle-anchor.json" },
      "maxItems": 16
    }
  }
}

1.3 ai-memory-write-request.json
- Client request to write memory; supports either encryptedPayload inline or external reference. Must include owner/writer identity and BRC‑31 signature for authenticity.

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://your-domain/schemas/v1/ai-memory-write-request.json",
  "title": "AI Memory Write Request",
  "type": "object",
  "required": ["owner","writer","kind","createdAt","contentHash","signature"],
  "additionalProperties": false,
  "properties": {
    "owner": { "$ref": "https://your-domain/schemas/v1/identity.json" },
    "writer": { "$ref": "https://your-domain/schemas/v1/identity.json" },
    "kind": { "type": "string" },
    "createdAt": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/ISOTime" },
    "tags": { "type": "array", "items": { "type": "string" }, "maxItems": 32 },

    "modelVersionId": { "type": "string" },
    "datasetVersionId": { "type": "string" },
    "runId": { "type": "string" },

    "contentHash": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/Hex32" },
    "encryptedPayload": { "type": ["string","null"], "contentEncoding": "base64" },
    "encryption": { "$ref": "https://your-domain/schemas/v1/ai-memory-fragment.json#/properties/encryption" },

    "external": { "$ref": "https://your-domain/schemas/v1/ai-memory-fragment.json#/properties/external" },

    "signature": { "$ref": "https://your-domain/schemas/v1/brc31-signature.json" }
  }
}

1.4 ai-memory-access-policy.json
- Declarative access policy attached to a fragment or owner scope.

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://your-domain/schemas/v1/ai-memory-access-policy.json",
  "title": "AI Memory Access Policy",
  "type": "object",
  "required": ["policyId","scope","rules","createdAt"],
  "additionalProperties": false,
  "properties": {
    "policyId": { "type": "string" },
    "scope": { "type": "string", "enum": ["owner","fragment"] },
    "ownerKey": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/PubKey" },
    "fragmentId": { "type": "string" },

    "rules": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "allowReaders": { "type": "array", "items": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/PubKey" }, "maxItems": 256 },
        "allowTags": { "type": "array", "items": { "type": "string" } },
        "denyTags": { "type": "array", "items": { "type": "string" } },
        "expiresAt": { "type": "integer", "minimum": 0 }
      }
    },
    "createdAt": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/ISOTime" },
    "signature": { "$ref": "https://your-domain/schemas/v1/brc31-signature.json" }
  }
}

1.5 merkle-anchor.json (re‑use D41/D33)

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://your-domain/schemas/v1/merkle-anchor.json",
  "title": "Merkle Root Anchor",
  "type": "object",
  "required": ["root","anchoredAt"],
  "additionalProperties": false,
  "properties": {
    "root": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/Hex32" },
    "anchoredAt": { "type": "integer", "minimum": 0 },
    "versionId": { "type": "string" },
    "txid": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/Hex32" }
  }
}

1.6 openlineage-memory-facet.json (optional facet to link runs to memory)
- Attach this custom facet to run.facets.memory to advertise memory fragment references in OL events.

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://your-domain/schemas/v1/openlineage-memory-facet.json",
  "title": "Facet: memory (references to memory fragments)",
  "type": "object",
  "required": ["_producer","_schemaURL","v","fragments"],
  "additionalProperties": false,
  "properties": {
    "_producer": { "type": "string", "format": "uri" },
    "_schemaURL": { "type": "string", "format": "uri", "const": "https://your-domain/schemas/v1/openlineage-memory-facet.json" },
    "v": { "type": "string", "enum": ["1"] },
    "fragments": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["fragmentId","contentHash","kind"],
        "additionalProperties": false,
        "properties": {
          "fragmentId": { "type": "string" },
          "contentHash": { "$ref": "https://your-domain/schemas/v1/primitives.json#/$defs/Hex32" },
          "kind": { "type": "string" }
        }
      }
    }
  }
}

2) Redis data model (keys)

Prefixes (ns = overlay:<env>)

- Fragment
  - JSON/Hash: ai:ns:<ns>:mem:<fragmentId>
    - fields: fragment_json (full JSON), owner_key, model_id?, dataset_id?, run_id?, kind, created_at, content_hash
  - ZSET: ai:ns:<ns>:mem:by_time (score=createdAtSec; member=<fragmentId>)
  - SET indices:
    - ai:ns:<ns>:mem:by_owner:<pubkey> (members=<fragmentId>)
    - ai:ns:<ns>:mem:by_model:<modelVersionId>
    - ai:ns:<ns>:mem:by_dataset:<versionId>
    - ai:ns:<ns>:mem:by_tag:<tag>
    - ai:ns:<ns>:mem:by_kind:<kind>

- Payload (optional, if you store encrypted blob)
  - String: ai:ns:<ns>:mem:enc:<fragmentId> (base64) or RedisJSON JSON.SET with {ciphertext, encryption}

- Policies
  - JSON/Hash: ai:ns:<ns>:policy:<policyId>
  - SET: ai:ns:<ns>:policy:by_owner:<pubkey> (members=<policyId>)

- Anchors
  - JSON/Hash: ai:ns:<ns>:anchor:<root>
  - ZSET: ai:ns:<ns>:anchor:by_time (score=anchoredAt; member=<root>)

- Cache
  - String: ai:cache:mem:search:<key> (TTL)
  - String: ol:cache:lineage:<...> (re‑use D41 lineage cache)

3) APIs (JSON over HTTP)

- POST /ai/memory/write
  - Body: ai-memory-write-request.json
  - Server:
    - Verify BRC‑31 signature (identityKey, nonce, sig over canonical JSON).
    - Validate schema; ensure contentHash matches encryptedPayload or external content (if server can fetch—prefer client to include hash only).
    - Assign fragmentId (e.g., mf_<rand>).
    - Persist fragment JSON + indices; if encryptedPayload present and you decide to store, save in ai:ns:<ns>:mem:enc:<id>.
    - Emit OL event (COMPLETE on publish run or a dedicated memory::write job) with openlineage-memory-facet (optional).
    - Return { fragmentId }
  - 200 → { fragmentId, status:"ok" }
  - 400/409/413 on invalid/duplicate/oversized

- GET /ai/memory/:fragmentId
  - Returns metadata (ai-memory-fragment.json) without decrypting payload.
  - If you allow server‑side payload delivery: only serve encryptedPayload to authorized readers (policy check). Otherwise return a presigned URI (external) or instruct the client to fetch from object store.

- GET /ai/memory/search?q=&ownerKey=&modelVersionId=&datasetVersionId=&tag=&kind=&from=&to=&limit=&offset=
  - Executes index queries; builds list of fragment summaries.

- POST /ai/memory/policy
  - Body: ai-memory-access-policy.json
  - Validate signature; upsert policy object and indices.

- POST /ai/memory/anchor (internal/cron)
  - Input: time window or batch id
  - Build Merkle root over contentHash (or fragmentId|contentHash), persist anchor record; OP_RETURN anchoring optional (D33), then attach SPV proof later.

Security & encryption (interoperability)
- Write authentication: BRC‑31 signature over canonical write request. Identity key becomes writer.identityKey. Do not accept unsigned writes in prod.
- Privacy: Prefer client‑side encryption. Server stores only encryptedPayload (base64) + encryption metadata. 
  - ECDH: secp256k1 ECDH producerKey × recipientKey → HKDF‑SHA256 context‑derived AES‑256‑GCM key; include ephemeralPubKey and context in encryption metadata.
- Access control: Enforce ai‑memory‑access‑policy by identityKey (allowReaders). Fine‑grain by tags if needed. Deny by default.
- Never store PII plaintext. If sensitive, store encrypted payload only; keep metadata minimal and non‑PII.

4) Integration with OpenLineage (D41)
- When memory is written as part of a model run, attach run.facets.memory referencing fragment IDs via openlineage-memory-facet.json (fragments[].fragmentId, contentHash, kind).
- Your D41 ingest should validate this facet just like gitdataSpv/governance and persist as part of run.facets.

5) Validation & CI

Add schemas to ajv CLI list and examples.

schemas/v1 list:  
- ai-memory-fragment.json  
- ai-memory-write-request.json  
- ai-memory-access-policy.json  
- openlineage-memory-facet.json  
- merkle-anchor.json  

Golden examples (examples/*.valid.json)
- ai-memory-fragment.valid.json
{
  "fragmentId": "mf_abc123",
  "contentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "createdAt": "2025-01-01T12:00:00Z",
  "owner": { "identityKey": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  "writer": { "identityKey": "02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  "kind": "completion",
  "tags": ["fraud","inference"],
  "modelVersionId": "md_v1",
  "runId": "txid_deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead",
  "encryptedPayload": "BASE64...",
  "encryption": {
    "alg": "aes-256-gcm",
    "ephemeralPubKey": "02cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "recipientPubKey": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "kdf": "hkdf-sha256",
    "nonce": "00112233445566778899aabb",
    "context": "model:md_v1|purpose:inference"
  }
}

- ai-memory-write-request.valid.json
{
  "owner": { "identityKey": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  "writer": { "identityKey": "02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  "kind": "completion",
  "createdAt": "2025-01-01T12:00:00Z",
  "tags": ["fraud","inference"],
  "modelVersionId": "md_v1",
  "contentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "encryptedPayload": "BASE64...",
  "encryption": {
    "alg": "aes-256-gcm",
    "ephemeralPubKey": "02cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "recipientPubKey": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "kdf": "hkdf-sha256",
    "nonce": "00112233445566778899aabb",
    "context": "model:md_v1|purpose:inference"
  },
  "signature": {
    "identityKey": "02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "nonce": "n-abc",
    "signature": "3045022100aa..."
  }
}

- ai-memory-access-policy.valid.json
{
  "policyId": "pol_mem_ownerA",
  "scope": "owner",
  "ownerKey": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "rules": {
    "allowReaders": ["02dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"],
    "allowTags": ["inference","log"],
    "expiresAt": 1790000000
  },
  "createdAt": "2025-01-01T12:00:00Z",
  "signature": {
    "identityKey": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "nonce": "n-123",
    "signature": "3045022100aa..."
  }
}

- openlineage-event.with-memory.valid.json
{
  "eventType": "COMPLETE",
  "eventTime": "2025-01-01T12:01:00Z",
  "producer": "https://overlay.example/adapter/openlineage/1.0",
  "job": { "namespace": "overlay:dev", "name": "publish::vr_demo" },
  "run": {
    "runId": "txid_deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead",
    "facets": {
      "memory": {
        "_producer": "https://overlay.example/schemas/v1",
        "_schemaURL": "https://your-domain/schemas/v1/openlineage-memory-facet.json",
        "v": "1",
        "fragments": [
          { "fragmentId": "mf_abc123", "contentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "kind": "completion" }
        ]
      }
    }
  }
}

Negative examples (examples/bad/)
- ai-memory-write-request.missing-signature.json (missing required signature) → invalid
- ai-memory-fragment.bad-contentHash.json (contentHash not 64 hex) → invalid
- openlineage-event.memory.missing-schemaurl.json (memory facet without _schemaURL) → invalid

CI (ajv) additions

package.json scripts:
"validate:mem": "ajv -c ajv-formats \
  -s schemas/v1/primitives.json \
  -s schemas/v1/identity.json \
  -s schemas/v1/brc31-signature.json \
  -s schemas/v1/ai-memory-fragment.json \
  -s schemas/v1/ai-memory-write-request.json \
  -s schemas/v1/ai-memory-access-policy.json \
  -s schemas/v1/openlineage-memory-facet.json \
  -s schemas/v1/openlineage-event.json \
  -s schemas/v1/merkle-anchor.json \
  -r https://your-domain/schemas/v1/ \
  -d \"examples/*.valid.json\"",

"validate:mem-bad": "sh -c '! ajv -c ajv-formats \
  -s schemas/v1/primitives.json \
  -s schemas/v1/identity.json \
  -s schemas/v1/brc31-signature.json \
  -s schemas/v1/ai-memory-fragment.json \
  -s schemas/v1/ai-memory-write-request.json \
  -s schemas/v1/ai-memory-access-policy.json \
  -s schemas/v1/openlineage-memory-facet.json \
  -s schemas/v1/openlineage-event.json \
  -r https://your-domain/schemas/v1/ \
  -d \"examples/bad/*.json\"'"

6) Redis integration (non‑Lua Node helpers)
- Use the same ingestion style as D41 (idempotent event upserts) for memory writes:
  - Compute fragmentId, persist fragment JSON string at ai:ns:<ns>:mem:<id>
  - Indices: ZADD by_time, SADD by_owner/by_model/by_dataset/by_tag/by_kind
  - If you store encrypted payload server‑side, SET ai:ns:<ns>:mem:enc:<id> (base64), else prefer external object storage (URI present)

7) Security and privacy checklist
- Always validate BRC‑31 signature on write requests (writer proves authorship).
- Prefer client‑side encryption; the server should not see plaintext. Include encryption metadata for recipient derivation.
- Deny by default; enforce allowReaders/allowTags from policy on GET payload.
- No PII in metadata; use hashes and URIs.
- SPV anchors are optional but recommended for audit: batch merkle root and later attach txid/SPV proof.

8) Definition of Done (DoD)
- Schemas hosted; CI validates golden and bad vectors.
- Redis ingestion stores fragments idempotently and builds search indices.
- APIs for write/get/search/policy implemented and secured.
- OL facet “memory” is emitted/ingested so runs reference fragmentIds.
- (Optional) Batch anchoring job runs and SPV proofs attach to fragment.spvAnchors.

9) Acceptance criteria (E2E)
- Write (signed) → fragmentId → Search by owner/tag → Get metadata → Access policy enforced for payload delivery.
- OL run shows memory facet referencing fragmentId; lineage view links back to memory detail.
- Bad payloads/signatures/schema variants rejected; CI fails on bad samples.
- Optional: anchors created; SPV proof accepted; memory fragment displays anchoredAt and txid.

10) Future extensions
- Add a “memory index” facet to datasets/models to list related fragments for UX.
- Add streaming endpoints (/ai/memory/stream) using SSE for live agent logging (persist via write).
- Add vector store linkage: memory fragment external.uri points to embedding index location; keep that out of the core trust path.

This deliverable gives your agents a standard way to write and share memory fragments with portable schemas, secure encryption and policy controls, Redis‑backed speed, and clean integration into OpenLineage and your SPV‑first trust model.