# D16 — Demonstration einer autonomen Agent-zu-Agent (A2A) Wertschöpfungskette

Labels: demo, e2e, autonomy, audit-trail
Assignee: TBA
Estimate: 2 PT

## 1) Zweck
Diese Demonstration zeigt eine vollständige, durchgehende Wertschöpfungskette, orchestriert von autonomen KI-Agenten auf einem offenen Marktplatz (D24). Ziele:
- Agenten treffen autonome Entscheidungen (finden, prüfen, benachrichtigen, optional kaufen/verkaufen).
- Der Prozess erzeugt einen lückenlosen, kryptographisch gesicherten Audit‑Trail (SPV‑erst, vendor‑neutral).
- Die Demo ist generisch und auf beliebige Domänen übertragbar.

## 2) Komponentenüberblick
- Overlay Service (D24) mit:
  - /agents/register, /agents/search, /agents/:id/ping
  - /rules (CRUD) und /rules/:id/run (manuelles Triggern)
  - /jobs (Queue/Status; evidence_json pro Job)
  - In‑Process Worker (führt Actions aus; notify, contract.generate simuliert)
  - Optional aktiv in deiner Instanz: /submit, /bundle, /ready, /price, /pay, /v1/data
- Beispiel‑Agent (Node/TS):
  - Akzeptiert BRC‑31-signierte Webhooks (Header: X-Identity-Key, X-Nonce, X-Signature) und antwortet mit { ok: true }.
- SQLite‑DB:
  - agents (Registry), rules, jobs inkl. evidence_json (Aggregat der Aktionsbelege).
- Signatur/Compliance:
  - Outbound Webhooks des Overlays sind BRC‑31‑signiert (secp256k1).
  - requireIdentity(false) erlaubt optionale identitäts-signierte Aufrufe.

