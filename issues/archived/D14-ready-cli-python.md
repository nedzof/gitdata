# issues/D14-ready-cli-python.md
# D14 — Python Ready‑CLI (CI Gate)
Labels: cli, python, devx
Assignee: TBA
Estimate: 1 PT

Zweck
- READY/NOT READY (Exit 0/1) für CI/CD.

Abhängigkeiten
- D4

Aufgaben
- [ ] CLI: python verifier.py –versionId –policy … → Exit 0/1.
- [ ] Beispiele & Doku.

Definition of Done
- [ ] Exit 0 bei ready, 1 bei recall/minConfs nicht erfüllt.

Abnahmekriterien
- [ ] Zwei Läufe (ok + recall) dokumentiert.

Artefakte
- [ ] CLI Output.

Risiken/Rollback
- —
