Product Design Document: Gitdata MVP

- Version: 1.0
- Status: Final
- Author: Gitdata AI Assistant
- Date: 2025-09-17
- Reviewers: Core Development Team

1. Introduction

1.1 Problem Statement
AI systems increasingly make high-stakes decisions, yet the data they rely on is often opaque. This “garbage in, garbage out” reality erodes trust, increases risk, and impedes adoption. Data producers lack a standard way to prove provenance; consumers have no simple, fast mechanism to verify lineage and integrity before using data.

1.2 Vision
Gitdata is the decentralized trust layer for the AI economy. It anchors provenance on Bitcoin SV, serves high-performance, SPV-verifiable lineage bundles, and enables an open, paid marketplace where high-quality data can be discovered, verified, bought, and used in minutes.

1.3 Target Audience
- AI/ML Engineers & Data Scientists (Consumers): Need a fast, automatable verification gate and confident delivery for training/inference.
- Data Providers & Enterprises (Producers): Need simple tools to publish, price, and monetize data while providing cryptographic proof of authenticity and origin.

1.4 Goals (Success Criteria)
1) Sub-second trust gate: POST /ready returns ready:true/false in < 200 ms (cached) for a target dataset under a given policy.
2) Functional marketplace: Producers can register, publish (DLM1), set prices, receive payments (receipts), and see revenue; consumers can discover, pay, and download with confidence.
3) Developer-first DX: Provide a minimal JS/TS SDK and CLI so a developer integrates verification and data access in < 30 minutes.

1.5 Non-Goals (MVP)
- Zero-Knowledge Proofs (advanced privacy)
- Full GUI lineage explorer (JSON-first; UI is post-MVP)
- Deep vendor-specific connectors (provide simple Python/CLI examples instead)
- Automated dispute resolution (log disputes; refunds manual at MVP)

2. Core Concepts & Terminology

- DLM1 (Data Lineage Manifest v1): On-chain declaration (canonical CBOR in OP_RETURN) that binds the manifestHash (hash of a canonical off-chain manifest), optional parents, and metadata flags. The manifest includes provenance/policy and contentHash of the bytes.
- TRN1 (Agent Transition v1): On-chain anchor for an agent step (agentId, seq, fromState, toState, outputsRoot, etc.). Used to create an immutable journal (optional).
- OTR1 (Ontology Triple v1): On-chain anchor for a tripleHash (subject/predicate/object canonicalized and hashed). Optional for machine-readable facts.
- Lineage Bundle: JSON object containing a target dataset’s ancestry (graph), the signed manifests, and SPV proof materials (rawTx, merkle path, block headers). Verifiable offline by clients.
- SPV Envelope: The raw transaction, merkle inclusion path, and block header(s) needed to prove on-chain inclusion. The overlay does not need to sign these; they verify against chain data.
- Receipt: Overlay-signed (HMAC) JSON granting time-limited, bandwidth-capped access to a resource after /pay. Contains resource scope, class/tier, quantity, expiry. Logged in revenue events.
- Advisory: Signed notice (producer/admin) recalling/superseding a dataset version or warning about issues. /ready consults advisories by default (ready:false unless policy allows).

3. System Architecture & High-Level Design

Layers
1) On-Chain Anchors (Trust Layer): Bitcoin SV provides immutable, time-stamped commitments (DLM1/TRN1/OTR1).
2) Overlay Service (Performance & Logic): Accepts submitted transactions, maintains a local index of committed items, constructs lineage bundles, enforces policies, issues receipts, and streams data.
3) Client Tooling (UX Layer): JS/TS SDK, Python verifier CLI, and CLIs for producer onboarding and one-shot flows.

Core Consumer Flow
1) Identify a dataset versionId.
2) POST /ready { versionId, policy, receiptId? } → { ready, reasons[], confsUsed, bestHeight }.
3) If payment required: GET /price → POST /pay → receiptId.
4) GET /v1/data?contentHash&receiptId → stream bytes; client hashes to compare with manifest.content.contentHash.

4. Detailed Feature Specifications

4.1 Scalability & Performance

4.1.1 Proof/Bundle Caching
- Cache SPV headers and verified envelopes; cache lineage bundles (short TTL; invalidate on reorg).
- Include confsUsed and bestHeight in /ready and /bundle responses.

