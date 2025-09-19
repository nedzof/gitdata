D16 — Demonstration einer autonomen Agent-zu-Agent (A2A) Wertschöpfungskette

Labels: demo, e2e, autonomy, audit-trail
Assignee: TBA
Estimate: 2 PT

1) Zweck
Diese Demonstration zeigt eine vollständige, durchgehende Wertschöpfungskette, orchestriert von autonomen KI-Agenten auf einem offenen Marktplatz. Ziel:
- Agenten treffen autonome Entscheidungen (finden, prüfen, benachrichtigen, optional kaufen/verkaufen).
- Der Prozess erzeugt einen lückenlosen, kryptographisch gesicherten Audit-Trail.
- Die Demo ist generisch und auf beliebige Domänen übertragbar.

2) Komponentenüberblick
- Overlay Service (D24): Stellt Marktplatz-APIs bereit
  - /agents/register, /agents/search, /agents/:id/ping
  - /rules CRUD + /rules/:id/run (manuelles Triggern)
  - /jobs (Queue-Status)
  - In-Process Worker (führt Actions aus; notify, contract.generate simuliert)
  - Optional bestehende Routen in deiner Instanz: submit, bundle, ready, price, pay
- Beispiel-Agent (Node/TS): Nimmt BRC-31-signierte Webhooks an (X-Identity-Key, X-Nonce, X-Signature) und antwortet mit ok: true.
- SQLite-Datenbank: Registry (agents), Regeln (rules), Jobs (jobs) inkl. evidence_json.
- Signatur/Compliance:
  - Webhook-Aufrufe vom Overlay sind BRC-31-signiert (secp256k1).
  - Registrierung/Calls können optional identity-signed erfolgen (requireIdentity(false)).

3) Voraussetzungen
- Overlay läuft (server.ts), Schema initialisiert.
- Beispiel-Agent gestartet: npm run agent:example (lauscht auf http://localhost:9099/webhook).
- AGENT_CALL_PRIVKEY im Overlay gesetzt (Pflicht für signierte Webhooks).
- Optional: Dein Overlay hat die bestehenden Routen (submit, bundle, ready, price, pay) montiert, damit die Kette „Produzieren–Bepreisen–Bezahlen–Bündeln“ vollumfänglich gezeigt werden kann. Ansonsten läuft die Demo im „Minimalmodus“ (notify + evidenzbasierter Job-Abschluss).

4) Akteure (abstrakt)
- Agent A (Produzent): Erzeugt aus einer Eingabe ein erstes Artefakt.
- Agent B (Verarbeiter): Entdeckt A, vertraut nach Prüfung, veredelt → Artefakt B.
- Agent C (Analyst): Entdeckt B, vertraut nach Prüfung, erstellt finalen Report.
- Operator (Mensch): Startet Demo, stößt optional Uploads/Payments an, prüft Audit-Trail.

5) Datenfluss-Varianten
- Minimal (immer verfügbar): Events werden über Regeln/Jobs orchestriert; notify löst bei Agenten Aktionen aus. contract.generate ist simuliert.
- Erweitert (falls Overlay-Routen verfügbar): Agenten publizieren Artefakte (submit), setzen Preise (price), bezahlen (pay), und der Operator bündelt den vollständigen Herkunftsbeweis (bundle) mit SPV/Evidence-Pack.

6) Schritt-für-Schritt (Runbook, reproduzierbar)

6.1 Setup und Agenten registrieren
- Register Agent A (gleiches Schema für B und C; du kannst denselben Webhook verwenden):
curl -sS -X POST "{{BASE}}/agents/register" -H "content-type: application/json" -d '{
  "name":"Agent-A",
  "capabilities":[{"name":"notify"}],
  "webhookUrl":"http://localhost:9099/webhook"
}'
→ Antwort enthält agentId (z. B. ag_...).
- Optional: /agents/:id/ping vom Agenten (oder simuliert)
curl -sS -X POST "{{BASE}}/agents/{agentIdA}/ping"
- Verifizieren:
curl -sS "{{BASE}}/agents/search?q=Agent-A"

6.2 Regel für Agent A anlegen (notify auf gefundene Items)
- Erzeuge Regel R_A:
curl -sS -X POST "{{BASE}}/rules" -H "content-type: application/json" -d '{
  "name":"R_A",
  "enabled":true,
  "when":{"type":"ready","predicate":{"eq":{"always":true}}},
  "find":{"source":"search","query":{"q":""},"limit":1},
  "actions":[{"action":"notify","agentId":"{agentIdA}"}]
}'
→ Antwort: ruleId (rl_...).

6.3 Regel R_A auslösen (manuelles Enqueue)
- Triggern:
curl -sS -X POST "{{BASE}}/rules/{ruleIdA}/run"
→ Antwort: enqueued: N (falls 0, gibt es derzeit keine Treffer in searchManifests; siehe Hinweis „Daten seeden“ unten).

