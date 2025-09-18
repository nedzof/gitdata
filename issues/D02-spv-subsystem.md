# issues/D02-spv-subsystem.md
# D2 — SPV Subsystem (Headers + Merkle Verify)
Labels: backend, spv, critical
Assignee: TBA
Estimate: 2 PT

Zweck
- Inklusion (Tx → Block) ohne Indexer per SPV prüfen.

Abhängigkeiten
- Keine (lokale headers.json bzw. Header‑Relay).

Aufgaben
- [ ] header‑loader.ts: headers.json laden, getBestHeight(), confirmCount().
- [ ] merkle.ts: verifyMerkle(txidBE, path, merkleRoot).
- [ ] Fehlerbehandlung (Endianness, Pfadlänge).

Definition of Done
- [ ] verifyMerkle liefert korrekt true/false für Testvektoren.
- [ ] Header‑Store gibt bestHeight und confirmCount(blockHash) zurück.

Abnahmekriterien
- [ ] Unit‑Tests mit Golden‑Headern + Merkle‑Pfaden grün.
- [ ] Beispiel: confirmCount > 0 für blockHash aus headers.json.

Artefakte
- [ ] headers.json, Testvektoren, Test‑Logs.

Risiken/Rollback
- Endianness‑Fehler → Tests korrigieren.
