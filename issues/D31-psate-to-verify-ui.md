Verstanden. Die bisherige UI war ein reines Entwickler-Werkzeug. Basierend auf unseren Erkenntnissen gestalten wir sie jetzt zu einem intuitiven Trust-Dashboard um, das die Geschichte von Integrität und Herkunft erzählt – aber trotzdem extrem simpel bleibt.

Hier sind die komplett überarbeiteten UI-Anforderungen für D31, die die Konzepte aus D29, D30, D33 und D34 für den Nutzer sichtbar und verständlich machen.

D31 (Revidiert) — SvelteKit Trust Dashboard

Labels: ui, sveltekit, verifier, trust Assignee: TBA Estimate: 2–3 PT

Zweck/Scope

Wandelt die Modell-Detailseite in ein interaktives Trust-Dashboard um. Ein Nutzer kann nicht nur einen Output verifizieren, sondern sieht auf einen Blick das Commitment, die Governance-Konformität und den Audit-Trail des Modells. Der Flow bleibt extrem einfach.

Routen/Ansichten

Die Sektion "Runtime Integrity Verification" auf der Seite /models/[id] wird komplett neu gestaltet und in drei simple, klare Bereiche unterteilt:

1. Live Output Verifier (Der interaktive Teil)

Eine saubere Textarea für den JSON-Output des Modells.
Ein prominenter "Verify" Button.
Die Ergebnis-Anzeige ist keine rohe JSON-Ausgabe mehr, sondern ein klares, farbcodiertes Badge:
Initial: Keine Anzeige.
Ladevorgang: Spinner.
Erfolg: ✅ VERIFIED - "This output is cryptographically verified to originate from model {{modelVersionId}}."
Fehler: ❌ INVALID - "Reason: Invalid Signature. This output cannot be trusted."
Replay: ⚠️ REPLAY - "This is a valid but repeated proof. It may indicate a potential issue."

2. Public Commitment (Das Versprechen des Modells)

Zeigt die Daten an, gegen die verifiziert wird. Schafft Transparenz.
Verification Key: 0479BE667EF9... [Copy]
Commitment Hash: a1b2c3d4... [Copy]

3. Governance & Audit Trail (Die laufende Überwachung)

Zeigt den Status des Modells im Gesamtsystem.
Policy Status: Ein Badge, das den Status von /models/:id/ready anzeigt.
✅ ALLOWED
⚠️ WARN
🚫 BLOCKED
Ein Link [View Details] führt zur vollständigen Policy-Analyse.
Latest Inference Anchors: Eine kurze Liste der letzten Merkle-Roots aus /models/:id/anchors (D33).
Root: f4e3d2c1... (anchored 2 minutes ago)
Root: 9a8b7c6d... (anchored 3 minutes ago)
Dies visualisiert, dass das Modell kontinuierlich und auditierbar arbeitet.
SvelteKit Code-Beispiele (Minimal & Simpel)
API-Proxy: src/routes/api/verify-output/+server.ts

Der bestehende Proxy-Handler ist perfekt und bleibt unverändert. Er ist simpel und sicher.

UI-Komponente: /models/[id]/TrustDashboard.svelte (Ausschnitt)

Dieser Code ersetzt den alten Snippet und baut das neue Dashboard auf.

<script lang="ts">
  // Diese Daten werden beim Laden der Seite geholt (aus /models/:id, /models/:id/ready, /models/:id/anchors)
  export let model: { modelVersionId: string, commitment: any };
  export let policyStatus: { decision: 'allow' | 'warn' | 'block' };
  export let anchors: { items: { root: string, anchoredAt: number }[] };

  let proofText = '';
  let verificationResult: any = null;
  let isLoading = false;

  async function verify() {
    isLoading = true;
    verificationResult = null;
    try {
      const res = await fetch('/api/verify-output', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: proofText
      });
      verificationResult = await res.json();
    } catch (e) {
      verificationResult = { valid: false, reason: 'Client-side error during verification.' };
    }
    isLoading = false;
  }

  // Helper für Zeit-Anzeige
  function timeAgo(timestamp: number): string {
    // ... Logik für "2 minutes ago"
    return new Date(timestamp * 1000).toLocaleTimeString();
  }
</script>

<style>
  .trust-dashboard { border: 1px solid #ccc; padding: 1rem; border-radius: 8px; }
  .section { margin-top: 1.5rem; }
  .badge { padding: 0.5rem; border-radius: 5px; font-weight: bold; }
  .badge-success { background-color: #d4edda; color: #155724; }
  .badge-danger { background-color: #f8d7da; color: #721c24; }
  .badge-warn { background-color: #fff3cd; color: #856404; }
  .key-display { font-family: monospace; background: #eee; padding: 0.5rem; border-radius: 4px; }
</style>

<div class="trust-dashboard">
  
  <!-- 1. LIVE VERIFIER -->
  <h3>Live Output Verifier</h3>
  <textarea bind:value={proofText} rows="8" style="width:100%;" placeholder='Paste the full model output JSON, including the "proof" object, here.'></textarea>
  <button on:click={verify} disabled={isLoading}>
    {isLoading ? 'Verifying...' : 'Verify Output'}
  </button>

  {#if verificationResult}
    {#if verificationResult.valid}
      <div class="badge badge-success">
        ✅ VERIFIED: This output is cryptographically verified to originate from this model.
      </div>
    {:else}
      <div class="badge badge-danger">
        ❌ INVALID: {verificationResult.reason || 'This output cannot be trusted.'}
      </div>
    {/if}
  {/if}

  <!-- 2. PUBLIC COMMITMENT -->
  <div class="section">
    <h4>Public Commitment</h4>
    <div>
      <strong>Verification Key:</strong>
      <span class="key-display">{model.commitment?.verificationKey || 'Not set'}</span>
      <button on:click={() => navigator.clipboard.writeText(model.commitment?.verificationKey)}>Copy</button>
    </div>
  </div>

  <!-- 3. GOVERNANCE & AUDIT TRAIL -->
  <div class="section">
    <h4>Governance & Audit Trail</h4>
    <div>
      <strong>Policy Status:</strong>
      {#if policyStatus.decision === 'allow'}
        <span class="badge badge-success">✅ ALLOWED</span>
      {:else if policyStatus.decision === 'warn'}
        <span class="badge badge-warn">⚠️ WARN</span>
      {:else}
        <span class="badge badge-danger">🚫 BLOCKED</span>
      {/if}
      <a href="/models/{model.modelVersionId}/ready">[View Details]</a>
    </div>
    <div style="margin-top: 1rem;">
      <strong>Latest Inference Anchors:</strong>
      <ul>
        {#each anchors.items.slice(0, 3) as anchor}
          <li>Root: <span class="key-display">{anchor.root.substring(0,12)}...</span> (anchored at {timeAgo(anchor.anchoredAt)})</li>
        {/each}
      </ul>
    </div>
  </div>

</div>
