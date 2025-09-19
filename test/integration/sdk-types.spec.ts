import { GitdataSDK } from '../../src/sdk';
import { SDKOptions, ReadyResult, PriceQuote, Receipt, LineageBundle } from '../../src/sdk/types';

(async function run() {
  // Test type imports work
  const opts: SDKOptions = {
    baseUrl: 'http://localhost:8788',
    headersUrl: 'http://localhost:8788/headers.json',
    timeoutMs: 8000
  };

  const sdk = new GitdataSDK(opts);

  // Test that all expected types are available
  const mockReady: ReadyResult = { ready: true };
  const mockPrice: PriceQuote = {
    versionId: 'a'.repeat(64),
    contentHash: 'b'.repeat(64),
    unitSatoshis: 1000,
    quantity: 1,
    totalSatoshis: 1000,
    ruleSource: 'default',
    tierFrom: 0,
    expiresAt: Date.now() + 60000
  };
  const mockReceipt: Receipt = {
    receiptId: 'c'.repeat(64),
    versionId: 'a'.repeat(64),
    contentHash: 'b'.repeat(64),
    quantity: 1,
    amountSat: 1000,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000
  };
  const mockBundle: LineageBundle = {
    bundleType: 'datasetLineageBundle',
    target: 'a'.repeat(64),
    graph: { nodes: [], edges: [] },
    manifests: [],
    proofs: []
  };

  console.log('OK: SDK types and imports work correctly.');
})().catch((e) => {
  console.error('SDK type tests failed:', e);
  process.exit(1);
});