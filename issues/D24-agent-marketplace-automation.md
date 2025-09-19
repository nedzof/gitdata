# D24 — Agent Marketplace & Automation

Labels: agents, automation, marketplace
Assignee: TBA
Estimate: 4–5 PT

Zweck
- Generisches Agenten‑Ökosystem aufbauen: Registrierung, Capability‑Discovery, deklarative Regeln/Workflows und sichere Ausführung.
- Beispielnutzen: “Finde Ressourcen/Events/Daten, die Kriterium X erfüllen → erstelle Angebot/Vertrag → führe Folgeaktionen aus (Preis setzen, zahlen, benachrichtigen, publizieren)”.
- Netzwerkeffekt: Mehr Agenten → mehr Automatisierung → mehr Plattformwert.

Abhängigkeiten
- D01 (DLM1 Submit), D02 (SPV), D03/D04 (/bundle, /ready), D05/D09 (Price/Pricebook), D06/D07 (Pay/Data), D08 (Producers), D11 (Caching), D12 (Limits), D19 (Identity), D21 (BSV Payments, optional), D23 (Realtime Ingest, optional)

Technische Architektur (Kurz)
- Rule DSL (deklarativ): “find where <predicate> then <actions>”
- Agent Registry & Discovery: Fähigkeiten, Inputs/Outputs, Webhook/Task‑Interface
- Job Orchestrator: Queue, Retry/Backoff, Idempotenz, Dead Letter
- Templates: Angebote/Verträge/Dokumente (optional DLM1 verankern)
- Identity & Policy: BRC‑31 Headers, Allowlist, Rollen
- Zahlungen: Preis/Payout (D21/D09), Quittungen (D06), optional on‑chain Anker
- Audit & Evidence: Artefakte/Logs, SPV‑verifizierbare Outputs (DLM1) falls publiziert

Aufgaben
- Agent Registry & Discovery
  - [ ] POST /agents/register (identity‑signed): { name, capabilities:[{name, inputs, outputs}], webhookUrl, publicKey? }
  - [ ] GET /agents/search?q&capability=… (Filter/Tags), GET /agents/:id (Profil)
  - [ ] Health/Ping: POST /agents/:id/ping (Signaturprüfung), Status in /metrics
- Rule DSL & Workflows
  - [ ] /rules: create/list/update/enable; DSL JSON wie:
        {
          "name":"my-rule",
          "when": { "type":"ready", "predicate":"(price < 1000) && (tags includes 'premium')" },
          "find": { "source":"search|resolve|feed", "query":{ ... } },
          "then": [
            { "action":"notify", "agentId":"...", "payload":{ ... } },
            { "action":"contract.generate", "templateId":"...", "vars":{ ... } },
            { "action":"price.set", "versionId":"...", "satoshis":1234 },
            { "action":"pay", "versionId":"...", "quantity":1 }
          ]
        }
  - [ ] Policy Guards: Max concurrency, time windows, allowlists
- Job Orchestrierung
  - [ ] /jobs: enqueue/list/status → Zustandsautomat (queued, running, done, failed, dead)
  - [ ] Retry/Backoff (exponential), Dead‑letter mit Ursache
  - [ ] Idempotenz: jobKey (ruleId + targetId), dedup
- Agent Execution/Callbacks
  - [ ] Webhook‑Aufrufe mit BRC‑31 Headers (body+nonce signieren)
  - [ ] Agent antwortet: { ok, artifacts:[{type,url|bytes,hash}] }
  - [ ] Artefakte optional als DLM1 publizieren (publish action) → /submit‑builder/receiver
- Integration mit Preis/Zahlung
  - [ ] price.set (D05/D09), price.rules (D09), pay (D06/D21)
  - [ ] Ergebnis/Ausgangszahlungen (overlay/producer splits, D21)
- Sicherheit & Identity
  - [ ] BRC‑31‑Signatur erzwingen auf /agents/*, /rules/*, /templates/* (ENV‑Flag)
  - [ ] Rate‑Limits (D12), Rollen/Scopes (admin/publisher/agent)
- Audit, Evidence & Observability
  - [ ] Evidence Pack pro Job: inputs, agent calls, outputs, (optional) DLM1 versionIds
  - [ ] /metrics: jobs/sec, successRate, p95 Dauer, DLQ Count, agent RTT
  - [ ] /health: Queue‑Lag, Agent‑Reachability

Definition of Done (DoD)
- [ ] Agenten registrierbar & auffindbar; Health/Ping sichtbar.
- [ ] Regeln triggern automatisch passende Jobs (search/resolve/feed) und führen Aktionen deterministisch aus.
- [ ] Jobs idempotent, retry‑fähig, mit Dead‑letter; Artefakte/Dokumente generierbar; optional DLM1/publish.
- [ ] Identity‑Signatur geprüft; Policies (Rate, Concurrency) greifen; Audit/Evidence per Job vorhanden.

Abnahmekriterien (Tests)
- [ ] Happy Path: rule(find) → notify(agent) → generate(contract) → price.set → pay → (optional publish) → evidence ok
- [ ] Negativ: Agent down → Retry → DLQ nach N Versuchen; Replay (duplizierter Trigger) → idempotent
- [ ] Performance: p95 job end‑to‑end < X s (konfigurierbar); Backpressure greift bei Last

Artefakte
- [ ] Rule DSL Beispiele, Agent Beispiel (Webhook), Contract‑Vorlagen, Evidence JSON (Job Trace)
- [ ] Postman/Newman Flows: register → rule → trigger → job → outputs
- [ ] Beispiel‑Konfigurationen (ENV) & Policies

Risiken/Rollback
- Endlosschleifen: rule guards, idempotent keys, TTL
- Sicherheitsoberfläche: Strikte BRC‑31, Allowlist für Callback‑Domains, Rate‑Limits
- Complex Coordination: Rückfall auf menschliche Freigaben (action: “review”) für kritische Pfade

ENV (Vorschlag)
- AGENT_IDENTITY_REQUIRED=true|false
- RULES_MAX_CONCURRENCY=10
- JOB_RETRY_MAX=5
- JOB_BACKOFF_JSON={"baseMs":500,"factor":2,"maxMs":30000}
- CALLBACK_TIMEOUT_MS=8000
- EVIDENCE_STORE=fs|s3
- CONTRACT_TEMPLATES_DIR=./data/templates
- ACTIONS_ALLOWLIST_JSON=["notify","contract.generate","price.set","pay","publish","custom:*"]

Hinweise zur Implementierung (Scoping)
- Start mit einfachen Quellen (search/resolve) und notify/contract.generate/price.set Actions; pay/publish als optionale Schritte.
- Agent‑Webhooks zuerst synchron (HTTP) mit Timeout/Retry; später Async‑Queue erweiterbar.
- Artefakt‑Publikation als DLM1 optional (nur wenn SPV/On‑Chain Nachweis gewünscht).
- Einheitliche Evidence‑Logs (JSON) pro Job für schnelle Audits und Reproduzierbarkeit.

Wenn du möchtest, generiere ich dazu direkt Cursor‑Tasks (Scaffolding) für:
- /agents/register/search, /rules CRUD, /jobs queue,
- webhook‑Aufrufer mit BRC‑31 Signatur,
- ein Beispiel‑Agent (Node/TS) und Rule‑DSL Parser + Evaluator.
