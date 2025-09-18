# D19 — Identity-signed Producer (BRC-31 style)
Labels: backend, security, identity
Assignee: TBA
Estimate: 2 PT

Zweck
- Producer-Endpunkte optional mit Identitätssignaturen absichern (X-Identity-Key, X-Nonce, X-Signature).

Abhängigkeiten
- src/brc/index.ts (BRC31 stubs vorhanden)
- DB: producers (D08)

Aufgaben
- [ ] Verifier-Middleware: prüft Signatur über body+nonce (Replay-Schutz, Nonce-Store mit TTL).
- [ ] Aktivieren für /producers/* (z. B. submit-dlm1, price set).
- [ ] UI/SDK: withIdentityHeaders() verwenden.

Definition of Done (DoD)
- [ ] Requests ohne/mit falscher Signatur → 401.
- [ ] Korrekter Flow dokumentiert (wie Signatur erzeugt wird).

Abnahmekriterien (Tests)
- [ ] Positivsignatur, Replay-Angriff blockiert, falscher Key blockiert.

Risiken/Rollback
- Scharf schalten per ENV‑Flag (IDENTITY_REQUIRED=true/false).
