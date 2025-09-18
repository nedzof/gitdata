# issues/D11-caching-and-confs.md
# D11 — Caching (Headers/Proofs/Bundles) + confsUsed
Labels: backend, performance
Assignee: TBA
Estimate: 2 PT

Zweck
- Performance + Finalitätsinfo in Responses.

Abhängigkeiten
- D2, D3, D4

Aufgaben
- [ ] TTL‑Caches (headers, proofs, bundles).
- [ ] /bundle & /ready: confsUsed + bestHeight im JSON.

Definition of Done
- [ ] P95 /bundle (depth ≤ 10) < 250 ms (Cache).

Abnahmekriterien
- [ ] Benchmark + /metrics Screenshot.

Artefakte
- [ ] Metrik‑Export, Log‑Screenshots.

Risiken/Rollback
- TTL konservativ wählen, Cache invalidierbar.
