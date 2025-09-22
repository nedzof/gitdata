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
- [x] GET /price?versionId=… → { versionId, contentHash, satoshis, expiresAt } (src/routes/price.ts) vollständig implementiert.
- [x] POST /price (Admin/Publisher): versionId, satoshis setzen/updaten mit identity authentication.
- [x] Erweiterte Features implementiert:
      - [x] Quantity-based pricing: GET /price?versionId=&quantity= → { unitSatoshis, totalSatoshis, tierFrom }
      - [x] Advanced pricing rules: POST /price/rules für version-specific und producer-specific rules.
      - [x] Tiered pricing support: different prices based on quantity tiers.
      - [x] PostgreSQL backend mit price_rules table für complex pricing logic.
- [x] Ablauffenster (30 min default) für Preis-Angebot mit PRICE_QUOTE_TTL_SEC configuration.

Definition of Done (DoD)
- [x] Preis wird zurückgegeben (Override oder Default), contentHash aus Manifest inkludiert.
- [x] Validierung: versionId=64hex, satoshis>0.
- [x] Advanced features: Quantity-based pricing, tiered rules, producer-specific pricing.

Abnahmekriterien (Tests)
- [x] GET ohne Override → Default (PRICE_DEFAULT_SATS).
- [x] POST → GET liefert gesetzten Preis.
- [x] Quantity pricing: GET /price?quantity=100 → correct tier-based calculations.
- [x] Producer rules: Pricing rules apply correctly for producer-specific and version-specific overrides.
- [x] Authentication: POST endpoints require valid identity authentication.

Risiken/Rollback
- Falsche Preise → POST ist idempotent; Audit optional in späterem Milestone.
