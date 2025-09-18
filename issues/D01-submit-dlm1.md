# issues/D01-submit-dlm1.md
# D1 — /submit + DLM1 (Core Anchoring)
Labels: backend, protocol, critical
Assignee: TBA
Estimate: 2–3 PT

Zweck
- On‑chain Erklärungen (DLM1) annehmen, Manifest optional speichern, manifestHash → versionId binden.

Abhängigkeiten
- DB (tables: declarations, manifests)
- Strict‑CBOR DLM1‑Validator (canonical)

Aufgaben
- [ ] DLM1‑Parser/Validator implementieren (canonical CBOR, feste Feldlängen, bekannte Keys).
- [ ] POST /submit: rawTx parsen, OP_RETURN → DLM1 erkennen, manifestHash/txo erfassen.
- [ ] Optionales Manifest JSON speichern (manifests).
- [ ] Mapping manifestHash → versionId (i. d. R. manifestHash) zurückgeben.
- [ ] Fehlerpfade: invalid CBOR → 400; fehlende Felder → 400.

Definition of Done (DoD)
- [ ] /submit akzeptiert 1–N Outputs in einer Tx.
- [ ] Ungültige/inkanonische CBOR payloads werden mit 400 abgewiesen.
- [ ] DB enthält declarations(manifestHash, txid, vout, createdAt) und manifests(manifestHash, body).

Abnahmekriterien (Tests)
- [ ] curl /submit (mit Beispiel‑TX) → 200 + { admitted: [...] }.
- [ ] curl /manifest?hash=<manifestHash> → 200 + gespeichertes Manifest.
- [ ] Negative: nicht‑kanonisch → 400; unbekannte Keys → 400.

Artefakte/Evidence
- [ ] Beispiel‑TX (hex), /submit‑Response JSON, DB‑Row‑Dump (declarations, manifests).

Risiken/Rollback
- Parsingfehler → 400; bei Problemen Endpoint vorübergehend deaktivierbar.