## 3) Voraussetzungen
- Overlay läuft (server.ts), Schema initialisiert.
- Beispiel‑Agent gestartet: npm run agent:example (lauscht auf http://localhost:9099/webhook).
- AGENT_CALL_PRIVKEY im Overlay gesetzt (Pflicht für signierte Webhooks).
- Optional (Advanced): Deine Instanz hat /submit, /price, /pay, /ready, /bundle, /v1/data montiert (siehe 6.5–6.8).

## 4) Akteure (abstrakt)
- Agent A (Produzent): Erzeugt aus einer Eingabe ein erstes Artefakt.
- Agent B (Verarbeiter): Entdeckt A, prüft Vertrauen/Readiness, veredelt → Artefakt B.
- Agent C (Analyst): Entdeckt B, prüft Readiness, erstellt finalen Report.
- Operator (Mensch): Startet Demo, stößt optional Uploads/Payments an, prüft Audit‑Trail.

## 5) Datenfluss‑Varianten
- Minimal (immer verfügbar):
  - Ereignisse werden über Regeln/Jobs orchestriert; notify löst Agent‑Aktionen aus.
  - contract.generate ist simuliert; Evidenz landet im evidence_json des Jobs.
- Erweitert (falls Overlay‑Routen verfügbar):
  - Agenten publizieren Artefakte (/submit), setzen Preise (/price), bezahlen (/pay).
  - Operator bündelt den Herkunftsbeweis (/bundle) mit SPV/Evidence‑Pack; Readiness‑Checks via /ready.
  - Dieser Pfad ist optional und abhängig von deiner Instanzkonfiguration.

## 6) Schritt‑für‑Schritt (Runbook, reproduzierbar)

### 6.1 Setup und Agenten registrieren
- Agent A registrieren (gleiches Schema für B und C; derselbe Webhook ist ok):
```bash
curl -sS -X POST "{{BASE}}/agents/register" \
  -H "content-type: application/json" \
  -d '{
    "name":"Agent-A",
    "capabilities":[{"name":"notify"}],
    "webhookUrl":"http://localhost:9099/webhook"
  }'
```
→ Antwort enthält agentId (z. B. ag_...).

- Optional: Reachability‑Proof
```bash
curl -sS -X POST "{{BASE}}/agents/{agentIdA}/ping"
```

- Verifizieren:
```bash
curl -sS "{{BASE}}/agents/search?q=Agent-A"
```

### 6.2 Regel R_A anlegen (notify auf gefundene Items)
- Erzeuge Regel R_A (findet mind. 1 Item; passe q bei Bedarf an):
```bash
curl -sS -X POST "{{BASE}}/rules" \
  -H "content-type: application/json" \
  -d '{
    "name":"R_A",
    "enabled":true,
    "when":{"type":"ready","predicate":{"eq":{"always":true}}},
    "find":{"source":"search","query":{"q":""},"limit":1},
    "actions":[{"action":"notify","agentId":"{agentIdA}"}]
  }'
```
→ Antwort: ruleId (rl_...).

### 6.3 Regel R_A auslösen (manuelles Enqueue)
```bash
curl -sS -X POST "{{BASE}}/rules/{ruleIdA}/run"
```
→ Antwort: enqueued: N
Hinweis: Wenn N=0, liefert euer searchManifests aktuell keine Treffer (siehe „Hinweise zum Datenbestand").

### 6.4 Jobs überwachen und Evidenz prüfen
- Liste Jobs:
```bash
curl -sS "{{BASE}}/jobs"
```
Erwartung:
- Jobs für ruleIdA gehen queued → running → done.
- evidence_json enthält einen Eintrag mit action: "notify", status < 300, body.ok === true (BRC‑31‑signierter Round‑Trip).
- Falls Agent nicht erreichbar oder Signatur‑Setup fehlt:
  - Worker versucht Retries (exponentiell, begrenzt durch JOB_RETRY_MAX); endzustand: dead mit last_error.

### 6.5 Erweiterung (optional) — A produziert und bepreist
Voraussetzung: Deine Instanz hat /submit und /price montiert. Bodies sind implementierungsspezifisch; bitte die jeweils gültigen Felder in eurer API verwenden.

- Publizieren (Submit): POST /submit mit z. B. contentHash, Metadaten, parentVersionId (z. B. SOURCE-ASSET-01).
- Preis setzen: POST /price (oder /producers/price) für die neue versionId.
- Ergebnis: versionId für A (z. B. INTERMEDIATE-RESULT-A-15).

### 6.6 Regel(n) für Agent B
- R_B: Benachrichtigt Agent B, wenn Ergebnisse von A gefunden werden (Query anpassen):
```bash
curl -sS -X POST "{{BASE}}/rules" \
  -H "content-type: application/json" \
  -d '{
    "name":"R_B",
    "enabled":true,
    "when":{"type":"ready","predicate":{"eq":{"always":true}}},
    "find":{"source":"search","query":{"q":"INTERMEDIATE-RESULT-A"},"limit":1},
    "actions":[{"action":"notify","agentId":"{agentIdB}"}]
  }'
```
- Triggern:
```bash
curl -sS -X POST "{{BASE}}/rules/{ruleIdB}/run"
```
- Beobachten: /jobs → done; evidence_json enthält notify (B wurde angestoßen).

- Erweiterung (falls verfügbar):
  - Vertrauensprüfung: GET /ready?versionId=INTERMEDIATE-RESULT-A-15
  - Kauf/Bezahlung: POST /pay (erhält receiptId)
  - Produktion B: POST /submit mit parentVersionId=INTERMEDIATE-RESULT-A-15 → neue versionId (z. B. INTERMEDIATE-RESULT-B-42)
  - Preis setzen für B (POST /price)

### 6.7 Regel für Agent C
- R_C analog zu R_B, aber mit Query „INTERMEDIATE-RESULT-B" und notify an {agentIdC}.
- Triggern und /jobs überwachen.
- Erweiterung (falls verfügbar):
  - Ready‑Check (GET /ready?versionId=INTERMEDIATE-RESULT-B-42)
  - Kauf (POST /pay)
  - Finales Artefakt publizieren (POST /submit mit parentVersionId=INTERMEDIATE-RESULT-B-42 → FINAL-REPORT-C-99)
  - Preis setzen (POST /price)

### 6.8 Finaler Audit‑Trail
- Minimal:
  - Prüfe /jobs für alle Regeln; evidence_json bildet die A2A‑Abläufe (inkl. BRC‑31‑notify‑Belege) ab.
- Erweitert:
```bash
curl -sS "{{BASE}}/bundle?versionId=FINAL-REPORT-C-99&depth=99"
```
→ Liefert einen kryptographisch gesicherten, lückenlosen Herkunftsnachweis (inkl. Manifeste, Receipts, SPV‑Proofs – sofern in deiner Instanz bereitgestellt).

## Hinweise zum Datenbestand (find.source = "search")
- /rules/:id/run nutzt intern searchManifests(db, { q, datasetId, limit }).
- Wenn enqueued=0 zurückkommt:
  - Seed Daten publizieren (POST /submit), um SOURCE-ASSET-01 und Folgeartefakte (A, B, C) zu erzeugen.
  - Oder find.query.q so anpassen, dass vorhandene Manifeste gefunden werden.
- Der when.predicate wird im Worker‑Skelett nicht ausgewertet; das Triggern erfolgt manuell via /rules/:id/run.

## 7) Definition of Done (DoD)
- E2E‑Minimal:
  - A, B, C sind registriert und über /agents/search auffindbar.
  - Für R_A, R_B, R_C wurde /rules/:id/run ausgeführt.
  - Mindestens eine Regel erzeugt Jobs, die in /jobs auf state=done gehen.
  - evidence_json enthält für notify‑Ereignisse status < 300 und body.ok === true.
- E2E‑Erweitert (falls Routen verfügbar):
  - Für die finale versionId (z. B. FINAL-REPORT-C-99) liefert /bundle eine durchgehende, verifizierbare Kette (Tiefe ≥ 3).
  - Ein Evidence‑Pack (Manifeste, Receipts, SPV‑Proofs) ist vollständig.

## 8) Abnahmekriterien
- Registry/Auffindbarkeit:
  - /agents/register liefert agentId; /agents/search findet den Agenten per q/capability.
  - /agents/:id/ping aktualisiert Status/lastPingAt.
- Regeln/Queue:
  - /rules CRUD funktioniert; /rules/:id/run liefert enqueued ≥ 0.
  - /jobs zeigt konsistente Zustandsübergänge (queued → running → done | dead).
- Evidenz:
  - evidence_json pro Job enthält Aktionsbelege (insb. notify; optional contract.generate).
  - Bei Erfolg: notify.body.ok === true; bei Fehler: last_error gesetzt; Retries bis DLQ (dead).
- Optional (erweitert):
  - contentHash/Lineage‑Checks über /ready und /bundle laufen ohne Warnungen.
  - Einnahmenbuchung (revenue) korrekt verbucht, sofern Käufe (pay) getätigt wurden.

## 9) Artefakte
- a2a-demo-evidence/ (empfohlen zu erzeugen, z. B. durch ein Skript)
  - agents.json (Registrierungen, Search‑Ergebnisse)
  - rules.json (IDs, Bodies)
  - jobs.json (Zustände, Timestamps)
  - evidence/*.json (pro Job evidence_json)
  - optional: bundle/FINAL-REPORT-C-99.json (vollständiger Herkunftsnachweis)
  - summary.md (Kurzbericht: Versionen, Receipts, Metriken)

## 10) Betrieb/Sicherheit/Compliance
- Webhook‑Signaturen:
  - Overlay signiert Outbound Calls (BRC‑31): X-Identity-Key, X-Nonce, X-Signature.
  - Beispiel‑Agent akzeptiert; Signaturprüfung kann serverseitig ergänzt werden.
- Identität:
  - /agents/register unterstützt optional Identity (requireIdentity(false)).
- Zuverlässigkeit:
  - Worker‑Retries mit exponentiellem Backoff; bei Überschreitung JOB_RETRY_MAX → state=dead.
- Konfiguration:
  - AGENT_CALL_PRIVKEY (Pflicht)
  - AGENT_CALL_PUBKEY (optional; wird sonst abgeleitet)
  - JOB_RETRY_MAX, CALLBACK_TIMEOUT_MS (z. B. 8000 ms)

## 11) Rollback/Risiken
- Gering: Die Demo ist idempotent. Regeln können deaktiviert/gelöscht werden (PATCH enabled=false; DELETE /rules/:id).
- Bei nicht erreichbarem Agenten: Jobs enden in dead, beeinträchtigen aber nicht den Rest.

## 12) Quick‑Checks (Copy & Paste)
- Agents registrieren, Regel anlegen, triggern, Jobs prüfen:
```bash
# A registrieren
curl -sS -X POST "{{BASE}}/agents/register" -H 'content-type: application/json' \
  -d '{"name":"Agent-A","capabilities":[{"name":"notify"}],"webhookUrl":"http://localhost:9099/webhook"}'

# Regel R_A anlegen
curl -sS -X POST "{{BASE}}/rules" -H 'content-type: application/json' \
  -d '{"name":"R_A","enabled":true,"when":{"type":"ready","predicate":{"eq":{"always":true}}},"find":{"source":"search","query":{"q":""},"limit":1},"actions":[{"action":"notify","agentId":"{agentIdA}"}]}'

# Triggern
curl -sS -X POST "{{BASE}}/rules/{ruleIdA}/run'

# Jobs
curl -sS '{{BASE}}/jobs'
```

## 13) Optional: Automatisierung
- Verwende die bereitgestellte Postman/Newman‑Suite oder ein eigenes Skript, das:
  - Agents registriert
  - Regeln anlegt und triggert
  - /jobs pollt bis done/dead
  - evidence_json und summary unter a2a-demo-evidence/ schreibt
- Cleanup: PATCH /rules/:id { "enabled": false }, dann DELETE /rules/:id

Hinweis: Für den erweiterten Pfad (submit/price/pay/ready/bundle) keine Beispiel‑Bodies hier, da payload‑Schemata je nach Instanz variieren. Bitte die gültigen Felder eurer API verwenden. Dieser Leitfaden bleibt dadurch D24‑kompatibel und sofort einsetzbar.