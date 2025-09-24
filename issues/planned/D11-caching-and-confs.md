# D11 — Caching & Confirmations
Labels: backend, api, perf
Assignee: TBA
Estimate: 2 PT

Zweck
- Caching für /bundle, Header-Cache-Policy, Konf‑Übergänge (unter/über Schwelle) sauber handhaben.

Abhängigkeiten
- ENV: CACHE_TTLS_JSON { headers, bundles }, POLICY_MIN_CONFS

Aufgaben
- [ ] Bundles Cache (key: versionId+depth), TTL gesteuert.
- [ ] Beim Lesen Konfirmationen frisch berechnen (Envelope bleibt, confs dynamisch).
- [ ] Invalidation: wenn TTL abläuft oder Konf-Schwelle überschritten wurde.

Definition of Done (DoD)
- [ ] /bundle P95-Latenz erreicht Ziel, Konf-Konsistenz gewährleistet.
- [ ] Kein Caching von „ready:true“ über TTL ohne Re-Check.

Abnahmekriterien (Tests)
- [ ] Cache-Hit/Miss Szenarien, Konf-Übergänge, Reorg-Anpassung.

Risiken/Rollback
- Stale Konf-Werte → Recompute-on-read Strategie.
