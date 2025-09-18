# issues/D03-bundle-endpoint.md
# D3 — /bundle (Lineage Bundle)
Labels: backend, bundle
Assignee: TBA
Estimate: 2 PT

Zweck
- Vollständiges Beweispaket: Graph (Nodes/Edges), Manifeste, SPV‑Envelopes.

Abhängigkeiten
- D1, D2

Aufgaben
- [ ] GET /bundle?versionId&depth implementieren.
- [ ] Graph bauen (Nodes: versionId/manifestHash/txo, Edges: child→parent).
- [ ] SPV‑Envelopes (rawTx, proof, headers‑Infos) beilegen.
- [ ] Manifeste beilegen (Integritätscheck intern).
- [ ] Depth‑Cap (z. B. 10) und Paging berücksichtigen.

Definition of Done
- [ ] Response enthält target, graph, manifests[], proofs[].

Abnahmekriterien
- [ ] curl /bundle?versionId=<hex> → 200, vollständiges JSON; proofs vorhanden.
- [ ] Tiefe > Cap → 400 (oder abgeschnitten + Hinweis).

Artefakte
- [ ] Bundle‑JSON Sample.

Risiken/Rollback
- Bei Last ggf. nur target+parents immediate; ancestors per Paging.
