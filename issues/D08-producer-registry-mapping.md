# issues/D08-producer-registry-mapping.md
# D8 — Producer Registry (+ Manifest→Producer Mapping)
Labels: backend, producers
Assignee: TBA
Estimate: 2 PT

Zweck
- Produzentenprofil & Payout; manifestHash→producerId abbilden.

Abhängigkeiten
- D1

Aufgaben
- [ ] POST /producers/register { identityKey, payoutTarget, displayName, contact?, attrs? }.
- [ ] /submit: manifest.signatures.producer.publicKey extrahieren → bind manifestHash/datasetId → producerId.

Definition of Done
- [ ] Profile in DB; Mapping vorhanden.

Abnahmekriterien
- [ ] Register → 200; Submit → Mapping sichtbar (Dump).

Artefakte
- [ ] Profil‑JSON, Mapping‑Dump.

Risiken/Rollback
- Identity‑Signaturen später (D19) erzwingen.
