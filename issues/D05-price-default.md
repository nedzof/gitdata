# issues/D05-price-default.md
# D5 — /price (Default Quote)
Labels: backend, payments
Assignee: TBA
Estimate: 1 PT

Zweck
- Basis‑Quote für resource (manifest:<hash>|dataset:<id>) und class.

Abhängigkeiten
- Keine (später D9 für Producer‑Regeln).

Aufgaben
- [ ] GET /price?resource&class → { unit, price, requiredAttrs, expiresAt }.
- [ ] Defaultpreise und TTL implementieren.

Definition of Done
- [ ] Gültige Quote mit TTL.

Abnahmekriterien
- [ ] curl /price -> 200; Felder korrekt und TTL in Zukunft.

Artefakte
- [ ] Quote‑JSON.

Risiken/Rollback
- Defaultpreis parametrisierbar.
