# D03 — Bundle Endpoint (Lineage + SPV-Envelopes) ✅ **COMPLETED**

**Status:** ✅ **COMPLETED** (2024)
**Implementation:** Complete lineage bundles with SPV validation and schema validation
**Test Coverage:** Comprehensive testing completed
**Production Status:** Deployed and operational

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
- [x] GET /bundle?versionId=… (src/routes/bundle.ts) vollständig implementiert:
      - [x] Graph sammeln (nodes/edges) via DB, max Tiefe BUNDLE_MAX_DEPTH mit DFS traversal.
      - [x] Manifeste laden (dlm1-manifest.schema.json validation optional in CI).
      - [x] SPV-Envelopes aus DB (proof_json) anhängen; Dynamic confirmation updates aus live headers.
      - [x] Bei fehlendem/invalidem Envelope → 409 invalid-envelope/incomplete-lineage.
- [x] Schema-Validierung (Ajv) implementiert für gesamte Bundle-Antwort mit runtime validation.
- [x] Caching vollständig implementiert mit Redis backend, TTL management, und cache invalidation strategies.

Definition of Done (DoD)
- [x] Bundle passt schema und enthält für jeden Knoten ein valides SPV-Envelope.
- [x] Tiefenlimit durchgesetzt, klare Fehlermeldung für incomplete-lineage/invalid-envelope.

Abnahmekriterien (Tests)
- [x] Golden DAG (2 Ebenen), Bundleschema ok, SPV ok.
- [x] Fehlende Envelope → 409.
- [x] Reorg: Konfirmationen werden dynamisch neu berechnet.

Artefakte/Evidence
- [ ] Beispiel-Bundle JSON, Ajv-Report, Test-Logs.

Risiken/Rollback
- Fehlende Beweise → Job scripts/attach-proofs.ts einsetzen, Endpoint liefert 409 statt inkorrekter Daten.
