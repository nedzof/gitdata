Of course. Here is a comprehensive Product Design Document (PDR) for the Genius System MVP. This document is designed to be the single source of truth for the engineering team, leaving no detail ambiguous. It is formatted for maximum clarity, suitable for direct use in development environments like Cursor.

***

# Product Design Document: Genius System MVP

*   **Version:** 1.0
*   **Status:** Final
*   **Author:** Genius System AI Assistant
*   **Date:** 2025-09-17
*   **Reviewers:** Core Development Team

## 1. Introduction

### 1.1. Problem Statement

The proliferation of AI models has created an urgent, unmet need for verifiable data lineage. AI systems are increasingly making high-stakes decisions, yet the data they are trained on is often a black box. This "garbage in, garbage out" problem leads to biased models, unreliable outputs, and a fundamental lack of trust in AI-driven results. Data producers lack a standardized way to prove the provenance of their datasets, and consumers have no reliable mechanism to verify the history and integrity of the data they use, creating significant technical and business risk.

### 1.2. Vision

The Genius System will be the decentralized trust layer for the AI economy. It will provide an open, verifiable, and performant protocol for establishing and resolving data lineage, analogous to a "Microsoft Purview for the decentralized world." By anchoring data provenance on-chain and providing a high-performance overlay network for verification, we will enable a transparent marketplace where high-quality, verifiably-sourced data can be confidently bought, sold, and consumed.

### 1.3. Target Audience

*   **AI/ML Engineers & Data Scientists (Consumers):** Need to ensure the data they use for training and inference is reliable, compliant, and free from tampering. They require simple, fast, and automatable tools to verify data provenance within their existing MLOps pipelines.
*   **Data Providers & Enterprises (Producers):** Need to monetize their data assets while providing cryptographic proof of quality and origin. They require straightforward tools to publish, price, and manage their datasets in a secure marketplace.

### 1.4. Goals (What Success Looks Like)

1.  **Establish Trust:** Provide a sub-second, cryptographically secure method (`/ready` endpoint) for any AI pipeline to verify the lineage and integrity of a dataset before use.
2.  **Enable a Marketplace:** Launch a functional producer-consumer flywheel where producers can register, price, and publish data, and consumers can discover, pay for, and download it with confidence.
3.  **Developer-First Experience:** Ship a lean, powerful SDK (JS/TS) and CLI that allows a developer to integrate lineage verification and data consumption into their workflow in under 30 minutes.

### 1.5. Non-Goals (What We Are Not Building for MVP)

*   **Zero-Knowledge Proofs (ZKPs):** Advanced privacy primitives are out of scope. We will provide foundational privacy via access controls and optional encryption.
*   **Rich Graphical User Interface (GUI):** All interactions will be via API, SDK, and CLI. A visual dashboard or lineage explorer is a post-MVP feature.
*   **Deep, Vendor-Specific Integrations:** We will not build native connectors for Snowflake, Databricks, etc. Instead, we will provide simple, generic examples (e.g., Python scripts) showing how to integrate.
*   **Automated Dispute Resolution:** The dispute system will log claims, but resolution and refunds will be handled manually out-of-band.

## 2. Core Concepts & Terminology

*   **DLM1 (Data Lineage Manifest v1):** The core on-chain declaration. A CBOR-encoded data structure embedded in an `OP_RETURN` output that contains the manifest hash, parent version IDs, and policy flags.
*   **TRN1 (Transaction Receipt Notice v1):** An on-chain anchor proving a payment was made for a specific resource, linking a consumer identity to a receipt.
*   **OTR1 (Overlay Trust Root v1):** An on-chain anchor establishing the cryptographic identity of the overlay service itself, used to sign SPV envelopes.
*   **Lineage Bundle:** An off-chain, JSON-formatted object provided by the overlay that contains a target dataset's full ancestry, including all parent manifests and the SPV proofs required to verify their on-chain commitments.
*   **SPV Envelope:** A signed wrapper containing an SPV proof (transaction, Merkle proof, block headers) that proves a specific transaction was included in the blockchain. Signed by the Overlay's OTR1 key.
*   **Receipt:** A JSON object issued by the overlay service that grants a consumer time-limited, bandwidth-capped access to a specific data resource after a successful payment (TRN1).
*   **Advisory:** A signed message issued by a producer or the overlay to flag a dataset version as recalled, deprecated, or problematic. The `/ready` endpoint consults these by default.

