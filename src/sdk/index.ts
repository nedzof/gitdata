/**
 * Minimal SDK client for Genius System Overlay (MVP)
 * - No external deps
 * - Fetch-injected for testability
 * - Types reflect OpenAPI shapes used most often
 */

import { BRC22, BRC36, BRC100 } from '../brc';

export type VerificationPolicy = {
  minConfs?: number;
  classificationAllowList?: string[];
  allowRecalled?: boolean;
  requiredEndorsementRoles?: string[];
};

export type ReadyResponse = {
  ready: boolean;
  reasons?: string[];
  confsUsed?: number;
  bestHeight?: number;
  bundle?: LineageBundle; // optional
};

export type LineageBundle = {
  bundleType: 'datasetLineageBundle';
  target: string; // versionId
  graph: {
    nodes: Array<{ versionId: string; manifestHash: string; txo: string }>;
    edges: Array<{ child: string; parent: string }>;
  };
  manifests: Array<{ manifestHash: string; manifest: Record<string, unknown> }>;
  proofs: Array<{ versionId: string; envelope: BRC36.SPVEnvelope }>;
  confsUsed?: number;
  bestHeight?: number;
};

export type PriceQuote = {
  resource: string;
  producerId?: string;
  unit: 'sat/byte' | 'sat/call';
  price: number;
  requiredAttrs?: string[];
  class?: string;
  expiresAt?: string;
};

export type Receipt = {
  receiptId: string;
  resource: string;
  class: string;
  quantity: number;
  amountSat: number;
  expiresAt: string;
  signature: string; // overlay HMAC for MVP
  attrs?: Record<string, unknown>;
};

export class GeniusClient {
  constructor(
    private baseUrl: string,
    private fetchImpl: typeof fetch = fetch, // allow DI in tests
  ) {}

  // Core lineage

  async submit(envelope: BRC22.SubmitEnvelope): Promise<{ admitted: any[] }> {
    if (!BRC22.isSubmitEnvelope(envelope)) throw new Error('invalid BRC22 envelope');
    const res = await this.fetchImpl(`${this.baseUrl}/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    if (!res.ok) throw await this._error(res);
    return res.json();
  }

  async bundle(versionId: string, depth = 10): Promise<LineageBundle> {
    const url = new URL(`${this.baseUrl}/bundle`);
    url.searchParams.set('versionId', versionId);
    url.searchParams.set('depth', String(depth));
    const res = await this.fetchImpl(url.toString());
    if (!res.ok) throw await this._error(res);
    return res.json();
  }

  async resolve(params: { versionId?: string; datasetId?: string; cursor?: string; limit?: number }) {
    const url = new URL(`${this.baseUrl}/resolve`);
    if (params.versionId) url.searchParams.set('versionId', params.versionId);
    if (params.datasetId) url.searchParams.set('datasetId', params.datasetId);
    if (params.cursor) url.searchParams.set('cursor', params.cursor);
    if (params.limit) url.searchParams.set('limit', String(params.limit));
    const res = await this.fetchImpl(url.toString());
    if (!res.ok) throw await this._error(res);
    return res.json();
  }

  async ready(versionId: string, policy?: VerificationPolicy, receiptId?: string): Promise<ReadyResponse> {
    const res = await this.fetchImpl(`${this.baseUrl}/ready`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ versionId, policy, receiptId }),
    });
    if (!res.ok) throw await this._error(res);
    return res.json();
  }

  // Payments & access

  async price(resource: string, cls = 'standard'): Promise<PriceQuote> {
    const url = new URL(`${this.baseUrl}/price`);
    url.searchParams.set('resource', resource);
    url.searchParams.set('class', cls);
    const res = await this.fetchImpl(url.toString());
    if (!res.ok) throw await this._error(res);
    return res.json();
  }

  async pay(resource: string, quantity: number, attrs?: Record<string, unknown>, payer?: string): Promise<Receipt> {
    const res = await this.fetchImpl(`${this.baseUrl}/pay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resource, quantity, attrs, payer }),
    });
    if (!res.ok) throw await this._error(res);
    return res.json();
  }

  /**
   * Stream data (binary). Caller should verify SHA-256(bytes) == manifest.content.contentHash.
   * This returns a Response so the caller can pipe or read as needed.
   */
  async streamData(contentHash: string, receiptId: string): Promise<Response> {
    const url = new URL(`${this.baseUrl}/v1/data`);
    url.searchParams.set('contentHash', contentHash);
    url.searchParams.set('receiptId', receiptId);
    const res = await this.fetchImpl(url.toString());
    if (!res.ok) throw await this._error(res);
    return res;
  }

  // Producers

  async registerProducer(
    wallet: BRC100.WalletClient,
    profile: { payoutTarget: string; displayName?: string; contact?: string; attrs?: Record<string, unknown> },
  ) {
    const identityKey = (await wallet.getIdentityKeyHex?.()) || '';
    const body = JSON.stringify({ identityKey, ...profile });
    const headers = await BRC100.withIdentityHeaders(wallet, body);
    const res = await this.fetchImpl(`${this.baseUrl}/producers/register`, {
      method: 'POST',
      headers,
      body,
    });
    if (!res.ok) throw await this._error(res);
    return res.json();
  }

  async upsertPriceRule(
    wallet: BRC100.WalletClient,
    rule: { producerId: string; pattern: string; unit: 'sat/byte' | 'sat/call'; basePrice: number; tiers?: Record<string, number>; requiredAttrs?: string[] },
  ) {
    const body = JSON.stringify(rule);
    const headers = await BRC100.withIdentityHeaders(wallet, body);
    const res = await this.fetchImpl(`${this.baseUrl}/producers/price`, {
      method: 'POST',
      headers,
      body,
    });
    if (!res.ok) throw await this._error(res);
    return res.json();
  }

  // Utilities

  private async _error(res: Response): Promise<Error> {
    const txt = await res.text().catch(() => `${res.status} ${res.statusText}`);
    return new Error(txt || `${res.status} ${res.statusText}`);
  }
}
