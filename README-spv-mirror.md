# Headers Mirror (SPV)

Usage:
- Set HEADERS_URLS to one or more JSON endpoints returning either:
  A) { bestHeight, tipHash, headers: [{ hash, prevHash, merkleRoot, height }, ...] }
  B) { bestHeight, tipHash, byHash: { [hash]: { prevHash, merkleRoot, height } } }
- Set HEADERS_FILE to your local path (e.g., ./data/headers.json)
- Optionally set REQUIRE_AGREEMENT=true to require all sources match tipHash & bestHeight.

Run:
  ts-node scripts/headers-mirror.ts

Behavior:
- Fetches all sources, normalizes, picks highest bestHeight (or requires agreement).
- Writes atomically to HEADERS_FILE only on change.
- Validates basic continuity and shape.