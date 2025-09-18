# issues/D04-ready-policy-min.md
# D4 — /ready (Policy: minConfs + Advisories)
Labels: backend, policy
Assignee: TBA
Estimate: 1–2 PT

Zweck
- True/False Gate vor Nutzung (deterministisch).

Abhängigkeiten
- D2, D3, D10

Aufgaben
- [ ] POST /ready { versionId, policy:{ minConfs, … } }.
- [ ] Prüfen: SPV‑Confs ≥ minConfs; Recalls/Advisories.
- [ ] reasons[] liefern.

Definition of Done
- [ ] ready:true/false + reasons[].

Abnahmekriterien
- [ ] Ohne Advisory + confs: true.
- [ ] Mit Advisory: false (reasons enthält "recalled").

Artefakte
- [ ] /ready Responses (vor/nach Advisory).

Risiken/Rollback
- Policy funktional trennbar; Advisory‑Check isolierbar.
