Ja – das ist genau im D24-Sinne und BSV‑konform. Dein D21‑Entwurf ist stark: SPV als Quelle der Wahrheit, mAPI‑Broadcast, deterministische Output‑Templates, Idempotenz und Reconcile sind die richtigen Bausteine. Unten findest du eine präzisierte, sofort verwendbare Fassung im selben Format – mit kleinen Ergänzungen zu Zustandsübergängen, Fehlercodes, Template‑Hash, Fallbacks und Security. Sie bleibt vendor‑neutral, SPV‑erst und nutzt die UTXO‑Modellstärke von BSV (digital asset).

File: issues/D21-bsv-payments.md

# D21 — Real BSV Payments (Producer Payouts & Consumer Purchases)

Labels: payments, backend, bsv, security
Assignee: TBA
Estimate: 4–6 PT

Zweck
- Overlay‑Receipts (D06/D07) auf produktionsreife BSV‑Zahlungen heben: echte On‑Chain‑Payments für Consumer (Kauf) und Producer (Payout‑Splits) mit Miner‑Broadcast (mAPI‑kompatibel) und SPV‑Verifikation (D02).
- Deterministische Output‑Templates (Splits), Idempotenz, Reconciliation/Status‑Updates und klare Sicherheitsrahmen.

Abhängigkeiten
- D01 (Submit), D02 (SPV), D05/D09 (Price/Pricebook), D06/D07 (Receipts/Data), D08 (Producers), D11 (Caching), D12 (Limits)
- DB: receipts, revenue_events, producers (erweitern)
- Optional: Attach‑Proofs Job (scripts/attach-proofs.ts) für SPV‑Übernahme

Aufgaben
- [ ] DB‑Erweiterungen
  - receipts: +payment_txid (TEXT UNIQUE), +paid_at (INTEGER), +payment_outputs_json (TEXT), +fee_sat (INTEGER), +quote_template_hash (TEXT), +quote_expires_at (INTEGER)
  - producers: +payout_script_hex (TEXT) oder payout_address (→ zu scriptHex normalisieren)
  - revenue_events: neue Events 'payment-quoted', 'payment-submitted', 'payment-confirmed', 'refund' (optional)
- [ ] Output‑Engine (Splits)
  - PAY_SPLITS_JSON (ENV): z. B. {"overlay":0.05,"producer":0.95} (prozentual, Summe=1.0); producer‑/version‑Overrides optional
  - PAY_SCRIPTS_JSON (ENV): Overlay‑payout scriptHex; Producer‑Ziel aus producers.payout_script_hex
  - Template‑Builder:
    - amount = unitPrice * quantity
    - allocate per splits (ganzzahlige Satoshis, Rest satt in “producer” oder “overlay” deterministisch)
    - fee wird vom Wallet gedeckt (required outputs werden nicht für Fee reduziert)
    - deterministische Reihenfolge der Outputs + Template‑Hash (quote_template_hash)
- [ ] Endpunkte (v1)
  - POST /payments/quote { receiptId }
    → 200 { versionId, amountSat, outputs:[{scriptHex,satoshis}], feeRateHint, expiresAt, templateHash }
    → 400/404 bei ungültigem/fehlendem Receipt; 409 wenn Receipt nicht mehr pending
    - Validiert Receipt (pending, nicht expired), bestimmt unitPrice (D09), splittet Outputs
    - Deterministisch: gleiche Inputs → gleicher templateHash
    - Side‑effect: revenue_events: 'payment-quoted'
  - POST /payments/submit { receiptId, rawTxHex, mapiProviderId? }
    → 200 { status:"accepted", txid, mapi?:{...} }
    → 400 bei invalidem Tx/Decoding; 409 wenn Outputs fehlen/zu klein oder templateHash verletzt; 409 bei abweichender txid für dieselbe receiptId; 410 wenn Quote abgelaufen
    - Verifiziert: txid=sha256d(rawTx), Tx enthält geforderte outputs (scriptHex exakt, satoshis >= gefordert)
    - Broadcast via mAPI‑Adapter (konfigurierbare Provider, Fallback‑Reihenfolge)
    - Persistiert: payment_txid, payment_outputs_json, fee_sat, paid_at, status=paid (pending confs)
    - Side‑effect: revenue_events: 'payment-submitted' (inkl. txid)
  - GET /payments/:receiptId
    → 200 { receipt, payment?:{ txid, paidAt, feeSat, outputs }, mapi?:{ lastResponse? }, spv?:{ confs?, lastCheckedAt? } }
    → 404 bei unbekanntem Receipt
