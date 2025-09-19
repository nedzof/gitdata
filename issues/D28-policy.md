# D28 — Policy Filters & Readiness Governance (Listings-/Ready-Integration)

Labels: policy, ready, governance, compliance, discovery  
Assignee: TBA  
Estimate: 3–5 PT

Zweck
- Einheitliche, konfigurierbare Policy-Governance für Readiness-/Kaufentscheidungen bereitstellen.
- Policies (JSON) definieren, evaluieren und an /ready sowie Discovery (/listings) anbinden, um Daten automatisiert zuzulassen, zu warnen oder abzulehnen.
- Unternehmensweite Leitplanken für Provenienz, Inhalt, Compliance, Ökonomie, Datenqualität, MLOps und Sicherheit als maschinenlesbare Regeln durchsetzen.

Nicht‑Ziele
- Kein Volltext-/KI-Policy-Reasoner; keine freie Codeausführung.
- Keine On-Chain-Indexierung im Frontend; SPV/Bundle/Ready bleiben maßgeblich für Trust.
- Keine proprietären Vendor-Locks; Policies bleiben vendor-neutral, JSON-basiert.

Abhängigkeiten
- D02 (SPV) – Konfirmationen, Proof-Verifikation
- D03/D04 (Bundle/Ready) – Lineage/Audit-Basis
- D17 (Listings) – Discovery-Ansichten, optionale Policy-Hinweise in Listings
- D12 (Limits) – Rate Limits/Backoff bei Evaluierung
- D24 Overlay – bestehende Routen, Manifest-/Lineage-Zugriff, searchManifests

Begriffe
- Policy: JSON-Dokument mit Attributen/Constraints, die auf ein Zielobjekt (versionId) und dessen Lineage/Metadaten angewandt werden.
- Decision: Ergebnis einer Evaluierung: allow | warn | block, inkl. Begründungen (reasonCodes) und Hinweisen (hints).
- Severity/Reason Codes: standardisierte, maschinenlesbare Gründe (z. B. POLICY.PRODUCER.NOT_ALLOWED).

Policy-Modell (JSON)
- Evaluationsmodus: Alle zutreffenden Regeln prüfen; höchste Schwere gewinnt (block > warn > allow).
- Standard-Felder (Auszug, alle optional):
  - minConfs: number
  - classificationAllowList: string[]
  - allowRecalled: boolean
  - producerAllowList: string[] (pubkeys/ids)
  - producerBlockList: string[]
  - maxLineageDepth: number
  - requiredAncestor: string (versionId)
  - requiredSchemaHash: string
  - requiredMimeTypes: string[]
  - requiredOntologyTags: string[]
  - licenseAllowList: string[]
  - piiFlagsBlockList: string[]
  - geoOriginAllowList: string[]
  - maxPricePerByte: number
  - maxTotalCostForLineage: number
  - maxDataAgeSeconds: number
  - minProducerUptime: number (e.g. 99.9)
  - requiresBillingAccount: boolean
  - minRowCount / maxRowCount: number
  - maxNullValuePercentage: number
  - requiredDistributionProfileHash: string
  - maxOutlierScore: number
  - minUniquenessRatio: number
  - requiredFeatureSetId: string
  - requiresValidSplit: boolean ("train"|"val"|"test" tags)
  - maxBiasScore: number
  - maxDriftScore: number
  - requiredParentModelId: string
  - blockIfInThreatFeed: boolean
  - minAnonymizationLevel: { type: "k-anon"|"dp", k?: number, epsilon?: number }

Evaluationsdaten (Quellen)
- Zielmanifest: Metadaten (policy/license/classification/mime/tags/contentHash/createdAt)
- Lineage: parents[] bis maxLineageDepth (via Bundle/Index)
- Producer: identityKey, uptime (aus Registry/Telemetry), payout-/Pricing-Metadaten
- Preis/Ökonomie: pricebook, unitPrice, size → price/byte
- Qualität/Profil: manifest.stats (rowCount, null%, uniqueness, outlierScore, profileHash)
- MLOps: manifest.features/featureSetId, splitTag, modelIds
- Security: Threat-Feeds (optional), geo-origin tags, PII-flags
- SPV: confirmations (SPV), recalled flags, advisories

Schnittstellen & Integration
- Neue Ressourcen
  - Policies Registry (optional): /policies CRUD
    - policy_id, name, enabled, policy_json, created_at, updated_at
  - Policy Evaluate: POST /ready/policy-eval
    - body: { versionId, policy?: PolicyJSON, policyId?: string }
    - returns: { decision: "allow"|"warn"|"block", reasons: string[], warnings?: string[], evidence: any }
- Bestehende Ressourcen (erweitert, optional)
  - GET /ready?versionId=&policyId=
    - optionaler policyId-Parameter; wenn gesetzt, wird Policy angewandt und Decision in response aufgenommen.
  - GET /listings (Discovery)
    - optionaler policyPreview=true: liefert pro Item eine leichte Policy-Prognose (allow/warn/block) ohne teure Aufrufe (nur einfache Felder, kein SPV-Rekurs).
