# issues/D06-pay-receipts-revenue.md
# D6 — /pay + Receipts + Revenue Logging
Labels: backend, payments, revenue
Assignee: TBA
Estimate: 2–3 PT

Zweck
- Zahlung erfassen, signierten Receipt ausstellen, Umsatz loggen.

Abhängigkeiten
- D5, revenue_events Tabelle (DB)

Aufgaben
- [ ] receipts.ts: HMAC‑Signatur, TTL, Scope (resource/class/quantity).
- [ ] POST /pay → receiptId, amountSat, expiresAt.
- [ ] revenue_events(producerId?, resource, amountSat, qty, tier, payer, ts) loggen.
- [ ] Receipt‑Wiederverwendung blockieren.

Definition of Done
- [ ] Signierter Beleg; Event protokolliert; Replay verhindert.

Abnahmekriterien
- [ ] /pay → 200, receipt JSON; revenue_events enthält neue Zeile.
- [ ] Erneuter Use desselben receiptId → 4xx.

Artefakte
- [ ] Receipt‑Beispiel, DB‑Dump.

Risiken/Rollback
- Payments vorübergehend deaktivierbar.