- [ ] Broadcast‑Adapter
  - PAY_PROVIDERS_JSON (ENV): Liste von Broadcast‑URLs (mAPI‑kompatibel), timeouts/retries, Health‑Check
  - BROADCAST_MODE=dryrun|live (dryrun → akzeptiert ohne externen Broadcast, nützlich für Staging)
  - Persistiere Provider/Antwort (für spätere Analyse)
- [ ] Verifikation/Reconciliation
  - scripts/reconcile-payments.ts:
    - Holt Headers/Proofs (D02), markiert receipts.status=confirmed, wenn SPV‑Konf. ≥ POLICY_MIN_CONFS
    - Reorg‑Toleranz: bei Inklusionsverlust status zurück auf paid, erneute Beobachtung
  - Optional: on‑submit SPV, falls Proof unmittelbar verfügbar (nicht erforderlich)
  - Side‑effect: revenue_events: 'payment-confirmed'
- [ ] Security/Policy
  - PAY_STRICT=true|false: strikte Template‑Prüfung (Outputs und Beträge exakt), sonst >= (mindestens)
  - Rate Limits (D12) für /payments/*; optional BRC‑31 Identity‑Schutz
  - Idempotenz: (receiptId,txid) ist unique‑Kombination; erneut gleich → 200 stabil, abweichend → 409
  - Nonce/Replay‑Schutz optional für signierte /payments/*‑Aufrufe
- [ ] Fehlercodes/Antworten harmonisieren
  - 400 bad‑request, 401 unauthorized (falls Identity), 403 forbidden, 404 not‑found, 409 conflict, 410 gone (quote expired), 429 too‑many‑requests, 500 internal
- [ ] Tests
  - Quote → Wallet‑Sign (synthetisch) → Submit (dryrun) → Receipt.status updated
  - Negativ: Output fehlt/zu klein → 409; falsches Script → 409; Quote abgelaufen → 410
  - Idempotenz: gleicher txid → 200; anderer txid für gleiche receiptId → 409
  - Reconcile: SPV‑bestätigt → status=confirmed
  - mAPI‑Fallback: erster Provider down → zweiter akzeptiert; Antwort persistiert

Definition of Done (DoD)
- [ ] /payments/quote liefert deterministische, nicht manipulierbare Templates (Splits, Beträge, templateHash, expiresAt).
- [ ] /payments/submit akzeptiert signierte Tx, validiert Outputs vs. Template, broadcastet (live) oder akzeptiert (dryrun).
- [ ] receipts Statusfluss: pending → paid (submit) → confirmed (Reconcile bei minConfs).
- [ ] revenue_events enthalten Payment‑Flows; Reconcile arbeitet SPV‑konform; Idempotenz garantiert.

Abnahmekriterien (E2E)
- [ ] Happy Path: quote → sign → submit (dryrun) → status=paid → reconcile (Proof) → status=confirmed.
- [ ] Split‑Beispiele (overlay/producer) korrekt und reproduzierbar; templateHash stabil bei gleichen Inputs.
- [ ] Idempotenz: gleiches (receiptId, txid) ist stabil; abweichender txid wird abgewiesen (409).
- [ ] Live‑Broadcast: mAPI‑Antwort gespeichert; Reconcile erkennt Inclusion (über attach‑proofs o. externen Proof).

Artefakte
- [ ] Beispiel‑PAY_SPLITS_JSON, PAY_SCRIPTS_JSON, PAY_PROVIDERS_JSON
- [ ] Beispiel‑Quote‑JSON (outputs, templateHash, expiresAt)
- [ ] Beispiel‑Submit‑Antwort (txid, mapi), Reconcile‑Log (SPV‑Status)
- [ ] DB‑Snapshots (receipts/revenue_events) vor/nach Reconcile

Risiken/Rollback
- Miner‑Policy Unterschiede: robustes mAPI‑Fallback; BROADCAST_MODE=dryrun als Notbremse
- Gebühren: Fee‑Schätzung im Wallet; Template nur „required outputs“; optional feeRateHint
- Eventually‑Consistent Reads: kurze Verzögerung vor SPV‑Lookup; Reorg‑Handhabung im Reconcile
- Mehrinstanzen: Idempotenz über Unique‑Keys; Reconcile als idempotenter Job

ENV (Vorschlag)
- PAY_SPLITS_JSON='{"overlay":0.05,"producer":0.95}'
- PAY_SCRIPTS_JSON='{"overlay":""}'
- PAY_PROVIDERS_JSON='["https://miner1.example/mapi/tx","https://miner2.example/mapi/tx"]'
- BROADCAST_MODE=dryrun|live
- POLICY_MIN_CONFS=1
- QUOTE_TTL_SEC=120
- PAY_STRICT=true
- RATE_LIMIT_PAYMENTS_PER_MIN=60

State‑Machine (Empfehlung)
- receipts.status: pending → paid (submit) → confirmed (reconcile) → settled (optional nach Off‑Chain‑Erfassung)
- payment.lifecycle: quoted → submitted → broadcast_accepted → confirmed | failed (rollback: pending)

Anmerkungen (D24‑Ausrichtung)
- BSV ist ein digitaler Vermögenswert (kein „Krypto“): SPV bleibt maßgeblich; keine Abhängigkeit von zentralen Indexern.
- Vendor‑neutral: Wallets nach BRC‑100‑Prinzip integrierbar; Identität via BRC‑31 optional.
- UTXO‑Modell nutzen: deterministische Outputs, einfache Idempotenz, klare Eigentumsübertragung.

Wenn du willst, liefere ich dir als Nächstes schlanke Scaffolds (nur Stubs, D24‑kompatibel) für:
- DB‑Migration (receipts/producers/revenue_events),
- POST /payments/quote & /payments/submit,
- mAPI‑Broadcast‑Adapter,
- reconcile‑payments.ts (SPV‑Proof‑Attach + Statusflip).


I can give you a single, drop‑in TypeScript template file that is D24‑compatible in style and patterns. It scaffolds:

- DB migration helpers for receipts/producers/revenue_events
- POST /payments/quote and POST /payments/submit (plus GET /payments/:receiptId)
- A minimal mAPI broadcast adapter (dryrun/live with fallback providers)
- A reconcilePayments() job stub to flip paid → confirmed after SPV (attach proofs hook)

Important
- This is a template. You must align field names/types with your actual receipts/producers schema and pricebook logic. Verify the code with your team/community before enabling in production.
- SPV attach/verify is left as a stub (verifyTxSPV). Wire it to your SPV module/job.

Create file: src/payments/scaffold.ts
```ts
/* 
  D21 Payments Scaffold (D24-compatible style)
  - DB migrations for receipts/producers/revenue_events
  - /payments/quote, /payments/submit, GET /payments/:receiptId
  - mAPI broadcast adapter (dryrun/live)
  - reconcilePayments() job stub (SPV attach + status flip)

  NOTES:
  - Align schema fields to your real DB. This file uses conservative checks to add columns if missing.
  - SPV verification (verifyTxSPV) is intentionally a stub; integrate your SPV logic.
  - Deterministic templateHash ensures idempotent quotes.
  - BROADCAST_MODE=dryrun allows local testing without miner IO.

  ENV (suggested):
    PAY_SPLITS_JSON='{"overlay":0.05,"producer":0.95}'
    PAY_SCRIPTS_JSON='{"overlay":"<scriptHex>"}'
    PAY_PROVIDERS_JSON='["https://miner1.example/mapi/tx","https://miner2.example/mapi/tx"]'
    BROADCAST_MODE=dryrun|live
    POLICY_MIN_CONFS=1
    QUOTE_TTL_SEC=120
    PAY_STRICT=true
*/

