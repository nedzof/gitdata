D30 — Runtime Commitment & Output Verifier (Proof-of-Execution)
Labels: runtime, signatures, verifier, spv
Assignee: TBA
Estimate: 4–6 PT

Zweck/Scope
- Modelle veröffentlichen zur Registrierung ein Laufzeit‑Commitment mit öffentlichem Verifikationsschlüssel.
- Jede Inferenz liefert einen signierten Proof; Server verifiziert deterministisch.

Nicht‑Ziele
- Keine TEE/HSM‑Pflicht (kann später ergänzt werden).
- Keine On‑Chain‑Verankerung pro Inferenz (dafür D33 optional).

Manifest‑Erweiterung (Teil von modelArtifact)
runtimeCommitment: {
  method: "ecdsa-signature",
  verificationKey: string (compressed or uncompressed hex; 33/65 bytes; doc),
  commitmentHash: string (sha256 hex; Paket der runtime env),
  schema?: { inputHash?: string, outputHash?: string }
}

API
- POST /models/commitment
  - Body:
    { modelVersionId, method?: "ecdsa-signature", verificationKey, commitmentHash, schema?: {...} }
  - 200: { status:"ok" }, 400/404
- POST /verify-output
  - Body:
    {
      prediction?: any, // optional
      proof: {
        modelVersionId: string,
        inputHash: string (^[0-9a-f]{64}$),
        outputHash: string (^[0-9a-f]{64}$),
        nonce: string (<=128 ascii),
        timestamp: number (unix seconds),
        signature: string (DER hex or compact base64/hex; config)
      }
    }
  - Canonicalization:
    payload = {
      modelVersionId, inputHash, outputHash, nonce, timestamp
    }
    msg = JSON.stringify(payload) with stable key order (exact: [modelVersionId,inputHash,outputHash,nonce,timestamp])
    digest = sha256(msg)
  - Verify:
    - lookup verificationKey by modelVersionId
    - ecdsa verify(digest, signature, verificationKey)
  - 200: { valid: true, modelVersionId, verificationKey } | { valid: false, reason }
  - Err: 400 bad-request, 404 unknown-model, 422 invalid-signature, 429 rate-limit

DB‑Schema
ALTER TABLE models ADD COLUMN commitment_json TEXT; -- stores runtimeCommitment

Zustandsmodell
- commitment: create/update → models.commitment_json.
- verify-output: stateless Prüfung (optional: Nonce‑Replay‑Cache in Memory/Redis).

Sicherheit
- Replay‑Window: optional Nonce‑Cache mit TTL (VERIFIER_NONCE_TTL_SEC).
- Clock skew toleriert ±5 min (konfigurierbar); außerhalb → reason="timestamp-skew".

Fehler/Rate‑Limits/Idempotenz
- 429 bei übermäßigen Verify‑Aufrufen.
- Idempotent: gleicher Proof → gleiche Antwort.

Observability
- verify_latency_p95, invalid_signature_rate, replay_dropped_count.

Performance
- p95 < 80 ms (lokal) pro Verify-Aufruf.

Tests
- Good vectors: 2–3 signierte Beispiele (kompakt/DER falls beide erlaubt).
- Bad vectors: falscher key, manipulierte inputHash/outputHash/nonce/timestamp, zu alter timestamp, Nonce‑Replay.

Artefakte
- JSON Schemas (commitment, proof), Testvektoren, Postman.

Risiken/Rollback
- Key rotation nötig → D32; strikte Validierung verhindert Akzeptanz ungültiger Formate.

ENV
- VERIFIER_NONCE_TTL_SEC=120
- RUNTIME_VERIFIER_STRICT=true
- SIGNATURE_FORMAT=der|compact

Environment: D30-Local.postman_environment.json
```json
{
  "id": "d30-local",
  "name": "D30 Local",
  "values": [
    { "key": "baseUrl", "value": "http://localhost:8788", "enabled": true },
    { "key": "modelVersionId", "value": "md_demo_123", "enabled": true },
    { "key": "verificationKey", "value": "03ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", "enabled": true },
    { "key": "commitmentHash", "value": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "enabled": true },
    { "key": "proofGood", "value": "{\n  \"proof\": {\n    \"modelVersionId\": \"md_demo_123\",\n    \"inputHash\": \"1111111111111111111111111111111111111111111111111111111111111111\",\n    \"outputHash\": \"2222222222222222222222222222222222222222222222222222222222222222\",\n    \"nonce\": \"nonce-abc\",\n    \"timestamp\": 1737427200,\n    \"signature\": \"3045022100aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa022100bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\"\n  }\n}", "enabled": true },
    { "key": "proofBadSignature", "value": "{\n  \"proof\": {\n    \"modelVersionId\": \"md_demo_123\",\n    \"inputHash\": \"1111111111111111111111111111111111111111111111111111111111111111\",\n    \"outputHash\": \"2222222222222222222222222222222222222222222222222222222222222222\",\n    \"nonce\": \"nonce-abc\",\n    \"timestamp\": 1737427200,\n    \"signature\": \"3045022100deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef022100cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe\"\n  }\n}", "enabled": true },
    { "key": "replayStrict", "value": "false", "enabled": true }
  ]
}
```