6.4 Jobs überwachen und Evidenz prüfen
- Liste Jobs:
curl -sS "{{BASE}}/jobs"
- Erwartung:
  - Jobs für ruleIdA gehen queued → running → done (Worker).
  - evidence_json enthält Eintrag action: "notify", status < 300, body.ok === true.
- Falls Agent nicht erreichbar oder Signatur-Setup fehlt: Worker retries (exponentielles Backoff) bis JOB_RETRY_MAX; am Ende state "dead" mit last_error.

6.5 Erweiterung – A produziert und bepreist (wenn vorhanden)
- Publizieren (Submit): POST /submit mit contentHash, parentVersionId (z. B. SOURCE-ASSET-01).
- Preis setzen: POST /producers/price oder /price.
- Ergebnis: versionId für A (z. B. INTERMEDIATE-RESULT-A-15).

6.6 Regel(n) für Agent B
- R_B definiert, dass beim Auffinden von A’s Ergebnissen B benachrichtigt wird:
curl -sS -X POST "{{BASE}}/rules" -H "content-type: application/json" -d '{
  "name":"R_B",
  "enabled":true,
  "when":{"type":"ready","predicate":{"eq":{"always":true}}},
  "find":{"source":"search","query":{"q":"INTERMEDIATE-RESULT-A"},"limit":1},
  "actions":[{"action":"notify","agentId":"{agentIdB}"}]
}'
- Triggern: POST /rules/{ruleIdB}/run
- Beobachten: /jobs → done, evidence_json enthält notify (B wurde angestoßen).
- Erweiterung (wenn verfügbar):
  - Vertrauensprüfung/Readiness: GET /ready?versionId=INTERMEDIATE-RESULT-A-15
  - Kauf/Bezahlung: POST /pay → receiptId
  - Produktion B: POST /submit mit parentVersionId=INTERMEDIATE-RESULT-A-15 → INTERMEDIATE-RESULT-B-42
  - Preis setzen für B

6.7 Regel für Agent C
- R_C analog zu R_B, aber mit Query „INTERMEDIATE-RESULT-B“ und notify auf agentIdC.
- Triggern und /jobs überwachen.
- Erweiterung (falls verfügbar):
  - Ready-Check bis zur Quelle
  - Kauf
  - Finales Artefakt: FINAL-REPORT-C-99 (per /submit mit parentVersionId=INTERMEDIATE-RESULT-B-42)
  - Preis setzen

6.8 Finaler Audit-Trail
- Minimal: Prüfe /jobs für alle Regeln; evidence_json bildet den Ablauf der A2A-Aktion(en) ab (inkl. BRC-31-signierter notify-Belege).
- Erweitert: Vollständiges Bundle (sofern Route vorhanden)
curl -sS "{{BASE}}/bundle?versionId=FINAL-REPORT-C-99&depth=99"
→ Liefert einen kryptographisch gesicherten, lückenlosen Herkunftsnachweis (inkl. Manifeste, Receipts, SPV-Proofs, sofern deine Instanz dies bereitstellt).

Hinweise zum Datenbestand (find.source=search)
- /rules/:id/run nutzt searchManifests(db, { q, datasetId, limit }) intern.
- Wenn enqueued=0 zurückkommt, gibt es aktuell keine Treffer. Seed-Empfehlungen:
  - Bestehende /submit-Route nutzen, um SOURCE-ASSET-01 und Folgeartefakte (A, B, C) zu publizieren.
  - Alternativ die find.query.q anpassen, sodass ein vorhandener Manifest-Eintrag gefunden wird.
- Der when.predicate wird im Worker-Skelett nicht ausgewertet; das Triggern erfolgt manuell via /rules/:id/run.

7) Definition of Done (DoD)
- E2E-Minimal:
  - Alle drei Agenten (A, B, C) sind registriert und über /agents/search auffindbar.
  - Für jede Regel (R_A, R_B, R_C) wurde /rules/:id/run erfolgreich ausgeführt.
  - Mindestens eine Regel hat Jobs erzeugt, die in /jobs auf state=done gehen.
  - evidence_json enthält für notify-Ereignisse status < 300 und body.ok === true (Beleg für BRC-31-signierte Webhook-Roundtrip).
- E2E-Erweitert (falls Routen verfügbar):
  - Für die finale versionId (z. B. FINAL-REPORT-C-99) liefert bundle eine durchgehende, verifizierbare Kette (Tiefe ≥ 3).
  - Ein Evidence-Pack (Manifeste, Receipts, SPV-Proofs) ist vollständig.

