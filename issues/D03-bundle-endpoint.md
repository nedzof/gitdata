# D03 — /bundle (Lineage + SPV-Envelopes)
Labels: backend, api, protocol
Assignee: TBA
Estimate: 2 PT

Zweck
- Vollständige Lineage-Bundles generieren: Graph, Manifeste und SPV-Envelopes, schema-validiert und SPV-geprüft.

Abhängigkeiten
- DB: declarations, manifests, edges (bereit)
- Schemas: schemas/lineage-bundle.schema.json, schemas/spv-envelope.schema.json
- SPV: src/spv/verify-envelope.ts, HEADERS_FILE

Aufgaben
- [ ] GET /bundle?versionId=… (src/routes/bundle.ts) finalisieren:
      - [ ] Graph sammeln (nodes/edges) via DB, max Tiefe BUNDLE_MAX_DEPTH.
      - [ ] Manifeste laden (dlm1-manifest.schema.json valid optional in CI).
      - [ ] SPV-Envelopes aus DB (proof_json) anhängen; Konfirmationen aktualisieren.
      - [ ] Bei fehlendem/invalidem Envelope → 409 invalid-envelope/incomplete-lineage.
- [ ] Schema-Validierung (Ajv) in CI für gesamte Bundle-Antwort.
- [ ] Caching-Hooks vorbereiten (D11), aber hier optional.

Definition of Done (DoD)
- [ ] Bundle passt schema und enthält für jeden Knoten ein valides SPV-Envelope.
- [ ] Tiefenlimit durchgesetzt, klare Fehlermeldung für incomplete-lineage/invalid-envelope.

Abnahmekriterien (Tests)
- [ ] Golden DAG (2 Ebenen), Bundleschema ok, SPV ok.
- [ ] Fehlende Envelope → 409.
- [ ] Reorg: Konfirmationen werden dynamisch neu berechnet.

Artefakte/Evidence
- [ ] Beispiel-Bundle JSON, Ajv-Report, Test-Logs.

Risiken/Rollback
- Fehlende Beweise → Job scripts/attach-proofs.ts einsetzen, Endpoint liefert 409 statt inkorrekter Daten.
