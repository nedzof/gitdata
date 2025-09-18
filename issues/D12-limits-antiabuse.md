# D12 — Limits & Antiabuse
Labels: backend, security, ops
Assignee: TBA
Estimate: 2 PT

Zweck
- Rate Limits, Bodygrößen, Timeout- und Schema‑Durchsetzung, um Missbrauch zu verhindern.

Abhängigkeiten
- ENV: RATE_LIMITS_JSON, BODY_MAX_SIZE
- Validatoren (Ajv), Router vorhanden

Aufgaben
- [ ] Per‑Route Ratelimits (/submit, /bundle, /ready, /price, /v1/data).
- [ ] Body‑Size‑Limits, strikte Schemas (Ajv) und sichere Parser.
- [ ] Timeouts/AbortController für Upstream‑Calls (z. B. Proof‑Provider).
- [ ] Audit‑Logs (method, path, status, ms).

Definition of Done (DoD)
- [ ] Exzessive Anfragen werden begrenzt, große Bodies 413.
- [ ] Parser robust (kein Crash bei Bösartigkeit).

Abnahmekriterien (Tests)
- [ ] Rate‑Limit E2E, 413 Pfad, ungültige Bodies → 400/422.

Risiken/Rollback
- Falsch positive Limits → ENV justierbar ohne Deploy.
