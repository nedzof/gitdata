# D04 — /ready (Policy: minConfs)
Labels: backend, api, policy
Assignee: TBA
Estimate: 1–2 PT

Zweck
- Einfache Readiness-Prüfung über gesamte Lineage: SPV-validiert und Konfirmationen ≥ POLICY_MIN_CONFS.

Abhängigkeiten
- SPV: verify-envelope.ts, HEADERS_FILE
- DB: declarations, edges

Aufgaben
- [ ] GET /ready?versionId=… (src/routes/ready.ts):
      - [ ] DFS über Lineage (Tiefe ≤ BUNDLE_MAX_DEPTH).
      - [ ] Für jeden Knoten proof_json laden, SPV prüfen, Konfirmationen ≥ POLICY_MIN_CONFS.
      - [ ] Klarer Output { ready: boolean, reason?: string, confirmations?: number }.
- [ ] Reorg-Strategie: Bestätigungen immer live aus headers.json berechnen (kein Pinning).

Definition of Done (DoD)
- [ ] Reiner SPV-Check, keine Indexer-Abhängigkeit.
- [ ] Negative Fälle (missing-envelope, insufficient-confs, unknown-block) geben ready:false mit reason.

Abnahmekriterien (Tests)
- [ ] Einfache Lineage: ready true/false bei Konf‑Schwelle.
- [ ] Reorg-Swap in headers → ready reagiert korrekt.

Risiken/Rollback
- Headerschicht nicht verfügbar → ready false mit reason; Endpoint stabil.
