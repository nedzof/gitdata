# D25 — Prosumer & Consumer GUI (Marketplace, Ingest, Payments)

Labels: ui, prosumer, consumer, marketplace, ingest, payments, spv  
Assignee: TBA  
Estimate: 4–6 PT

Zweck
- Eine einfache, webbasierte Oberfläche, in der Prosumer und Consumer sich anmelden und die Kernabläufe ausführen können:
  - Prosumer: Agenten registrieren, Regeln anlegen/triggern, Jobs/Evidence einsehen, Ingest-Streams einspeisen und zertifizieren, Preise/Payouts verwalten.
  - Consumer: Katalog durchsuchen, Readiness/Audit ansehen, Zahlungen durchführen, Downloads starten.
- SPV-first, vendor-neutral: BRC-100 Wallet-Connect (optional), BRC-31 Identität/Signaturen für relevante Calls, keine Indexer-Abhängigkeit.

Nicht‑Ziele
- Kein Fullnode/Blockchain-Explorer. Keine On-Chain-Indexierung im Frontend.
- Kein Custodial Wallet, keine Speicherung privater Schlüssel im Browser.
- Kein komplexes CMS/Backoffice (nur die minimal nötigen Oberflächen).
- Keine KYC/AML-Workflows (außer optionaler Identity-Signatur via BRC-31).
- Kein proprietäres Vendor-Lock-in; keine Abhängigkeit von zentralisierten Indexern.

