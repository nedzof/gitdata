# D25 — Prosumer & Consumer GUI (inkl. Listings/Discovery)

Labels: ui, prosumer, consumer, marketplace, listings, ingest, payments, spv  
Assignee: TBA  
Estimate: 4–6 PT

Zweck
- Eine einfache, webbasierte Oberfläche für Prosumer und Consumer, die die D24-Funktionen bedient und speziell Data Discovery via /listings integriert:
  - Prosumer: Agenten registrieren, Regeln anlegen/triggern, Jobs/Evidence einsehen, Ingest-Streams einspeisen und zertifizieren, ggf. Preise/Payouts verwalten.
  - Consumer: Katalog durchsuchen (Listings), Ready/Bundle ansehen, Zahlungen (optional) durchführen, Downloads starten.
- SPV-first, vendor-neutral: optional BRC-100 Wallet-Connect, BRC-31 Identität für sensible Calls. Keine Indexer-Abhängigkeit.

Nicht‑Ziele
- Kein Fullnode/Explorer, keine On-Chain-Indexierung im Frontend.
- Kein Custodial Wallet, keine Private Keys im Browser.
- Kein umfangreiches CMS; nur das notwendige UI für die Flows.
- Keine KYC/AML-Prozesse (außer optional Identity-Signatur via BRC-31).
- Keine proprietären Abhängigkeiten (vendor-neutral bleiben).

