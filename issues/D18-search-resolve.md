# issues/D18-search-resolve.md
# D18 — /search & /resolve (Basic Katalog)
Labels: backend, catalog
Assignee: TBA
Estimate: 2 PT

Zweck
- Finden/Discover.

Abhängigkeiten
- D1, D8

Aufgaben
- [ ] GET /search?q|datasetId|tag → Treffer aus manifests (Meta/Tags).
- [ ] GET /resolve?versionId|datasetId → Versionen/Eltern (Paging).

Definition of Done
- [ ] Einfaches Listing + Paging funktioniert.

Abnahmekriterien
- [ ] Suche nach ontology/tag liefert Treffer; resolve gibt Parents.

Artefakte
- [ ] JSON Beispiele.

Risiken/Rollback
- —