Abhängigkeiten
- D24 Overlay APIs: /agents, /rules, /jobs, /watch (SSE), optional /ingest/*, optional /payments/*, optional /bundle & /ready
- D21 (BSV Payments, SPV Reconcile), D23 (Ingest & Certification)
- BRC‑31 (Identity-Signatur) und optional BRC‑100 (Wallet-Connect, vendor-neutral)
- ENV: BASE_URL, FEATURE_FLAGS_JSON (z. B. { payments:true, ingest:true })

Zielgruppen & Rollen
- Prosumer (Publisher/Producer/Agent-Operator)
- Consumer (Käufer/Leser/Analyst/Agent)
- Optional: Admin (nur Konfiguration/Monitoring; kein Pflichtumfang)

Informationsarchitektur (Ansichten)
- Auth
  - Login/Logout (Identity optional, Basic Session ausreichend)
  - Wallet verbinden (optional, BRC-100) und Identität anzeigen (BRC-31-Pubkey)
- Dashboard (kontextabhängig)
  - Prosumer: Kurzübersicht (Agenten, Regeln, Jobs-Status, letzte Ingest-Events, Zertifizierungen)
  - Consumer: Katalog-Suche, letzte Käufe, aktive Downloads
- Agenten & Marketplace (Prosumer)
  - Agent registrieren (/agents/register), Agenten suchen (/agents/search), Ping-Status
  - Agent-Details (Webhooks, Capabilities, Reachability)
- Regeln & Automation (Prosumer)
  - Regeln anlegen/bearbeiten/löschen (/rules CRUD)
  - Manuell triggern (/rules/:id/run)
  - Jobs-Ansicht (/jobs): Filter nach Status/Rule; Evidence-Viewer (notify-Responses, artifacts)
- Ingest & Certification (Prosumer, optional)
  - Events einspeisen (/ingest/events), Feeds einsehen (/ingest/feed)
  - Live-Stream (/watch via SSE) mit Filter
  - Event-Detail (raw → normalized → certified, Evidence, VersionId)
- Zahlungen (Consumer/Prosumer, optional)
  - Quote holen (/payments/quote), Transaktion einreichen (/payments/submit), Status ansehen (/payments/:receiptId)
  - Historie (Quittungen, Payout-Splits sichtbar)
- Audit & Readiness (Consumer/Prosumer, optional)
  - Version-Detail: /ready (Warnungen/Confs), /bundle (Lineage) Anzeige
  - Download-Start (presigned URL oder Fallback)
- Einstellungen
  - API-Endpoint (BASE_URL), Feature-Toggles
  - Identity/Wallet (BRC‑31/BRC‑100) verbinden/trennen

UX/Interaktion (Kernabläufe)
- Prosumer
  - Agent registrieren → Regel anlegen → Regel triggern → Jobs beobachten → Evidence prüfen
  - Ingest-Batch posten → Live-Stream sehen → Event zertifiziert → VersionId sichtbar
  - Optional: Preis-/Payout-Info einsehen (read-only oder Link)
- Consumer
  - Suche/Katalog → Ready prüfen → Quote holen → Signieren/Submit → Download (Presigned URL)
  - Bundle/Lineage als Audit-Ansicht einsehen

Sicherheit/Compliance
- SPV-first Anzeige (Konf.-Zähler, Status-Hinweise aus /ready)
- Identity: BRC‑31 Kopfzeilen für sensible Aktionen (optional)
- Wallet: BRC‑100 Connect (keine privaten Schlüssel im Frontend)
- Rate Limiting/Backoff-Hinweise auf UI (freundliche Fehlertexte)
- Keine Speicherung sensitiver Secrets im Browser-Storage (nur Short-lived Tokens)

Aufgaben
- [ ] Informationsarchitektur & Wireframes (low/mid-fidelity) für alle oben genannten Ansichten
- [ ] Auth/Session (leichtgewichtig), optional Wallet-Connect (BRC‑100)
- [ ] Prosumer-Views
  - [ ] Agenten: Register/Search/Details/Ping
  - [ ] Regeln: Liste/Details/Create/Edit/Delete/Run
  - [ ] Jobs: Liste/Filter/Details, Evidence-Viewer (JSON/pretty)
  - [ ] Ingest: Submit-Batch, Feed (paginiert), Event-Detail (raw/normalized/certified), SSE Live-View
- [ ] Consumer-Views
  - [ ] Suche/Katalog (an Overlay-Suche anbindbar)
  - [ ] Version-Detail: Ready/Bundle Tabs (nur Anzeige)
  - [ ] Payments: Quote/Submit Flow (inkl. Idempotenz-Feedback), Receipt-Status
  - [ ] Downloads: Presigned URL Anzeige + Hinweis zu Gültigkeitsdauer
- [ ] Cross-Cutting
  - [ ] API-Client (BASE_URL), Fehler-/Retry-Strategie, Loading/Empty/Error States
  - [ ] Feature-Toggles (z. B. payments, ingest)
  - [ ] SSE-Client für /watch (Auto-Reconnect, Backoff)
  - [ ] A11y (Keyboard-Navigation, Kontraste), i18n (de/en minimal)
  - [ ] Logging/Telemetry (UI-Events, Fehler, Latenzen anonymisiert)
- [ ] Doku
  - [ ] README (ENV, Feature Flags, Rollen-Überblick)
  - [ ] Screenshots/Flows, Hinweis auf SPV-first und Vendor-Neutralität

Definition of Done (DoD)
- [ ] Prosumer kann: Agent registrieren → Regel anlegen → Regel triggern → Job/Evidence einsehen (status=done mit notify body.ok=true sichtbar).
- [ ] Consumer kann: Ein Element finden → Ready/Bundle sichten (Anzeige) → Quote holen → Submit (dryrun möglich) → Receipt-Status sehen → Download-Link erhalten (falls konfiguriert).
- [ ] Ingest (falls aktiv): Batch-Upload → Events erscheinen in Feed → Live-Updates via /watch → Event-Detail zeigt normalized/certified & VersionId.
- [ ] SPV-first: Ready-/Bundle-Anzeigen funktionieren ohne Indexer; konfigurierter Proof-Status wird UI-seitig klar dargestellt.
- [ ] Fehlerzustände verständlich: enqueued=0, Agent nicht erreichbar (dead Job), Quote abgelaufen (410), Template-Konflikt (409), etc.
- [ ] A11y: Fokus-Reihenfolge, ARIA-Basics, ausreichende Kontraste; i18n en/de Umschaltbar.
- [ ] Dokumentation vorhanden (Setup, Flows, Screenshots).

Abnahmekriterien (Tests)
- [ ] E2E (Prosumer): Agent→Rule→Run→Jobs→Evidence-Check reproduzierbar; ohne Datenbestand zeigt UI sinnvolle Hinweise (keine Treffer/enqueued=0).
- [ ] E2E (Consumer): Suche→Ready/Bundle→Quote→Submit(dryrun)→Receipt-Status; Idempotenz bei erneutem Submit klar signalisiert.
- [ ] SSE: Live-Updates erscheinen < 2 s im UI nach Event-Post; Reconnect nach Netzwerkunterbruch.
- [ ] Zugänglichkeit: Tastaturbedienung der Kernabläufe möglich; Screenreader liest Labels.
- [ ] Performance: Erste inhaltsvolle Anzeige < 2s auf lokaler Dev-Instanz; Netzfehler degradieren elegant.

Nichtfunktionale Anforderungen
- Einfaches Deployment (statisches Frontend + ENV für BASE_URL/Flags)
- Responsives Layout (Desktop-first, Tablet tauglich)
- Stabilität: Kein harter Crash bei API-Fehlern; Rate-Limit-Rückmeldungen im UI

Artefakte/Evidence
- Wireframes (PDF/PNG)
- Screenshots & kurze GIFs der Kernflüsse
- UI-Test-Plan (manuell) inkl. Fehlerfälle
- Beispiel-ENV (.env.example) mit BASE_URL, FEATURE_FLAGS_JSON
- README (Setup, Rollen, Flows)

Risiken/Rollback
- Fehlende Daten/Manifeste → UI zeigt enqueued=0/keine Treffer; Kommunikationshinweise in Regeln/Find-Queries nötig.
- Zahlungen live vs. dryrun → In UI klar kennzeichnen; Dryrun als Default für Dev.
- SSE hinter Proxies/Firewalls → Fallback-Hinweise; Reconnect-Strategie.
- Überfrachtung der UI → Feature-Toggles einsetzen; Minimalumfang beibehalten.

ENV (Vorschlag)
- BASE_URL=http://localhost:8788
- FEATURE_FLAGS_JSON={"payments":true,"ingest":true,"bundle":true,"ready":true}
- UI_LOCALE=de|en
- UI_SSE_PATH=/watch
- UI_POLL_INTERVAL_MS=5000 (Fallback, wenn SSE aus)
- UI_DOWNLOAD_MODE=presigned|stream
- UI_BRANDING_JSON={"title":"D24 Demo","logoUrl":"/logo.svg"}

Hinweise zur D24‑Ausrichtung
- BSV ist ein digitaler Vermögenswert: SPV bleibt maßgeblich. UI zeigt Proof-/Confs-Status, nicht „vertraue dem Indexer“.
- BRC‑31: Identität/Signaturen optional; BRC‑100: Wallet‑Connect (vendor-neutral) als Zukunftspfad.
- UTXO/Idempotenz: Zahlungen und Receipts konsequent als zustandsbasierte Flows abbilden.
- Peer‑to‑Peer: Wo möglich, SPV-/Presigned‑Flows statt serverseitigem Proxy/Indexer.