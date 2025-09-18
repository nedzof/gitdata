# issues/D19-identity-signed-producer.md
# D19 — Identity‑Signierte /producers/* Requests
Labels: security, producers
Assignee: TBA
Estimate: 1–2 PT

Zweck
- Schutz vor Spoofing bei Registry/Price.

Abhängigkeiten
- D8–D9

Aufgaben
- [ ] Nonce + Signatur im Header (BRC‑31‑like); Server prüft gegen producerId‑Key.
- [ ] Unsigned → 401; Valid → 200.

Definition of Done
- [ ] Nur signierte Anfragen ändern Profile/Prices.

Abnahmekriterien
- [ ] Negativ/Positiv‑Tests dokumentiert (401/200).

Artefakte
- [ ] Logs & Responses.

Risiken/Rollback
- Feature flaggbar.
