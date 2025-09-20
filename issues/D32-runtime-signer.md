D32 — Runtime Signer & Key Management (Emitter)
Labels: runtime, signer, ops
Assignee: TBA
Estimate: 3–4 PT

Zweck/Scope
- Referenz‑Signer (Node/TS) für Proof‑Erzeugung; Key‑Versionierung/Rotation.

Nicht‑Ziele
- Kein Custodial Key im Overlay.

Spezifikation
- Canonical payload: {modelVersionId,inputHash,outputHash,nonce,timestamp} (gleiche Reihenfolge wie D30)
- Domain‑Separator: SIGNING_DOMAIN prefix optional, z. B. "model-output-v1|" + JSON
- digest = sha256(domain || canonical_json)
- signature = ECDSA(secp256k1, digest, PRIVKEY)

Key‑Management
- Keys via ENV/KMS (MODEL_SIGNING_KEY_HEX, MODEL_SIGNING_KEY_ID)
- Rotation: altes KeyId bleibt prüfbar (Commitment kann “currentKeyId” führen; neue Komponente D30 setzt neues commitmentHash/verificationKey)

DoD
- CLI/Lib erzeugt Proof kompatibel zu D30.
- Rotation ohne Bruch: neue Proofs valid mit neuem Key; alte weiterhin überprüfbar bis Commitment aktualisiert.

Tests
- Local sign/verify roundtrip.
- Multi-key roundtrip.

Artefakte
- Pseudocode, README, Rotations-Checklist.

Risiken
- Key leakage → sofortige Rotation; restriktive FS‑Rechte.

ENV
- MODEL_SIGNING_KEY_HEX, MODEL_SIGNING_KEY_ID, SIGNING_DOMAIN="model-output-v1"

D33 — Inference Batch Anchoring (Merkle Root Commit)
Labels: anchoring, merkle, spv
Assignee: TBA
Estimate: 3–4 PT

Zweck/Scope
- Periodische Merkle‑Wurzel über Output‑Proof‑Blätter (leaf = sha256(inputHash|outputHash|nonce|timestamp|signature|modelVersionId)) bilden.
- Root optional als DLM1/OP_RETURN verankern (SPV‑prüfbar). Inclusion‑Proof liefert “existence at time”.

Nicht‑Ziele
- Kein per‑Output On‑Chain Publish (Batches, z. B. minütlich).
- Keine Klartext‑Payload; nur Hashes.

API
- GET /models/:id/anchors
  - 200: { items: [{ root: string, anchoredAt: number, versionId?: string, txid?: string }] }

DB‑Schema
CREATE TABLE IF NOT EXISTS model_anchors (
  anchor_id TEXT PRIMARY KEY,
  model_version_id TEXT NOT NULL,
  merkle_root TEXT NOT NULL,
  anchored_at INTEGER NOT NULL,
  version_id TEXT,
  txid TEXT
);
CREATE INDEX IF NOT EXISTS idx_model_anchors_model ON model_anchors(model_version_id, anchored_at);

Worker
- Collect proofs → build tree → root
- Mode synthetic: nur persist root
- Mode advanced: /submit/dlm1 (+ /submit) oder direkte OP_RETURN (falls vorhanden) → txid/versionId speichern

Proof‑Format
- leaf = sha256(concatHex(modelVersionId,inputHash,outputHash,nonce,timestamp,signature))
- path = [{ hash, pos: "L"|"R" }...], rootHex

DoD
- Anchors erzeugt im INTERVAL; Inclusion‑Proof verifizierbar; advanced‑Root SPV‑prüfbar.

Akzeptanz
- Good/Bad proofs; SPV‑Kette (falls verfügbar).

Artefakte
- Merkle‑Proof Spezifikation + Beispiel.

Risiken
- Broadcast down → Retry mit Backoff, DLQ; limits (batch size/window) konfigurieren.

ENV
- ANCHOR_MODE=synthetic|advanced
- ANCHOR_INTERVAL_SEC=60
- ANCHOR_BATCH_MAX=1000

