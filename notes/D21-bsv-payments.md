Here you go—D21 in the same format as your previous issues, focused on real, production BSV (digital asset) payments with SPV verification and miner broadcast (mAPI-compatible).

File: issues/D21-bsv-payments.md
```md
# D21 — Real BSV Payments (Producer Payouts & Consumer Purchases)

Labels: payments, backend, bsv, security
Assignee: TBA
Estimate: 4–6 PT

Zweck
- Mock-/Overlay-Receipts (D06/D07) auf produktionsreife BSV-Zahlungen heben: echte On-Chain-Zahlungen für Consumer (Kauf) und Producer (Payout-Splits) mit Miner-Broadcast (mAPI-kompatibel) und SPV-Verifikation (D02).
- Deterministische Output-Templates (Splits), Idempotenz, Reconciliation/Status-Updates und klare Sicherheitsrahmen.

Abhängigkeiten
- D01 (Submit), D02 (SPV), D05/D09 (Price/Pricebook), D06/D07 (Receipts/Data), D08 (Producers, Payout-Felder), D11 (Caching), D12 (Limits)
- DB: receipts, revenue_events, producers (erweitern)
- Optional: Attach-Proofs Job (scripts/attach-proofs.ts) zur späteren SPV-Übernahme

Aufgaben
- [ ] DB-Erweiterungen
  - receipts: +payment_txid (TEXT UNIQUE), +paid_at (INTEGER), +payment_outputs_json (TEXT), +fee_sat (INTEGER)
  - producers: +payout_script_hex (TEXT) (oder payout_address → in scriptHex normalisieren)
  - revenue_events: zusätzliche Events 'payment-submitted', 'payment-confirmed', 'refund' (optional)
- [ ] Output-Engine (Splits)
  - PAY_SPLITS_JSON (ENV): z.B. {"overlay":0.05,"producer":0.95} oder tiered per producer/version
  - PAY_SCRIPTS_JSON (ENV): overlay payout scriptHex (z.B. P2PKH/P2PKH-like)
  - Producer-Payout aus producers.payout_script_hex, Version-Overrides optional
  - Template-Builder: amount = unitPrice * quantity; allocate per splits; fee wird vom Wallet gedeckt (change output liegt clientseitig)
- [ ] Endpunkte (v1)
  - POST /payments/quote { receiptId } → { versionId, amountSat, outputs:[{scriptHex,satoshis}], feeRateHint, expiresAt }
    - Validiert Receipt (pending, nicht expired), bestimmt unitPrice via D09 (tiers)
    - Deterministisch: gleiche Inputs → gleicher Template-Hash
  - POST /payments/submit { receiptId, rawTxHex, mapiProviderId? } → { status:"accepted", txid, mapi:... }
    - Verifiziert: txid = sha256d(rawTx), tx enthält geforderte outputs (min Beträge, scriptHex exakt)
    - Broadcast via mAPI (konfigurierbar, Fallback-Kette), Idempotenz über txid/receiptId
    - Persistiert payment_txid, payment_outputs_json, fee_sat (aus Tx-Analyse), status=paid (pending best. Konf.)
  - GET /payments/:receiptId → { receipt, payment?, mapi? }
- [ ] Broadcast-Adapter
  - PAY_PROVIDERS_JSON (ENV): Liste von Broadcast-URLs (mAPI-kompatibel), timeouts/retries
  - BROADCAST_MODE=dryrun|live (dryrun → accept ohne externen Broadcast)
- [ ] Verifikation/Reconciliation
  - scripts/reconcile-payments.ts: markiert payments confirmed, wenn SPV-Konf. ≥ POLICY_MIN_CONFS (D02)
  - optional: on-submit sofort SPV, falls Proof verfügbar (nicht erforderlich)
- [ ] Security/Policy
  - PAY_STRICT=true/false: strikte Template-Prüfung (Outputs und Beträge exakt)
  - Rate Limits (D12), BRC‑31 Identity (D19) optional für /payments/quote/submit
  - Logging: revenue_events (payment-submitted/confirmed/refund)
- [ ] Tests
  - Quote → Wallet‑Sign (synthetisch) → Submit (dryrun) → Receipt.status updated
  - Negativ: Output fehlt/zu klein → 400/409, falsches Script → 409, Idempotenz (gleicher txid) → 200 stabil
  - Reconcile: SPV‑bestätigt → status „confirmed“

Definition of Done (DoD)
- [ ] /payments/quote liefert deterministische, nicht manipulierbare Templates (Splits, Beträge).
- [ ] /payments/submit akzeptiert signierte Tx, validiert Outputs vs. Template, broadcastet (live) oder akzeptiert (dryrun).
- [ ] receipts: status‑Flow „pending“ → „paid“ (submit) → „confirmed“ (Reconcile bei minConfs).
- [ ] revenue_events enthalten Payment‑Flows; Reconciliation arbeitet SPV‑konform.

Abnahmekriterien (E2E)
- [ ] Happy Path: quote → sign → submit (dryrun) → status=paid → reconcile (mit Headers/Proof) → status=confirmed.
- [ ] Split‑Beispiele (overlay/producer) korrekt und reproduzierbar; Template‑Hash stimmt.
- [ ] Idempotenz: gleiches receiptId + txid → 200 mit existing state; anderer txid → 409.
- [ ] Live‑Broadcast: mAPI‑Antwort gespeichert; Reconcile erkennt Inclusion (über attach‑proofs oder externen Proof).

Artefakte
- [ ] Beispiel‑PAY_SPLITS_JSON, PAY_SCRIPTS_JSON, PAY_PROVIDERS_JSON
- [ ] Beispiel‑Quote‑JSON, Beispiel‑RawTx (Signiert), Submit‑Antwort, Reconcile‑Log
- [ ] DB‑Dumps (receipts/revenue_events) vor/nach Reconcile

Risiken/Rollback
- Miner/Policy Unterschiede: robustes mAPI‑Fallback und klare Fehler; BROADCAST_MODE=dryrun als Notbremse
- Gebühren: Fee‑Schätzung dem Wallet überlassen (Template nur „outputs required“); optional feeRateHint aus Konfig/Miner‑Quote
- Mehrinstanzen‑Betrieb: Nonce/Idempotenz über txid/receiptId sicherstellen; Reconcile als idempotenter Job

ENV (Vorschlag)
- PAY_SPLITS_JSON='{"overlay":0.05,"producer":0.95}'
- PAY_SCRIPTS_JSON='{"overlay":"<scriptHex>"}'
- PAY_PROVIDERS_JSON='["https://miner1.example/mapi/tx","https://miner2.example/mapi/tx"]'
- BROADCAST_MODE=dryrun|live
- NONCE_TTL_SEC=120 (falls Identity‑Sign von /payments/* gewünscht)
- POLICY_MIN_CONFS=1
```

If you want, I can also provide the scaffolding tasks (code stubs) for:
- DB migration (receipts/payment fields),
- POST /payments/quote and /payments/submit routes,
- A minimal mAPI broadcast adapter,
- A reconcile-payments.ts job that attaches SPV proofs and flips receipts to confirmed.
