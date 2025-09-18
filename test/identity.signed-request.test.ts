// test/identity.signed-request.test.ts
import { describe, it, expect } from 'vitest';
import { IdentitySigner, buildPreimage, verifyIdentitySignature } from '../src/identity/signer';
import { verifyIdentityHeaders } from '../src/identity/verifier';

describe('Identity signer and server-side verifier', () => {
  // fixed 32-byte private key (hex) for deterministic golden behavior (DO NOT use in production)
  const SK =
    '5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a';

  it('builds headers and verifies them server-side (happy path)', () => {
    const signer = new IdentitySigner(SK);
    const pk = signer.getPublicKeyHex();
    const body = JSON.stringify({ hello: 'world', n: 1 });
    const nonce = 'abc123';
    const preimage = buildPreimage(body, nonce);
    const signature = signer.signMessage(preimage);

    const res = verifyIdentityHeaders(
      {
        'X-Identity-Key': pk,
        'X-Nonce': nonce,
        'X-Signature': signature,
      },
      body,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.identityKey.toLowerCase()).toBe(pk.toLowerCase());
      expect(res.nonce).toBe(nonce);
    }
  });

  it('fails verification when body is tampered', () => {
    const signer = new IdentitySigner(SK);
    const pk = signer.getPublicKeyHex();
    const body = JSON.stringify({ hello: 'world', n: 1 });
    const badBody = JSON.stringify({ hello: 'WORLD', n: 1 });
    const nonce = 'nonce-xyz';
    const preimage = buildPreimage(body, nonce);
    const signature = signer.signMessage(preimage);

    const res = verifyIdentityHeaders(
      {
        'X-Identity-Key': pk,
        'X-Nonce': nonce,
        'X-Signature': signature,
      },
      badBody, // tampered body
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('invalid_signature');
  });

  it('fails verification when nonce is tampered', () => {
    const signer = new IdentitySigner(SK);
    const pk = signer.getPublicKeyHex();
    const body = JSON.stringify({ x: 42 });
    const nonce = 'original';
    const preimage = buildPreimage(body, nonce);
    const signature = signer.signMessage(preimage);

    const res = verifyIdentityHeaders(
      {
        'X-Identity-Key': pk,
        'X-Nonce': 'different', // wrong nonce
        'X-Signature': signature,
      },
      body,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('invalid_signature');
  });

  it('raw verify helper works (unit)', () => {
    const signer = new IdentitySigner(SK);
    const pk = signer.getPublicKeyHex();
    const body = JSON.stringify({ a: 1 });
    const nonce = 'n1';
    const preimage = buildPreimage(body, nonce);
    const sig = signer.signMessage(preimage);
    const ok = verifyIdentitySignature(pk, body, nonce, sig);
    expect(ok).toBe(true);
  });
});
