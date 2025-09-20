D34 — Model Policy Integration (D28 Bridge)
Labels: policy, ready, governance
Assignee: TBA
Estimate: 2–3 PT

Zweck/Scope
- Policies (D28) auf Modelle anwenden: requiredAncestor, licenseAllowList, piiFlagsBlockList, maxTotalCostForLineage, maxDataAgeSeconds etc.
- /models/:id/ready?policyId= → Decision (allow|warn|block) + reasons + evidence.

Nicht‑Ziele
- Keine Heavy Checks im Discovery‑Preview (nur leichte Heuristik).

API
- GET /models/:id/ready?policyId=
  - Proxy auf /ready?versionId=...
  - 200: { decision, reasons[], evidence }

Policy‑Mapping (Beispiele)
- Provenance: producerAllowList / producerBlockList → Modell‑Eltern (trainingIndex.parents)
- Compliance: licenseAllowList / piiFlagsBlockList → Elternmanifeste
- Ökonomie: maxTotalCostForLineage → Summe parents.price * qty; maxDataAgeSeconds → createdAt
- Qualität/MLOps/Security → nur auswerten, wenn Felder vorhanden (defensiv)

DoD
- Decision/Evidence zurückgegeben; UI‑Badge möglich.

Akzeptanz
- Block/Warn/Allow Cases je Kategorie.

Artefakte
- Beispiel‑Policies (JSON) + Reason‑Codes.

Risiken
- Over‑blocking → zunächst warn default; Flags für schwere Checks.

ENV
- POLICY_DEFAULT_ID
- POLICY_PREVIEW_ENABLE=true|false

Schluss-Hinweise
- SPV-first bleibt Leitplanke: /bundle und /ready sind Quelle der Wahrheit und sollen ohne Indexer funktionieren.
- Signaturen/Commitments halten sich an secp256k1 und BRC‑31‑kompatible Praktiken, ohne private Keys dem Overlay anzuvertrauen.
- Die hier spezifizierten JSON‑Schemata und Zustandsmodelle passen zum vorhandenen D24‑Stil (Express + better‑sqlite3, optionale Identity‑Signatur, klare Fehlercodes). Bitte verifiziert die endgültigen Body‑Formate mit eurem Team/Community, bevor ihr in Produktion geht.

Wenn du willst, liefere ich dir als nächsten Schritt:
- Postman‑Sammlungen (D29 connect/search/get/lineage/ready; D30 commitment/verify-output; D33 anchors)
- Minimale JSON‑Fixtures (good/bad Vektoren) und einen SvelteKit‑Proxy‑Handler für /api/verify-output (D31)