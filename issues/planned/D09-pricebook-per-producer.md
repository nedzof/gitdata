# D09 — Pricebook pro Producer
Labels: backend, api, marketplace
Assignee: TBA
Estimate: 2–3 PT

Zweck
- Preisregeln auf Producer- oder Dataset‑Ebene (Overrides, Mengenrabatte/Tiers).

Abhängigkeiten
- DB: prices (erweitern), producers
- D05 /price Basis

Aufgaben
- [ ] Tabelle price_rules: { producer_id?, version_id?, tier_from?, satoshis }.
- [ ] /price Logik: best-match (versionId → producerId → default).
- [ ] (Optional) Mengenrabatte (quantity → best tier).

Definition of Done (DoD)
- [ ] /price gibt konsistenten Preis entsprechend Regeln zurück.
- [ ] Admin-API zum Setzen/Löschen von Regeln.

Abnahmekriterien (Tests)
- [ ] Override-Kaskade korrekt (versionId > producer > default).
- [ ] Tier-Auswahl korrekt.

Risiken/Rollback
- Regelkonflikte → eindeutige Priorität definieren (versionId > producer > default).
