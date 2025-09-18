# D20 — Docs & Postman Collection
Labels: docs, api, qa
Assignee: TBA
Estimate: 1–2 PT

Zweck
- Entwickler‑Dokumentation und Postman‑Sammlung für End‑to‑End Validierung.

Abhängigkeiten
- Alle Kernendpunkte vorhanden (submit‑builder/receiver, bundle, ready, price, optional pay/data)

Aufgaben
- [ ] README erweitern (Producer/Consumer Flows, ENV, Runbooks).
- [ ] OpenAPI (optional) oder gut gepflegte Postman‑Collection + Environment.
- [ ] Newman/CI Job: Sammlung ausführen, Basistests (Statuscode + Schema Checks).
- [ ] Beispiel‑Manifeste, Beispiel‑TX, Golden-Vektoren beilegen.

Definition of Done (DoD)
- [ ] Postman‑Sammlung deckt Hauptpfade ab (submit→bundle→ready→price).
- [ ] Docs zeigen Klartext‑Schritte (Builder→Wallet→Receiver→UI).

Abnahmekriterien (Tests)
- [ ] Newman läuft grün in CI.
- [ ] Entwickler kann in <15 min „Hello World Dataset“ publizieren.

Risiken/Rollback
- Veraltete Beispiele → CI als Wächter, Sammlung in PRs aktuell halten.
