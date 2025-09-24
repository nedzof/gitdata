D29 — Model Provenance & Reverse Lineage (AI Hash → Training Inputs)
Labels: models, provenance, lineage, spv
Assignee: TBA
Estimate: 3–5 PT

Zweck/Scope
- Modelle per AI‑Hash (sha256 der Gewichte) als DLM1‑Versionen ankern (synthetic oder advanced).
- Reverse Lineage via /bundle darstellen (Train/Val/Test/Features, parents oder rollupHash).
- Minimaler, vendor‑neutraler, SPV‑konformer Nachweis: was wurde trainiert, worauf basiert es.

Nicht‑Ziele
- Kein Upload von Weights; nur Hash/Metadaten/Manifeste.
- Keine Qualitäts-/Benchmarkaussagen; nur Herkunft/Verifizierbarkeit.

Abhängigkeiten
- D24 Basis (Express + SQLite), optional: /submit/dlm1 + /submit (advanced), D03/D04 (bundle/ready).

API (Requests/Responses; alle JSON)
- POST /models/connect
  - Body schema:
    {
      modelHash: string (^[0-9a-f]{64}$),
      framework?: string,
      sizeBytes?: number,
      tags?: any[],
      trainingIndex?: {
        parents?: string[],
        rollupHash?: string (^[0-9a-f]{64}$),
        split?: { train?: string[], val?: string[], test?: string[] }
      },
      anchorMode?: "synthetic"|"advanced" // optional override, sonst ENV
    }
  - 200:
    {
      status: "ok",
      modelVersionId: string,
      trainingIndexVersionId?: string|null,
      mode: "synthetic"|"advanced",
      evidence: { manifests: { training?: object|null, model: object } }
    }
  - 400/409: bad-request/duplicate
- GET /models/search?q&limit=20&offset=0
  - 200: { items: [{ modelVersionId, modelHash, trainingIndexVersionId, framework, sizeBytes, tags, createdAt }] }
- GET /models/:id
  - 200: { modelVersionId, modelHash, trainingIndexVersionId, framework, sizeBytes, tags, createdAt }
  - 404
- GET /models/:id/lineage → Proxy /bundle?versionId
  - 200: bundle JSON
  - 502: proxy-failed
- GET /models/:id/ready?policyId=
  - 200: ready JSON (Decision/Evidence via Policy)
  - 502: proxy-failed

DB‑Schema (SQLite)
CREATE TABLE IF NOT EXISTS models (
  model_version_id TEXT PRIMARY KEY,
  model_hash TEXT NOT NULL UNIQUE,
  training_index_version_id TEXT,
  framework TEXT,
  tags_json TEXT,
  size_bytes INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_models_hash ON models(model_hash);
CREATE INDEX IF NOT EXISTS idx_models_created ON models(created_at);

Zustandsmodell
- Connect: (input) modelHash → (anchor synthetic/advanced) → persist registry row.
- Search/Get: reine Lesepfade.
- Lineage/Ready: Proxy auf bestehende /bundle, /ready.

Sicherheit/Policy
- Keine Keys im Backend (nur Hashes/Metadaten).
- Optional: requireIdentity() auf POST /models/connect (BRC‑31), Feature‑Flaggesteuert.

Fehler/Rate‑Limits/Idempotenz
- 400: invalid hash/params; 409: duplicate modelHash.
- Rate‑Limits per IP/Identity; 200 idempotent bei erneutem Connect mit identischer Payload.

Observability
- Metrics: models_connect/sec, mode_distribution (synthetic/advanced), lineage_proxy_latency_p95.

Performance
- Connect p95 < 150 ms (synthetic), < 400 ms (advanced builder+submit).
- Search p95 < 100 ms bei 10k rows.

Tests
- Good: synthetic + advanced; rollupHash nur; parents only.
- Negative: invalid hash, duplicate, 404 id.
- Proxy fail: /bundle-/ready‑down → 502.

Artefakte
- Beispielmanifeste (trainingIndex, modelArtifact).
- Postman: connect/search/get/lineage/ready.

Risiken/Rollback
- Große Parents-Liste → rollupHash; advanced‑Down → fallback synthetic.

ENV
- MODEL_ANCHOR_MODE=synthetic|advanced
- OVERLAY_SELF_URL
- MODEL_PRODUCER_IDENTITY_KEY (optional provenance)