import type { Router, Request, Response } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';

// ------------ ENV / Config helpers ------------

const PAY_SPLITS_JSON = process.env.PAY_SPLITS_JSON || '{"overlay":0.05,"producer":0.95}';
const PAY_SCRIPTS_JSON = process.env.PAY_SCRIPTS_JSON || '{"overlay":""}';
const PAY_PROVIDERS_JSON = process.env.PAY_PROVIDERS_JSON || '[]';
const BROADCAST_MODE = (process.env.BROADCAST_MODE || 'dryrun').toLowerCase();
const POLICY_MIN_CONFS = Number(process.env.POLICY_MIN_CONFS || 1);
const QUOTE_TTL_SEC = Number(process.env.QUOTE_TTL_SEC || 120);
const PAY_STRICT = /^true$/i.test(String(process.env.PAY_STRICT || 'true'));

type Splits = Record<string, number>;
type PayoutScripts = Record<string, string>;

// ------------ Generic utils ------------

function nowSec() { return Math.floor(Date.now() / 1000); }
function sha256hex(s: string) { return createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex'); }
function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

function safeParse<T=any>(s: string, fallback: T): T {
  try { return JSON.parse(s); } catch { return fallback; }
}

// ------------ DB migration helpers ------------

function tableHasColumn(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  return rows.some(r => String(r.name) === column);
}

function ensureColumn(db: Database.Database, table: string, column: string, ddlType: string) {
  if (!tableHasColumn(db, table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`).run();
  }
}

export function runPaymentsMigrations(db: Database.Database) {
  // receipts: add payment fields if not present
  try {
    ensureColumn(db, 'receipts', 'payment_txid', 'TEXT');
    ensureColumn(db, 'receipts', 'paid_at', 'INTEGER');
    ensureColumn(db, 'receipts', 'payment_outputs_json', 'TEXT');
    ensureColumn(db, 'receipts', 'fee_sat', 'INTEGER');
    ensureColumn(db, 'receipts', 'quote_template_hash', 'TEXT');
    ensureColumn(db, 'receipts', 'quote_expires_at', 'INTEGER');
  } catch (e) {
    // If receipts table does not exist here, you must create it in your base schema.
    // This scaffold assumes your project already has receipts.
    console.warn('[payments.migration] receipts table missing; ensure base schema exists before running payments migrations.');
  }

  // producers: ensure payout_script_hex
  try {
    ensureColumn(db, 'producers', 'payout_script_hex', 'TEXT');
  } catch (e) {
    console.warn('[payments.migration] producers table missing or unmanaged in this scaffold.');
  }

  // revenue_events table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS revenue_events (
      event_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,            -- payment-quoted | payment-submitted | payment-confirmed | refund
      receipt_id TEXT,
      txid TEXT,
      details_json TEXT,
      created_at INTEGER NOT NULL
    )
  `).run();

  db.prepare(`CREATE INDEX IF NOT EXISTS idx_revenue_events_type ON revenue_events(type)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_revenue_events_receipt ON revenue_events(receipt_id)`).run();
}

// ------------ DB accessors (align with your existing schema!) ------------

type ReceiptRow = {
  receipt_id: string;
  version_id: string;
  quantity: number;
  status: 'pending' | 'paid' | 'confirmed' | string;
  unit_price_sat?: number | null; // optional; depends on your schema
  quote_template_hash?: string | null;
  quote_expires_at?: number | null;
  payment_txid?: string | null;
  payment_outputs_json?: string | null;
  fee_sat?: number | null;
  paid_at?: number | null;
};

type ProducerRow = {
  producer_id: string;
  payout_script_hex?: string | null;
};

function getReceipt(db: Database.Database, receiptId: string): ReceiptRow | undefined {
  try {
    return db.prepare('SELECT * FROM receipts WHERE receipt_id = ?').get(receiptId) as any;
  } catch { return undefined; }
}

function setReceiptQuote(db: Database.Database, receiptId: string, templateHash: string, expiresAt: number) {
  db.prepare(`UPDATE receipts SET quote_template_hash=?, quote_expires_at=? WHERE receipt_id=?`)
    .run(templateHash, expiresAt, receiptId);
}

function setReceiptPaid(db: Database.Database, receiptId: string, txid: string, feeSat: number, outputs: any[]) {
  db.prepare(`UPDATE receipts SET status='paid', payment_txid=?, fee_sat=?, paid_at=?, payment_outputs_json=? WHERE receipt_id=?`)
    .run(txid, feeSat || 0, nowSec(), JSON.stringify(outputs || []), receiptId);
}

function setReceiptConfirmed(db: Database.Database, receiptId: string) {
  db.prepare(`UPDATE receipts SET status='confirmed' WHERE receipt_id=?`).run(receiptId);
}

function logRevenueEvent(db: Database.Database, type: string, receiptId: string | null, txid: string | null, details: any) {
  const id = 'rev_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  db.prepare(`INSERT INTO revenue_events(event_id, type, receipt_id, txid, details_json, created_at) VALUES (?,?,?,?,?,?)`)
    .run(id, type, receiptId, txid, JSON.stringify(details || {}), nowSec());
}

function getProducerByVersion(db: Database.Database, versionId: string): ProducerRow | undefined {
  // Align this with your actual version->producer relation.
  // Placeholder: try to find by joining manifests/versions to producers if available.
  try {
    const row = db.prepare(`SELECT p.* FROM producers p 
      JOIN versions v ON v.producer_id = p.producer_id 
      WHERE v.version_id = ? LIMIT 1`).get(versionId) as any;
    return row;
  } catch { return undefined; }
}

// ------------ Template builder (deterministic) ------------

type PaymentOutput = { scriptHex: string; satoshis: number };

function buildPaymentTemplate(db: Database.Database, receipt: ReceiptRow) {
  if (!receipt || !receipt.version_id) throw new Error('receipt-invalid');
  // amount determination
  // Prefer receipt.unit_price_sat if present; otherwise you must look up your pricebook.
  const unitPrice = Number(receipt.unit_price_sat ?? 0);
  if (!unitPrice) throw new Error('unit-price-missing');
  const quantity = Math.max(1, Number(receipt.quantity || 1));
  const amountSat = unitPrice * quantity;

  // splits
  const splits: Splits = safeParse<Splits>(PAY_SPLITS_JSON, { overlay: 0.05, producer: 0.95 });
  const scripts: PayoutScripts = safeParse<PayoutScripts>(PAY_SCRIPTS_JSON, { overlay: '' });

  // resolve producer payout script
  const producer = getProducerByVersion(db, receipt.version_id);
  const producerScript = producer?.payout_script_hex || '';

  // allocation
  const outputs: PaymentOutput[] = [];
  let allocated = 0;
  for (const [name, pct] of Object.entries(splits)) {
    const raw = Math.floor(amountSat * Number(pct));
    let scriptHex = '';
    if (name === 'overlay') scriptHex = scripts.overlay || '';
    if (name === 'producer') scriptHex = producerScript;
    if (!scriptHex) continue; // skip unknown leg
    outputs.push({ scriptHex, satoshis: raw });
    allocated += raw;
  }
  // push remainder (dust rounding) to producer if present, else to first output
  const remainder = amountSat - allocated;
  if (remainder !== 0) {
    const idx = outputs.findIndex(o => o.scriptHex === producerScript);
    if (idx >= 0) outputs[idx].satoshis += remainder;
    else if (outputs.length) outputs[0].satoshis += remainder;
  }

  // sort deterministically
  outputs.sort((a, b) => (a.scriptHex < b.scriptHex ? -1 : a.scriptHex > b.scriptHex ? 1 : a.satoshis - b.satoshis));

  // template hash over canonical JSON
  const canonical = JSON.stringify({ versionId: receipt.version_id, amountSat, outputs });
  const templateHash = sha256hex(canonical);

  // TTL
  const expiresAt = nowSec() + QUOTE_TTL_SEC;

  return { amountSat, outputs, templateHash, expiresAt };
}

// ------------ mAPI Broadcast Adapter ------------

async function broadcastTx(rawTxHex: string, providers: string[], mode: 'dryrun'|'live') {
  const txid = sha256dHex(rawTxHex); // internal calculation for reference
  if (mode === 'dryrun') {
    return { txid, accepted: true, provider: null, mapi: { mode: 'dryrun' } };
  }
  let lastErr: any;
  for (const url of providers) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ rawtx: rawTxHex })
      });
      const text = await r.text();
      let js: any; try { js = JSON.parse(text); } catch { js = { raw: text }; }
      if (r.ok) {
        return { txid, accepted: true, provider: url, mapi: js };
      } else {
        lastErr = { status: r.status, body: js, provider: url };
      }
    } catch (e: any) {
      lastErr = { error: String(e?.message || e), provider: url };
    }
  }
  const err = new Error(`broadcast-failed: ${JSON.stringify(lastErr)}`);
  (err as any).txid = txid;
  throw err;
}

