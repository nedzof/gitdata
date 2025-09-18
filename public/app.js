const apiBase = '';

async function loadListings() {
  const res = await fetch(`${apiBase}/listings`);
  const js = await res.json();
  const q = document.getElementById('search').value.toLowerCase().trim();
  const filtered = js.items.filter((it) => {
    if (!q) return true;
    return (it.title || '').toLowerCase().includes(q) ||
           (it.license || '').toLowerCase().includes(q);
  });

  const el = document.getElementById('listings');
  el.innerHTML = '';
  for (const it of filtered) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div><strong>${it.title || '(no title)'}</strong></div>
      <div class="muted">versionId: <span class="mono">${it.version_id}</span></div>
      <div class="muted">contentHash: <span class="mono">${it.content_hash || '-'}</span></div>
      <div class="row">
        <span class="badge">${it.license || 'unknown'}</span>
        <span class="badge">${it.classification || 'n/a'}</span>
        <span class="badge">${it.status || 'pending'}</span>
      </div>
      <div style="margin-top:8px;">
        <button data-vid="${it.version_id}">View</button>
      </div>
    `;
    card.querySelector('button').addEventListener('click', () => viewDetails(it.version_id));
    el.appendChild(card);
  }
}

async function viewDetails(versionId) {
  const details = document.getElementById('details');
  details.innerHTML = 'Loading…';

  // Ready
  const readyRes = await fetch(`${apiBase}/ready?versionId=${versionId}`);
  const ready = await readyRes.json();

  // Price
  const priceRes = await fetch(`${apiBase}/price?versionId=${versionId}`);
  const price = await priceRes.json();

  const readyBadge = ready.ready
    ? '<span class="badge ready-yes">ready</span>'
    : `<span class="badge ready-no">not ready (${ready.reason || ''})</span>`;

  details.innerHTML = `
    <div><strong>Version</strong>: <span class="mono">${versionId}</span> ${readyBadge}</div>
    <div style="margin-top:8px;">Price: <strong>${price.satoshis || '—'}</strong> sats</div>
    <div style="margin-top:8px;">
      <button onclick="viewBundle('${versionId}')">View Bundle (JSON)</button>
      <button onclick="requestPrice('${versionId}')">Refresh Price</button>
    </div>
    <pre id="bundle" style="margin-top:12px; background:#fafafa; padding:8px; border:1px solid #eee; max-height:320px; overflow:auto;"></pre>
  `;
}

window.viewBundle = async function(versionId) {
  const pre = document.getElementById('bundle');
  pre.textContent = 'Loading bundle…';
  const res = await fetch(`${apiBase}/bundle?versionId=${versionId}`);
  const js = await res.json();
  pre.textContent = JSON.stringify(js, null, 2);
}

window.requestPrice = async function(versionId) {
  await viewDetails(versionId);
}

window.loadListings = loadListings;

loadListings();
