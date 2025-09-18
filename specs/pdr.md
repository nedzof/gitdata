1. Introduction

1.1 Problem Statement
AI systems depend on data whose origin and integrity are often opaque. Producers lack a simple way to attest provenance; consumers lack a fast, automatable verification gate. This raises risk, cost, and slows adoption.

1.2 Vision
Gitdata is a decentralized trust layer for the AI data marketplace. It anchors minimal lineage commitments on Bitcoin SV (BSV), serves SPV-verifiable lineage bundles, and enables paid, policy-compliant access to datasets.

1.3 Target Audience
- Consumers (AI/ML engineers, data scientists): need a fast “ready or not” gate and reliable delivery.
- Producers (data vendors, enterprises): need to publish versions, prove lineage, set prices, and monetize.

1.4 Goals (MVP Success Criteria)
- Ready gate: /ready responds in < 200 ms P95 (cached) for common targets.
- Marketplace: producer can publish (DLM1), set price, consumers can discover → pay → download.
- DX: JS/TS SDK and CLI enable end-to-end integration in < 30 minutes.

1.5 Non-Goals (MVP)
- ZK/advanced privacy, deep vendor-specific connectors, automated dispute resolution, full-blown GUI lineage explorer.

2. Core Concepts

- DLM1 (Data Lineage Manifest v1): Tiny on-chain CBOR in OP_RETURN anchoring:
  - mh = bytes32 manifest hash (versionId)
  - p[] = parent versionIds (bytes32[])
- Off-chain manifest (JSON): Rich metadata (contentHash, provenance.locations, policy, lineage.transforms, etc.). Canonicalized for hashing (exclude signatures and versionId, sort keys).
- Lineage Bundle: JSON with graph (nodes/edges), manifests, and SPV envelopes (rawTx, merkle path, block ref).
- SPV Envelope: Proof materials to verify inclusion against local headers (no overlay signature needed).
- Receipt (overlay-signed): Time/byte-capped access token returned by /pay; HMAC for MVP.
- Advisory: Signed recall/warning applied by /ready.
- TRN1/OTR1: Reserved for post-MVP (agent transitions, ontology triples). Not required for marketplace MVP.

3. Architecture

Layers
1) Trust (on-chain): BSV anchors (DLM1 today).
2) Overlay (logic/perf): Accepts submissions, persists manifests/lineage, verifies proofs (SPV), enforces policies, serves bundles, pricing, pay/receipts, and data.
3) Clients (UX): SDK/CLI/UI for producer and consumer flows.

Endianness & SPV
- API hex big-endian (txid, merkle nodes, blockHash).
- Hashing internal with byte-reversal around double-SHA256 (LE).
- SPV verifies merkle path against local headers mirror; confirmations computed from bestHeight − height + 1.

4. Feature Specifications

4.1 Producer Flow (Builder + Receiver)
- Builder: POST /submit/dlm1
  - Validate manifest (JSON Schema).
  - Derive versionId = sha256(canonical(manifest)).
  - Encode DLM1 { mh, p[] } as CBOR, return OP_RETURN scriptHex (OP_FALSE OP_RETURN) and outputs array [{ scriptHex, 0 }].
- Receiver: POST /submit
  - Accept rawTx (signed, broadcast-ready).
  - Parse OP_RETURN, detect DLM1, decode CBOR to extract mh (versionId).
  - Persist declarations, manifests, edges; optionally persist SPV envelope if provided (verified).
  - Idempotent by unique(version_id) and unique(txid).

4.2 Lineage & Verification
- GET /bundle
  - Build graph (nodes/edges) from DB, include manifests and SPV envelopes.
  - Re-verify envelopes against headers and refresh confirmations.
  - Return schema-valid bundle or 409 if incomplete/invalid.
- GET /ready
  - DFS lineage, ensure each node’s envelope verifies and has ≥ POLICY_MIN_CONFS confirmations.
  - Return { ready: boolean, reason?, confirmations? }. No pinning of confs.

4.3 Marketplace
- GET /price
  - Returns price for versionId (override or default).
- POST /price
  - Admin/publisher sets per-version price.
- POST /pay (post-MVP or simple)
  - Returns overlay-signed receipt (HMAC), TTL/quota-limited.
- GET /v1/data
  - Validates receipt, enforces quotas/TTL, streams data or returns presigned URL.
- GET /listings
  - Basic catalog endpoint for UI (title, license, classification, contentHash, txid, status).

