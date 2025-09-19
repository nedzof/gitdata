Yes. Your overlay already hints at a listings layer: server.ts mentions “keep existing route mounts (… listings …)”. If that route isn’t in your codebase yet, here’s a D24‑style issue you can add to formalize Data Discovery and make it testable end‑to‑end, leveraging your existing searchManifests(db, …) utility.

D17 — Data Discovery & Listings

Labels: discovery, listings, search, marketplace
Assignee: TBA
Estimate: 2–3 PT

Zweck
- Konsumierende brauchen eine „Shop‑Window“‑API, um verfügbare Versionen/Datasets zu finden.
- Stellt eine einfache, paginierte Discovery bereit, die auf vorhandene Indizes/Manifeste aufsetzt (searchManifests).
- Optional: Preis‑Snippet pro Listing via bestehendem /price Endpunkt.

Nicht‑Ziele
- Kein komplexes Facetten‑/Vektor‑Search‑System.
- Keine serverseitige On‑Chain‑Indexierung (SPV bleibt maßgeblich für Trust; Listings sind reine Discovery).
- Kein Backoffice‑CMS; nur API + minimaler DTO für UI/SDK.

Abhängigkeiten
- D01 (Submit), D03/D04 (Bundle/Ready), D05/D09 (Price/Pricebook), D07 (Data), D11 (Caching), D12 (Limits)
- searchManifests(db, { q, datasetId, limit, offset }) existiert bereits und wird in /rules/:id/run genutzt.
- Optional: producers registry für Producer‑Metadaten.

Aufgaben
- [ ] Endpunkte
  - [ ] GET /listings?q=&datasetId=&producerId=&limit=&offset=
       - Quelle: searchManifests(db, …)
       - Antwort: items[] mit Kernfeldern, z. B. { versionId, name, description, datasetId, producerId, tags?, updatedAt }
  - [ ] GET /listings/:versionId
       - Liefert Detail (Manifest‑Kernfelder), optional Preis‑Snippet
  - [ ] Optional: GET /search (Alias für /listings mit erweitertem Filterset)
- [ ] Datenquellen/Mapping
  - [ ] Mapping der searchManifests‑Zeilen auf DTO (mind. versionId = rows.version_id)
  - [ ] Felder, die nicht im Index liegen, nicht „erfinden“ (nur liefern, was vorhanden/verlässlich ist)
- [ ] Preis‑Snippet (optional, feature‑flag)
  - [ ] Für jedes Listing: optionaler Aufruf gegen /price?versionId=… (mit kleinem Timeout/Bulk‑Cap)
  - [ ] Caching: kurzlebig (TTL z. B. 15–60 s) im Memory‑Cache
- [ ] Caching & Limits
  - [ ] HTTP Cache‑Header (s-maxage/Cache‑Control) + interne LRU (z. B. bis N Einträge)
  - [ ] Rate Limits für /listings (D12)
- [ ] Tests
  - [ ] Leere DB: /listings liefert items=[], 200
  - [ ] Eintrag vorhanden: q/filters liefern Treffer, Paginierung stabil
  - [ ] Detail: /listings/:versionId 200/404
  - [ ] Preis‑Snippet (falls aktiv): fällt robust aus, wenn /price langsam/fehlerhaft ist; Listing bleibt 200
- [ ] Doku
  - [ ] README Abschnitt „Discovery“: Felder, Filter, Paginierung, Preis‑Snippet, TTLs

Definition of Done (DoD)
- [ ] /listings liefert paginierte Treffer via searchManifests, stabil bei q/datasetId/limit/offset.
- [ ] /listings/:versionId liefert Details (mind. versionId), 404 für unbekannte IDs.
- [ ] Optionaler Preis‑Snippet wird sauber degradiert (Timeout → kein Preis, aber 200).
- [ ] Caching/Limits dokumentiert; Beispiel‑curls vorhanden.

Abnahmekriterien (Tests)
- [ ] Paging deterministisch (limit/offset); q‑Filter wirkt (Substring/Simple LIKE).
- [ ] Performance: p95 < 200 ms bei 10k Listings (lokal, ohne Preis‑Snippet).
- [ ] Fehlerfälle: ungültige Parameter → 400; unbekannte ID → 404; Preis‑Service down → Listings weiter nutzbar.

Artefakte
- [ ] Beispiel‑Responses (listings.json, listing-detail.json)
- [ ] Postman/Newman‑Tests für /listings und /listings/:versionId
- [ ] README Snippets (curl)

Risiken/Rollback
- Preis‑Fan‑Out kann langsam werden → Feature‑Flag + Cache + harte Budgets (max Items for price enrichment).
- Uneinheitliche Manifestfelder → Nur robuste, vorhandene Felder exposen (name/description optional).
- Zu aggressive Caches → kurze TTLs + Cache‑Buster via q/offset.

Minimaler DTO‑Vorschlag
- item: { versionId, name?, description?, datasetId?, producerId?, tags?, updatedAt? }
- detail: { versionId, manifest?: { name?, description?, datasetId?, … }, price?: { satoshis, currency? } }

Beispiel‑Flows (curl)
- Liste:
  curl -sS '{{BASE}}/listings?q='
- Paginierung:
  curl -sS '{{BASE}}/listings?q=data&limit=20&offset=20'
- Detail:
  curl -sS '{{BASE}}/listings/{versionId}'

Hinweis zur Umsetzung im Code
- Ihr habt bereits searchManifests(db, …). Ein einfacher listingsRouter kann das direkt nutzen. Beispiel: mappe rows zu { versionId: row.version_id, … } und liefere nur Felder, die sicher verfügbar sind. Wenn ihr später Manifest‑Kerne (name/description) in den Index aufnehmt, erweitert ihr den DTO ohne Breaking Change.
- In server.ts ist „listings“ bereits als Mount erwähnt. Falls das in eurer Codebase fehlt, könnt ihr es nachrüsten und neben agents/rules/jobs einhängen.

Wenn du möchtest, liefere ich dir eine kleine Postman‑Sammlung (2 Requests + Tests) für /listings und /listings/:versionId, damit Discovery sofort CI‑fähig ist.