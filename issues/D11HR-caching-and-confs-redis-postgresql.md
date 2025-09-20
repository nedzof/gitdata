Hier ist eine überarbeitete, hybride Fassung von D11, die zu deinem PostgreSQL+Redis‑Setup (D22HR/D41) passt und SPV‑first bleibt. Sie definiert klar, was persistent in Postgres bleibt (Audit/Protokoll), was kurzlebig in Redis gecacht wird (Bundle‑Envelopes, Header‑Tip, „stale‑while‑revalidate“), wie Konfirmationen „frisch“ berechnet werden und wie Reorgs/Schwellenübergänge gehandhabt werden.

D11H — Caching & Confirmations (Hybrid: PostgreSQL + Redis)

Labels: backend, api, perf, redis, postgres, spv  
Assignee: TBA  
Estimate: 2 PT

Zweck
- Beschleunige /bundle mit einem Redis Cache (Envelope/Beweis) und dynamischer Konf‑Berechnung zur Laufzeit.
- Stelle sicher, dass Confirmations (confs) und Ready‑Entscheidungen nie „eingebacken“ gecacht werden, sondern gegen den aktuellen Header‑Tip (SPV) frisch evaluiert werden.
- Integriere saubere Invalidation bei TTL‑Ablauf, Tip‑Wechsel (Headers) und Konf‑Schwellenübergang (unter/über POLICY_MIN_CONFS).

Abhängigkeiten
- Redis (Cache) + PostgreSQL (Audit optional)
- ENV:
  - CACHE_TTLS_JSON (z. B. { "headers":30, "bundles":300, "staleWhileRevalidate":60 })
  - POLICY_MIN_CONFS (z. B. 1 oder 2)
  - HEADERS_SOURCE (Datei/Service/Endpoint für Header‑Mirror)
- D02 (SPV verify), D22HR (Hybrid Storage), D41 (OpenLineage/Redis)

Architektur (Kernprinzipien)
- Envelope‑Cache: Das „Bundle‑Envelope“ (Proof, Pfade, Blockhash, BlockHeight) wird als JSON in Redis mit TTL abgelegt. Dieses Envelope enthält KEINE fixen „confs“.
- Konf‑Berechnung: Bei jeder /bundle‑Antwort werden die Confirmations frisch berechnet (tipHeight − envelope.blockHeight + 1, sofern block im aktuellen Header‑Zweig).
- Header‑Tip: Aktueller Tip/BestHeight liegt in Redis (kurzlebig) und wird periodisch aktualisiert (oder bei Cache‑Miss geladen). Tip‑Change invalidiert betroffene Keys (z. B. markiert stale).
- Stale‑while‑revalidate: Bei Cache‑Treffer wird serviert und im Hintergrund revalidiert (Headers/Ancestry/Existenz). Bei Diskrepanz wird invalidiert und frisch aufgebaut.
- Reorg‑Sicherheit: Envelope enthält blockHash. Bei Tip‑Update wird ancestry geprüft; bei Divergenz wird Envelope verworfen/erneuert (DLQ/Backoff optional einbauen).

Redis Keyspace
- cache:bundle:<versionId>|<depth> = JSON (Envelope, ohne confs) | TTL = CACHE_TTLS_JSON.bundles
- cache:headers:tip = { "height": n, "hash": "...", "updatedAt": ... } | TTL = CACHE_TTLS_JSON.headers
- cache:bundle:lock:<versionId> = „1“ (kurzer Lock gegen Stampede; EX 10s)
- cache:bundle:neg:<versionId> = „1“ (Negativ‑Cache für 404, kurze TTL, z. B. 30s)
- Optional: cache:stale:<key> = „1“ (Marker für „serve stale while revalidate“)

PostgreSQL (optional, audit)
- table bundle_audit(version_id, block_hash, block_height, verified_at, reorg_flag, created_at)
- Persistiere keine confs; speichere nur zeitpunktbezogene Verifikationsinformationen (für Forensik).

Caching‑Algorithmus (/bundle Pfad)
1) Eingabe: versionId, depth
2) Versuche GET cache:bundle:<versionId>|<depth>.
   - Hit: parse Envelope
   - Miss: setze lock (SETNX cache:bundle:lock:<versionId>; EX 10s); wenn gesetzt:
     - Baue Envelope frisch (SPV Verify chain inclusion, blockHash, blockHeight, Pfade…)
     - SETEX cache:bundle:<versionId>|<depth> mit TTL
     - DEL lock
   - Wenn lock nicht gesetzt: kurze Wartezeit/Retry (oder „serve stale“ wenn verfügbar)
3) Aktualer Tip:
   - GET cache:headers:tip (falls miss → lade Tip aus HEADERS_SOURCE; SETEX)
4) Konf‑Berechnung:
   - confs = (tip.height − envelope.blockHeight + 1), wenn ancestry gültig; sonst → Reorg‑Pfad
5) Reorg‑Check:
   - Wenn blockHash nicht im aktuellen Headerbaum → Envelope invalidieren (DEL cache) und neu aufbauen; falls HEADERS_SOURCE verzögert, optional DLQ/Retry
6) Antwort:
   - Liefere { envelope, confs, tip: {height, hash} } (confs frisch, niemals aus Cache)
7) stale‑while‑revalidate:
   - Wenn TTL abgelaufen und Rebuild langsam, optional stale ausliefern und asynchron revalidieren (setzen Marker cache:stale:<key>)

