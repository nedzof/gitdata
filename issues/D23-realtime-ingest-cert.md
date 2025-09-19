D23 — Real-Time Event Ingestion & Certification

Labels: ingest, streaming, publishers, e2e
Assignee: TBA
Estimate: 4 PT

Zweck
- Echtzeit‑Datenströme (Systemevents, Sensor/IoT, Log/Telemetry, API‑Feeds) ingestieren, validieren und als verifizierbare DLM1‑Versionen zertifizieren. Publisher‑Portal + APIs, Live‑Feeds (/watch), Multi‑Source‑Konsolidierung und Auditierbarkeit.

Abhängigkeiten
- D01 (DLM1 Submit), D02 (SPV), D03/D04 (Bundle/Ready), D05–D07 (Price/Pay/Data), D08 (Producers), D11 (Caching), D12 (Limits), D19 (Identity)

Aufgaben
- Ingest‑Layer (Streams & Webhooks)
  - [ ] POST /ingest/events (webhook, identity‑signed optional) — batched JSON/NDJSON
  - [ ] /watch (SSE/WebSocket) — Live‑Events für Clients/Agents (mit Filter/Split)
  - [ ] Adapter: CSV/JSON/NDJSON, generic REST pull (poller), MQTT/AMQP/Kafka bridge (optional worker)
  - [ ] Dedup & Ordering: eventId/sourceId/timestamp, idempotente Upserts
- Normalisierung & Validierung
  - [ ] Mapping Policy (JSON): field mapping, required fields, coercion
  - [ ] Plausibilitäts‑Regeln & Constraints (e.g., monotonicity, bounds, schema)
  - [ ] Multi‑Source Konsens (Quorum/Priority); Konfliktprotokoll (audit trail)
- Zertifizierung (Publishing)
  - [ ] On‑the‑fly oder Batch‑Publish: DLM1‑Manifeste je Aggregat (z. B. “event packet”, “window”, “rollup”)
  - [ ] contentHash (payload hash), lineage.parents (Vorversion/Inputs), provenance.producer.identityKey (Publisher)
  - [ ] POST /submit/dlm1 (identity‑signed) → OP_RETURN; danach POST /submit (rawTx)
  - [ ] Preisregeln optional (D09), Version/Producer‑Mapping (D08)
- Live‑Feeds & Caching
  - [ ] /feed?sourceId&filter=… (JSON, low‑TTL) + /watch Stream (SSE/WS) mit Backpressure (D12)
  - [ ] Indexierte Suche (/search) & /resolve Integration für frische Versionen
- Publisher‑Portal APIs (generisch)
  - [ ] /publishers/feeds: registrieren/aktualisieren (identity), Secrets/Allowlist (Webhook)
  - [ ] /publishers/streams: listen, publish/unpublish, throttle/quota
  - [ ] /ingest/keys: Rotations‑Endpunkte (secrets, IP allowlist)
- Multi‑Source Fusion & Provenienz
  - [ ] sources Tabelle (Trust‑Gewichte, Reputation), event_source_relations
  - [ ] Fusion‑Policy pro Stream (quorum, priority, tie‑breakers)
- Audit & Observability
  - [ ] Event‑Trace: raw→normalized→certified mit IDs/Hashes
  - [ ] /metrics: ingest/sec, backlog, normalization latency p95, publish latency p95
  - [ ] /health: webhook secret check, queue lag, storage reachability

Definition of Done (DoD)
- [ ] Echtzeit‑Events werden in Sekunden zu zertifizierten DLM1‑Versionen (SPV‑verifiziert); /bundle & /ready grün.
- [ ] Live‑Feed aktualisiert < 2 s E2E; Konflikte werden deterministisch gelöst und protokolliert.
- [ ] Publisher können Feeds registrieren, Secrets rotieren und Streams (de)aktivieren.

Abnahmekriterien (Tests)
- [ ] Simulierter Strom (≥ 10k Events) → Zertifizierungs‑Latenz P95 < 5 s; Gesamtverlustfrei (Dedup+Idempotenz)
- [ ] Konfliktszenario (zwei abweichende Quellen) → ein kanonisches Resultat; Audit‑Trail enthält Begründung/Policy
- [ ] /watch sendet Updates bei Ingest; Backpressure/Rate‑Limits gemäß D12 greifen

Artefakte
- [ ] Event‑Schemas (Beispiele), Mapping‑Policies, Normalisierungs‑Rules
- [ ] Beispiel‑Manifeste, Bundles, Ready‑Belege (JSON); End‑to‑End Log eines zertifizierten Events

Risiken/Rollback
- Out‑of‑order/Clock‑Skew → Buffer & Watermarks; Fallback Batch‑Publish
- Bösartige Quellen → Identity (BRC‑31), IP‑Allowlists, Rate‑Limits (D12), Quarantäne/Advisory (D10)
- Speicher/Queue Backlog → Sichtbarkeit in /metrics + Degradation (Drop to batch)

ENV (Vorschlag)
- INGEST_SOURCES_JSON='[{"id":"feed1","secret":"...","type":"webhook"}]'
- INGEST_ALLOWLIST_CIDRS='["1.2.3.0/24"]'
- WATCH_MAX_CLIENTS=500
- EVENT_BUFFER_MS=750
- NORMALIZE_POLICY_JSON='{"required":["id","ts"],"coerce":{"ts":"iso8601->epoch"}}'
- FUSION_POLICY_JSON='{"strategy":"quorum","min":2,"priority":["sourceA","sourceB"]}'
- PUBLISH_MODE=live|batch
- FEED_CACHE_TTL_MS=1000

Hinweise zur Implementierung (Scoping)
- Start mit Webhook + SSE (Simpel, ohne Broker); Kafka/MQTT optional als Worker
- Normalisierung als isolierter Service/Worker (Job‑Queue), Publish asynchron
- Deterministisches contentHash & lineage (Versionierung) → reproduzierbare Zertifikate
- Reuse bestehende D01/D03/D04 Pfade; keine Indexer‑Abhängigkeit (SPV‑first)

Wenn du möchtest, erstelle ich dir dazu sofort Cursor‑Tasks (Scaffolding) für:
- /ingest/events (Webhook) + /watch (SSE),
- Normalizer‑Worker (in‑process Queue),
- Publisher‑Bridge (build DLM1 → submit builder/receiver),
- Feed Cache & basic /metrics wiring.
