export type CacheTTLs = {
  headers: number; // ms
  bundles: number; // ms
};

export function getCacheTTLs(): CacheTTLs {
  try {
    const raw = process.env.CACHE_TTLS_JSON;
    if (raw) {
      const js = JSON.parse(raw);
      return {
        headers: Number(js.headers ?? 60000),
        bundles: Number(js.bundles ?? 60000),
      };
    }
  } catch {
    // ignore
  }
  return { headers: 60000, bundles: 60000 };
}