export type CacheTTLs = {
  headers: number; // ms
  bundles: number; // ms
  assets: number;  // ms - D022HR asset cache
  listings: number; // ms - D022HR catalog listings
  lineage: number;  // ms - D022HR lineage graph
  sessions: number; // ms - D022HR user sessions
  policies: number; // ms - D022HR policy cache
  prices: number;   // ms - D022HR price cache
};

export function getCacheTTLs(): CacheTTLs {
  try {
    const raw = process.env.CACHE_TTLS_JSON;
    if (raw) {
      const js = JSON.parse(raw);
      return {
        headers: Number(js.headers ?? 60000),     // 1 minute
        bundles: Number(js.bundles ?? 60000),     // 1 minute
        assets: Number(js.assets ?? 300000),      // 5 minutes
        listings: Number(js.listings ?? 180000),  // 3 minutes
        lineage: Number(js.lineage ?? 120000),    // 2 minutes
        sessions: Number(js.sessions ?? 1800000), // 30 minutes
        policies: Number(js.policies ?? 600000),  // 10 minutes
        prices: Number(js.prices ?? 120000),      // 2 minutes
      };
    }
  } catch {
    // ignore
  }
  return {
    headers: 60000,
    bundles: 60000,
    assets: 300000,
    listings: 180000,
    lineage: 120000,
    sessions: 1800000,
    policies: 600000,
    prices: 120000,
  };
}