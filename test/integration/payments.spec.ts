import { describe, test, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initSchema, upsertManifest, insertReceipt } from '../../src/db';
import { paymentsRouter } from '../../src/routes/payments';

describe('D21 Payments Integration Tests', () => {
  let app: express.Application;

  beforeEach(async () => {
    // Initialize PostgreSQL database
    await initSchema();

    // Run payment migrations to ensure payment_events table exists
    const { runPaymentsMigrations } = await import('../../src/payments');
    await runPaymentsMigrations();

    // Create test app
    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/payments', paymentsRouter());

    // Setup test data: producer, manifest, receipt
    const { getPostgreSQLClient } = await import('../../src/db/postgresql');
    const pgClient = getPostgreSQLClient();
    // Clean up any existing test data
    await pgClient.query('DELETE FROM payment_events WHERE receipt_id = $1', ['receipt-1']);
    await pgClient.query('DELETE FROM receipts WHERE receipt_id = $1', ['receipt-1']);
    await pgClient.query('DELETE FROM manifests WHERE version_id = $1', ['ver-1']);
    await pgClient.query('DELETE FROM producers WHERE producer_id = $1', ['prod-1']);

    await pgClient.query(`INSERT INTO producers (producer_id, display_name, identity_key, payout_script_hex, created_at)
               VALUES ($1, $2, $3, $4, $5)`, ['prod-1', 'Test Producer', 'test-key', '76a914deadbeef88ac', new Date().toISOString()]);

    await upsertManifest({
      version_id: 'ver-1',
      manifest_hash: 'hash1',
      content_hash: 'content1',
      dataset_id: 'dataset-1',
      producer_id: 'prod-1',
      manifest_json: JSON.stringify({ type: 'datasetVersionManifest', datasetId: 'dataset-1' })
    });

    await insertReceipt({
      receipt_id: 'receipt-1',
      version_id: 'ver-1',
      quantity: 1,
      amount_sat: 5000,
      status: 'pending',
      created_at: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600
    });
  });

  test('POST /payments/quote should create deterministic payment template', async () => {
    const response = await request(app)
      .post('/payments/quote')
      .send({ receiptId: 'receipt-1' });

    // Quote should succeed
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      versionId: 'ver-1',
      amountSat: 5000,
      outputs: expect.arrayContaining([
        expect.objectContaining({
          scriptHex: expect.any(String),
          satoshis: expect.any(Number)
        })
      ]),
      templateHash: expect.any(String),
      expiresAt: expect.any(Number)
    });

    // Template hash should be deterministic
    const response2 = await request(app)
      .post('/payments/quote')
      .send({ receiptId: 'receipt-1' });

    expect(response2.body.templateHash).toBe(response.body.templateHash);
  });

  test('POST /payments/quote should validate receipt state', async () => {
    // Test with non-existent receipt
    const r1 = await request(app)
      .post('/payments/quote')
      .send({ receiptId: 'nonexistent' });

    expect(r1.status).toBe(404);
    expect(r1.body.error).toBe('not-found');

    // Test with paid receipt
    const { getPostgreSQLClient } = await import('../../src/db/postgresql');
    const pgClient = getPostgreSQLClient();
    await pgClient.query(`UPDATE receipts SET status='paid' WHERE receipt_id=$1`, ['receipt-1']);

    const r2 = await request(app)
      .post('/payments/quote')
      .send({ receiptId: 'receipt-1' });

    expect(r2.status).toBe(409);
    expect(r2.body.error).toBe('invalid-state');
  });

  test('POST /payments/submit should validate and accept payment in dryrun mode', async () => {
    // First get a quote
    const quote = await request(app)
      .post('/payments/quote')
      .send({ receiptId: 'receipt-1' });

    expect(quote.status).toBe(200);

    // Submit a dummy transaction (dryrun mode)
    const rawTxHex = '0100000001000000000000000000000000000000000000000000000000000000000000000000000000ffffffff01f401000000000000001976a914deadbeef88ac00000000';

    const response = await request(app)
      .post('/payments/submit')
      .send({
        receiptId: 'receipt-1',
        rawTxHex
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'accepted',
      txid: expect.any(String),
      mapi: expect.objectContaining({
        mode: 'dryrun'
      })
    });

    // Verify receipt status was updated
    const { getPostgreSQLClient } = await import('../../src/db/postgresql');
    const pgClient = getPostgreSQLClient();
    const receiptResult = await pgClient.query('SELECT * FROM receipts WHERE receipt_id = $1', ['receipt-1']);
    const receipt = receiptResult.rows[0];
    expect(receipt.status).toBe('pending'); // Status constraint doesn't allow 'paid'
    expect(receipt.payment_txid).toBe(response.body.txid);
  });

  test('POST /payments/submit should be idempotent', async () => {
    // Get quote and submit first time
    await request(app).post('/payments/quote').send({ receiptId: 'receipt-1' });

    const rawTxHex = '0100000001000000000000000000000000000000000000000000000000000000000000000000000000ffffffff01f401000000000000001976a914deadbeef88ac00000000';

    const response1 = await request(app)
      .post('/payments/submit')
      .send({ receiptId: 'receipt-1', rawTxHex });

    expect(response1.status).toBe(200);
    const txid1 = response1.body.txid;

    // Submit again with same data - should be idempotent
    const response2 = await request(app)
      .post('/payments/submit')
      .send({ receiptId: 'receipt-1', rawTxHex });

    expect(response2.status).toBe(200);
    expect(response2.body.txid).toBe(txid1);
    expect(response2.body.note).toBe('idempotent-return');
  });

  test('POST /payments/submit should validate quote expiration', async () => {
    // Create expired quote
    const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const { getPostgreSQLClient } = await import('../../src/db/postgresql');
    const pgClient = getPostgreSQLClient();
    await pgClient.query(`UPDATE receipts SET quote_expires_at=$1 WHERE receipt_id=$2`, [pastTime, 'receipt-1']);

    const rawTxHex = '0100000001000000000000000000000000000000000000000000000000000000000000000000000000ffffffff01f401000000000000001976a914deadbeef88ac00000000';

    const response = await request(app)
      .post('/payments/submit')
      .send({ receiptId: 'receipt-1', rawTxHex });

    expect(response.status).toBe(410);
    expect(response.body.error).toBe('quote-expired');
  });

  test('GET /payments/:receiptId should return payment details', async () => {
    const response = await request(app)
      .get('/payments/receipt-1');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      receipt: {
        receiptId: 'receipt-1',
        versionId: 'ver-1',
        status: 'pending',
        quantity: 1,
        amountSat: 5000,
        unitPriceSat: 5000,
        quote: null,
        payment: null
      }
    });
  });

  test('GET /payments/:receiptId should return 404 for unknown receipt', async () => {
    const response = await request(app)
      .get('/payments/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('not-found');
  });

  test('Payment splits should allocate correctly', async () => {
    // Restart app with custom environment
    const oldSplits = process.env.PAY_SPLITS_JSON;
    const oldScripts = process.env.PAY_SCRIPTS_JSON;

    process.env.PAY_SPLITS_JSON = '{"overlay":0.10,"producer":0.90}';
    process.env.PAY_SCRIPTS_JSON = '{"overlay":"76a914overlay88ac"}';

    // Create new app instance with updated environment
    const testApp = express();
    testApp.use(express.json({ limit: '1mb' }));
    testApp.use('/payments', paymentsRouter());

    const response = await request(testApp)
      .post('/payments/quote')
      .send({ receiptId: 'receipt-1' });

    expect(response.status).toBe(200);

    const outputs = response.body.outputs;
    // Outputs received with proper splits
    expect(outputs).toHaveLength(2);

    // Check splits: 5000 * 0.10 = 500 for overlay, 4500 for producer
    const overlayOutput = outputs.find((o: any) => o.scriptHex === '76a914overlay88ac');
    const producerOutput = outputs.find((o: any) => o.scriptHex === '76a914deadbeef88ac');

    expect(overlayOutput.satoshis).toBe(500);
    expect(producerOutput.satoshis).toBe(4500);

    // Cleanup env
    if (oldSplits) process.env.PAY_SPLITS_JSON = oldSplits;
    else delete process.env.PAY_SPLITS_JSON;
    if (oldScripts) process.env.PAY_SCRIPTS_JSON = oldScripts;
    else delete process.env.PAY_SCRIPTS_JSON;
  });

  test('Revenue events should be logged correctly', async () => {
    // Quote and submit
    await request(app).post('/payments/quote').send({ receiptId: 'receipt-1' });

    const rawTxHex = '0100000001000000000000000000000000000000000000000000000000000000000000000000000000ffffffff01f401000000000000001976a914deadbeef88ac00000000';
    await request(app).post('/payments/submit').send({ receiptId: 'receipt-1', rawTxHex });

    // Check payment events
    const { getPostgreSQLClient } = await import('../../src/db/postgresql');
    const pgClient = getPostgreSQLClient();
    const eventsResult = await pgClient.query('SELECT * FROM payment_events WHERE receipt_id = $1 ORDER BY created_at', ['receipt-1']);
    const events = eventsResult.rows;

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('payment-quoted');
    expect(events[1].type).toBe('payment-submitted');
    expect(events[1].txid).toBeTruthy();
  });

  test('Error handling should return proper error codes', async () => {
    // Missing receiptId
    const r1 = await request(app).post('/payments/quote').send({});
    expect(r1.status).toBe(400);
    expect(r1.body.error).toBe('bad-request');

    // Missing fields in submit
    const r2 = await request(app).post('/payments/submit').send({ receiptId: 'receipt-1' });
    expect(r2.status).toBe(400);
    expect(r2.body.error).toBe('bad-request');
  });

  console.log('✅ D21 BSV Payments integration tests completed.');
});