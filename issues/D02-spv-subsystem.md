# D02 — SPV Subsystem (Headers Mirror + Merkle Verify)
Labels: backend, protocol, critical
Assignee: TBA
Estimate: 2–3 PT

Zweck
- SPV-first Verifikation bereitstellen: Header-Mirror lokal, Merkle-Beweis-Verifikation, Endianness fixieren.
- Grundlage für /bundle und /ready (und optionale SPV-Prüfung bei /submit).

Nicht‑Ziele
- Kein Fullnode. Keine Indexer-Abhängigkeit. Nur Headers + Proofs.

Abhängigkeiten
- src/spv/verify-envelope.ts (bereit)
- HEADERS_FILE (JSON Mirror), ENV: POLICY_MIN_CONFS, CACHE_TTLS_JSON.headers
- Optional: scripts/headers-mirror.ts (Pull von mehreren Quellen)

Aufgaben
- [ ] Endianness festhalten: API-Hex big-endian; Hashing intern mit byte-reversal (LE) – bereits in verify-envelope.ts.
- [ ] Headers Mirror:
      - [ ] scripts/headers-mirror.ts: HEADERS_URLS (≥1), Atomare Writes (tmp+rename), Continuity (prevHash/height), bestHeight/tipHash setzen.
      - [ ] Format exportieren, das von loadHeaders() unterstützt wird: {bestHeight, tipHash, headers[]|byHash{}}.
- [ ] SPV Prüfer:
      - [ ] verifyMerklePath(txidBE, path[{hash, position}], merkleRootBE).
      - [ ] verifyEnvelopeAgainstHeaders(env, headersIdx, minConfs) – bereits vorhanden; Tests erweitern.
- [ ] Tests:
      - [ ] Golden headers.json (3–5 Blöcke), Good/Bad Merklepfade.
      - [ ] Reorg-Simulation: geänderte tipHash/bestHeight, Konfirmationsberechnung.

Definition of Done (DoD)
- [ ] headers.json wird atomar geschrieben, Continuity-Fehler führen zu no-write und Exit-Code ≠ 0.
- [ ] verify-envelope.ts verifiziert Good-Vector, lehnt Bad-Vector klar ab (invalid-merkle-path/unknown-block).
- [ ] /ready und /bundle können headers.json laden und Konfirmationen berechnen.

Abnahmekriterien (Tests)
- [ ] Unit: verifyMerklePath (left/right, falsche Reihenfolge), txid- und Root-Endianness.
- [ ] Integration: verifyEnvelopeAgainstHeaders (blockHeader vs. blockHash Pfad, minConfs Grenzfälle).
- [ ] Mirror: Eine Quelle fällt aus → keine Korruption, Logs verständlich.

Artefakte/Evidence
- [ ] headers.json Beispiel, Logs vom Mirror, Test-Outputs.

Risiken/Rollback
- Falsche Endianness → Golden Tests decken ab. Mirror-Quelle instabil → mehrere Quellen + atomare Updates.