2) Postman Collection: D30-Verify.postman_collection.json
Requests: Commit runtimeKey → Verify (Good) → Verify (Bad Signature) → Verify (Replay)
Speichern als D30-Verify.postman_collection.json
```json
{
  "info": {
    "_postman_id": "d30-verify-collection",
    "name": "D30 — Runtime Commitment & Verify-Output",
    "description": "Registers runtime commitment and verifies model outputs (good/bad/replay).",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Set Runtime Commitment",
      "request": {
        "method": "POST",
        "header": [{ "key": "content-type", "value": "application/json" }],
        "url": { "raw": "{{baseUrl}}/models/commitment", "host": ["{{baseUrl}}"], "path": ["models","commitment"] },
        "body": {
          "mode": "raw",
          "raw": "{\n  \"modelVersionId\": \"{{modelVersionId}}\",\n  \"method\": \"ecdsa-signature\",\n  \"verificationKey\": \"{{verificationKey}}\",\n  \"commitmentHash\": \"{{commitmentHash}}\",\n  \"schema\": { \"inputHash\": \"\", \"outputHash\": \"\" }\n}"
        }
      },
      "event": [
        { "listen": "test", "script": { "type":"text/javascript", "exec":[
          "pm.test('200 OK', ()=> pm.response.to.have.status(200));"
        ]}}
      ]
    },
    {
      "name": "Verify Output (Good)",
      "request": {
        "method": "POST",
        "header": [{ "key": "content-type", "value": "application/json" }],
        "url": { "raw": "{{baseUrl}}/verify-output", "host": ["{{baseUrl}}"], "path": ["verify-output"] },
        "body": {
          "mode": "raw",
          "raw": "{{proof_good_json}}"
        }
      },
      "event": [
        { "listen":"prerequest", "script": { "type":"text/javascript", "exec":[
          "pm.environment.set('proof_good_json', pm.environment.get('proofGood'));"
        ]}},
        { "listen":"test", "script": { "type":"text/javascript", "exec":[
          "pm.test('200 OK', ()=> pm.response.to.have.status(200));",
          "const js = pm.response.json();",
          "pm.test('valid true', ()=> pm.expect(js.valid).to.eql(true));"
        ]}}
      ]
    },
    {
      "name": "Verify Output (Bad Signature)",
      "request": {
        "method": "POST",
        "header": [{ "key": "content-type", "value": "application/json" }],
        "url": { "raw": "{{baseUrl}}/verify-output", "host": ["{{baseUrl}}"], "path": ["verify-output"] },
        "body": {
          "mode": "raw",
          "raw": "{{proof_bad_sig_json}}"
        }
      },
      "event": [
        { "listen":"prerequest", "script": { "type":"text/javascript", "exec":[
          "pm.environment.set('proof_bad_sig_json', pm.environment.get('proofBadSignature'));"
        ]}},
        { "listen":"test", "script": { "type":"text/javascript", "exec":[
          "pm.test('200 OK', ()=> pm.response.to.have.status(200));",
          "const js = pm.response.json();",
          "pm.test('valid false', ()=> pm.expect(js.valid).to.eql(false));"
        ]}}
      ]
    },
    {
      "name": "Verify Output (Replay Nonce)",
      "request": {
        "method": "POST",
        "header": [{ "key": "content-type", "value": "application/json" }],
        "url": { "raw": "{{baseUrl}}/verify-output", "host": ["{{baseUrl}}"], "path": ["verify-output"] },
        "body": {
          "mode": "raw",
          "raw": "{{proof_good_json}}"
        }
      },
      "event": [
        { "listen":"test", "script": { "type":"text/javascript", "exec":[
          "pm.test('OK or policy response', function(){",
          "  pm.response.to.have.status(200);",
          "  const js = pm.response.json();",
          "  if (pm.environment.get('replayStrict') === 'true') {",
          "     pm.test('replay rejected', ()=> pm.expect(js.valid).to.eql(false));",
          "  } else {",
          "     pm.test('replay accepted (non-strict mode)', ()=> true);",
          "  }",
          "});"
        ]}}
      ]
    }
  ]
}
```

