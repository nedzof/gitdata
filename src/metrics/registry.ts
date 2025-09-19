/**
 * Minimal in-memory metrics registry for ops/monitoring.
 * Exposes:
 *  - request counters by route + status class
 *  - admissions counter (/submit)
 *  - bundles cache hits/misses
 *  - SPV proof latency histogram (last N samples) with p50/p95
 *  - uptime
 */

type RouteKey =
  | 'submit'
  | 'bundle'
  | 'ready'
  | 'price'
  | 'data'
  | 'pay'
  | 'advisories'
  | 'producers'
  | 'listings'
  | 'agents'
  | 'rules'
  | 'jobs'
  | 'other';

const START_MS = Date.now();
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

const reqByRoute: Record<RouteKey, number> = {
  submit: 0,
  bundle: 0,
  ready: 0,
  price: 0,
  data: 0,
  pay: 0,
  advisories: 0,
  producers: 0,
  listings: 0,
  agents: 0,
  rules: 0,
  jobs: 0,
  other: 0,
};

const reqByClass: Record<'2xx' | '4xx' | '5xx' | '3xx' | '1xx' | 'other', number> = {
  '1xx': 0,
  '2xx': 0,
  '3xx': 0,
  '4xx': 0,
  '5xx': 0,
  other: 0,
};

let requestsTotal = 0;
let admissionsTotal = 0;

const bundlesCache = { hits: 0, misses: 0 };

// Proof latency reservoir (simple)
const PROOF_SAMPLES_MAX = 512;
const proofLatenciesMs: number[] = [];

// Helpers
function statusClass(code: number): keyof typeof reqByClass {
  if (code >= 100 && code < 200) return '1xx';
  if (code >= 200 && code < 300) return '2xx';
  if (code >= 300 && code < 400) return '3xx';
  if (code >= 400 && code < 500) return '4xx';
  if (code >= 500) return '5xx';
  return 'other';
}

export function incRequest(route: RouteKey, statusCode: number) {
  requestsTotal += 1;
  reqByRoute[route] = (reqByRoute[route] || 0) + 1;
  const sc = statusClass(statusCode);
  reqByClass[sc] = (reqByClass[sc] || 0) + 1;
}

export function incAdmissions(n = 1) {
  admissionsTotal += n;
}

export function cacheHit() {
  bundlesCache.hits += 1;
}

export function cacheMiss() {
  bundlesCache.misses += 1;
}

export function observeProofLatency(ms: number) {
  const v = clamp(ms, 0, 120_000);
  proofLatenciesMs.push(v);
  if (proofLatenciesMs.length > PROOF_SAMPLES_MAX) {
    proofLatenciesMs.shift();
  }
}

function percentile(arr: number[], p: number): number {
  if (!arr.length) return 0;
  const a = arr.slice().sort((x, y) => x - y);
  const idx = Math.floor((p / 100) * (a.length - 1));
  return a[idx];
}

export function snapshotMetrics() {
  const now = Date.now();
  return {
    nowIso: new Date(now).toISOString(),
    uptimeSec: Math.floor((now - START_MS) / 1000),
    requestsTotal,
    requestsByRoute: { ...reqByRoute },
    requestsByClass: { ...reqByClass },
    admissionsTotal,
    bundlesCache: { ...bundlesCache },
    proofLatencyMs: {
      count: proofLatenciesMs.length,
      p50: percentile(proofLatenciesMs, 50),
      p95: percentile(proofLatenciesMs, 95),
      avg:
        proofLatenciesMs.length > 0
          ? Math.round(
              (proofLatenciesMs.reduce((a, b) => a + b, 0) / proofLatenciesMs.length) * 100,
            ) / 100
          : 0,
      max: proofLatenciesMs.length > 0 ? Math.max(...proofLatenciesMs) : 0,
    },
  };
}