## 3. System Architecture & High-Level Design

The system consists of three primary layers:

1.  **On-Chain Anchors (Trust Layer):** Bitcoin blockchain is used as an immutable ledger for DLM1, TRN1, and OTR1 commitments. This provides the ultimate, decentralized source of truth.
2.  **Overlay Service (Performance & Logic Layer):** A centralized service responsible for indexing the blockchain, constructing lineage bundles, managing receipts, enforcing policies, and serving data. It is the primary interaction point for users.
3.  **Client-Side Tooling (UX Layer):** The JS/TS SDK, Python Verifier, and CLIs that abstract the complexity of the protocol and provide a simple, ergonomic interface for developers.

**Core User Flow (Consumer):**
1.  Consumer identifies a dataset version ID.
2.  Calls `ready(versionId)` via SDK/CLI to the Overlay.
3.  Overlay checks the lineage, policies, and advisories, returning `ready: true/false`.
4.  If a purchase is required, the consumer calls `pay(resource, qty)`.
5.  Overlay generates a quote; consumer makes a payment, creating a TRN1 anchor.
6.  Overlay indexes the TRN1 and issues a `Receipt`.
7.  Consumer calls `streamData(contentHash, receiptId)`.
8.  Overlay verifies the receipt and streams the data, decrementing bandwidth.

## 4. Detailed Feature Specifications

### 4.1. Scalability and Performance

#### 4.1.1. Proof/Bundle Caching
*   **Requirement:** The system must provide low-latency responses for frequently accessed lineage data.
*   **Implementation Details:**
    *   An in-memory cache (e.g., Redis) will be used.
    *   **SPV Cache:** Cache SPV headers and verified SPV envelopes.
        *   Key: `spv:env:<txid>:<height>`
        *   Value: Serialized SPV Envelope object.
    *   **Lineage Bundle Cache:** Cache fully constructed lineage bundles.
        *   Key: `bundle:<target_version_id>`
        *   Value: Serialized Lineage Bundle JSON.
        *   TTL: Short (e.g., 5 minutes) to handle blockchain updates. Invalidate on reorg signals from the node poller.
*   **Acceptance Criteria:**
    *   Cache hit rate for popular datasets exceeds 90%.
    *   P95 latency for `/bundle` (depth ≤ 10) is < 250 ms with cached proofs.

#### 4.1.2. Bounded Graph and Pagination
*   **Requirement:** Prevent denial-of-service and performance degradation from overly complex lineage graphs.
*   **Implementation Details:**
    *   **Max Parents:** The `/submit` endpoint will reject any DLM1 declaration with more than a configured number of parents (e.g., 16).
    *   **Max Ancestry Depth:** The `/bundle` endpoint will enforce a maximum queryable depth (e.g., 20). Requests for greater depth will be rejected with a `400 Bad Request` error.
    *   **Pagination:** The `/resolve` and `/search` (post-MVP) endpoints will use cursor-based pagination.
*   **Acceptance Criteria:**
    *   API requests exceeding configured limits are rejected with a clear error message.

#### 4.1.3. Rate Limits and Backpressure
*   **Requirement:** Protect the service from abuse and ensure fair usage.
*   **Implementation Details:**
    *   Implement a token bucket algorithm for rate limiting.
    *   Apply limits per IP address for unauthenticated endpoints.
    *   Apply stricter, higher limits per producer identity/API key for authenticated endpoints like `/submit`.
    *   Apply limits per receipt for data access endpoints (`/v1/data`).
    *   Heavy endpoints (`/bundle`, `/submit`) will have strict timeouts (e.g., 10 seconds).
    *   The `/v1/data` endpoint will have a cap on concurrent streams per user/receipt.
*   **Acceptance Criteria:**
    *   Requests exceeding the rate limit receive a `429 Too Many Requests` response.