- Evidence
  - Für jede Evaluierung: evidence_json mit geprüften Attributen, Grenzwerten und Trefferlisten (z. B. ancestorId match, producer blocked).

Entscheidungslogik (Kurzform)
- allow: alle harten Constraints erfüllt; ggf. warnings vorhanden (soft constraints)
- warn: keine harten Blocker, aber Soft-Policy verletzt (z. B. minProducerUptime knapp unterschritten)
- block: harte Constraints verletzt (z. B. producerBlockList hit, PII-Flag geblockt, minConfs nicht erfüllt, Threat-Feed Match)

Tasks
- [ ] Policy-Datenmodell und Registry
  - [ ] Tabelle policies (policy_id, name, enabled, policy_json, created_at, updated_at)
  - [ ] Endpunkte: POST/GET/PATCH/DELETE /policies
- [ ] Policy-Evaluator (Server)
  - [ ] Evaluations-Pipeline mit klarer Reihenfolge:
        1) SPV/Confs/Recall
        2) Provenance/Lineage (producer allow/block, requiredAncestor, maxLineageDepth)
        3) Compliance/Legal (license allow, PII flags, geo origin)
        4) Content/Schema (schema hash, mime, ontology tags)
        5) Ökonomie/Betrieb (price per byte, total lineage cost, data age, uptime, billing)
        6) Qualität/Profil (rowCount/null%/uniqueness/outlier/profileHash)
        7) MLOps (featureSetId/split/bias/drift/parentModelId)
        8) Security (threat feed, anonymization level)
        9) Aggregation → Decision
  - [ ] Reason Codes & Hints (z. B. POLICY.PRODUCER.NOT_ALLOWED; POLICY.PII.BLOCKED; POLICY.SPV.CONFS_TOO_LOW)
  - [ ] Caching (short TTL) für wiederkehrende, teure Subchecks (z. B. pricebook, uptime-stats)
- [ ] /ready Integration
  - [ ] policyId Query-Param unterstützen; Response um decision + reasons + evidence ergänzen
  - [ ] Fallback: ohne policyId bleibt bestehendes Verhalten unverändert
- [ ] /listings Integration (Preview)
  - [ ] policyPreview=true → günstige Heuristik (ohne volle SPV/Lineage), z. B. licenseAllowList, classificationAllowList, producerAllowList
  - [ ] UI-Hinweisflag: previewDecision ist „unverbindlich“; finale Entscheidung in /ready
- [ ] Tests
  - [ ] Unit-Tests je Kategorie (Positiv/Negativ/Warn)
  - [ ] E2E: policyId in /ready blockiert/warnt/erlaubt erwartungskonform; evidence enthält Treffer
  - [ ] Performance: p95 < 300 ms pro /ready (ohne heavy bundle), p95 < 150 ms für /listings?policyPreview=true
- [ ] Doku
  - [ ] Policy-JSON-Referenz mit Beispielen
  - [ ] Reason-Code-Liste und Schwere-Mapping
  - [ ] Beispiel-Policies (siehe unten)
  - [ ] Hinweise zur Kombination mit SPV/Bundle und Agenten-Workflows

Definition of Done (DoD)
- [ ] /policies CRUD verfügbar; policy_json wird validiert (Schema OK).
- [ ] /ready akzeptiert optional policyId und liefert decision + reasons + evidence.
- [ ] /listings unterstützt policyPreview=true (Feature-Flag); Ergebnis degradiert bei Fehlern sauber.
- [ ] Evaluator deckt die in diesem Deliverable beschriebenen Kategorien ab (mind. je ein Testfall pro Kategorie).
- [ ] Reason Codes dokumentiert, Evidence enthält geprüfte Felder und Grenzwerte.
- [ ] Performance-/Cache-Budgets dokumentiert.

Abnahmekriterien (Tests)
- [ ] Provenance: producerAllowList lässt zu; producerBlockList blockt; requiredAncestor trifft; maxLineageDepth greift.
- [ ] Compliance: licenseAllowList durchgesetzt; piiFlagsBlockList blockt; geoOriginAllowList filtert.
- [ ] Content: requiredSchemaHash exact match; requiredMimeTypes enforced; requiredOntologyTags geprüft.
- [ ] Ökonomie: maxPricePerByte, maxTotalCostForLineage greifen; maxDataAgeSeconds blockt alte Daten; minProducerUptime warn/block.
- [ ] Qualität: minRowCount/maxRowCount; maxNullValuePercentage; requiredDistributionProfileHash; maxOutlierScore; minUniquenessRatio.
- [ ] MLOps: requiredFeatureSetId; requiresValidSplit; maxBiasScore; maxDriftScore; requiredParentModelId.
- [ ] Sicherheit: blockIfInThreatFeed; minAnonymizationLevel.
- [ ] /listings?policyPreview=true liefert Flags ohne den /ready‑Pfad zu brechen.