Acceptance
- P95 /bundle (depth ≤ 10, cached) < 250 ms; ≥ 90% hit rate for popular items.

4.1.2 Bounded Graph & Pagination
- Max parents per node (e.g., 16), max ancestry depth for /bundle (e.g., 20).
- Cursor pagination for /resolve and /search.

Acceptance
- Requests beyond configured limits return clear 400 errors.

4.1.3 Rate Limits & Backpressure
- Token bucket per IP/identity/receipt on /submit, /bundle, /ready, /v1/data, /price, /pay.
- Concurrency caps for streams; request timeouts on heavy endpoints.

Acceptance
- Excess calls return 429; metrics show stable performance under burst.

4.1.4 Asynchronous Proof Refresh
- Serve cached proofs; background refresh when new headers arrive.

Acceptance
- P95 /ready (cached) < 150 ms; stable behavior across block boundaries.

4.2 Privacy & Confidentiality

4.2.1 Access Classes
- Manifest.policy.classification ∈ {public, internal, restricted}; /ready enforces allow-lists and required attributes.

4.2.2 Gated Access by Receipts
- /v1/data requires a valid, unexpired receipt with sufficient bandwidth; decrement bandwidth on completion.

4.2.3 Minimal Sensitive Data Hygiene
- Manifest.policy.pii_flags[]; default overlay policy can block or require attributes for flagged data.

4.2.4 Optional Encryption (FRG1)
- Client-side ECDH + HKDF derived symmetric keys; overlay stores encrypted blobs; SDK adds helper functions.

4.3 Developer Tooling

4.3.1 JS/TS SDK
- Minimal NPM package with: ready(), verifyBundle(), price(), pay(), streamData().

Acceptance
- Quickstart completes end-to-end in < 30 minutes.

4.3.2 CLI
- producer-onboard: register → submit DLM1 → set price → print listing/quote/dashboard URLs.
- one-shot: publish → pay → ready → download for testing flows.

Acceptance
- producer-onboard finishes in one run with working URLs.

4.3.3 Minimal Dashboard JSON
- GET /producers/dashboard: profile, pricebook, last30d revenue (secured).

4.4 Integrations

4.4.1 Python Verifier CLI
- verify_ready.py → calls /ready and returns exit 0/1 with reasons.

4.4.2 Pre-Ingest Check Example
- examples/preflight.sh → shows ready gating before MLflow/K8s steps.

4.4.3 Export Formats
- All complex endpoints return valid, structured JSON; no CSV/XML for MVP.

4.5 Governance & Disputes

4.5.1 Advisories/Recalls
- POST /advisories; GET /advisories; /ready returns false if an advisory applies (unless policy ignores).

4.5.2 Disputes (JSON Only)
- POST /disputes with linked receiptId/resource and evidence. Log and notify producer/admin; manual refunds.

4.5.3 Refund Policy
- Public documentation; manual processing at MVP.

5. API Endpoint Definitions (MVP)

Method | Path | Description | Auth
- POST /submit — Accepts a raw transaction with DLM1/TRN1/OTR1 OP_RETURN and optional manifest; maps manifestHash → producerId | Producer (signed request recommended)
- GET /bundle?versionId&depth — Returns lineage graph, manifests, SPV proofs, confsUsed, bestHeight | None
- GET /resolve?versionId|datasetId&cursor — Lists versions and parents with pagination | None
- POST /ready — Body: { versionId, policy, receiptId? }; returns { ready, reasons[], confsUsed, bestHeight } | None
- GET /price?resource&class — Returns per-producer quote (unit, price, requiredAttrs, expiresAt) | None
- POST /pay — Body: { resource, quantity, attrs, payer? } → { receiptId, amountSat, expiresAt } and logs revenue event | Consumer
- GET /v1/data?contentHash&receiptId — Streams bytes; enforces bandwidth/TTL; client verifies contentHash | Consumer
- POST /producers/register — Registers producer profile/payout | Producer (signed request recommended)
- POST /producers/price — Upserts price rules (pattern/unit/basePrice/tiers/requiredAttrs) | Producer (signed request recommended)
- GET /producers/revenue?producerId&period&limit&offset — Returns totals and events | Producer
- GET /producers/dashboard?producerId — Returns profile, pricebook, last30d revenue | Producer
- POST /advisories — Create recall/supersede advisory | Producer/Admin
- GET /advisories?versionId — List advisories for a version | None
- GET /health, GET /metrics — Ops

