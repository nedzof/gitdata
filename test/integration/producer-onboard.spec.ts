import { spawn } from 'child_process';
import assert from 'assert';

(async function run() {
  console.log('Testing D15 Producer Onboard CLI...');

  // Test 1: Missing required environment variables
  console.log('1. Testing missing DATASET_ID');
  const missingDataset = spawn('npx', ['tsx', 'scripts/producer-onboard.ts'], {
    env: { ...process.env, DATASET_ID: '', PRICE_SATS: '1000' }
  });

  let output1 = '';
  missingDataset.stderr.on('data', (data) => { output1 += data.toString(); });

  await new Promise((resolve) => {
    missingDataset.on('close', (code) => {
      assert.strictEqual(code, 2, 'Should exit with code 2 for missing DATASET_ID');
      assert.ok(output1.includes('set DATASET_ID'), 'Should show DATASET_ID error');
      console.log('✓ Correctly validates missing DATASET_ID');
      resolve(code);
    });
  });

  // Test 2: Missing PRICE_SATS
  console.log('2. Testing missing PRICE_SATS');
  const missingPrice = spawn('npx', ['tsx', 'scripts/producer-onboard.ts'], {
    env: { ...process.env, DATASET_ID: 'test', PRICE_SATS: '0' }
  });

  let output2 = '';
  missingPrice.stderr.on('data', (data) => { output2 += data.toString(); });

  await new Promise((resolve) => {
    missingPrice.on('close', (code) => {
      assert.strictEqual(code, 2, 'Should exit with code 2 for missing PRICE_SATS');
      assert.ok(output2.includes('set PRICE_SATS > 0'), 'Should show PRICE_SATS error');
      console.log('✓ Correctly validates missing PRICE_SATS');
      resolve(code);
    });
  });

  // Test 3: Invalid CONTENT_HASH
  console.log('3. Testing invalid CONTENT_HASH');
  const invalidHash = spawn('npx', ['tsx', 'scripts/producer-onboard.ts'], {
    env: { ...process.env, DATASET_ID: 'test', PRICE_SATS: '1000', CONTENT_HASH: 'invalid' }
  });

  let output3 = '';
  invalidHash.stderr.on('data', (data) => { output3 += data.toString(); });

  await new Promise((resolve) => {
    invalidHash.on('close', (code) => {
      assert.strictEqual(code, 2, 'Should exit with code 2 for invalid CONTENT_HASH');
      assert.ok(output3.includes('CONTENT_HASH must be 64-hex'), 'Should show CONTENT_HASH error');
      console.log('✓ Correctly validates invalid CONTENT_HASH');
      resolve(code);
    });
  });

  // Test 4: Invalid IDENTITY_KEY
  console.log('4. Testing invalid IDENTITY_KEY');
  const invalidKey = spawn('npx', ['tsx', 'scripts/producer-onboard.ts'], {
    env: { ...process.env, DATASET_ID: 'test', PRICE_SATS: '1000', IDENTITY_KEY: 'invalid' }
  });

  let output4 = '';
  invalidKey.stderr.on('data', (data) => { output4 += data.toString(); });

  await new Promise((resolve) => {
    invalidKey.on('close', (code) => {
      assert.strictEqual(code, 2, 'Should exit with code 2 for invalid IDENTITY_KEY');
      assert.ok(output4.includes('IDENTITY_KEY must be 66-hex'), 'Should show IDENTITY_KEY error');
      console.log('✓ Correctly validates invalid IDENTITY_KEY');
      resolve(code);
    });
  });

  // Test 5: Network error with valid params (server not running)
  console.log('5. Testing network error handling');
  const networkError = spawn('npx', ['tsx', 'scripts/producer-onboard.ts'], {
    env: {
      ...process.env,
      DATASET_ID: 'test-dataset',
      PRICE_SATS: '1000',
      OVERLAY_URL: 'http://localhost:8788'
    }
  });

  let output5 = '';
  let stderr5 = '';
  networkError.stdout.on('data', (data) => { output5 += data.toString(); });
  networkError.stderr.on('data', (data) => { stderr5 += data.toString(); });

  await new Promise((resolve) => {
    networkError.on('close', (code) => {
      assert.ok(output5.includes('[onboard] manifest prepared'), 'Should show manifest preparation');
      assert.ok(stderr5.includes('fetch failed') || code !== 0, 'Should fail due to network error');
      console.log('✓ Correctly handles network errors');
      resolve(code);
    });
  });

  console.log('');
  console.log('OK: All producer onboard CLI validation tests passed! ✓');
  console.log('');
  console.log('Expected flow when server is running:');
  console.log('1. [onboard] manifest prepared');
  console.log('2. [onboard] versionId: <64-hex>');
  console.log('3. [onboard] OP_RETURN scriptHex: <hex>...');
  console.log('4. [onboard] indexed txid: <64-hex>');
  console.log('5. [onboard] SUCCESS');
  console.log('6. JSON output with producerId, links, etc.');

})().catch((e) => {
  console.error('Producer onboard CLI tests failed:', e);
  process.exit(1);
});