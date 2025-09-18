# D07 — Data Streaming & Quotas
Labels: backend, api, marketplace
Assignee: TBA
Estimate: 3 PT

Zweck
- Autorisierte Auslieferung via Receipts mit Quoten (Bytes/Zeitraum) und single-use/TTL.

Abhängigkeiten
- D06 Receipts
- DB: receipts (erweitern um counters: bytes_used, last_seen, expires_at)

Aufgaben
- [ ] GET /v1/data?contentHash=&receiptId=…:
      - [ ] Validate receipt (exists, not expired, matches contentHash, status ok).
      - [ ] Durchsatz/Bytes-Quoten prüfen (bytes_used + window).
      - [ ] Daten streamen (oder presigned URL generieren), counters aktualisieren.
- [ ] TTL/Expiry durchsetzen; single-use optional.

Definition of Done (DoD)
- [ ] Streaming/Passthrough mit Quoten und atomarer Zählung (Transaktion).
- [ ] Klare Fehler: 401/403/409 je nach Zustand.

Abnahmekriterien (Tests)
- [ ] Positiv: innerhalb Limit → 200 + Daten/URL.
- [ ] Negativ: falscher contentHash, abgelaufen, Limit überschritten.

Risiken/Rollback
- Speicher-/IO-Last → presigned URLs bevorzugen; CDN-Integration später.