6. Data Models (Selected)

Advisory
{
  versionId: string,
  severity: "CRITICAL" | "WARNING",
  reason: string,
  signature: string // producer/admin identity key signature
}

Receipt (Overlay-signed)
{
  receiptId: string,
  resource: string, // e.g., "manifest:<hash>" or "data:<hash>"
  class: string,    // e.g., "gold"
  quantity: number, // bytes or calls
  amountSat: number,
  expiresAt: string, // ISO
  signature: string  // HMAC for MVP
}

7. Success Metrics (MVP)

Performance & Verification
- ≥ 99% of /ready calls complete < 200 ms for cached targets; /bundle (depth ≤ 10, cached) < 250 ms P95.
- /v1/data sustains 50–100 MB/s on LAN with correct metering.

Marketplace Adoption
- ≥ 2 producers onboarded; ≥ 10 successful /pay receipts; revenue_events logged.

Trust & Reliability
- 0 SPV verification failures attributable to the overlay; < 1% disputes per 100 receipts.
- Advisory flip causes /ready to return false immediately (documented test).

8. Security, Abuse & Fraud (MVP)

- Strict canonical CBOR for DLM1/TRN1/OTR1; reject non-canonical or oversize payloads.
- Token-bucket rate limits; size/depth caps; timeouts; stream concurrency limits.
- Identity-signed requests for /producers/* endpoints (recommended MVP+).
- Single-use, TTL receipts; scope-bound (resource, class, quantity); anti-replay checks.
- Attribute-gated tiers (enterprise:true, priority:gold) for higher limits/QoS.
- Always verify SPV (never trust remote claims). Peer allowlist and maxHops if you federate later.

9. Operations & Deployment

- ENV: DB_PATH, OVERLAY_PORT, RECEIPT_SECRET, WALLET_URL, POLICY_MIN_CONFS, BUNDLE_MAX_DEPTH, BODY_MAX_SIZE, HEADERS_FILE/HEADERS_URL.
- /health and /metrics provide liveness and counters (admissions/sec, proof latency, cache hits, 4xx/5xx).
- Dockerize overlay; persist SQLite volume to ./data.

10. Quickstarts

Producer Onboarding (CLI)
- genius producer-onboard → prints producerId, listing, quote, dashboard URLs.

Consumer
- GET /price → POST /pay → POST /ready → GET /v1/data → verify SHA-256(bytes) == manifest.content.contentHash.

Audit
- GET /bundle?versionId=<hash>&depth=ancestors → verify SPV, signatures, DAG offline.

11. Roadmap (Post-MVP)

- BRC-100 pay-through with multi-output splits (producer/overlay/affiliate).
- Event feed (/watch via SSE/webhooks).
- Auctions/missions (commit–reveal, slashing, budgets).
- Selective disclosure (Merkle proofs per manifest field).
- Lightweight Web UI (catalog & lineage viewer).

12. Glossary

- SPV: Simplified Payment Verification (merkle path + headers).
- DLM1/TRN1/OTR1/FRG1: On-chain/Off-chain formats: dataset version, agent transition, ontology triple, encrypted fragment.
- Lineage Bundle: Graph + manifests + SPV proofs package.
- Receipt: Signed, scoped, time-limited access grant.

Corrections you asked me to apply
- TRN1 = Agent Transition (not a payment receipt).
- OTR1 = Ontology Triple anchor (not an overlay trust root).
- SPV envelopes are verifiable from chain data; no overlay signature required.
- /ready is POST (accepts policy and optionally receiptId), not GET.
- MVP uses overlay-signed receipts (HMAC); payments are logged in revenue_events; no on-chain payment anchoring required.

If you want, I can provide an OpenAPI 3.0 YAML matching this PDR, plus JSON Schemas for DLM1 manifest, lineage bundle, advisory, and receipt.
