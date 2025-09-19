# Gitdata SDK (JS/TS, Minimal)

Install (local project):
- This SDK lives in `src/sdk`. Import via relative path or publish a local npm package as needed.

Usage

```ts
import { GitdataSDK } from './src/sdk';

const sdk = new GitdataSDK({
  baseUrl: 'http://localhost:8788',
  headersUrl: 'http://localhost:8788/data/headers.json' // or another mirror URL
});

(async () => {
  const versionId = '<64-hex>';

  // Ready gate
  const r = await sdk.ready(versionId);
  console.log('ready?', r.ready, 'reason:', r.reason);

  // Bundle + SPV verify (no indexer required)
  const v = await sdk.verifyBundle(versionId, 1);
  console.log('bundle SPV ok?', v.ok, 'minConfs:', v.minConfirmations);

  // Price & Pay
  const quote = await sdk.price(versionId, 2);
  console.log('quote total', quote.totalSatoshis);

  const receipt = await sdk.pay(versionId, 2);
  console.log('receipt id', receipt.receiptId);

  // Download/stream
  const bytes = await sdk.streamData(quote.contentHash!, receipt.receiptId);
  console.log('downloaded bytes:', bytes.length);
})();
```

API
- ready(versionId): GET /ready
- verifyBundle(versionId | bundle, minConfs?): Fetch or take provided bundle and verify SPV envelopes against headers (headersUrl or headersIdx required).
- price(versionId, quantity?): GET /price?versionId=&quantity=
- pay(versionId, quantity?): POST /pay
- streamData(contentHash, receiptId): GET /v1/data

Notes
- Headers mirror URL should serve the JSON your overlay writes (see scripts/headers-mirror.ts).
- This SDK verifies bundle proofs using SPV (no indexer). For browsers, ensure a CORS-enabled headersUrl.
- For large downloads, prefer presigned URLs and streaming.