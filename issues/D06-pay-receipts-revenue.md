# D06 — Pay, Receipts & Revenue Log
Labels: backend, api, marketplace
Assignee: TBA
Estimate: 3–4 PT

Zweck
- Zahlpfad mit Quittungen (Receipts) implementieren, um Downloads/Streams zu autorisieren und Umsätze zu loggen. Optional TRN1-Anker.

Abhängigkeiten
- DB: receipts (bereit), prices
- Schema: schemas/receipt.schema.json (off-chain JSON)
- Optional: TRN1 on-chain Encoder (CBOR minimal)

Aufgaben
- [ ] POST /pay:
      - [ ] Input: { versionId, quantity }.
      - [ ] Preis lookup → total sats (simple: quantity * price).
      - [ ] Receipt generieren: { receiptId, versionId, contentHash, status:'pending', ttl }.
      - [ ] (Optional) TRN1 anstoßen/ankern; Mapping receiptId→txid speichern.
- [ ] GET /receipt?receiptId=… → Status, Limits, Versionbindung.
- [ ] Revenue log (einfach): Tabelle oder JSON-Log für Einnahmen (optional).

Definition of Done (DoD)
- [ ] /pay gibt Receipt-Objekt zurück (schema‑valide).
- [ ] receipts.status Fluss: pending → (optionell paid) → consumed/expired (D07).
- [ ] TRN1 optional als Zukunftspfad, nicht blocking.

Abnahmekriterien (Tests)
- [ ] /pay happy path, Schema-check für Receipt.
- [ ] Negative: unbekannte versionId, abgelaufener quote, ungültige quantity.

Risiken/Rollback
- Zahlung outsourcen (Wallet/Processor); MVP kann „pending“ Quittungen ohne On-Chain-Anker simulieren.
