D33 — Inference Batch Anchoring (Merkle Root Commit) Labels: anchoring, merkle, spv Assignee: TBA Estimate: 3–4 PT

Zweck

    Periodisch Merkle-Root über Output-Hashes bilden; optional als DLM1/OP_RETURN verankern; Inclusion-Proofs pro Output.

Endpunkte

    GET /models/:id/anchors → [{ root, anchoredAt, versionId? }]

Aufgaben

    Collector/Builder; Anchoring-Job (synthetic|advanced); Proof-Speicher.
    Optional: /verify-output erweitert: akz. Merkle-Proof + Root.

Definition of Done

    Roots erzeugt & dokumentiert; Inclusion-Proofs verifizierbar.

Abnahmekriterien

    Proof verifizierbar; advanced: Root ↔ on-chain Anchor per SPV.

Artefakte

    Beispiel-Proofs; Postman-Requests.

ENV

    ANCHORMODE, ANCHORINTERVAL_SEC.

Environment: D33-Local.postman_environment.json
```json
{
  "id": "d33-local",
  "name": "D33 Local",
  "values": [
    { "key": "baseUrl", "value": "http://localhost:8788", "enabled": true },
    { "key": "modelVersionId", "value": "md_demo_123", "enabled": true }
  ]
}
```

4) JSON-Fixtures (Good/Bad Proofs)
Speichere diese z. B. unter fixtures/:

fixtures/proof-good.json
```json
{
  "proof": {
    "modelVersionId": "md_demo_123",
    "inputHash": "1111111111111111111111111111111111111111111111111111111111111111",
    "outputHash": "2222222222222222222222222222222222222222222222222222222222222222",
    "nonce": "nonce-abc",
    "timestamp": 1737427200,
    "signature": "3045022100aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa022100bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  }
}
```

fixtures/proof-bad-signature.json
```json
{
  "proof": {
    "modelVersionId": "md_demo_123",
    "inputHash": "1111111111111111111111111111111111111111111111111111111111111111",
    "outputHash": "2222222222222222222222222222222222222222222222222222222222222222",
    "nonce": "nonce-abc",
    "timestamp": 1737427200,
    "signature": "3045022100deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef022100cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe"
  }
}
```

fixtures/proof-bad-timestamp.json
```json
{
  "proof": {
    "modelVersionId": "md_demo_123",
    "inputHash": "1111111111111111111111111111111111111111111111111111111111111111",
    "outputHash": "2222222222222222222222222222222222222222222222222222222222222222",
    "nonce": "nonce-abc",
    "timestamp": 123456, 
    "signature": "3045022100aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa022100bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  }
}
```

3) Postman Collection: D33-Anchors.postman_collection.json
Request: List Model Anchors
Speichern als D33-Anchors.postman_collection.json
```json
{
  "info": {
    "_postman_id": "d33-anchors-collection",
    "name": "D33 — Inference Anchors",
    "description": "Lists Merkle-root anchors for a given model (batch anchoring).",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "List Anchors",
      "request": {
        "method": "GET",
        "url": { "raw": "{{baseUrl}}/models/{{modelVersionId}}/anchors", "host": ["{{baseUrl}}"], "path": ["models","{{modelVersionId}}","anchors"] }
      },
      "event": [
        { "listen":"test", "script": { "type":"text/javascript", "exec":[
          "pm.test('200 OK (if anchoring is mounted)', ()=> pm.response.to.have.status(200));",
          "const js = pm.response.json();",
          "pm.test('items array', ()=> pm.expect(js.items).to.be.an('array'));",
          "if ((js.items||[]).length) {",
          "  const first = js.items[0];",
          "  pm.test('root present', ()=> pm.expect(first.root).to.be.a('string').and.not.empty);",
          "}"
        ]}}
      ]
    }
  ]
}
```

