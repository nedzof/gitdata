# Contribution Guide

This document provides a set of development guidelines to ensure the team stays fast, consistent, and safe while building the project. Following these "dev rails" helps us maintain a high-quality, stable, and predictable codebase.

---

### 1. Repository Layout

We use a single-source-of-truth repository structure to keep things organized and predictable.

-   `/src`: Main application source code.
    -   `/db`: SQLite database, migrations, and data access logic.
    -   `/validators`: Strict CBOR parsers and JSON Schema validators.
    -   `/builders`: Helpers for building on-chain data structures (DLM1, TRN1, etc.).
    -   `/spv`: SPV logic, including headers loader and Merkle verification.
    -   `/policy`: Business logic for the `/ready` engine and advisory checks.
    -   `/payments`: Logic for handling receipts and revenue logging.
    -   `/mock`: Mock overlay server and wallet stubs for testing.
-   `/schemas`: All official JSON schemas (`dlm1-manifest.schema.json`, `lineage-bundle.schema.json`, etc.).
-   `/scripts`: One-off scripts for tasks like producer onboarding and running demos.
-   `/test`: All tests, including unit tests, golden vectors, and Postman/Newman collections.
-   `openapi.yaml`: The OpenAPI specification, defining our API contract.
-   `README.md`: Project overview and setup instructions.
-   `CONTRIBUTING.md`: (This file) Development guidelines and standards.

### 2. Environment and Configuration

The application is configured via environment variables. We use different profiles for development, staging, and production.

**Required Environment Variables:**

```bash
# Database path
DB_PATH=./data/overlay.db

# Server and wallet configuration
OVERLAY_PORT=8788
WALLET_URL=http://localhost:3001

# Security and policy
RECEIPT_SECRET=change-me
POLICY_MIN_CONFS=1
BUNDLE_MAX_DEPTH=10
BODY_MAX_SIZE=1048576

# SPV and Caching
HEADERS_FILE=./headers.json
RATE_LIMITS_JSON='{"submit":5,"bundle":10,"ready":20,"data":10,"price":50,"pay":10}'
CACHE_TTLS_JSON='{"headers":60000,"proofs":300000,"bundles":300000}'