Invalidation‑Regeln
- TTL‑Ablauf: reguläre Expire der Envelope‑Keys
- Tip‑Wechsel: Bei neuem tip.hash/height → markiere stale für alle bundle‑Keys (nicht massenhaft löschen; lazy revalidate beim nächsten Aufruf)
- Konf‑Schwelle (POLICY_MIN_CONFS): Keine permanente Invalidierung; die Schwelle wird bei jeder Anfrage dynamisch geprüft (ready = confs ≥ min). UI/Clients dürfen mit TTL gecachten „Envelope“ arbeiten; Entscheidung (allow/warn/block) stets frisch.

Header‑Cache‑Policies
- cache:headers:tip TTL kurz (z. B. 15–60s)
- Watchdog/Backoff: Bei HEADERS_SOURCE Fehlern → nutze aktuellen Tip (stale) und gib „unstable: true“ in Antwortmetadaten (optional)
- Recompute‑On‑Read: Bei jeder Anfrage prüfe confs/ancestry. Kein blindes Vertrauen in gespeicherten conf‑Wert.

Aufgaben
- [ ] Implementiere Envelope‑Cache in Redis (SETEX) mit Lock gegen Stampede
- [ ] Implementiere Tip‑Cache (SETEX) und HEADERS_SOURCE‑Fetcher (HTTP/Datei)
- [ ] Berechne confs dynamisch aus tip.height vs envelope.blockHeight; ancestry‑Check
- [ ] Implementiere stale‑while‑revalidate‑Pfad (optional Flag in ENV)
- [ ] Negativ‑Cache für 404/unknown versionIds (kurze TTL)
- [ ] Optionale Audit‑Insertion in PostgreSQL (bundle_audit)
- [ ] ENV‑TTLs parametrisieren (CACHE_TTLS_JSON, POLICY_MIN_CONFS)
- [ ] Metriken/Logs: Hits/Misses, stale served, confs histogram, reorg count

Definition of Done (DoD)
- /bundle liefert p95‑Latenz im Zielbereich (Cache‑Hit < 50 ms, Miss < Budget) und korrekte, frisch berechnete confs.
- „Ready“ Entscheidungen (confs ≥ POLICY_MIN_CONFS) werden nie über TTL „eingefroren“; bei jeder Anfrage frisch evaluiert.
- Reorg‑Pfad funktioniert: Erkennung (ancestry fail) → Invalidation + Rebuild.
- Header‑Cache arbeitet (kurze TTL), kein Dauerhit auf HEADERS_SOURCE (Backoff/Retry bei Fehlern).
- Keine Stale‑Konf‑Werte im Cache (confs werden nie mitgespeichert).

Abnahmekriterien (Tests)
- Cache Hit/Miss: Miss → Rebuild; nächster Hit → Envelope aus Redis; confs stimmen mit aktuellem Tip überein.
- Konf‑Übergang: confs < min → ready=false; nach Tip‑Update → confs ≥ min → ready=true (ohne Datenänderung).
- Reorg‑Sim: Tip‑Wechsel mit abweichender ancestry → Envelope invalidiert & neu generiert.
- Negativ‑Cache: unbekannte versionId → 404 cached (kurze TTL), anschließend gültig nach Publish.
- Headless‑Pfad: HEADERS_SOURCE down → serve stale with unstable:true (wenn konfiguriert)

Metriken & Observability
- bundle_cache_hit_ratio, bundle_build_latency_ms_p95
- headers_fetch_latency, headers_cache_hit_ratio
- reorg_detected_total, stale_served_total
- ready_decision_changes_total (optional)
- Logs: { versionId, depth, cache:hit|miss, confs, tipHeight, reorg:bool, latencyMs }

Risiken/Rollback
- Stale Tip → falsche confs: kurzes headers TTL + Recompute‑On‑Read mitigiert
- Stampedes: Locks + SWR (stale‑while‑revalidate)
- HEADERS Quelle unzuverlässig: Backoff + unstable Markierung + UI Hinweis
- Speicherverbrauch: Begrenze Bundle‑TTL und mögliche Größe; Serien größerer DAGs vermeiden

ENV‑Beispiel
- CACHE_TTLS_JSON={"headers":30,"bundles":300,"staleWhileRevalidate":60,"neg404":30}
- POLICY_MIN_CONFS=1
- HEADERS_SOURCE=file:///var/headers/headers.json (oder https://headers.example/tip)
- SWR_ENABLE=true

API‑Antwort (Beispiel)
{
  "envelope": { "blockHash":"...", "blockHeight":800123, "proof":{...}, "paths":[...] },
  "confs": 2,
  "tip": { "height": 800124, "hash":"..." },
  "unstable": false,
  "cache": { "hit": true, "ageSec": 42 }
}

Integration (Hybrid)
- Redis für Bundle‑Envelope/Tip‑Caching und Recompute; PostgreSQL optional als Audit (kein Konf‑Speicher).
- D41 bleibt unverändert für Lineage; D22 (S3/CDN) getrennt für BLOBs.
- /ready nutzt die frisch berechneten confs aus /bundle (oder rechnet selbst frisch).

So änderst du D11: mache daraus D11H (wie oben), nutze Redis als schnellen Cache (Envelope & Tip), berechne Confirmations immer dynamisch, invalidiere über TTL/Tip‑Change/Reorg, und schreibe optional Audits nach PostgreSQL. Diese Fassung passt exakt zur Hybrid‑Architektur und verhindert, dass falsche Konf‑Werte im Cache „kleben bleiben“.