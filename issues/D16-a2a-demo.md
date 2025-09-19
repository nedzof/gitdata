
D16 — Demonstration einer autonomen Agent-zu-Agent (A2A) Wertschöpfungskette

Labels: demo, e2e, autonomy, audit-trail Assignee: TBA Estimate: 2 PT

Zweck

Diese Demonstration zeigt eine vollständige, durchgehende Wertschöpfungskette, die von mehreren autonomen KI-Agenten ausgeführt wird, die auf einem offenen, durch das Genius System ermöglichten Markt agieren.

Das Ziel ist es zu beweisen, wie Agenten autonom Geschäftsentscheidungen treffen (Daten kaufen/verkaufen), Werte schaffen und eine lückenlose, kryptographisch gesicherte Nachweiskette (Audit-Trail) für den gesamten Prozess erzeugen können, ohne sich gegenseitig oder einer zentralen Instanz blind vertrauen zu müssen.

Das abstrakte Szenario

Drei spezialisierte, autonome Agenten (A, B, C), die von unterschiedlichen Entwicklern stammen könnten, arbeiten nacheinander an einem Problem, ohne sich direkt zu kennen.

Agent A ("Der Produzent"): Nimmt eine initiale Datenquelle, analysiert sie und produziert ein erstes Zwischenergebnis.
Agent B ("Der Verarbeiter"): Entdeckt das Ergebnis von Agent A, kauft es nach einer Vertrauensprüfung, verarbeitet es weiter und produziert ein komplexeres, zweites Zwischenergebnis.
Agent C ("Der Analyst"): Entdeckt das Ergebnis von Agent B, kauft es ebenfalls nach einer Vertrauensprüfung und erstellt daraus einen finalen Analyse-Report.
Demonstrations-Skript: Schritt für Schritt
Schritt 1: Der Startschuss (Menschlicher Input)

Ein menschlicher Operator lädt einen initialen Datensatz hoch und "versiegelt" ihn mit dem Genius System.

Aktion: genius submit ...
Ergebnis: Der initiale Datensatz erhält eine eindeutige, fälschungssichere versionId (z.B. SOURCE-ASSET-01).
Schritt 2: Agent A produziert den ersten Wert

Agent A erhält den Auftrag, SOURCE-ASSET-01 zu analysieren.

Aktion 1 (Analyse): Agent A verarbeitet die Daten und erzeugt ein Ergebnis (z.B. eine Liste von erkannten Mustern).
Aktion 2 (Autonome Produktion): Agent A nutzt das Genius SDK, um sein Ergebnis zu publizieren. Entscheidend hierbei ist die Verlinkung zum Input:
contentHash: Der Fingerabdruck seines Ergebnisses.
parentVersionId: SOURCE-ASSET-01 (Dies ist der Schlüssel für die lückenlose Kette).
Aktion 3 (Publizierung & Preisgestaltung):
Agent A ruft /submit auf und erhält eine neue versionId für sein Produkt (z.B. INTERMEDIATE-RESULT-A-15).
Agent A ruft /producers/price auf und setzt autonom einen Preis für sein Werk.
Schritt 3: Agent B entdeckt, prüft und kauft

Agent B ist darauf programmiert, den Markt nach Daten vom Typ INTERMEDIATE-RESULT-A zu durchsuchen.

Aktion 1 (Autonome Entdeckung): Agent B findet INTERMEDIATE-RESULT-A-15.
Aktion 2 (Autonome Vertrauensprüfung): Bevor Budget ausgegeben wird, führt Agent B einen automatisierten Check durch:
genius.ready("INTERMEDIATE-RESULT-A-15")
Das System prüft die Herkunft (Lineage). Agent B stellt fest: "Ah, dies basiert auf SOURCE-ASSET-01 von einem vertrauenswürdigen Akteur. Keine Warnungen. Sicher zum Kauf."
Aktion 3 (Autonomer Kauf & Produktion):
Da die Prüfung erfolgreich war, führt Agent B eine /pay-Transaktion aus, erhält eine receiptId und bezahlt Agent A.
Er konsumiert die Daten und produziert sein eigenes, wertvolleres Ergebnis.
Er publiziert sein Ergebnis (z.B. INTERMEDIATE-RESULT-B-42) mit parentVersionId: "INTERMEDIATE-RESULT-A-15" und setzt ebenfalls einen Preis.
Schritt 4: Agent C erstellt das Endprodukt

Der Prozess wiederholt sich. Agent C entdeckt INTERMEDIATE-RESULT-B-42, führt seine eigene ready-Prüfung durch (die die Kette bis zu SOURCE-ASSET-01 zurückverfolgt), kauft die Daten und produziert den finalen Report (z.B. FINAL-REPORT-C-99).

Schritt 5: Der lückenlose Audit-Trail (Das Ergebnis)

Der menschliche Operator erhält die finale ID FINAL-REPORT-C-99. Er muss nichts über die Zwischenschritte wissen.

Aktion: Er führt einen einzigen Befehl aus:
genius bundle --versionId "FINAL-REPORT-C-99" --depth 99

Ergebnis: Er erhält sofort einen kryptographisch fälschungssicheren, lückenlosen Herkunftsnachweis der gesamten Wertschöpfungskette, der beweist:
Der finale Report von Agent C...
...basiert nachweislich auf dem Ergebnis von Agent B...
...welches nachweislich auf dem Ergebnis von Agent A basiert...
...welches nachweislich auf dem originalen Quelldatensatz basiert.
Definition of Done
 Das genius bundle-Kommando für die finale versionId gibt eine vollständige, fehlerfreie und verifizierbare Kette mit einer Tiefe von mindestens 3 Schritten zurück.
 Ein "Evidence Pack" mit allen Transaktionsbelegen (Manifests, Receipts, SPV-Proofs) für jeden Schritt wird automatisch generiert.
Abnahmekriterien
 Alle contentHash-Prüfungen über die gesamte Kette hinweg sind erfolgreich.
 Die Einnahmen (revenue_events) für Agent A und Agent B sind im System korrekt verbucht.
 Die ready-Prüfung schlägt fehl, wenn ein Glied in der Kette manipuliert oder mit einer Warnung versehen wird.
Artefakte
 Ein Ordner a2a-demo-evidence mit allen JSON-Belegen, Logs und dem finalen Bundle-Report.
Risiken/Rollback
Keinerlei Risiken. Das Skript ist idempotent und kann jederzeit wiederholt werden.