// double SHA-256 helper for txid
function sha256dHex(hex: string): string {
  const buf = Buffer.from(hex, 'hex');
  const h1 = createHash('sha256').update(buf).digest();
  const h2 = createHash('sha256').update(h1).digest();
  // txid is little-endian hex of the double-hash; for matching UI, you may want to reverse bytes
  return Buffer.from(h2.reverse()).toString('hex');
}

// ------------ Express Router (/payments) ------------

export function paymentsRouter(db: Database.Database): Router {
  const router = makeRouter();

  // POST /payments/quote { receiptId }
  router.post('/payments/quote', (req: Request, res: Response) => {
    try {
      const receiptId = String(req.body?.receiptId || '');
      if (!receiptId) return json(res, 400, { error: 'bad-request', hint: 'receiptId required' });

      const r = getReceipt(db, receiptId);
      if (!r) return json(res, 404, { error: 'not-found', hint: 'unknown receiptId' });
      if (r.status && r.status !== 'pending') {
        return json(res, 409, { error: 'invalid-state', hint: `expected pending, got ${r.status}` });
      }

      const tpl = buildPaymentTemplate(db, r);
      setReceiptQuote(db, receiptId, tpl.templateHash, tpl.expiresAt);
      logRevenueEvent(db, 'payment-quoted', receiptId, null, { templateHash: tpl.templateHash, expiresAt: tpl.expiresAt });

      return json(res, 200, {
        versionId: r.version_id,
        amountSat: tpl.amountSat,
        outputs: tpl.outputs,
        feeRateHint: null, // optional: miner policy/fee hint
        expiresAt: tpl.expiresAt,
        templateHash: tpl.templateHash
      });
    } catch (e: any) {
      return json(res, 500, { error: 'quote-failed', message: String(e?.message || e) });
    }
  });

  // POST /payments/submit { receiptId, rawTxHex, mapiProviderId? }
  router.post('/payments/submit', async (req: Request, res: Response) => {
    try {
      const receiptId = String(req.body?.receiptId || '');
      const rawTxHex = String(req.body?.rawTxHex || '');
      if (!receiptId || !rawTxHex) return json(res, 400, { error: 'bad-request', hint: 'receiptId, rawTxHex required' });

      const r = getReceipt(db, receiptId);
      if (!r) return json(res, 404, { error: 'not-found' });

      if (r.payment_txid) {
        // idempotent complete: already submitted
        return json(res, 200, { status: 'accepted', txid: r.payment_txid, note: 'idempotent-return' });
      }

      if (r.quote_expires_at && nowSec() > Number(r.quote_expires_at)) {
        return json(res, 410, { error: 'quote-expired' });
      }

      const tpl = buildPaymentTemplate(db, r);
      const reqTxid = sha256dHex(rawTxHex);

      // Basic output validation: parse outputs from tx (simple scan for scriptHex + min sat).
      // NOTE: This template does not decode the whole tx; you should integrate a proper tx parser.
      // As a placeholder, we only check templateHash equality here (deterministic inputs).
      const templateHash = tpl.templateHash;
      if (r.quote_template_hash && r.quote_template_hash !== templateHash) {
        return json(res, 409, { error: 'template-mismatch', hint: 'quote templateHash differs' });
      }

      // Broadcast via mAPI (or dryrun)
      const providers = safeParse<string[]>(PAY_PROVIDERS_JSON, []);
      const mode = BROADCAST_MODE === 'live' ? 'live' : 'dryrun';
      const b = await broadcastTx(rawTxHex, providers, mode);

      // Persist payment fields (fee_sat is unknown w/o full parse; set 0 or compute client-side)
      setReceiptPaid(db, receiptId, b.txid, 0, tpl.outputs);
      logRevenueEvent(db, 'payment-submitted', receiptId, b.txid, { provider: b.provider, mapi: b.mapi, mode });

      return json(res, 200, { status: 'accepted', txid: b.txid, mapi: b.mapi });
    } catch (e: any) {
      return json(res, 500, { error: 'submit-failed', message: String(e?.message || e) });
    }
  });

  // GET /payments/:receiptId
  router.get('/payments/:receiptId', (req: Request, res: Response) => {
    try {
      const r = getReceipt(db, String(req.params.receiptId));
      if (!r) return json(res, 404, { error: 'not-found' });

      const out = {
        receipt: {
          receiptId: r.receipt_id,
          versionId: r.version_id,
          status: r.status,
          quantity: r.quantity,
          unitPriceSat: r.unit_price_sat ?? null,
          quote: r.quote_template_hash ? { templateHash: r.quote_template_hash, expiresAt: r.quote_expires_at } : null,
          payment: r.payment_txid ? {
            txid: r.payment_txid,
            paidAt: r.paid_at || null,
            feeSat: r.fee_sat || null,
            outputs: safeParse(r.payment_outputs_json || '[]', [])
          } : null
        }
      };
      return json(res, 200, out);
    } catch (e: any) {
      return json(res, 500, { error: 'get-payment-failed', message: String(e?.message || e) });
    }
  });

  return router;
}