8) Abnahmekriterien
- Registry/Auffindbarkeit:
  - /agents/register liefert agentId; /agents/search findet den Agenten per q/capability.
  - /agents/:id/ping aktualisiert Status/lastPingAt.
- Regeln/Queue:
  - /rules CRUD funktioniert, /rules/:id/run enqueued ≥ 0.
  - /jobs listet Einträge mit schlüssigem state-Übergang (queued → running → done | dead).
- Evidenz:
  - evidence_json pro Job enthält Aktionsbelege (notify, ggf. contract.generate).
  - Bei Erfolg: notify.body.ok === true; bei Fehler: last_error gesetzt und Retries bis DLQ (dead).
- Optional (erweitert):
  - contentHash/Lineage-Checks über ready/bundle laufen ohne Warnungen.
  - Einnahmen (revenue_events) für Produzenten werden korrekt verbucht (sofern Teil deiner Instanz).

9) Artefakte
- a2a-demo-evidence/
  - agents.json (Registrierungsantworten, Search-Ergebnisse)
  - rules.json (IDs, Bodies)
  - jobs.json (Zwischenstände, finaler Stand)
  - evidence/ (pro Job die evidence_json extrahiert)
  - optional: bundle/FINAL-REPORT-C-99.json (kompletter Herkunftsnachweis)

10) Betrieb/Sicherheit/Compliance
- Webhook-Signaturen:
  - Overlay signiert mit secp256k1; Header: X-Identity-Key, X-Nonce, X-Signature.
  - Beispiel-Agent akzeptiert Webhooks; Signaturprüfung kann serverseitig ergänzt werden.
- Identität:
  - /agents/register unterstützt optional Identity (requireIdentity(false) → signiert empfohlen).
- Zuverlässigkeit:
  - Worker-Retries mit exponentiellem Backoff; after JOB_RETRY_MAX → state=dead.
- Konfiguration:
  - AGENT_CALL_PRIVKEY (Pflicht)
  - AGENT_CALL_PUBKEY (optional, wird sonst abgeleitet)
  - JOB_RETRY_MAX, CALLBACK_TIMEOUT_MS (Standard 8000 ms)

11) Rollback/Risiken
- Gering: Die Demo ist idempotent. Regeln können gelöscht (/rules/:id DELETE), Jobs laufen aus. Erneute Ausführung ist jederzeit möglich.
- Bei nicht erreichbarem Agenten: Jobs gehen nach Retries in dead und beeinträchtigen nicht den Rest.

12) Automatisierte Verifikation (Postman/Newman)
- Verwende die bereitgestellte E2E-Collection (Agents → Rules → Run → Jobs-Polling → Cleanup).
- Prüft:
  - Agent-Registry/Suche/Ping
  - Regel-Erstellung/Ausführung
  - Jobs bis state=done und notify-evidence ok: true
- Kommandobeispiel:
npx newman run D24-Agent-Marketplace.postman_collection.json -e D24-Local.postman_environment.json --delay-request 250 --timeout-request 15000

Appendix: Beispiel-Requests (copy & paste)

A) Agent registrieren
curl -X POST {{BASE}}/agents/register -H 'content-type: application/json' -d '{
  "name":"Agent-A",
  "capabilities":[{"name":"notify"}],
  "webhookUrl":"http://localhost:9099/webhook"
}'

B) Regel anlegen
curl -X POST {{BASE}}/rules -H 'content-type: application/json' -d '{
  "name":"R_A",
  "enabled":true,
  "when":{"type":"ready","predicate":{"eq":{"always":true}}},
  "find":{"source":"search","query":{"q":""},"limit":1},
  "actions":[{"action":"notify","agentId":"{agentIdA}"}]
}'

C) Regel triggern
curl -X POST {{BASE}}/rules/{ruleId}/run

D) Jobs prüfen
curl -X GET {{BASE}}/jobs

E) Cleanup
curl -X DELETE {{BASE}}/rules/{ruleId}

Hinweise zur Anwendbarkeit
- Diese Vorlage ist absichtlich generisch gehalten. Du kannst die Benennung der Artefakte (SOURCE-ASSET-01, INTERMEDIATE-RESULT-A-15, …) und die Suchabfragen (find.query.q) an dein Fachszenario anpassen.
- Der Minimalpfad funktioniert out-of-the-box mit dem D24-Agent-Marktplatz (notify + Evidenzen). Der erweiterte Pfad nutzt deine bestehenden Overlay-Endpunkte für eine voll ökonomische Wertschöpfung (submit/price/pay/bundle).

Wenn du magst, erstelle ich dir zusätzlich eine schlanke „One-Click“-Makefile- oder npm-Skript-Sequenz, die Setup, Registrierung, Regel-Trigger, Polling und Evidenz-Export automatisiert – inklusive optionaler Datenseeds für die find-Queries.
