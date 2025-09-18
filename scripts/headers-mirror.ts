#!/usr/bin/env tsx
/**
 * Lightweight headers mirror for SPV.
 * - Fetches headers from one or more remote sources
 * - Validates continuity (prevHash, height)
 * - Optionally requires agreement on tip across all sources
 * - Writes atomically to HEADERS_FILE as a plain array of headers
 *
 * Env:
 * - HEADERS_URLS='["https://relay-a/headers.json","https://relay-b/headers.json"]'
 *   or HEADERS_URL='https://relay/headers.json'
 * - HEADERS_FILE=./data/headers.json
 * - INTERVAL_MS=60000     (optional; if set, runs repeatedly)
 * - TIMEOUT_MS=10000      (optional HTTP timeout)
 * - REQUIRE_AGREEMENT=true (optional; require same tip across sources)
 * - STRICT_RAW=false      (optional; require header.raw to be present/valid)
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

type Header = {
  raw?: string
  hash: string
  prevHash: string
  merkleRoot: string
  height: number
  time: number
}

const env = (k: string, d?: string) => process.env[k] ?? d

// Config
const OUT_FILE = env('HEADERS_FILE', './data/headers.json')!
const TIMEOUT_MS = Number(env('TIMEOUT_MS', '10000'))
const INTERVAL_MS = env('INTERVAL_MS') ? Number(env('INTERVAL_MS')) : 0
const REQUIRE_AGREEMENT = (env('REQUIRE_AGREEMENT', 'true') || 'true').toLowerCase() === 'true'
const STRICT_RAW = (env('STRICT_RAW', 'false') || 'false').toLowerCase() === 'true'

// Sources: HEADERS_URLS (JSON array) or HEADERS_URL (single)
function parseUrls(): string[] {
  const urlsJson = env('HEADERS_URLS')
  if (urlsJson) {
    try {
      const arr = JSON.parse(urlsJson)
      if (Array.isArray(arr) && arr.length) return arr
    } catch {}
  }
  const single = env('HEADERS_URL')
  if (single) return [single]
  throw new Error('Set HEADERS_URLS (JSON array) or HEADERS_URL (string)')
}

function isHex(s: string | undefined, len?: number) {
  if (!s || typeof s !== 'string') return false
  const ss = s.startsWith('0x') ? s.slice(2) : s
  if (!/^[0-9a-fA-F]+$/.test(ss)) return false
  return len == null ? true : ss.length === len
}

function isHeader(h: any): h is Header {
  const base =
    h &&
    typeof h === 'object' &&
    isHex(h.hash, 64) &&
    isHex(h.prevHash, 64) &&
    isHex(h.merkleRoot, 64) &&
    Number.isInteger(h.height) &&
    Number.isInteger(h.time)

  if (!base) return false
  if (STRICT_RAW) return isHex(h.raw, 160) // 80 bytes => 160 hex chars
  // raw is optional unless STRICT_RAW=true
  return !h.raw || isHex(h.raw, 160)
}

function validateChain(headers: Header[]) {
  if (!Array.isArray(headers) || !headers.length) throw new Error('empty headers array')
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    if (!isHeader(h)) throw new Error(`bad header at index ${i}`)
    if (i > 0) {
      const prev = headers[i - 1]
      if (h.height !== prev.height + 1) {
        throw new Error(`height discontinuity at ${h.height} (prev ${prev.height})`)
      }
      if (h.prevHash.toLowerCase() !== prev.hash.toLowerCase()) {
        throw new Error(`prevHash mismatch at height ${h.height}`)
      }
    }
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

// Accept either a plain array of headers or an object with { headers: [...] } or { chain: [...] }
function resolveHeadersShape(json: any): Header[] {
  const arr = Array.isArray(json)
    ? json
    : Array.isArray(json?.headers)
    ? json.headers
    : Array.isArray(json?.chain)
    ? json.chain
    : undefined
  if (!arr) throw new Error('no headers array found in source')
  return arr as Header[]
}

async function readCurrent(): Promise<string | undefined> {
  try {
    return await fs.readFile(OUT_FILE, 'utf8')
  } catch {
    return undefined
  }
}

async function writeAtomic(txt: string): Promise<void> {
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true })
  const tmp = `${OUT_FILE}.tmp`
  await fs.writeFile(tmp, txt)
  await fs.rename(tmp, OUT_FILE)
}

function tipOf(arr: Header[]) {
  const last = arr[arr.length - 1]
  return { height: last.height, hash: last.hash.toLowerCase() }
}

async function once(): Promise<void> {
  const urls = parseUrls()
  const results: { url: string; headers: Header[]; tip: { height: number; hash: string} }[] = []
  const errs: string[] = []

  await Promise.all(
    urls.map(async (url) => {
      try {
        const json = await fetchWithTimeout(url, TIMEOUT_MS)
        const arr = resolveHeadersShape(json)
        validateChain(arr)
        results.push({ url, headers: arr, tip: tipOf(arr) })
      } catch (e: any) {
        errs.push(`${url}: ${e?.message || String(e)}`)
      }
    }),
  )

  if (!results.length) throw new Error(`all sources failed: ${errs.join(' | ')}`)

  if (REQUIRE_AGREEMENT) {
    const h0 = results[0].tip.height
    const tip0 = results[0].tip.hash
    const disagree = results.some((r) => r.tip.height !== h0 || r.tip.hash !== tip0)
    if (disagree) {
      const views = results.map((r) => `${r.url} → h=${r.tip.height} tip=${r.tip.hash}`).join(' ; ')
      throw new Error(`sources disagree on tip: ${views}`)
    }
  }

  // Choose the longest chain (highest height). On ties, pick the first.
  const best = results.reduce((a, b) => (b.tip.height > a.tip.height ? b : a))

  // Prepare output (plain array of headers, matching your current format)
  const txt = JSON.stringify(best.headers)

  // Write only if changed
  const prev = (await readCurrent()) || ''
  if (prev === txt) {
    console.log(`no change (h=${best.tip.height} tip=${best.tip.hash})`)
    return
  }

  await writeAtomic(txt)
  console.log(`headers updated: ${best.headers.length} (h=${best.tip.height} tip=${best.tip.hash})`)
}

async function main() {
  if (INTERVAL_MS && INTERVAL_MS > 0) {
    console.log(`Headers mirror running every ${INTERVAL_MS} ms -> ${OUT_FILE}`)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await once()
      } catch (e: any) {
        console.error('mirror error:', e?.message || String(e))
      }
      await delay(INTERVAL_MS)
    }
  } else {
    await once()
  }
}

main().catch((e) => {
  console.error('fatal', e?.message || String(e))
  process.exit(99)
})