// ------------ Reconcile job (SPV attach + status flip) ------------

export async function reconcilePayments(db: Database.Database) {
  // Select receipts with status='paid' to check confirmations
  const rows = db.prepare(`SELECT receipt_id, payment_txid FROM receipts WHERE status='paid' AND payment_txid IS NOT NULL`).all() as any[];
  for (const row of rows) {
    const txid = String(row.payment_txid);
    try {
      const confs = await verifyTxSPV(txid);
      if (confs >= POLICY_MIN_CONFS) {
        setReceiptConfirmed(db, row.receipt_id);
        logRevenueEvent(db, 'payment-confirmed', row.receipt_id, txid, { confs });
      }
    } catch (e: any) {
      // keep as paid; reconcile will try again later
    }
  }
}

// Stub: integrate your SPV verification here
async function verifyTxSPV(txid: string): Promise<number> {
  // TODO: call your SPV module to fetch inclusion proof and return confirmed depth (confs)
  // For now, always return 0 (not confirmed)
  return 0;
}

// ------------ How to wire (example) ------------
// 1) In your server.ts (after DB initSchema):
//    import { runPaymentsMigrations, paymentsRouter } from './src/payments/scaffold';
//    runPaymentsMigrations(db);
//    app.use(paymentsRouter(db));
//
// 2) Start a periodic reconcile task (e.g., every minute):
//    import { reconcilePayments } from './src/payments/scaffold';
//    setInterval(() => { reconcilePayments(db).catch(()=>{}); }, 60_000);
//
// 3) Ensure your receipts table contains: receipt_id (TEXT PK), version_id (TEXT), quantity (INTEGER), status (TEXT),
//    and optionally unit_price_sat (INTEGER). Adapt buildPaymentTemplate() if your pricebook is elsewhere.
//
// 4) Replace verifyTxSPV() with your SPV logic to finalize confirmations.
```

What you need to adapt
- Map getProducerByVersion to your actual versions→producers relation.
- Provide unit prices: either store unit_price_sat on receipts or look it up from your pricebook in buildPaymentTemplate.
- Replace verifyTxSPV with your SPV client/module.
- If you want strict output validation, integrate a Tx decoder and check that all required outputs (scriptHex, satoshis) are present. Honor PAY_STRICT to enforce exact amounts.

As always, please verify this scaffold with the community before enabling it on a live system. It keeps things vendor neutral, SPV-first, and aligned with BSV’s UTXO model, while fitting your D24 code style.