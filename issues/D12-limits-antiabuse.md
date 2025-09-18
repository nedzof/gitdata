# issues/D12-limits-antiabuse.md
# D12 — Limits & Anti‑Abuse (Rate‑Limits, Caps, Timeouts)
Labels: backend, security, ops
Assignee: TBA
Estimate: 2 PT

Zweck
- Stabilität unter Last; Spam/DoS‑Dämpfung.

Abhängigkeiten
- alle

Aufgaben
- [ ] Token‑Bucket pro Endpoint/IP/Identity.
- [ ] Body‑Size‑Caps; bundle depth/parents caps; Stream‑Concurrency; Timeouts.
- [ ] Einheitliche Fehlercodes: 429/413/400.

Definition of Done
- [ ] Flood → 429; zu groß → 413; tiefer Graph → 400.

Abnahmekriterien
- [ ] Lasttest protokolliert; Limits greifen.

Artefakte
- [ ] Rate‑Limit‑Logs, Fehler‑Responses.

Risiken/Rollback
- Limits via ENV feinjustierbar.
