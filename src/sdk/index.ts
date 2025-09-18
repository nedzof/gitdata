import { Readable } from 'stream';

const API_BASE = 'http://localhost:8788'; // Or from ENV

export async function ready(versionId: string, policy: object): Promise<{ ready: boolean; reasons: string[] }> {
  const res = await fetch(`${API_BASE}/ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionId, policy }),
  });
  return res.json();
}

export async function bundle(versionId: string, depth = 10) {
  const res = await fetch(`${API_BASE}/bundle?versionId=${versionId}&depth=${depth}`);
  return res.json();
}

export async function price(resource: string, cls: string) {
  const res = await fetch(`${API_BASE}/price?resource=${resource}&class=${cls}`);
  return res.json();
}

export async function pay(resource: string, quantity: number, attrs: object) {
  const res = await fetch(`${API_BASE}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource, quantity, attrs }),
  });
  return res.json();
}

export async function streamData(contentHash: string, receiptId: string): Promise<Readable> {
  const res = await fetch(`${API_BASE}/v1/data?contentHash=${contentHash}&receiptId=${receiptId}`);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to stream data: ${res.status}`);
  }
  // Note: In Node.js, you might need to convert the web stream.
  // In a browser, you can use res.body directly.
  return res.body as unknown as Readable;
}
