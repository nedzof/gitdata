export type CacheTTLs = {
  headers: number; // ms
  bundles: number; // ms
  assets: number;  // ms - D022HR asset cache
  listings: number; // ms - D022HR catalog listings
  lineage: number;  // ms - D022HR lineage graph
  sessions: number; // ms - D022HR user sessions
  policies: number; // ms - D022HR policy cache
  prices: number;   // ms - D022HR price cache
  staleWhileRevalidate: number; // ms - D11H stale-while-revalidate
  neg404: number;   // ms - D11H negative cache for 404s
  brcVerification: number; // ms - BRC method verification cache
  brcSignatures: number;   // ms - BRC signature cache
  apiClient: number;       // ms - API client method cache override
};

export function getCacheTTLs(): CacheTTLs {
  try {
    const raw = process.env.CACHE_TTLS_JSON;
    if (raw) {
      const js = JSON.parse(raw);
      return {
        headers: Number(js.headers ?? 30000),           // 30 seconds - D11H shorter for dynamic confirmations
        bundles: Number(js.bundles ?? 300000),          // 5 minutes - D11H envelope cache
        assets: Number(js.assets ?? 300000),            // 5 minutes
        listings: Number(js.listings ?? 180000),        // 3 minutes
        lineage: Number(js.lineage ?? 120000),          // 2 minutes
        sessions: Number(js.sessions ?? 1800000),       // 30 minutes
        policies: Number(js.policies ?? 600000),        // 10 minutes
        prices: Number(js.prices ?? 120000),            // 2 minutes
        staleWhileRevalidate: Number(js.staleWhileRevalidate ?? 60000), // 1 minute
        neg404: Number(js.neg404 ?? 30000),             // 30 seconds
        brcVerification: Number(js.brcVerification ?? 10000),  // 10 seconds
        brcSignatures: Number(js.brcSignatures ?? 300000),     // 5 minutes
        apiClient: Number(js.apiClient ?? 0),           // 0 = no cache, force reload
      };
    }
  } catch {
    // ignore
  }
  return {
    headers: 30000,           // 30 seconds - D11H
    bundles: 300000,          // 5 minutes - D11H
    assets: 300000,           // 5 minutes
    listings: 180000,         // 3 minutes
    lineage: 120000,          // 2 minutes
    sessions: 1800000,        // 30 minutes
    policies: 600000,         // 10 minutes
    prices: 120000,           // 2 minutes
    staleWhileRevalidate: 60000,  // 1 minute
    neg404: 30000,            // 30 seconds
    brcVerification: 10000,   // 10 seconds
    brcSignatures: 300000,    // 5 minutes
    apiClient: 0,             // No cache, force reload
  };
}