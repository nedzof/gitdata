// src/example-sign.ts
import { IdentitySigner } from '../identity/signer';

const skHex = 'e3...'; // 32-byte hex private key from your identity wallet
const signer = new IdentitySigner(skHex);

const body = JSON.stringify({ producerId: signer.getPublicKeyHex(), pattern: 'manifest:...' });
const headers = signer.buildIdentityHeaders(body); // { 'X-Identity-Key', 'X-Nonce', 'X-Signature', 'content-type' }

// fetch with headers:
await fetch(`${OVERLAY}/producers/price`, { method: 'POST', headers, body });
