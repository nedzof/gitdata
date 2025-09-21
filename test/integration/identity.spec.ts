import { describe, test, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
 //import { initSchema } from '../../src/db';
import { submitDlm1Router } from '../../src/routes/submit-builder';
import { requireIdentity } from '../../src/middleware/identity';
import { secp256k1 } from '@noble/curves/secp256k1';
import { createHash } from 'crypto';

function sha256Hex(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex');
}

describe('Identity Integration Test', () => {
  test('should handle identity signatures and validation', async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));

    const db = new Database(':memory:');
    initSchema(db);

    // Mount builder (already requires identity via internal change)
    app.use(submitDlm1Router({}));

    // Also add a test route with explicit identity requirement
    app.post('/test-identity', requireIdentity(true), (req, res) => {
      res.json({ success: true, identityKey: (req as any).identityKey });
    });

    // Prepare a dummy manifest for call
    const manifest = {
      type: 'datasetVersionManifest',
      datasetId: 'ds-i',
      content: { contentHash: 'c'.repeat(64) },
      provenance: { createdAt: '2024-01-01T00:00:00Z', producer: {} },
      policy: { license: 'cc-by-4.0', classification: 'public' }
    };

    // Generate secp256k1 key pair
    const priv = secp256k1.utils.randomPrivateKey();
    const pub = secp256k1.getPublicKey(priv, true); // compressed
    const idKey = Buffer.from(pub).toString('hex');

    // Build headers for a valid request
    const nonce = 'nonce-' + Date.now();
    const bodyStr = JSON.stringify({ manifest });
    const msgHashHex = sha256Hex(Buffer.from(bodyStr + nonce, 'utf8'));
    const sig = secp256k1.sign(msgHashHex, priv);
    const sigDer = sig.toDERHex();

    // Test 1: Valid signature should not be unauthorized
    const r1 = await request(app)
      .post('/submit/dlm1')
      .set('x-identity-key', idKey)
      .set('x-nonce', nonce)
      .set('x-signature', sigDer)
      .send({ manifest });

    // Should not be 401 (unauthorized) - may fail for other reasons like missing validation
    expect(r1.status).not.toBe(401);
    console.log('✓ Valid signature accepted (not 401)');

    // Test 2: Wrong key should fail
    const wrongPriv = secp256k1.utils.randomPrivateKey();
    const wrongPub = secp256k1.getPublicKey(wrongPriv, true);
    const wrongId = Buffer.from(wrongPub).toString('hex');

    const r2 = await request(app)
      .post('/submit/dlm1')
      .set('x-identity-key', wrongId)
      .set('x-nonce', 'nonce-2')
      .set('x-signature', sigDer) // signature from the first key
      .send({ manifest });

    expect(r2.status).toBe(401);
    expect(r2.body.error).toBe('unauthorized');
    console.log('✓ Wrong key rejected (401)');

    // Test 3: Replay attack (reuse nonce) should fail
    const r3 = await request(app)
      .post('/submit/dlm1')
      .set('x-identity-key', idKey)
      .set('x-nonce', nonce) // reuse the first nonce
      .set('x-signature', sigDer)
      .send({ manifest });

    expect(r3.status).toBe(401);
    expect(r3.body.error).toBe('unauthorized');
    expect(r3.body.hint).toBe('nonce-reused');
    console.log('✓ Replay attack blocked (401)');

    // Test 4: Missing headers should fail when required
    const r4 = await request(app)
      .post('/test-identity')
      .send({});

    expect(r4.status).toBe(401);
    console.log('✓ Missing identity headers rejected (401)');

    console.log('✅ D19 Identity middleware tests passed.');
  });
});