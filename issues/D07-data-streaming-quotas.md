# issues/D07-data-streaming-quotas.md
# D7 — /v1/data (Streaming + Quoten)
Labels: backend, data, streaming
Assignee: TBA
Estimate: 2 PT

Zweck
- Quoten‑gesicherter Stream, Client prüft Bytes‑Hash.

Abhängigkeiten
- D6, contentHash aus Manifest

Aufgaben
- [ ] GET /v1/data?contentHash&receiptId; Quota prüfen; Bandbreiten‑Abzug am Ende.
- [ ] 402 bei Übernutzung/Expiry; Logging.

Definition of Done
- [ ] Erster Stream erfolgreich; weitere über Limit → 402.

Abnahmekriterien
- [ ] Zwei Downloads ok; dritter → 402; Client‑SHA‑256 == contentHash.

Artefakte
- [ ] Logs, Hash‑Screenshot.

Risiken/Rollback
- Idempotenz beachten; Abzugsfehler korrigierbar.
