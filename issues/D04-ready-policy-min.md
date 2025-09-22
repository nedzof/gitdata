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
- [x] GET /ready?versionId=… (src/routes/ready.ts) vollständig implementiert:
      - [x] DFS über Lineage (Tiefe ≤ BUNDLE_MAX_DEPTH) mit cycle detection.
      - [x] Für jeden Knoten proof_json laden, SPV prüfen, Konfirmationen ≥ POLICY_MIN_CONFS.
      - [x] Klarer Output { ready: boolean, reason?: string, confirmations?: number } mit detailliertem error reporting.
      - [x] Advisory system integration - BLOCK advisories führen zu ready:false.
      - [x] Policy evaluation support - optional policyId parameter für erweiterte rule evaluation.
- [x] Reorg-Strategie: Bestätigungen immer live aus headers.json berechnen (kein Pinning), dynamic recomputation.

Definition of Done (DoD)
- [x] Reiner SPV-Check, keine Indexer-Abhängigkeit.
- [x] Negative Fälle (missing-envelope, insufficient-confs, unknown-block, advisory-blocked, policy-blocked) geben ready:false mit reason.

Abnahmekriterien (Tests)
- [x] Einfache Lineage: ready true/false bei Konf‑Schwelle.
- [x] Reorg-Swap in headers → ready reagiert korrekt.
- [x] Advisory blocking: BLOCK advisories führen zu ready:false.
- [x] Policy evaluation: Optional policy checks mit detailliertem decision output.

Risiken/Rollback
- Headerschicht nicht verfügbar → ready false mit reason; Endpoint stabil.
