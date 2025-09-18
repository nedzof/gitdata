# D10 — Advisories & Recalls
Labels: backend, api, policy
Assignee: TBA
Estimate: 3 PT

Zweck
- Sicherheits-/Compliance-Hinweise und Rückrufe modellieren und in /ready durchsetzen.

Abhängigkeiten
- Schema: schemas/advisory.schema.json
- DB: advisories (neu), advisory_targets (versionId/producerId scope)

Aufgaben
- [ ] Tabellen advisories: { advisory_id, type, reason, created_at, expires_at?, payload_json } und advisory_targets { advisory_id, version_id?, producer_id? }.
- [ ] Endpunkte: POST /advisories (admin), GET /advisories?versionId=….
- [ ] /ready erweitert: advisories prüfen → ready:false bei Blockern.

Definition of Done (DoD)
- [ ] Advisories werden gespeichert und korrekt auf Version/Producer angewandt.
- [ ] /ready gibt reason:'advisory-blocked' bei Treffern.

Abnahmekriterien (Tests)
- [ ] Positive/Negative Pfade, Ablauf/Expiry, Scopes (producer vs. version).

Risiken/Rollback
- Falsche Sperren → Admin kann Advisory deaktivieren/ablaufen lassen.
