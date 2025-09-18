# Contributing to Genius System (MVP)

Thank you for contributing! This document defines the engineering rails (structure, standards, CI) so we stay fast, consistent, and safe. It also includes ready-to-use configs for ESLint/Prettier and a GitHub Actions CI workflow.

### Contents
- 1. Repository layout
- 2. Environment & configuration
- 3. Setup & dev workflow
- 4. Coding standards
- 5. Protocol rules (tags & schemas)
- 6. Testing & quality gates
- 7. Observability & ops
- 8. Security rails
- 9. Performance budgets
- 10. PR checklist
- 11. Release process
- 12. Copy-paste configs
  - 12.1 ESLint (`.eslintrc.cjs`)
  - 12.2 Prettier (`.prettierrc`, `.prettierignore`)
  - 12.3 GitHub Actions (`ci.yml`)

---

### 1. Repository layout
- `/src`
  - `/db` (sqlite repo, migrations)
  - `/validators` (strict CBOR parsers + JSON Schemas helpers)
  - `/builders` (DLM1/TRN1/OTR1 + OP_RETURN helpers)
  - `/spv` (headers loader, merkle verify, proof cache)
  - `/policy` (/ready engine, advisory checks)
  - `/payments` (receipts, revenue logging)
  - `/mock` (overlay server, wallet stub)
- `/schemas` (`dlm1-manifest.schema.json`, `lineage-bundle.schema.json`, `receipt.schema.json`, `advisory.schema.json`)
- `/postman` (`collection.postman_collection.json`, `env.postman_environment.json`)
- `/scripts` (one-shot, producer-onboard, demo)
- `/test` (unit, integration, golden vectors)
- `openapi.yaml`, `README.md`, `CONTRIBUTING.md`

### 2. Environment & configuration
**Required ENV** (dev defaults in `.env` or your procfile):
- `DB_PATH=./data/overlay.db`
- `OVERLAY_PORT=8788`
- `WALLET_URL=http://localhost:3001`
- `RECEIPT_SECRET=change-me`
- `POLICY_MIN_CONFS=1`
- `BUNDLE_MAX_DEPTH=10`
- `BODY_MAX_SIZE=1048576`
- `HEADERS_FILE=./headers.json` (or `HEADERS_URL`)
- `RATE_LIMITS_JSON={"submit":5,"bundle":10,"ready":20,"data":10,"price":50,"pay":10}`
- `CACHE_TTLS_JSON={"headers":60000,"proofs":300000,"bundles":300000}`

**Profiles**
- **dev**: `MIN_CONFS=0`, relaxed rate limits, verbose logs
- **staging**: `MIN_CONFS=1`, realistic limits, caching enabled
- **prod**: `MIN_CONFS≥1` (3–6 for regulated); strict limits; caching + metrics

### 3. Setup & dev workflow
- Node 18+ and SQLite
- **Install**: `npm ci`
- **Start overlay**: `npm run dev` (or `node src/mock/overlay-mock-extended.ts` with `tsx`)
- **Start wallet stub**: `npm run wallet`
- **Generate goldens/tests**: `npm test`
- **Postman**: import the collection & environment from `/postman`; run “Full Suite + Tests”

### 4. Coding standards
- TypeScript `strict`; ESLint + Prettier must pass
- Keep endpoint handlers thin; move logic to `/policy`, `/payments`, `/spv`, etc.
- Return JSON everywhere (except `/v1/data` streaming)
- **Error model**: `400` invalid input, `401` unsigned (protected routes), `402` payment/receipt issues, `403` forbidden, `404` not found, `413` body too large, `429` rate limit, `500` unexpected. Respond with `{ error, code?, hint? }`.

### 5. Protocol rules (tags & schemas)
- On-chain tags are **immutable**: `DLM1`/`TRN1`/`OTR1`
- Breaking field changes → **new tag** (`DLM2`/`TRN2`/`OTR2`)
- JSON Schemas: pin `$id`, keep old schema for replay
- Maintain golden vectors for each tag version

### 6. Testing & quality gates
- **Unit**: CBOR validators, SPV (merkle proof), policy logic
- **Integration**: `submit` → `bundle` → `ready`; `price` → `pay` → `data`; producers (`register` → `price` → `revenue`)
- **Newman/Postman**: run collection with tests (schema validation for `/bundle`, `/pay`, `/advisories`); advisory flip scenario must pass
- **E2E**: A2A demo (GenoScreener → Molecula → ToxSim)
- **Golden vectors**: `test/vectors` (`dlm1` blobs, `headers.json`, bundle samples)

### 7. Observability & ops
- `/health` must return `{ "ok": true }` if DB + header store + cache are reachable
- `/metrics` JSON: `admissions/sec`, `proofLatencyMsP95`, `bundleLatencyMsP95`, `cacheHits`, `4xx/5xx`
- **Logs**: one JSON line per request (`method`, `path`, `status`, `ms`, `ip`, `identity?`, `receiptId?`)

### 8. Security rails
- **Identity-signed producer endpoints** (`/producers/*`) in staging/prod:
  - `X-Identity-Key` (hex), `X-Nonce` (uuid), `X-Signature` (sig over body+nonce)
- **Receipts**: single-use, scope-bound (resource, class, quantity), TTL; mark consumption atomically
- **Policy enforcement**: classification allow-list and advisories at `/ready` (and optionally at `/v1/data`)
- **Federation** (post-MVP): peer allowlist, always verify remote bundles via local SPV

### 9. Performance budgets
- `/ready` (cached) P95 < 200 ms
- `/bundle` (depth ≤ 10, cached) P95 < 250 ms
- `/v1/data` streaming ≥ 50–100 MB/s on LAN
- Default rate limits (per ENV); cache TTLs: headers 60s, proofs 5m, bundles 5m

### 10. PR checklist
- [ ] Lint & Prettier pass (`npm run lint && npm run format:check`)
- [ ] Unit & integration tests pass (`npm test`)
- [ ] Postman `newman` run succeeds (advisory flip scenario included)
- [ ] OpenAPI and schemas updated if API/shapes changed
- [ ] Golden vectors updated (if validators changed)
- [ ] Error responses are informative (`error/code/hint`) and consistent
- [ ] Performance impact assessed (no unbounded queries; depth caps respected)

### 11. Release process
- Bump version (semver); update `README` + `OpenAPI`
- Run full CI; produce docker image if applicable
- Backup DB; apply migrations
- Tag release and publish artifacts (`openapi.yaml`, postman collection, schemas)

---

### 12. Copy-paste configs

#### 12.1 ESLint (`.eslintrc.cjs`)
Place at the repo root.
```javascript
module.exports = {
  root: true,
  env: { es2022: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
    // If you use project references, consider:
    // project: ["./tsconfig.json"]
  },
  plugins: ["@typescript-eslint", "import", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:prettier/recommended"
  ],
  rules: {
    "prettier/prettier": "error",
    "import/order": ["warn", { "alphabetize": { order: "asc", caseInsensitive: true }, "newlines-between": "always" }],
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": "warn",
    "no-console": "off"
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/__tests__/**/*.ts"],
      env: { jest: true },
      rules: { "no-console": "off" }
    }
  ]
};
