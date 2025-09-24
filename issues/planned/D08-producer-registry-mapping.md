# D08 — Producer Registry & Mapping 📋 **PLANNED**

**Status:** 📋 **PLANNED** (High Priority)
**Dependencies:** D06 (Payments), D07 (Streaming)
**Implementation:** Awaiting priority and resource allocation
**Estimated Start:** Q1 2025

Labels: backend, api, identity
Assignee: TBA
Estimate: 2 PT

Zweck
- Producer-Registry (IdentityKey → Publisher-Profil), Mapping datasetId → Producer, Ownershipsichtbarkeit.

Abhängigkeiten
- DB: producers (neu), manifests (datasetId)
- Identity (D19 für signierte Calls)

Aufgaben
- [ ] Tabelle producers: { producer_id, name, website, identity_key, created_at }.
- [ ] Mapping: datasetId → producer_id (ableiten beim Submit; optional Meta in manifest.provenance).
- [ ] Endpunkte: GET /producers/:id, GET /producers?datasetId=… /search.

Definition of Done (DoD)
- [ ] Producer-Daten speicherbar, abrufbar, gelistet.
- [ ] Anzeige in UI (Listing-Card: Publisher-Name/Website).

Abnahmekriterien (Tests)
- [ ] Insert → Fetch, datasetId-Auflösung klappt.

Risiken/Rollback
- Uneindeutige Zuordnung → Fallback auf manifest.provenance.producer.identityKey.
