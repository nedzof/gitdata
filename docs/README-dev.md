# Gitdata Overlay — Developer Guide (MVP)

Purpose
- End-to-end producer/consumer flows over an SPV-first, indexer-free BSV overlay.

Key ENV
- DB_PATH=./data/overlay.db
- OVERLAY_PORT=8788
- HEADERS_FILE=./data/headers.json
- POLICY_MIN_CONFS=1
- BUNDLE_MAX_DEPTH=8
- BODY_MAX_SIZE=1048576
- PRICE_DEFAULT_SATS=5000
- CACHE_TTLS_JSON={"headers":60000,"bundles":60000}
- RATE_LIMITS_JSON={"submit":5,"bundle":10,"ready":20,"price":50,"data":10}

Runbooks

Producer (Builder → Wallet → Receiver → Price)
1) Prepare manifest.json (dlm1-manifest.schema.json)
2) POST /submit/dlm1 with { manifest } → { versionId, outputs:[{scriptHex,0}] }
3) Broadcast tx with a wallet embedding scriptHex (dev: synthetic tx via producer-onboard CLI)
4) POST /submit with { rawTx, manifest } → index versionId ↔ txid
5) POST /price { versionId, satoshis } → set per-version price

Consumer (Discover → Verify → Pay → Data)
1) GET /search?datasetId=… or /resolve?datasetId=… → find versionId
2) GET /bundle?versionId=… → verify SPV offline (SDK verifyBundleLocal)
3) GET /ready?versionId=… → gate on minConfs/advisories
4) GET /price?versionId=… → POST /pay → receiptId
5) GET /v1/data?contentHash&receiptId → stream bytes; sha256(bytes) == manifest.content.contentHash

Security & Identity (opt-in, D19)
- Protected producer endpoints accept BRC-31 style headers:
  X-Identity-Key, X-Nonce, X-Signature (sha256(JSON.stringify(body)+nonce))
- Toggle with IDENTITY_REQUIRED=true

SPV (indexer-free)
- Headers mirror at HEADERS_FILE; /ready and /bundle recompute confirmations live
- scripts/headers-mirror.ts can mirror multiple sources atomically

Golden vectors (test/vectors/)
- manifest.sample.json: DLM1 off-chain manifest
- headers.sample.json: headers mirror shape
- proof.sample.json: example envelope for unit tests

Quick commands
- npm run dev          # start overlay
- npm run test:bundle  # bundle tests
- npm run test:ready   # ready tests
- npm run test:price   # price tests
- npm run test:pay     # pay/receipt tests
- npm run test:data    # streaming/quotas tests
- npm run cli:onboard  # producer-onboard flow (dev)
- npm run cli:a2a      # A2A demo (evidence pack)
- npm run postman      # run Postman collection locally (Newman)

Notes
- Keep /bundle cached but always recompute confirmations on read (D11).
- /ready must never pin "ready:true" beyond TTL without re-check.