#### 4.1.4. Asynchronous Proof Refresh
*   **Requirement:** Ensure `/ready` and `/bundle` endpoints remain fast even when new blocks arrive.
*   **Implementation Details:**
    *   The service will maintain a `bestHeight` variable.
    *   When a request arrives, serve proofs and bundles from the cache based on the last verified state.
    *   A background worker will poll for new blocks. When a new block is found, it will trigger a refresh of relevant SPV proofs and update the cache.
    *   The `/bundle` and `/ready` responses will include `confsUsed` (confirmations of the tip proof) and `bestHeight` (the overlay's current chain height) to provide context to the client.
*   **Acceptance Criteria:**
    *   P95 latency for `/ready` is < 150 ms for a cached target, independent of new block arrival.
    *   `/v1/data` endpoint sustains 50–100 MB/s throughput on a LAN, with metering correctly enforced.

### 4.2. Privacy and Confidentiality

#### 4.2.1. Access Classes
*   **Requirement:** Allow producers to classify their data for policy enforcement.
*   **Implementation Details:**
    *   The DLM1 manifest schema will include a `policy.classification` field.
    *   Valid values: `public`, `internal`, `restricted`.
    *   The `/ready` endpoint will enforce this. If `classification` is not `public`, the caller must present required attributes (e.g., a JWT proving they are part of the producer's organization for `internal`).
*   **Acceptance Criteria:**
    *   `/ready` denies access to `restricted` or `internal` content unless the caller presents the required attributes.

#### 4.2.2. Gated Access by Receipts
*   **Requirement:** All non-public data downloads must be authorized and metered.
*   **Implementation Details:**
    *   The `/v1/data` endpoint will require a valid `receiptId` as a parameter or header.
    *   The service will validate that the receipt is not expired and has remaining bandwidth.
    *   During the data stream, the service will decrement the `bandwidthRemaining` on the receipt record in the database.
*   **Acceptance Criteria:**
    *   Any call to `/v1/data` without a valid, unexpired receipt with sufficient bandwidth is rejected with a `403 Forbidden` error.

#### 4.2.3. Minimal Sensitive Data Hygiene
*   **Requirement:** Provide a basic mechanism to flag and handle PII.
*   **Implementation Details:**
    *   The DLM1 manifest schema will include a `policy.pii_flags` array of strings.
    *   The overlay can be configured with a default policy to block or mask datasets containing specific flags. This enforcement happens at the `/ready` and `/v1/data` endpoints.
*   **Acceptance Criteria:**
    *   A dataset flagged with a blocked PII category will return `ready: false` unless the consumer's policy explicitly allows it.

#### 4.2.4. Optional Encryption (FRG1)
*   **Requirement:** Provide a standard for client-side encryption when needed.
*   **Implementation Details:**
    *   The FRG1 (Fragment) specification will be documented. It uses ECDH for key exchange and an HKDF to derive a symmetric key for encrypting data fragments.
    *   The overlay service will not perform encryption/decryption; it will merely store and serve the encrypted blobs. The SDK will contain helper functions for FRG1.
*   **Acceptance Criteria:**
    *   The SDK provides `encryptFragment` and `decryptFragment` functions that correctly implement the FRG1 spec.

### 4.3. UX and Developer Tooling

#### 4.3.1. JS/TS SDK
*   **Requirement:** A thin, intuitive client library for Node.js and browsers.
*   **Implementation Details:**
    *   Published as an NPM package (`@genius-system/sdk`).
    *   Core functions:
        *   `verifyBundle(bundle: LineageBundle): Promise<boolean>`
        *   `ready(versionId: string, policy?: VerificationPolicy): Promise<{ ready: boolean; reason: string; }>`
        *   `pay(resource: string, quantity: number): Promise<Quote>`
        *   `streamData(contentHash: string, receiptId: string): Promise<ReadableStream>`
*   **Acceptance Criteria:**
    *   A developer can follow the README quickstart to verify and download a public dataset in under 30 minutes.

#### 4.3.2. CLI
*   **Requirement:** Powerful command-line tools for automation and producer onboarding.
*   **Implementation Details:**
    *   Published as an NPM package (`@genius-system/cli`).
    *   Commands:
        *   `genius producer-onboard`: Interactive script to register a new producer, create an identity, and publish a first dataset. Prints shareable URLs for the listing, quote, and dashboard endpoints.
        *   `genius one-shot`: A combined command that executes the full consumer flow: `publish -> pay -> ready -> download`. Useful for testing and simple scripts.
*   **Acceptance Criteria:**
    *   `producer-onboard` completes in one command and prints working URLs.

#### 4.3.3. Minimal Dashboard JSON
*   **Requirement:** Provide producers with a simple, API-driven way to view their status.
*   **Implementation Details:**
    *   Create a `GET /producers/dashboard` endpoint.
    *   Requires authentication (producer API key).
    *   Returns a JSON object containing profile info, pricebook, and last 30 days of revenue events.
*   **Acceptance Criteria:**
    *   The endpoint returns the correct data structure and is properly secured.

### 4.4. Integrations

#### 4.4.1. Python Verifier CLI
*   **Requirement:** A simple, standalone Python script for use in non-JS environments like CI/CD pipelines.
*   **Implementation Details:**
    *   A single Python script (`verify_ready.py`).
    *   Takes `versionId` and `--overlay-host` as arguments.
    *   Calls the `/ready` endpoint.
    *   Exits with code `0` if `ready: true`, `1` otherwise. Prints the reason to stderr.
*   **Acceptance Criteria:**
    *   The CLI returns the correct exit code and completes in < 200 ms for a cached target.

#### 4.4.2. Pre-ingest Check Example
*   **Requirement:** Show users how to integrate verification into common ML pipelines.
*   **Implementation Details:**
    *   Create a `examples/` directory in the main repository.
    *   Add a simple `preflight.sh` script that demonstrates calling `python verify_ready.py` before executing a dummy `mlflow run` or `kubectl apply` command.
*   **Acceptance Criteria:**
    *   The example script is clear, works, and is referenced in the documentation.

#### 4.4.3. Export Formats
*   **Requirement:** Allow users to ingest system data into their own tools.
*   **Implementation Details:**
    *   All API endpoints that return complex objects (e.g., `/bundle`, `/receipts`) will return well-structured JSON.
    *   No other formats (e.g., CSV, XML) will be supported for MVP.
*   **Acceptance Criteria:**
    *   API responses are consistently formatted, valid JSON.

### 4.5. Governance and Dispute Handling

#### 4.5.1. Advisories/Recalls
*   **Requirement:** A mechanism to quickly signal that a dataset version is no longer valid.
*   **Implementation Details:**
    *   Create a `POST /advisories` endpoint, secured for producers and admins.
    *   The `/ready` endpoint logic will be updated to query for any active advisories matching the target version ID or its ancestors.
    *   If an advisory is found, `/ready` will return `false` with "AdvisoryIssued" as the reason, unless the consumer's verification policy explicitly ignores advisories.
*   **Acceptance Criteria:**
    *   Issuing an advisory via the API instantly causes `/ready` to return `false` for all affected versions.

#### 4.5.2. Disputes (JSON only)
*   **Requirement:** A formal channel for consumers to report issues with purchased data.
*   **Implementation Details:**
    *   Create a `POST /disputes` endpoint.
    *   The request body will be a JSON object (see Data Models section).
    *   The service will persist the dispute, linking it to the receipt and bundle.
    *   It will then trigger a notification (e.g., email, webhook) to the producer's configured contact address.
*   **Acceptance Criteria:**
    *   A submitted dispute is persisted and can be queried by the producer and admins.

#### 4.5.3. Refund Policy (Manual)
*   **Requirement:** A documented process for handling refunds.
*   **Implementation Details:**
    *   A page in the documentation will clearly state the refund policy and process.
    *   The process will be manual for MVP: an admin will review the dispute, and if approved, manually reverse the payment and mark the revenue event as refunded in the database.
*   **Acceptance Criteria:**
    *   The refund policy is publicly documented.

## 5. API Endpoint Definitions

| Method | Path                     | Description                                                              | Auth Required |
| :----- | :----------------------- | :----------------------------------------------------------------------- | :------------ |
| `POST` | `/submit`                | Submits a raw, signed transaction containing a DLM1 declaration.         | Producer      |
| `GET`  | `/resolve/{versionId}`   | Resolves a version ID to its latest transaction details.                 | None          |
| `GET`  | `/bundle/{versionId}`    | Retrieves the full lineage bundle and SPV proofs for a version.          | None          |
| `GET`  | `/ready/{versionId}`     | Performs a comprehensive check of lineage, policy, and advisories.       | None          |
| `GET`  | `/v1/data/{contentHash}` | Streams the data content. Requires a valid receipt.                      | Consumer      |
| `GET`  | `/producers/dashboard`   | Retrieves producer-specific metrics and information.                     | Producer      |
| `POST` | `/disputes`              | Submits a dispute claim against a purchased resource.                    | Consumer      |
| `POST` | `/advisories`            | Publishes a new advisory/recall notice for a dataset version.            | Producer      |

*(Detailed request/response schemas for each endpoint would follow here in a full specification)*

## 6. Data Models (JSON Schema)

#### Dispute Model
```json
{
  "type": "object",
  "properties": {
    "receiptId": { "type": "string" },
    "resource": { "type": "string" },
    "manifestHash": { "type": "string" },
    "reason": { "type": "string", "enum": ["DATA_CORRUPT", "INACCURATE_DESCRIPTION", "POLICY_VIOLATION", "OTHER"] },
    "evidence": {
      "type": "array",
      "items": { "type": "string", "description": "URLs or content hashes of evidence" }
    }
  },
  "required": ["receiptId", "resource", "reason", "evidence"]
}
```

#### Advisory Model
```json
{
  "type": "object",
  "properties": {
    "versionId": { "type": "string" },
    "severity": { "type": "string", "enum": ["CRITICAL", "WARNING"] },
    "reason": { "type": "string" },
    "signature": { "type": "string", "description": "Signature from the producer's identity key" }
  },
  "required": ["versionId", "severity", "reason", "signature"]
}
```

## 7. Success Metrics for MVP

*   **Verification Performance:** ≥ 99% of `/ready` calls complete < 200 ms (cached) and < 600 ms (cold).
*   **Marketplace Adoption:** > 10 producers onboarded; > 100 receipts issued in the first 30 days.
*   **Trust & Reliability:** < 0.5% dispute rate per receipt issued. 0 SPV verification failures attributable to the overlay.

## 8. Launch Checklist (2-Week Sprint)

1.  [ ] **Security Hardening:** Turn on and configure rate limits, body size caps, and bundle depth caps in production.
2.  [ ] **Performance Features:** Enable async proof refresh. Add `confsUsed` and `bestHeight` to `/bundle` and `/ready` responses.
3.  [ ] **Monetization:** Enforce receipt gating on `/v1/data`. Finalize and test bandwidth decrement accounting.
4.  [ ] **Developer Experience:** Publish final SDK and CLI packages to NPM. Create a Postman collection for the API. Write README quickstarts.
5.  [ ] **Governance:** Deploy the `/advisories` and `/disputes` endpoints. Enable advisory checks in the `/ready` logic.
6.  [ ] **Operations:** Set up basic abuse monitoring dashboards and alerts (e.g., spike in 4xx/5xx errors, high dispute rate).
7.  [ ] **Documentation:** Final review and publication of all public-facing documentation.

## 9. Future Considerations (Post-MVP)

*   **Pay-through Splits:** Implement logic to automatically split revenue between a dataset creator and its parent data sources.
*   **Endorsements & Reputation:** Develop a system for users to endorse datasets, building a web-of-trust.
*   **Selective Disclosure:** Use Merkle proofs to allow producers to prove facts about their data without revealing the entire dataset.
*   **Advanced Privacy:** Investigate and implement ZKPs for private lineage verification.
*   **GUI:** Build a web-based UI for lineage exploration, producer dashboards, and marketplace discovery.
