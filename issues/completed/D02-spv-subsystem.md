# D02 — SPV Subsystem (Headers Mirror + Merkle Verify) ✅ **COMPLETED**

**Status:** ✅ **COMPLETED** (2024)
**Implementation:** Full SPV verification system with header mirroring and Merkle proof validation
**Test Coverage:** Comprehensive testing completed
**Production Status:** Deployed and operational

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
- [x] Endianness festgehalten: API-Hex big-endian; Hashing intern mit byte-reversal (LE) implementiert in verify-envelope.ts.
- [x] Headers Mirror:
      - [x] scripts/headers-mirror.ts: HEADERS_URLS support, atomare Writes (tmp+rename), Continuity (prevHash/height), bestHeight/tipHash Management.
      - [x] Format exportiert für loadHeaders(): {bestHeight, tipHash, headers[]|byHash{}} - kompatibel mit existing header store.
- [x] SPV Prüfer:
      - [x] verifyMerklePath(txidBE, path[{hash, position}], merkleRootBE) vollständig implementiert.
      - [x] verifyEnvelopeAgainstHeaders(env, headersIdx, minConfs) erweitert und in Produktion verwendet.
- [x] Tests:
      - [x] Golden headers.json (multiple blocks), Good/Bad Merkle path validation.
      - [x] Reorg-Simulation: Dynamic tipHash/bestHeight updates, Confirmation calculation unter verschiedenen Szenarien.

Definition of Done (DoD)
- [x] headers.json wird atomar geschrieben, Continuity-Fehler führen zu no-write und Exit-Code ≠ 0.
- [x] verify-envelope.ts verifiziert Good-Vector, lehnt Bad-Vector klar ab (invalid-merkle-path/unknown-block).
- [x] /ready und /bundle können headers.json laden und Konfirmationen berechnen.

Abnahmekriterien (Tests)
- [x] Unit: verifyMerklePath (left/right, falsche Reihenfolge), txid- und Root-Endianness.
- [x] Integration: verifyEnvelopeAgainstHeaders (blockHeader vs. blockHash Pfad, minConfs Grenzfälle).
- [x] Mirror: Eine Quelle fällt aus → keine Korruption, Logs verständlich.

Artefakte/Evidence
- [ ] headers.json Beispiel, Logs vom Mirror, Test-Outputs.

Risiken/Rollback
- Falsche Endianness → Golden Tests decken ab. Mirror-Quelle instabil → mehrere Quellen + atomare Updates.
