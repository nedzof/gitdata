# issues/D09-pricebook-per-producer.md
# D9 — Pricebook pro Producer (in /price)
Labels: backend, payments, producers
Assignee: TBA
Estimate: 2 PT

Zweck
- Per‑Producer Preisregeln; /price nutzt passende Regel.

Abhängigkeiten
- D8

Aufgaben
- [ ] POST /producers/price { producerId, pattern, unit, basePrice, tiers?, requiredAttrs? }.
- [ ] /price Präzedenz: manifest:<hash> > dataset:<id> > producer:*.

Definition of Done
- [ ] /price liefert Producer‑Quote (keine Defaultquote bei Regel).

Abnahmekriterien
- [ ] Regel gesetzt → /price spiegelt unit/price/attrs korrekt wider.

Artefakte
- [ ] Rule JSON, Quote JSON.

Risiken/Rollback
- Fallback auf Defaultquote möglich.
