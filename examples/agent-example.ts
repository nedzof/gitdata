import express from 'express';

const PORT = Number(process.env.AGENT_PORT || 9099);

const app = express();
app.use(express.json({ limit: '1mb' }));

// Example webhook (verify BRC-31 headers upstream if desired)
app.post('/webhook', (req, res) => {
  const { type, payload } = req.body || {};
  if (type === 'notify') {
    console.log('[agent] notify', payload);
    return res.status(200).json({ ok: true });
  }
  if (type === 'contract' || type === 'contract.generate') {
    const artifact = { type:'contract/pdf', url:`https://example.com/contracts/${Date.now()}.pdf`, hash:'cafebabe' };
    return res.status(200).json({ ok: true, artifacts:[artifact] });
  }
  return res.status(200).json({ ok: true, echo: { type, payload } });
});

app.listen(PORT, () => console.log(`Example Agent listening on :${PORT}`));