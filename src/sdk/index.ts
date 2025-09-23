import { getJson, postJson } from './http';
import type { SDKOptions, ReadyResult, PriceQuote, Receipt, LineageBundle } from './types';
import { verifyBundleSPV } from './verify';

export class GitdataSDK {
  private baseUrl: string;
  private headersUrl?: string;
  private f: typeof fetch;
  private timeoutMs: number;

  constructor(opts: SDKOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.headersUrl = opts.headersUrl;
    this.f = opts.fetchImpl || fetch;
    this.timeoutMs = Number(opts.timeoutMs || 8000);
  }

  async ready(versionId: string): Promise<ReadyResult> {
    const path = `/ready?versionId=${encodeURIComponent(versionId)}`;
    return await getJson(this.baseUrl, path, this.timeoutMs, this.f);
  }

  async bundle(versionId: string): Promise<LineageBundle> {
    const path = `/bundle?versionId=${encodeURIComponent(versionId)}`;
    return await getJson(this.baseUrl, path, this.timeoutMs, this.f);
  }

  async verifyBundle(
    versionIdOrBundle: string | LineageBundle,
    minConfs = 0,
  ): Promise<{
    ok: boolean;
    minConfirmations?: number;
    results: { versionId: string; ok: boolean; reason?: string; confirmations?: number }[];
  }> {
    const bundle =
      typeof versionIdOrBundle === 'string'
        ? await this.bundle(versionIdOrBundle)
        : versionIdOrBundle;
    const { ok, results, minConfirmations } = await verifyBundleSPV(bundle, {
      headersUrl: this.headersUrl,
      minConfs,
      fetchImpl: this.f,
    });
    return { ok, minConfirmations, results };
  }

  async price(versionId: string, quantity = 1): Promise<PriceQuote> {
    const q = `/price?versionId=${encodeURIComponent(versionId)}&quantity=${encodeURIComponent(String(quantity))}`;
    return await getJson(this.baseUrl, q, this.timeoutMs, this.f);
  }

  async pay(versionId: string, quantity = 1): Promise<Receipt> {
    return await postJson(this.baseUrl, `/pay`, { versionId, quantity }, this.timeoutMs, this.f);
  }

  /**
   * streamData: returns a Uint8Array of content bytes (MVP).
   * In production, you may prefer to receive a presigned URL and fetch directly from CDN/storage.
   */
  async streamData(contentHash: string, receiptId: string): Promise<Uint8Array> {
    const url = `${this.baseUrl}/v1/data?contentHash=${encodeURIComponent(contentHash)}&receiptId=${encodeURIComponent(receiptId)}`;
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const r = await this.f(url, { signal: ctl.signal as any });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      const buf = new Uint8Array(await r.arrayBuffer());
      return buf;
    } finally {
      clearTimeout(tm);
    }
  }
}