Artefakte/Evidence
- Beispiel-Policies (JSON)
- Postman-Sammlung: /policies CRUD, /ready mit policyId, /listings mit policyPreview
- Testberichte (Positiv/Negativ/Warn), Performance-Metriken
- README „Policy & Readiness Governance“

Risiken/Rollback
- Zu strikte Policies → hohe Blockrate: Feature-Flag & Staging; zunächst warn statt block.
- Performance bei tiefer Lineage → Cache & Grenzwerte (maxLineageDepth).
- Externe Feeds instabil → Timeouts/Degradation auf „warn“ statt „block“, klar dokumentiert.
- Uneinheitliche Manifestfelder → defensives Parsing; nur verfügbare Felder nutzen.

ENV (Vorschlag)
- POLICY_PREVIEW_ENABLE=true|false
- POLICY_PREVIEW_TTL_SEC=30
- POLICY_DEFAULT_ID=pol_default (falls kein policyId übergeben)
- POLICY_HEAVY_CHECKS_ENABLE=true|false (schaltet kostenintensive Checks global)
- THREAT_FEED_URL=https://…
- UPTIME_SOURCE_URL=https://…
- PRICEBOOK_TTL_SEC=60

Beispiel-Policy (Ultra-Policy)
- Bank/Frankfurt: strenge Compliance, nur EU, strenge PII-Verbote, ökonomische Limits.

{
  "minConfs": 12,
  "classificationAllowList": ["restricted"],
  "allowRecalled": false,
  "producerAllowList": ["internal-fraud-department-key", "verified-partner-feed-key"],
  "requiredAncestor": "Q1-2024-AUDITED-TRANSACTIONS",
  "requiredSchemaHash": "b3a4c1...",
  "licenseAllowList": ["Internal-Banking-Use-Only"],
  "piiFlagsBlockList": ["has_customer_name", "has_address"],
  "geoOriginAllowList": ["EU"],
  "maxPricePerByte": 0.5,
  "maxTotalCostForLineage": 250000,
  "maxDataAgeSeconds": 3600,
  "minProducerUptime": 99.9,
  "requiresBillingAccount": true,
  "minRowCount": 1000000,
  "maxNullValuePercentage": 1.0,
  "requiredDistributionProfileHash": "pf_01ab..",
  "maxOutlierScore": 3.5,
  "minUniquenessRatio": 0.98,
  "requiredFeatureSetId": "fraud-features-v3",
  "requiresValidSplit": true,
  "maxBiasScore": 0.2,
  "maxDriftScore": 0.15,
  "requiredParentModelId": "bert-v3.1-internal",
  "blockIfInThreatFeed": true,
  "minAnonymizationLevel": { "type": "k-anon", "k": 5 }
}

Beispiel-Reason Codes (Auszug)
- POLICY.SPV.CONFS_TOO_LOW
- POLICY.PRODUCER.NOT_ALLOWED / BLOCK_LISTED
- POLICY.LINEAGE.MISSING_ANCESTOR / TOO_DEEP
- POLICY.COMPLIANCE.PII_BLOCKED / LICENSE_NOT_ALLOWED / GEO_NOT_ALLOWED
- POLICY.CONTENT.SCHEMA_MISMATCH / MIME_NOT_ALLOWED / TAGS_MISSING
- POLICY.ECON.PRICE_PER_BYTE_EXCEEDED / LINEAGE_COST_EXCEEDED / DATA_TOO_OLD / UPTIME_TOO_LOW / BILLING_REQUIRED
- POLICY.QA.ROWS_TOO_FEW / NULL_PERCENT_EXCEEDED / PROFILE_HASH_MISMATCH / OUTLIER_TOO_HIGH / UNIQUENESS_TOO_LOW
- POLICY.MLOPS.FEATURE_SET_MISSING / SPLIT_INVALID / BIAS_TOO_HIGH / DRIFT_TOO_HIGH / PARENT_MODEL_MISMATCH
- POLICY.SEC.THREAT_FEED_BLOCK / ANON_LEVEL_TOO_LOW

UI-/Listings-Integration (D25-Abgleich)
- Listings-Liste: farbige Badges (allow/warn/block) bei policyPreview=true; Tooltip mit Haupt-ReasonCode.
- Listing-Detail: Tab „Readiness & Policy“ – Ergebnis von /ready?versionId=&policyId= inkl. Evidence.
- Filter (Client) optional: „nur allow“, „warn einschließen“, „block ausblenden“.

Hinweise zur Umsetzung
- Evaluator kann auf eure bestehende Predicate-Logik (and/or/eq/includes…) aufbauen, aber ohne String‑Eval (sandboxed).
- Für tiefe Lineage-Abfragen ggf. pragmatische Grenzen setzen (z. B. maxLineageDepth ≤ 10) und SPV-/Bundle-Ergebnisse cachen.
- Startet konservativ: Warn-Modus als Default, Block erst nach Monitoring-Phase aktivieren.

Wenn gewünscht, liefere ich eine kleine Postman‑Sammlung für /policies CRUD und /ready mit policyId, sowie UI‑Hinweise für D25 (Badges/Filter in Listings).