4.4 Policies & Advisories (MVP)
- license, classification, pii_flags in manifest used for filtering and UI.
- Advisories post-MVP; ready() to consider advisories once implemented.

5. API (MVP)

- POST /submit/dlm1
  - Body: { manifest }
  - 200: { status, versionId, parents, outputs:[{ scriptHex, 0 }], estOutputSize, opReturnScriptHex, cborHex }
- POST /submit
  - Body: { rawTx, manifest, envelope? }
  - 200: { status: "success", txid, versionId, type, vout }
- GET /bundle?versionId=…
  - 200: Lineage bundle JSON (schema-valid), confirmations refreshed
  - 409: incomplete-lineage/invalid-envelope
- GET /ready?versionId=…
  - 200: { ready, reason?, confirmations? }
- GET /price?versionId=…
  - 200: { versionId, contentHash, satoshis, expiresAt }
- POST /price
  - Body: { versionId, satoshis }
  - 200: { status: "ok" }
- GET /v1/data?contentHash&receiptId=…
  - 200: stream/URL; enforces quotas/TTL
- GET /listings
  - 200: { items: [ { version_id, title, license, classification, content_hash, txid, status, created_at } ] }
- GET /health, GET /metrics
  - Liveness/metrics (requests, proof latency, cache hits, 4xx/5xx)

6. Data Model (DB highlights)

- declarations(version_id PK, txid UNIQUE, type, status, created_at, block_hash, height, opret_vout, raw_tx, proof_json)
- manifests(version_id PK, manifest_hash, content_hash, title, license, classification, created_at, manifest_json)
- edges(child_version_id, parent_version_id, PK(child,parent))
- prices(version_id PK, satoshis)
- receipts(receipt_id PK, version_id, quantity, content_hash, status, created_at) [post-MVP usage]

7. Performance & Scale

- Caching: bundles cached by versionId (+depth), short TTL; confirmations recomputed on read.
- Limits: BUNDLE_MAX_DEPTH, BODY_MAX_SIZE, rate limits per route.
- Targets: /ready cached < 200 ms P95; /bundle (depth ≤ 10) < 250 ms P95.

8. Security & Compliance

- SPV-first: never trust remote proofs; verify against local headers mirror.
- Strict parsers and JSON Schema; reject malformed/oversize payloads.
- Token-bucket rate limits; body size caps; timeouts.
- Identity-signed producer routes (BRC-31 style) post-MVP toggleable by ENV.

9. Operations

- ENV: DB_PATH, OVERLAY_PORT, HEADERS_FILE, POLICY_MIN_CONFS, BUNDLE_MAX_DEPTH, BODY_MAX_SIZE, PRICE_DEFAULT_SATS
- Headers mirror: scripts/attach-proofs.ts + external proof providers; verify locally.
- Metrics: admissions/sec, proofLatencyMsP95, bundleLatencyMsP95, cacheHits, 4xx/5xx.

10. Quickstarts

Producer
- POST /submit/dlm1 with manifest → get outputs/scriptHex
- Wallet builds/signs/broadcasts tx with OP_RETURN
- POST /submit with rawTx (+manifest) → indexed; visible in /listings

Consumer
- GET /bundle → verify lineage & proofs; GET /ready → gate
- GET /price → POST /pay → GET /v1/data (verify bytes == manifest.content.contentHash)

11. Roadmap (Post-MVP)

- Receipts/pay flow with TRN1 anchor (optional on-chain)
- Producer registry & pricebooks; advisories/recalls; quotas & dashboards
- SDK/CLI polish; Postman/OpenAPI; identity-signed producers
- Federation & event feeds; selective disclosure (field proofs)

12. Glossary

- SPV: Simplified Payment Verification (merkle path + headers)
- DLM1: Dataset version anchor (mh, parents)
- Lineage Bundle: Graph + manifests + SPV proofs
- Receipt: Time/byte-capped access grant (overlay-signed for MVP)

Notes on alignment
- /ready is GET with versionId for MVP (matches existing routes). A POST /ready (with policy/receipt in body) can be added later.
- TRN1/OTR1 are reserved; not required for marketplace MVP.
- All hashes in JSON are big-endian hex; hashing uses LE internal with byte reversal.

If you want, I can also produce a matching OpenAPI 3.0 YAML and a Postman collection so your team can run end-to-end flows in one click.
