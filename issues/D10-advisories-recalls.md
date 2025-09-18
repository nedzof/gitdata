# issues/D10-advisories-recalls.md
# D10 — Advisories/Recalls
Labels: backend, governance
Assignee: TBA
Estimate: 1–2 PT

Zweck
- Zurückrufen/Superseden von Versionen; /ready verweigert.

Abhängigkeiten
- D4

Aufgaben
- [ ] POST /advisories { versionId, recalled:true|false, supersededBy?, reason }.
- [ ] GET /advisories?versionId.
- [ ] /ready liest Advisories → reasons.

Definition of Done
- [ ] Advisory kippt ready:true → false.

Abnahmekriterien
- [ ] Nach POST advisory: /ready { ready:false } mit Reason.

Artefakte
- [ ] Advisory‑JSON, /ready Output.

Risiken/Rollback
- Advisory‑Check via Feature‑Flag steuerbar.
