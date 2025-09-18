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
```

Profiles:
```bash
dev: MIN_CONFS=0, relaxed rate limits, verbose logging.
staging: MIN_CONFS=1, realistic limits, caching enabled.
prod: MIN_CONFS>=1 (typically 3 or 6), strict limits, caching and metrics enabled.
```

3. Coding Standards
Language: TypeScript (strict: true in tsconfig.json).
Linting/Formatting: ESLint and Prettier, enforced with a pre-commit hook.
Module Rules:
Validators must be pure functions and cover all edge cases (invalid, canonical, etc.).
API endpoints should only assemble results. All business logic must reside in dedicated modules (/policy, /payments, etc.).
All external API responses must return JSON, with the exception of /v1/data.
Error Model:
Use standard HTTP status codes: 400 (invalid input), 401 (unsigned), 402 (payment required), 403 (forbidden), 404 (not found), 413 (payload too large), 429 (rate limit), 500 (server error).
Error responses must include a machine-readable JSON body: { "error": "description", "code": "optional_code", "hint": "optional_hint" }.

4. Topic and Versioning Rules

To ensure protocol stability, we follow strict versioning rules.

Tags are Immutable: On-chain tags (e.g., DLM1, TRN1) are permanent.
Breaking Changes: Any breaking change to a data structure requires a new tag (e.g., DLM2).
JSON Schemas: Schema versions are part of their $id URI (e.g., .../v1/...). Old schemas must be kept for replayability.
Golden Vectors: Test vectors must be maintained for each tag version.
5. Testing Strategy
Unit Tests: Cover validators (CBOR canonical ordering, sizes, key checks), SPV logic (Merkle proofs, endianness), and policy rules.
Integration Tests: Verify flows like submit -> bundle -> ready and price -> pay -> data.
E2E Tests: The full A2A demo script serves as our primary E2E test.
API Conformance: The Postman collection is run via newman to validate the API against its specification.
Golden Vectors: Located in /test/vectors, these provide standard test data. Any change to validators requires updating these vectors.
6. CI/CD

Our continuous integration pipeline runs the following jobs on every push:

Lint, unit tests, and integration tests.
newman run of the Postman collection.
Build and tag a Docker image.
7. Observability and Operations
Logs: One JSON line per request, including method, path, status, ms, ip.
Metrics: A /metrics endpoint exposes key indicators like admissions/sec, proofLatencyMsP95, and cache hit rates.
Health: A /health endpoint returns { "ok": true } if all backend services (DB, header store) are reachable.
8. Security Rails
Identity: Endpoints for producers must be signed (see D19).
Receipts: Receipts must be single-use, scope-bound, and have a TTL.
Content Safety: Enforce policy.classification at the /ready endpoint.

This guide is a living document. Please feel free to propose changes via a pull request.
