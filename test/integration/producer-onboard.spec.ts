import { spawn } from 'child_process';
import { describe, test, expect } from 'vitest';

describe('Producer Onboard CLI Integration Test', () => {
  test('should validate CLI parameters and handle errors', { timeout: 20000 }, async () => {
  console.log('Testing D15 Producer Onboard CLI...');

  // Test 1: Missing required environment variables
  console.log('1. Testing missing DATASET_ID');
  const missingDataset = spawn('npx', ['tsx', 'scripts/producer-onboard.ts'], {
    env: { ...process.env, DATASET_ID: '', PRICE_SATS: '1000' }
  });

  let output1 = '';
  missingDataset.stderr.on('data', (data) => { output1 += data.toString(); });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      missingDataset.kill();
      reject(new Error('Test 1 timeout: missing DATASET_ID validation'));
    }, 3000);

    missingDataset.on('close', (code) => {
      clearTimeout(timeout);
      expect(code).toBe(2);
      expect(output1).toContain('set DATASET_ID');
      console.log('✓ Correctly validates missing DATASET_ID');
      resolve(code);
    });

    missingDataset.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Test 2: Missing PRICE_SATS
  console.log('2. Testing missing PRICE_SATS');
  const missingPrice = spawn('npx', ['tsx', 'scripts/producer-onboard.ts'], {
    env: { ...process.env, DATASET_ID: 'test', PRICE_SATS: '0' }
  });

  let output2 = '';
  missingPrice.stderr.on('data', (data) => { output2 += data.toString(); });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      missingPrice.kill();
      reject(new Error('Test 2 timeout: missing PRICE_SATS validation'));
    }, 3000);

    missingPrice.on('close', (code) => {
      clearTimeout(timeout);
      expect(code).toBe(2);
      expect(output2).toContain('set PRICE_SATS > 0');
      console.log('✓ Correctly validates missing PRICE_SATS');
      resolve(code);
    });

    missingPrice.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Test 3: Invalid CONTENT_HASH
  console.log('3. Testing invalid CONTENT_HASH');
  const invalidHash = spawn('npx', ['tsx', 'scripts/producer-onboard.ts'], {
    env: { ...process.env, DATASET_ID: 'test', PRICE_SATS: '1000', CONTENT_HASH: 'invalid' }
  });

  let output3 = '';
  invalidHash.stderr.on('data', (data) => { output3 += data.toString(); });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      invalidHash.kill();
      reject(new Error('Test 3 timeout: invalid CONTENT_HASH validation'));
    }, 3000);

    invalidHash.on('close', (code) => {
      clearTimeout(timeout);
      expect(code).toBe(2);
      expect(output3).toContain('CONTENT_HASH must be 64-hex');
      console.log('✓ Correctly validates invalid CONTENT_HASH');
      resolve(code);
    });

    invalidHash.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Test 4: Invalid IDENTITY_KEY
  console.log('4. Testing invalid IDENTITY_KEY');
  const invalidKey = spawn('npx', ['tsx', 'scripts/producer-onboard.ts'], {
    env: { ...process.env, DATASET_ID: 'test', PRICE_SATS: '1000', IDENTITY_KEY: 'invalid' }
  });

  let output4 = '';
  invalidKey.stderr.on('data', (data) => { output4 += data.toString(); });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      invalidKey.kill();
      reject(new Error('Test 4 timeout: invalid IDENTITY_KEY validation'));
    }, 3000);

    invalidKey.on('close', (code) => {
      clearTimeout(timeout);
      expect(code).toBe(2);
      expect(output4).toContain('IDENTITY_KEY must be 66-hex');
      console.log('✓ Correctly validates invalid IDENTITY_KEY');
      resolve(code);
    });

    invalidKey.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
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

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      networkError.kill();
      reject(new Error('Test 5 timeout: network error handling'));
    }, 5000); // Longer timeout for network test

    networkError.on('close', (code) => {
      clearTimeout(timeout);
      expect(output5).toContain('[onboard] manifest prepared');
      expect(stderr5.includes('fetch failed') || code !== 0).toBe(true);
      console.log('✓ Correctly handles network errors');
      resolve(code);
    });

    networkError.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
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

  });
});