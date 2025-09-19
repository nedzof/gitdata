import { getCacheTTLs } from './ttls';

type CacheKey = string; // `${versionId}:${depth}`

export type BundleCacheEntry = {
  assembledAt: number; // ms since epoch
  body: any;           // the bundle JSON (structure only; confirmations will be recomputed on read)
  meetsPolicyAtWrite: boolean; // whether at write time all envelopes met minConfs
};

const store = new Map<CacheKey, BundleCacheEntry>();

export function bundlesKey(versionId: string, depth: number): CacheKey {
  return `${versionId.toLowerCase()}:${depth}`;
}

export function bundlesGet(key: CacheKey): BundleCacheEntry | undefined {
  const ttl = getCacheTTLs().bundles;
  const ent = store.get(key);
  if (!ent) return undefined;
  if (Date.now() - ent.assembledAt > ttl) {
    store.delete(key);
    return undefined;
  }
  return ent;
}

export function bundlesSet(key: CacheKey, body: any, meetsPolicyAtWrite: boolean) {
  store.set(key, { assembledAt: Date.now(), body, meetsPolicyAtWrite });
}

export function bundlesInvalidate(key?: CacheKey) {
  if (key) store.delete(key);
  else store.clear();
}