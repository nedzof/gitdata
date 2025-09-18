# D05 — /price (Default & Override)
Labels: backend, api, marketplace
Assignee: TBA
Estimate: 1 PT

Zweck
- Preisermittlung für Dataset-Versionen: Default-Preis und pro-Version Overrides.

Abhängigkeiten
- DB: prices, manifests
- ENV: PRICE_DEFAULT_SATS

Aufgaben
- [ ] GET /price?versionId=… → { versionId, contentHash, satoshis, expiresAt } (src/routes/price.ts).
- [ ] POST /price (Admin/Publisher): versionId, satoshis setzen/updaten.
- [ ] (Optional) Ablauffenster (e.g., 30 min) für Preis-Angebot.

Definition of Done (DoD)
- [ ] Preis wird zurückgegeben (Override oder Default), contentHash aus Manifest inkludiert.
- [ ] Validierung: versionId=64hex, satoshis>0.

Abnahmekriterien (Tests)
- [ ] GET ohne Override → Default.
- [ ] POST → GET liefert gesetzten Preis.

Risiken/Rollback
- Falsche Preise → POST ist idempotent; Audit optional in späterem Milestone.