Abhängigkeiten
- D24 Overlay APIs: 
  - Pflicht: /listings, /listings/:versionId, /agents, /rules, /jobs, /watch (SSE)
  - Optional: /ingest/* (D23), /payments/* (D21), /bundle & /ready, /price
- Feature Flags (ENV): FEATURE_FLAGS_JSON z. B. {"payments":true,"ingest":true,"bundle":true,"ready":true,"priceSnippet":false}
- Identität/Wallet: BRC‑31 (optional signierte Calls), BRC‑100 (optional Wallet-Connect)

Zielgruppen & Rollen
- Prosumer (Publisher/Producer/Agent-Operator)
- Consumer (Käufer/Leser/Analyst/Agent)
- Optional Admin (Konfiguration/Monitoring)

Informationsarchitektur (Ansichten)
- Auth
  - Login/Logout (leichte Session), optional Identity-Anzeige (BRC-31 Pubkey), optional Wallet verbinden (BRC-100).
- Dashboard
  - Prosumer: Übersicht zu Agenten, Regeln, Job-Status, letzte Ingest-Events/Zertifizierungen.
  - Consumer: „Shop“-Start mit Listings-Suche/Filter, zuletzt angesehene/gekaufte Items.
- Listings (Consumer, Kern)
  - Liste (/listings): Suchfeld q, optionale Filter (datasetId, producerId), Paging (limit/offset).
  - Karten/Tabellenansicht je Item: versionId, name/description (falls vorhanden), datasetId, producerId, updatedAt; optional Preis-Snippet (Feature-Flag).
  - Detail (/listings/:versionId): Manifest-Kernfelder, Links/Buttons zu Ready (/ready) und Bundle (/bundle), optional Preis-/Quote-CTA, Download-CTA (presigned URL) wenn berechtigt.
  - Empty/Loading/Error States: 200 items:[] (leer), 404 Detail, robuste Fehlermeldungen.
- Agenten & Marketplace (Prosumer)
  - Agent registrieren (/agents/register), suchen (/agents/search), Ping-Status, Agent-Details (Capabilities, Webhook).
- Regeln & Automation (Prosumer)
  - Regeln CRUD (/rules), Trigger (/rules/:id/run), Jobs-Ansicht (/jobs) mit Filter/Details; Evidence-Viewer (notify body.ok etc.).
- Ingest & Certification (Prosumer, optional)
  - Events einspeisen (/ingest/events), Feed (/ingest/feed), Live-Stream (/watch via SSE), Event-Detail (raw/normalized/certified, VersionId).
- Payments (Consumer/Prosumer, optional)
  - Quote (/payments/quote), Submit (/payments/submit), Receipt-Status (/payments/:receiptId).
- Audit & Readiness (optional)
  - Ready-/Bundle-Tabs (nur Anzeige, SPV-first Hinweise), optional Download-Start (presigned URL) nach Pay.

UX/Interaktion (Kernabläufe)
- Consumer Discovery
  - Öffnet Listings → Suche/Filter → wählt Item → sieht Detail → optional Ready/Bundle → ggf. Quote/Pay → Download (presigned).
- Prosumer Automation
  - Agent registrieren → Regel anlegen → Regel triggern → Jobs/Evidence prüfen.
- Prosumer Ingest (optional)
  - Batch posten → Live-Stream beobachen → Event zertifiziert → VersionId sichtbar → erscheint später im Listings-Katalog (abhängig von Index/Sync).

Sicherheit/Compliance
- SPV-first Anzeige (Konf.-Status via /ready, Chain-of-Custody via /bundle).
- Identity: BRC‑31 für sensible Aktionen (optional).
- Wallet: BRC‑100 Connect; keine Private Keys im Browser.
- Rate Limits/Backoff: klare UI-Fehlertexte; keine endlosen Spinner.

Aufgaben
- [ ] IA & Wireframes (low/mid-fidelity) für: Listings-Liste, Listings-Detail, Agenten, Regeln, Jobs, Ingest, Payments.
- [ ] Auth/Session (leichtgewichtig), Identity/Wallet-Anzeige (optional).
- [ ] Listings
  - [ ] Liste: GET /listings mit q, datasetId, producerId, limit/offset; persistente Filter/URL-Params.
  - [ ] Detail: GET /listings/:versionId; Buttons/Links zu /ready, /bundle; Download-CTA (falls berechtigt).
  - [ ] Empty/Loading/Error States; Paginierung.
  - [ ] Optional Preis-Snippet: kleiner Timeout/Degradierung (Feature-Flag: priceSnippet).
- [ ] Prosumer-Views
  - [ ] Agenten: Register/Search/Details/Ping.
  - [ ] Regeln: Liste/Details/Create/Edit/Delete/Run.
  - [ ] Jobs: Liste/Filter/Details; Evidence-Viewer (JSON pretty).
- [ ] Ingest (optional)
  - [ ] Submit-Batch, Feed (paginiert), Event-Detail; SSE Live-View mit Auto-Reconnect & Backoff.
- [ ] Payments (optional)
  - [ ] Quote/Submit Flow (inkl. Idempotenz-Feedback), Receipt-Status-Ansicht.
- [ ] Cross-Cutting
  - [ ] API-Client (BASE_URL), zentrale Error/Retry-Strategie; Loading/Empty/Error Komponenten.
  - [ ] Feature-Toggles (payments, ingest, bundle, ready, priceSnippet).
  - [ ] A11y (Keyboard, ARIA), i18n (de/en minimal).
  - [ ] Telemetrie/Logging (UI-Events, Latenzen, Fehler anonymisiert).
- [ ] Doku
  - [ ] README (ENV, Flags, Rollen/Flows), Screenshots.

Definition of Done (DoD)
- [ ] Listings integriert:
  - /listings zeigt paginierte Treffer; q/Filter funktionieren; Empty State korrekt.
  - /listings/:versionId lädt Details; 404 wird im UI klar angezeigt.
  - Optionales Preis-Snippet degradiert sauber (Timeout → kein Preis, UI bleibt nutzbar).
- [ ] Consumer kann: Item via Listings finden → Detail ansehen → Ready/Bundle (Anzeige) → optional Quote/Submit (dryrun möglich) → Receipt-Status → Download-Link (falls konfiguriert).
- [ ] Prosumer kann: Agent registrieren → Regel anlegen → Regel triggern → Jobs/Evidence ansehen; Fehler (dead Job) werden im UI verständlich dargestellt.
- [ ] Ingest (falls aktiv): Batch → Events im Feed → Live-Updates via /watch → Event-Detail zeigt normalized/certified & VersionId.
- [ ] SPV-first Darstellung: Ready/Bundle ohne Indexer, Proof-/Confs-Status sichtbar.
- [ ] A11y/i18n: Kernflüsse per Tastatur bedienbar; Basis-Übersetzungen de/en.
- [ ] Dokumentation (Setup, Flows, Screenshots) vorhanden.

Abnahmekriterien (Tests)
- [ ] Listings E2E:
  - Liste 200 mit items:[] bei leerem Index; Detail-Request ohne versionId wird übersprungen/abgefedert.
  - Mit Daten: Liste speichert versionId; Detail verifiziert die gleiche versionId.
  - Paging deterministisch (limit/offset).
- [ ] Fehlerfälle: ungültige Params → UI meldet 400; unbekannte ID → 404-Hinweis; Timeout beim Preis-Snippet bricht unkritisch ab.
- [ ] Consumer Flow: Ready/Bundle Anzeige; Payment dryrun (falls aktiv) → Receipt-Status.
- [ ] Prosumer Flow: Jobs laufen done → Evidence (notify body.ok) sichtbar; enqueued=0 wird erklärt.
- [ ] SSE: Live-Events < 2 s sichtbar; Reconnect nach Netzunterbruch.
- [ ] Performance: Erste inhaltsvolle Anzeige < 2 s lokal; UI bleibt responsiv bei API-Fehlern.

Nichtfunktionale Anforderungen
- Einfaches Deployment (statisches Frontend, ENV-gestützt).
- Responsives Layout (Desktop-first, Tablet tauglich).
- Stabilität: Keine UI-Crashes bei API-Fehlern; Rate-Limits freundlich kommuniziert.

Artefakte/Evidence
- Wireframes/Mockups (Listings, Detail, Agenten, Regeln, Jobs, Ingest, Payments).
- Screenshots & kurze GIFs der Kernflüsse.
- UI-Test-Plan (manuell) inkl. Fehlerfälle.
- Beispiel-ENV (.env.example) mit BASE_URL, FEATURE_FLAGS_JSON, DEFAULT_QUERY.
- README (Setup, Flows, Screenshots).

Risiken/Rollback
- Leerer Datenbestand → UI zeigt sinnvolle Empty States; Hinweise zur Datenseed/Find-Query.
- Preis-Fan-Out (falls aktiv) → Feature-Flag, kurze Timeouts, keine Blockade der Liste.
- SSE hinter Proxies → Fallback Polling, Reconnect-Backoff.

ENV (Vorschlag)
- BASE_URL=http://localhost:8788
- FEATURE_FLAGS_JSON={"payments":true,"ingest":true,"bundle":true,"ready":true,"priceSnippet":false}
- UI_DEFAULT_LISTING_QUERY=
- UI_SSE_PATH=/watch
- UI_DOWNLOAD_MODE=presigned|stream
- UI_LOCALE=de|en
- UI_BRANDING_JSON={"title":"D24 Demo","logoUrl":"/logo.svg"}

Hinweise zur D24‑Ausrichtung
- BSV als digitaler Vermögenswert: SPV bleibt maßgeblich; UI zeigt Proof-/Confs-Status, keine Indexer-Abhängigkeit.
- BRC‑31 Identität optional; BRC‑100 Wallet‑Connect als vendor-neutraler Weg.
- UTXO/Idempotenz: Payment‑Flows sauber und deterministisch abbilden.
- Peer‑to‑Peer: Presigned-/SPV-Flows statt serverseitiges Proxy/Indexer-Paradigma.