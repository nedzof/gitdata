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
- [ ] Manifest‑Validator: Ajv initialisieren (src/validators/index.ts), validateDlm1Manifest(manifest) bereitstellen.
- [ ] Canonicalisierung: canonicalizeManifest (signatures+versionId ausgeschlossen), deriveManifestIds (explizite versionId muss zum Hash passen, sonst Fehler).
- [ ] DLM1 CBOR: encodeDLM1({ mh, p }), decodeDLM1(buf) (nur minimale Form: mh=bytes32, p=[bytes32…]).
- [ ] Builder‑Route: src/routes/submit-builder.ts
      - POST /submit/dlm1: manifest validieren, IDs ableiten, CBOR erzeugen, scriptHex via OP_FALSE OP_RETURN zurückgeben.
      - Response: { status, versionId, parents, outputs:[{scriptHex,0}], estOutputSize, opReturnScriptHex, cborHex }.
      - Fehler: 422 Schemafehler, 400 Bodyfehler, 500 Intern.
- [ ] Receiver‑Route: src/routes/submit-receiver.ts
      - POST /submit: Body.rawTx prüfen, OP_RETURN parsen (single- und multi‑push), DLM1→CBOR→mh dekodieren.
      - Idempotentes Ingest: declarations, manifests (manifest_json + abgeleitete Felder), edges (lineage.parents), opret_vout, optional proof_json (wenn envelope mitkommt und SPV ok).
      - Fehler: 400 invalid rawTx, 409 spv-verification-failed (falls envelope fehl schlägt), 500 Intern.
- [ ] DB‑Ingest: src/services/ingest.ts
      - versionId/manifestHash ableiten; bei DLM1-Payload mismatch => Fehler.
      - rows upserten; unique(version_id), unique(txid) sicherstellen.
- [ ] Tests (mind.):
      - Unit: DLM1 encode/decode, OP_RETURN builder/parser (single & multi push).
      - Integration: /submit/dlm1 → craft rawTx → /submit; Receiver muss versionId persistieren.
      - Negative: invalid manifest (422), invalid rawTx (400), DLM1.mh ≠ derived (409 oder 500 mit klarer Meldung).
- [ ] OpenAPI (optional): Endpunktbeschreibungen ergänzen.

Definition of Done (DoD)
- [ ] POST /submit/dlm1 liefert deterministische versionId und ein gültiges OP_RETURN scriptHex (Wallet-ready).
- [ ] POST /submit akzeptiert eine signierte TX, erkennt DLM1 (single & multi push), dekodiert mh→versionId und persistiert:
      - declarations(version_id, txid, opret_vout, raw_tx, type='DLM1', status='pending', created_at)
      - manifests(version_id, manifest_json, manifest_hash, content_hash, license, classification, created_at)
      - edges(child=version_id, parents…)
- [ ] Idempotenz: Wiederholte /submit‑Aufrufe mit gleichem txid/versionId sind „created=false“ oder 200 stabil.
- [ ] Fehlerpfade liefern klare JSON‑Fehler { error, hint?, code? }.

Abnahmekriterien (Tests)
- [ ] curl POST /submit/dlm1 (valider Manifest) → 200 + { versionId, outputs[0].scriptHex startsWith "006a" }.
- [ ] Synthetic rawTx mit diesem scriptHex → POST /submit → 200 + { status:"success", type:"DLM1", versionId } und DB‑Rows vorhanden.
- [ ] Multi‑push Variante (["DLM1", CBOR]) wird korrekt erkannt.
- [ ] Negative 1: ungültiges Manifest → 422 schema-validation-failed.
- [ ] Negative 2: rawTx nicht hex / zu groß → 400 invalid-rawtx.
- [ ] Negative 3: DLM1.mh ≠ canonical manifest hash → Fehler mit klarer Meldung (onchain-mh-mismatch).
- [ ] Optional: Mitgeliefertes envelope wird SPV‑verifiziert; bei Fehler 409 spv-verification-failed.

Artefakte/Evidence
- [ ] Beispiel‑Manifest (JSON), Builder‑Response (JSON), scriptHex, Beispiel‑TX (hex), Receiver‑Response (JSON).
- [ ] DB‑Dump (declarations, manifests, edges) für die Version.
- [ ] Test‑Logs (Integration) und Commit‑IDs.

Risiken/Rollback
- OP_RETURN‑Parsing (Varianten single vs. multi push) → mit Parser‑Tests abgesichert.
- Canonicalisierung (Key‑Sortierung, Exklusion signatures/versionId) → deterministische Tests (golden vectors).
- Bei Problemen: Receiver soft‑disable (Return 503) ohne Datenverlust, Builder bleibt verwendbar.
