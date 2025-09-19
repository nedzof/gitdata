import { GitdataSDK } from '../src/sdk';
import crypto from 'crypto';

async function main() {
  const baseUrl = process.env.OVERLAY_URL || 'http://localhost:8788';
  const headersUrl = process.env.HEADERS_URL || (baseUrl + '/data/headers.json');
  const versionId = process.env.VERSION_ID || 'a'.repeat(64);

  const sdk = new GitdataSDK({ baseUrl, headersUrl, timeoutMs: 8000 });

  // 10-line quickstart
  const ready = await sdk.ready(versionId);
  console.log('ready?', ready.ready, ready.reason || '');

  const price = await sdk.price(versionId, 1);
  console.log('unit=', price.unitSatoshis, 'total=', price.totalSatoshis);

  const spv = await sdk.verifyBundle(versionId, 1);
  console.log('bundle-ok?', spv.ok, 'minConfs=', spv.minConfirmations || 0);

  // Only attempt data if content is expected and free (for demo)
  if (price.contentHash) {
    const receipt = await sdk.pay(versionId, 1);
    const bytes = await sdk.streamData(price.contentHash, receipt.receiptId);
    const digest = crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    console.log('bytes=', bytes.length, 'sha256=', digest);
  }
}

main().catch((e) => { console.error('sdk quickstart failed:', e); process.exit(1); });