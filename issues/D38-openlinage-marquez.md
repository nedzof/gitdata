Verstanden. OpenLineage soll Pflicht sein, damit Visualisierung und Interoperabilität garantiert sind. Hier ist ein präzises, produktionsreifes Deliverable, das OpenLineage als verbindlichen Standard festschreibt und die gesamte Kette (Emission → Persistenz/Query → UI) normiert. Es bleibt D24‑konform, SPV‑first (Trust via /bundle, /ready), vendor‑neutral und ohne Indexer.

D40 — OpenLineage Pflichtstandard & Visualisierungs‑Vertrag

Labels: openlineage, governance, visualization, backend, interoperability  
Assignee: TBA  
Estimate: 4–6 PT

Zweck/Scope
- OpenLineage (OL) ist ab jetzt der verpflichtende Standard für Lineage‑Events.
- Jede Veröffentlichung/Änderung eines Assets (versionId) muss deterministische OL‑Events erzeugen.
- Die Visualisierung (UI) konsumiert ausschließlich OL‑konforme Lineage‑Queries (entweder via Marquez oder via OL‑Query‑Endpoint).
- SPV‑Prüfung bleibt separat: “Verify” nutzt /bundle (und /ready). OL dient der schnellen, interaktiven Visualisierung.

Nicht‑Ziele
- Keine Abkehr von /bundle und /ready als Quelle der Wahrheit.
- Keine proprietären Lineageformate neben OL.
- Keine PII‑Anreicherung in OL‑Facets.

Pflicht‑Entscheidungen (verbindlich)
- OL‑Emission ist verpflichtend für jeden Publish/Recall.
- Mindestens ein OL‑kompatibler Query‑Pfad muss verfügbar sein:
  - Produktion: Marquez (empfohlen), oder
  - Interner OL‑Query‑Endpoint (siehe unten), der dieselben Abfragen liefert.

1) OL‑Namenskonventionen (deterministisch)
- namespace (global fest): overlay:<env> (z. B. overlay:prod)
- dataset.name = <versionId> (exakt, unverändert)
- job.name = publish::<versionId> (alternativ: publish::<txid>; dann konsequent überall)
- run.runId = <txid> (bevorzugt), ansonsten sha256(versionId|createdAt)
- producer (OL Pflichtfeld): https://<host>/adapter/openlineage/1.0 (statisch, versionsiert)

2) OL‑Event‑Lebenszyklus (Minimalfolge)
- OPTIONAL: RUN_START
- RUN_COMPLETE (verpflichtend), sobald Publish erfolgt ist
- OPTIONAL: lifecycle change (Recall/Withdraw): Custom‑Facet lifecycleStateChange = RETRACTED
- Reorg‑Handling:
  - Konfiguration: minConfs (0 erlaubt sofortige Projektion; >0 wartende Projektion)
  - Falls Reorg → Custom‑Facet reorgFacet: { unstable:true, reason:"reorg" } und Update bei Stabilisierung

3) OL‑Event Schema (Pflichtfelder + erlaubte Facets)
- Pflichtfelder pro Event:
  - eventType: COMPLETE (oder START/ABORT optional)
  - eventTime: ISO
  - producer: URL s. o.
  - job: { namespace, name }
  - run: { runId }
  - inputs: Datasets für alle parents (dataset.namespace=overlay:<env>, dataset.name=<parentVersionId>)
  - outputs: [ Dataset für versionId ]
- Erlaubte (whitelistete) Facets (keine PII):
  - dataset.facets.datasetVersion: { contentHash, createdAt, type:"dlm1" }
  - dataset.facets.dataSource: { name:"gitdata", uri:"https://<overlay>/listings/<versionId>" }
  - run.facets.nominalTime: { nominalStartTime }
  - run.facets.gitdataSpv: { confs, bundleUrl, bundleHash, readyDecision?, readyReasons? }
  - dataset.facets.gitdataProvenance: { producerIdentityKey?, parentsCount?, lineageDepth? }
  - run.facets.lifecycleStateChange (optional): { lifecycleState:"RETRACTED" }
  - run.facets.reorgFacet (optional): { unstable:true, reason }

4) Emission (Adapter/Hook, verpflichtend)
- Trigger: nach erfolgreichem Publish (oder bei “Recall”).
- Quelle: /bundle?versionId=… (Parents; creation info); /ready optional für Decision/Confs.
- Idempotenz: runId‑Upsert (erneute COMPLETE‑Events dürfen keine Duplikate erzeugen).
- Fehler: Retries mit Backoff; DLQ für 5xx/Netzwerkfehler; Metriken.

5) Persistenz & Query (Pflicht‑Vertrag)
Variante A (empfohlen, Produktion): Marquez
- OL‑Events via Marquez API posten (Auth/TLS).
- UI nutzt Marquez Lineage‑API:
  - GET /api/v1/lineage?node=dataset:<namespace>:<versionId>&depth=<n>
  - Oder Jobs‑Lineage API je Version
- Vertrag: UI darf sich auf Marquez‑Schema/Abfragen verlassen; “Verify” getrennt via /bundle.

Variante B (integrierter OL‑Query‑Endpoint; nur wenn Marquez nicht verfügbar)
- Neuer interner Endpoint (Pflicht, wenn Marquez entfällt):
  - GET /openlineage/lineage?node=dataset:<namespace>:<versionId>&depth=<n>
  - Antwortschema kompatibel zur Marquez‑Lineage (Nodes/Edges) oder ein klar spezifiziertes Graph‑Schema (nodes/edges), aber die Quelle MUSS ausschließlich die intern persistierten OL‑Events sein (z. B. Datei‑Store/DB).
- UI konsumiert ausschließlich diesen OL‑Query‑Endpoint (nicht /bundle) für Visualisierung.

6) UI‑Verbrauch (D37 Abgleich)
- Visualize Tab: konsumiert OL‑Lineage Query (Marquez ODER /openlineage/lineage).
- Verify Tab: konsumiert /bundle (SPV) + /ready (Policy).
- Tiefer Laden: depth Parameter (maxDepth begrenzen), progressive Expansion.
- SPV‑/Policy‑Badges aus Facets (gitdataSpv.readyDecision etc.) anzeigen; Disclaimer: “Cache/OL Visualisierung – kryptographischer Proof via Verify”.

7) Sicherheit/Compliance (Pflicht)
- Schreibzugang OL‑Sink (Marquez/OL‑Store): Token + IP‑Allowlist.
- Facet‑Whitelist strikt; keine PII/Sensitiv‑Felder.
- Rate‑Limits: Adapter→Sink; UI→Query.
- Logs ohne Secrets; Debug‑Payloads redaktieren.

8) Observability (Pflicht‑Metriken)
- Adapter:
  - ol_events_sent_total, ol_events_retry_total, ol_dlq_size
  - ol_end_to_end_latency_ms_p95, ol_bundle_fetch_latency_ms_p95
  - ol_reorg_flags_total
- Sink (Marquez/OL‑Store):
  - api_requests_total, api_5xx_total, lineage_query_latency_ms_p95
- UI:
  - lineage_graph