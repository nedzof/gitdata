# D01 — DLM1 Submit (Builder + Receiver)

Labels: backend, protocol, critical
Assignee: TBA
Estimate: 2–3 PT

Zweck
- Producer-Flow für DLM1 vollständig bereitstellen:
  1) Builder-Endpoint: POST /submit/dlm1 — Manifest validieren, versionId kanonisch ableiten, DLM1-CBOR encodieren, OP_RETURN scriptHex zurückgeben (Wallet-ready, kein Broadcast).
  2) Receiver-Endpoint: POST /submit — Final signierten rawTx annehmen, OP_RETURN parsen, DLM1 dekodieren, versionId extrahieren und alle DB-Entitäten persistieren.

Nicht‑Ziele
- Kein Broadcast in der API (Wallet signiert/broadcastet).
- Keine Pflicht‑SPV bei /submit (kann optional verifiziert und gespeichert werden; SPV wird in D02 forciert).

Abhängigkeiten
- DB-Schema: declarations, manifests, edges (bereits vorhanden)
- JSON Schemas: schemas/dlm1-manifest.schema.json
- Validator: Ajv (strict=false, formats)
- Hilfen: src/dlm1/codec.ts (canonicalize, deriveManifestIds, encode/decode DLM1), src/utils/opreturn.ts (Parser), src/builders/opreturn.ts (Builder)
- Optional: src/spv/verify-envelope.ts (für optionale SPV-Überprüfung am Receiver)

Aufgaben
- [x] Manifest‑Validator: Ajv initialisiert (src/validators/index.ts), validateDlm1Manifest(manifest) implementiert.
- [x] Canonicalisierung: deriveManifestIds implementiert in src/dlm1/codec.ts - canonicalization + ID derivation.
- [x] DLM1 CBOR: buildDlm1AnchorFromManifest implementiert - encode/decode CBOR mit minimaler Form (mh=bytes32, p=[bytes32…]).
- [x] Builder‑Route: src/routes/submit-builder.ts vollständig implementiert
      - POST /submit/dlm1: manifest validation, ID derivation, CBOR generation, scriptHex via OP_FALSE OP_RETURN.
      - Response: { status, versionId, manifestHash, parents, outputs:[{scriptHex,0}], opReturnScriptHex, opReturnOutputBytes }.
      - Error handling: 422 schema errors, 400 body errors, 500 internal errors.
- [x] Receiver‑Route: src/routes/submit-receiver.ts vollständig implementiert
      - POST /submit: Body.rawTx validation, OP_RETURN parsing (single/multi-push), DLM1→CBOR→mh decoding.
      - Idempotent ingest: declarations, manifests (manifest_json + derived fields), edges (lineage.parents), opret_vout, optional proof_json (SPV verification).
      - Error handling: 400 invalid rawTx, 409 spv-verification-failed, 500 internal errors.
- [x] DB‑Ingest: src/services/ingest.ts vollständig implementiert
      - versionId/manifestHash derivation; DLM1-Payload mismatch validation.
      - Database upserts with unique constraints (version_id), unique(txid).
- [x] Tests: Umfassende Test-Suite implementiert
      - Unit tests: DLM1 encode/decode, OP_RETURN builder/parser (single & multi push).
      - Integration tests: /submit/dlm1 → craft rawTx → /submit flow; versionId persistence verification.
      - Negative tests: invalid manifest (422), invalid rawTx (400), DLM1.mh ≠ derived errors.
- [x] OpenAPI: Endpoint documentation integriert via routing system.

Definition of Done (DoD)
- [x] POST /submit/dlm1 liefert deterministische versionId und ein gültiges OP_RETURN scriptHex (Wallet-ready).
- [x] POST /submit akzeptiert eine signierte TX, erkennt DLM1 (single & multi push), dekodiert mh→versionId und persistiert:
      - declarations(version_id, txid, opret_vout, raw_tx, type='DLM1', status='pending', created_at)
      - manifests(version_id, manifest_json, manifest_hash, content_hash, license, classification, created_at)
      - edges(child=version_id, parents…)
- [x] Idempotenz: Wiederholte /submit‑Aufrufe mit gleichem txid/versionId sind idempotent mit stabilen 200 responses.
- [x] Fehlerpfade liefern klare JSON‑Fehler { error, hint?, code? }.

Abnahmekriterien (Tests)
- [x] curl POST /submit/dlm1 (valider Manifest) → 200 + { versionId, outputs[0].scriptHex startsWith "006a" }.
- [x] Synthetic rawTx mit diesem scriptHex → POST /submit → 200 + { status:"success", type:"DLM1", versionId } und DB‑Rows vorhanden.
- [x] Multi‑push Variante (["DLM1", CBOR]) wird korrekt erkannt.
- [x] Negative 1: ungültiges Manifest → 422 schema-validation-failed.
- [x] Negative 2: rawTx nicht hex / zu groß → 400 invalid-rawtx.
- [x] Negative 3: DLM1.mh ≠ canonical manifest hash → Fehler mit klarer Meldung (onchain-mh-mismatch).
- [x] Optional: Mitgeliefertes envelope wird SPV‑verifiziert; bei Fehler 409 spv-verification-failed.

Artefakte/Evidence
- [ ] Beispiel‑Manifest (JSON), Builder‑Response (JSON), scriptHex, Beispiel‑TX (hex), Receiver‑Response (JSON).
- [ ] DB‑Dump (declarations, manifests, edges) für die Version.
- [ ] Test‑Logs (Integration) und Commit‑IDs.

Risiken/Rollback
- OP_RETURN‑Parsing (Varianten single vs. multi push) → mit Parser‑Tests abgesichert.
- Canonicalisierung (Key‑Sortierung, Exklusion signatures/versionId) → deterministische Tests (golden vectors).
- Bei Problemen: Receiver soft‑disable (Return 503) ohne Datenverlust, Builder bleibt verwendbar.
