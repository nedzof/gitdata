import assert from 'assert';
import { GitdataSDK } from '../../src/sdk';

(async function run() {
  // Test SDK instantiation and types
  const sdk = new GitdataSDK({
    baseUrl: 'http://test:8788',
    headersUrl: 'http://test:8788/headers.json',
    timeoutMs: 5000
  });

  assert.ok(sdk, 'SDK should instantiate');
  assert.strictEqual(typeof sdk.ready, 'function', 'SDK should have ready method');
  assert.strictEqual(typeof sdk.bundle, 'function', 'SDK should have bundle method');
  assert.strictEqual(typeof sdk.verifyBundle, 'function', 'SDK should have verifyBundle method');
  assert.strictEqual(typeof sdk.price, 'function', 'SDK should have price method');
  assert.strictEqual(typeof sdk.pay, 'function', 'SDK should have pay method');
  assert.strictEqual(typeof sdk.streamData, 'function', 'SDK should have streamData method');

  // Test mock fetch functionality
  let fetchCalled = false;
  const mockFetch = async (url: string, opts?: any) => {
    fetchCalled = true;
    assert.ok(url.includes('http://test:8788'), 'URL should use baseUrl');
    return {
      ok: true,
      json: async () => ({ ready: true }),
      headers: { get: () => 'application/json' }
    } as any;
  };

  const mockSdk = new GitdataSDK({
    baseUrl: 'http://test:8788',
    fetchImpl: mockFetch,
    timeoutMs: 1000
  });

  const result = await mockSdk.ready('a'.repeat(64));
  assert.ok(fetchCalled, 'Fetch should have been called');
  assert.strictEqual(result.ready, true, 'Should return mock result');

  console.log('OK: SDK tests passed.');
})().catch((e) => {
  console.error('SDK tests failed:', e);
  process.exit(1);
});