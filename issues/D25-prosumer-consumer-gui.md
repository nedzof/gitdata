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




______________



Klar! Hier ist ein schlanker, SvelteKit‑basierter GUI‑Entwurf, der direkt auf eure D24 Overlay‑APIs (insb. /listings) setzt. Fokus: sofort nutzbare, friktionsarme Suche auf der Startseite, SEO‑freundliches SSR, klare Fehlerzustände. Ich liefere dir:

- Anforderungen, Architektur und Projektstruktur
- ENV/Config
- Kern‑Snippets für SvelteKit (Pages, Server‑Load, API‑Wrapper, UI‑Komponenten)
- Optional‑Hooks für Ready/Bundle (SPV‑first) und Payments (Feature‑Flag, sauber degradiert)

Hinweis: Ich beziehe mich ausschließlich auf eure D24 Endpunkte wie /listings, /listings/:versionId, optional /ready und /bundle. Bitte überprüft die Snippets mit eurer Community.

Ziele
- Startseite zeigt GitData kurz an (Hero), mit direkter Suchleiste über /listings
- Ergebnissliste mit Paginierung (limit/offset) und Detailseite
- SSR‑first (SvelteKit load auf dem Server) für schnelle Time‑to‑Content und SEO
- Keine Keys/Secrets im Client (nur PUBLIC_ Variablen)
- Sanftes Degradieren, wenn optionale Endpunkte fehlen (Ready/Bundle/Payments)

Nicht‑Ziele
- Kein Custodial Wallet; keine Private Keys im Browser
- Kein Indexer im Frontend; SPV/Lineage wird nur angezeigt, wenn Backend bereitstellt
- Kein komplexes CMS; nur die minimalen UI‑Flows

Projektstruktur (SvelteKit)
- src/lib
  - api.ts: Fetch‑Wrapper zu Overlay
  - config.ts: ENV/Flags
  - components/
    - SearchBar.svelte
    - ListingCard.svelte
- src/routes
  - +layout.svelte: Grundgerüst/Branding
  - +layout.server.ts: Feature‑Flags bereitstellen
  - +page.svelte: Home (Hero + Suche)
  - search/+page.server.ts: Listings‑Abfrage
  - search/+page.svelte: Ergebnisliste + Paging
  - listings/[versionId]/+page.server.ts: Detail, optional Ready/Bundle
  - listings/[versionId]/+page.svelte: Anzeige
- static/ (Logo, Favicons)

ENV (.env.local)
- PUBLIC_OVERLAY_BASE_URL=http://localhost:8788
- PUBLIC_FEATURE_FLAGS_JSON={"ready":true,"bundle":true,"payments":false}
- PUBLIC_DEFAULT_QUERY=

Core Snippets

1) src/lib/config.ts
Liest öffentliche ENV und Feature‑Flags.

export const OVERLAY_BASE = import.meta.env.PUBLIC_OVERLAY_BASE_URL || 'http://localhost:8788';

let flags: Record<string, boolean>;
try {
  flags = JSON.parse(import.meta.env.PUBLIC_FEATURE_FLAGS_JSON || '{}');
} catch { flags = {}; }

export const FEATURES = {
  ready: !!flags.ready,
  bundle: !!flags.bundle,
  payments: !!flags.payments,
};

export const DEFAULT_QUERY = import.meta.env.PUBLIC_DEFAULT_QUERY || '';

2) src/lib/api.ts
Sicherer Fetch‑Wrapper (SSR/CSR), nur GETs für Listings/Detail. Optional Ready/Bundle.

import { OVERLAY_BASE } from './config';

