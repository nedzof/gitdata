# BSV Development Standards & Rails

This document outlines the specific BRC standards, toolkits, and architectural patterns used in this project. It serves as the single source of truth for technical implementation to ensure consistency and compliance.

### 1. BSV Standards to Adopt

-   **BRC-22 (Submit Envelope):**
    -   **What:** How clients/overlays exchange transaction envelopes for topic admission.
    -   **Where:** `POST /submit` accepts an envelope with `rawTx`, `inputs`, `mapiResponses`, `proof`, and `topics`.

-   **BRC-31 (Identity-Signed Requests):**
    -   **What:** Identity headers/signatures for protected endpoints.
    -   **Where:** Required for `/producers/register` and `/producers/price` in staging/prod.
    -   **Headers:** `X-Identity-Key`, `X-Nonce`, `X-Signature` (over body+nonce).

-   **BRC-36 (SPV Transaction Envelope):**
    -   **What:** Portable SPV proof (`rawTx` + `merklePath` + `blockHeader`).
    -   **Where:** Embedded in `/bundle.proofs[].envelope` for client-side verification.

-   **BRC-64 (Extended History/Resolve):**
    -   **What:** Paging semantics for overlay lookups.
    -   **Where:** Used in `/resolve` for parents/versions and for deep history in `/bundle`.

### 2. Wallet & Payment Rails (BRC-100)

-   **Wallet:** Use a BRC-100 compliant wallet for building, signing, and payments.
-   **Channel:** JSON-API (as implemented with `WalletClient`/`AuthFetch`).
-   **Flow:**
    1.  Build `rawTx` for on-chain outputs → `POST /submit` (BRC-22).
    2.  Buy access: `GET /price` → `POST /pay` → `receiptId`.
    3.  Stream data: `GET /v1/data?contentHash&receiptId`.

### 3. Toolkits & Libraries

-   **CBOR (canonical):** `cbor` npm package. Use `encodeCanonical`/`decodeFirstSync`.
-   **Signatures:** `@noble/curves/secp256k1` for producer/endorser signature verification.
-   **Hashing:** Node.js `crypto` module (`sha256`).
-   **JSON Schema:** `ajv` + `ajv-formats` for server-side validation.

### 4. SPV & Headers

-   **Do:** Implement a header loader that reads `HEADERS_FILE` or polls `HEADERS_URL`. Cache `bestHeight` and `confirmCount`.
-   **Do:** Implement Merkle verification locally.
-   **Don't:** Rely on an external indexer for trust. **Always verify via SPV.**

### 5. Do's & Don'ts (BSV-First Principles)

-   **Do:**
    -   Always anchor commitments on-chain (DLM1/TRN1/OTR1) and prove with SPV.
    -   Always hash and compare payload bytes to `manifest.content.contentHash`.
    -   Always enforce `minConfs` and advisories in `/ready`.
    -   Always gate heavy endpoints with receipts and log revenue events.
-   **Don't:**
    -   Don’t query an indexer for trust.
    -   Don’t sign SPV envelopes server-side.
    -   Don’t change CBOR tags/field semantics; create a new version (e.g., `DLM2`) if needed.

### 6. Standard Mapping Cheat Sheet

-   **DLM1:** Dataset versions → `OP_RETURN`.
-   **BRC-22:** `/submit` envelope shape.
-   **BRC-31:** Identity-signed requests for `/producers/*`.
-   **BRC-36:** SPV envelope shape inside `/bundle.proofs[]`.
-   **BRC-64:** Paging/history shape for `/resolve`.
-   **BRC-100:** Wallet/payment JSON-API pattern.