async function fetchJson(input: string, init?: RequestInit) {
  const r = await fetch(input, { headers: { accept: 'application/json' }, ...init });
  const txt = await r.text();
  let js: any; try { js = JSON.parse(txt); } catch { js = { raw: txt }; }
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(js)}`);
  return js;
}

export const api = {
  async listings(q = '', limit = 20, offset = 0) {
    const u = `${OVERLAY_BASE}/listings?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`;
    return fetchJson(u);
  },
  async listingDetail(versionId: string) {
    const u = `${OVERLAY_BASE}/listings/${encodeURIComponent(versionId)}`;
    return fetchJson(u);
  },
  async ready(versionId: string) {
    const u = `${OVERLAY_BASE}/ready?versionId=${encodeURIComponent(versionId)}`;
    return fetchJson(u);
  },
  async bundle(versionId: string) {
    const u = `${OVERLAY_BASE}/bundle?versionId=${encodeURIComponent(versionId)}&depth=99`;
    return fetchJson(u);
  }
};

3) src/lib/components/SearchBar.svelte
Einfache GET‑Suche (SvelteKit Form), landet auf /search?q=...

<script lang="ts">
  export let q = '';
</script>

<form method="GET" action="/search">
  <input name="q" placeholder="Suche nach Daten..." value={q} />
  <input type="number" name="limit" value="20" min="1" />
  <input type="number" name="offset" value="0" min="0" />
  <button type="submit">Suchen</button>
</form>

4) src/lib/components/ListingCard.svelte
Einzelnes Listing‑Item mit Link zur Detailseite.

<script lang="ts">
  export let item: any;
</script>

<div class="card">
  <div><strong>{item.versionId}</strong></div>
  <div class="meta">
    datasetId: {item.datasetId || '-'} | producerId: {item.producerId || '-'}
  </div>
  <a href={`/listings/${encodeURIComponent(item.versionId)}`}>Details</a>
</div>

<style>
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin: 8px 0; }
  .meta { color: #6b7280; font-size: 12px; }
</style>

5) src/routes/+layout.svelte
Branding/Navigation. Startet mit GitData Hero.

<script>
  export let data;
</script>

<nav style="padding:10px;border-bottom:1px solid #eee;display:flex;gap:12px;">
  <a href="/">GitData</a>
  <a href="/search">Katalog</a>
</nav>
<slot />

<footer style="padding:12px;color:#666;border-top:1px solid #eee;">
  SPV-first. Vendor-neutral. Powered by D24 Overlay.
</footer>

6) src/routes/+layout.server.ts
Feature‑Flags für Client bereitstellen.

import type { LayoutServerLoad } from './$types';
import { FEATURES } from '$lib/config';

export const load: LayoutServerLoad = async () => {
  return { features: FEATURES };
};

7) src/routes/+page.svelte (Home)
Hero + direkte Suche (friktionsarm).

<script lang="ts">
  import SearchBar from '$lib/components/SearchBar.svelte';
  import { DEFAULT_QUERY } from '$lib/config';
</script>

<section style="padding:20px;">
  <h1>GitData</h1>
  <p>Finde und nutze Daten in Sekunden – ohne Reibung.</p>
  <SearchBar q={DEFAULT_QUERY} />
</section>

8) src/routes/search/+page.server.ts
Serverseitiges Laden der Listings.

import type { PageServerLoad } from './$types';
import { api } from '$lib/api';

export const load: PageServerLoad = async ({ url }) => {
  const q = url.searchParams.get('q') ?? '';
  const limit = Number(url.searchParams.get('limit') ?? '20');
  const offset = Number(url.searchParams.get('offset') ?? '0');

  try {
    const res = await api.listings(q, limit, offset);
    return { q, limit, offset, items: res.items ?? [] };
  } catch (e: any) {
    return { q, limit, offset, items: [], error: String(e?.message || e) };
  }
};

9) src/routes/search/+page.svelte
Ergebnisliste mit Paging.

<script lang="ts">
  export let data;
  import ListingCard from '$lib/components/ListingCard.svelte';

  const q = data.q || '';
  const limit = data.limit || 20;
  const offset = data.offset || 0;
  const items = data.items || [];
</script>

<section style="padding:20px;">
  <h2>Ergebnisse</h2>
  {#if data.error}
    <div style="color:#b91c1c;">Fehler: {data.error}</div>
  {/if}
  {#if items.length === 0}
    <div>Keine Listings gefunden.</div>
  {:else}
    {#each items as it}
      <ListingCard {item} />
    {/each}
  {/if}

  <nav style="margin-top:10px;display:flex;gap:8px;">
    {#if offset > 0}
      <a href={`/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${Math.max(0, offset - limit)}`}>« Zurück</a>
    {/if}
    <a href={`/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset + limit}`}>Weiter »</a>
  </nav>
</section>

10) src/routes/listings/[versionId]/+page.server.ts
Detail + optional Ready/Bundle (Feature‑Flags).

import type { PageServerLoad } from './$types';
import { api } from '$lib/api';
import { FEATURES } from '$lib/config';

export const load: PageServerLoad = async ({ params }) => {
  const versionId = params.versionId!;
  let detail: any = null, ready: any = null, bundle: any = null, errs: string[] = [];
  try {
    detail = await api.listingDetail(versionId);
  } catch (e: any) {
    errs.push(`detail: ${String(e?.message || e)}`);
  }
  if (FEATURES.ready) {
    try { ready = await api.ready(versionId); } catch (e: any) { errs.push(`ready: ${String(e?.message || e)}`); }
  }
  if (FEATURES.bundle) {
    try { bundle = await api.bundle(versionId); } catch (e: any) { errs.push(`bundle: ${String(e?.message || e)}`); }
  }
  return { versionId, detail, ready, bundle, errs };
};

11) src/routes/listings/[versionId]/+page.svelte
Anzeige inkl. SPV‑Hinweisen.

<script lang="ts">
  export let data;
</script>

<section style="padding:20px;">
  <h2>Listing: {data.versionId}</h2>
  {#if data.errs?.length}
    <div style="color:#b45309;">Hinweise: {data.errs.join(' | ')}</div>
  {/if}

  <details open>
    <summary>Detail</summary>
    <pre>{JSON.stringify(data.detail, null, 2)}</pre>
  </details>

  {#if data.ready}
    <details>
      <summary>Ready (SPV/Warnings)</summary>
      <pre>{JSON.stringify(data.ready, null, 2)}</pre>
    </details>
  {/if}

  {#if data.bundle}
    <details>
      <summary>Bundle (Lineage)</summary>
      <pre>{JSON.stringify(data.bundle, null, 2)}</pre>
    </details>
  {/if}
</section>

Setup‑Hinweise
- npm create svelte@latest my-gitdata-ui
- cd my-gitdata-ui && npm i
- Lege die Dateien wie oben an, setze .env.local (PUBLIC_OVERLAY_BASE_URL)
- npm run dev
- Teste: Home → Suche → Liste → Detail; Ready/Bundle nur, wenn vom Overlay bereitgestellt

Qualität/UX
- SSR‑Load sorgt für schnelle Anzeige (kein FOUC)
- Fehler degradieren sanft (keine Blocker bei fehlenden Optionalen)
- Minimal‑CSS inline; du kannst später Tailwind oder ein Design‑System ergänzen
- I18n/A11y: einfache Struktur, semantische Elemente (details/summary), gute Tastatur‑Bedienbarkeit

Erweiterungen (optional)
- Clientseitige Enhance‑Navigation (Progress Bar, Skeletons)
- Preis‑Snippet (Feature‑Flag) per eigenem API‑Call (kurzer Timeout, Caching)
- Payments‑CTA (D21): wenn payments==true, „Jetzt kaufen“ → /payments/quote Flow
- Prosumer‑Tabs (Agents/Rules/Jobs) in separaten Routen analog zu den früheren Snippets

Damit hast du eine SvelteKit‑Startbasis, die GitData auf der Homepage präsentiert und sofortige Datensuche ermöglicht — simpel, friktionsarm, D24‑kompatibel und SPV‑erst.s





Detail-Konzept der einzelnen Bereiche
1. Die Landing Page (/)

    Ein einziges Element: Ein großes, zentriertes Suchfeld mit dem Placeholder "versionId, txid, contentHash...".
    Keine Menüs, keine Bilder, kein Marketing-Blabla. Darunter in kleiner Schrift: "Genius System Explorer. A trust layer for the AI economy. [Docs] [Explorer]".
    Funktion: Gibt man eine ID ein und drückt Enter, wird man direkt zur Explorer-Detailansicht explorer/version/[id] weitergeleitet. Das ist der schnellste Weg zum Ziel.

3. Der Explorer (/explorer/...)

    Die Listenansicht 
        Eine simple, paginierte Tabelle oder Liste von Datensätzen.
        Spalten: versionId, Typ, Produzent, Erstellt am, Preis.
        Oben ein paar einfache Filter: "Zeige nur Klassifizierung: internal" oder "Produzent: ...".
        Kein "infinite scroll", sondern klare "Weiter" / "Zurück"-Buttons. Schnell und ressourcenschonend.
    Die Detailansicht Das ist das Herzstück für den Menschen.
        Header: Die versionId als große Überschrift. Darunter die wichtigsten Metadaten (Produzent, Erstellungsdatum, Content-Hash, Lizenz).
        Lineage-Visualisierung: Eine simple, vertikale Darstellung der Herkunftskette. Kein komplexer, interaktiver Graph. Eher wie eine Git-History:

        Beispiel:
        ◉ TOXSIM-REPORT-12 (this)
        │   - License: Internal-Use-Only
        │   - Producer: ToxSimAgent
        │
        └─┬ ◉ MOLECULA-DESIGNS-45
          │   - License: Research-License-v2
          │   - Producer: MoleculaAgent
          │
          └─┬ ◉ GENOSCREEN-RESULT-01
            │   - License: Data-Provider-ABC-License
            │   - Producer: GenoScreenerAgent
            │
            └── ◉ PHARMA-GENOME-73 (root)
                - License: PharmaCorp-Proprietary
                - Producer: human@pharmaco.corp

        Aktionen: Ein Button "[Download Manifest (JSON)]" und "[Download Data (if paid)]".
        Policy Check: Ein kleines Widget "Run /ready Check". Man kann eine Policy (als JSON) einfügen und der Button leuchtet grün ("Ready") oder rot ("Not Ready") mit Begründung. Das macht die Governance greifbar.

4. Die Dokumentation (/docs/...)

    Stil: Extrem minimalistisch, einspaltig, hoher Kontrast (Dark Mode by default).
    Inhalt: Reine Markdown-Dateien, die von SvelteKit in HTML umgewandelt werden. Schnell, versionierbar und einfach zu pflegen.
    Features: Code-Beispiele mit "Copy"-Button. Eine klare Beschreibung jedes API-Endpunkts mit Request- und Response-Beispielen.

Design- und UX-Prinzipien

    Radikale Simplizität: Wenn ein Element nicht absolut notwendig ist, um eine Aufgabe zu erfüllen, wird es entfernt.
    Dark Mode by Default: Angenehmer für Entwickler, die oft in dunklen IDEs arbeiten.
    Funktion über Form: Die Ästhetik ergibt sich aus der Klarheit und der Struktur, nicht aus Dekoration.
    Keine Ladezeiten: Die Seite muss sich augenblicklich anfühlen. SvelteKit's serverseitiges Rendering und die minimalistische Codebase machen das möglich.
    Informationsdichte: Wichtige Informationen (wie Hashes und IDs) sind immer sichtbar und kopierbar. Unwichtige Informationen sind standardmäßig ausgeblendet.

Diese Website wäre kein "Portal", sondern ein scharfes, präzises Werkzeug. Sie respektiert beide Zielgruppen, indem sie ihnen genau das gibt, was sie brauchen, und alles andere weglässt.