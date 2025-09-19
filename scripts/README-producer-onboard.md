# Producer Onboard CLI

Dev usage (one-shot):
```bash
OVERLAY_URL=http://localhost:8788 \
DATASET_ID=open-images-50k \
CONTENT_HASH=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
PRICE_SATS=5000 \
PRODUCER_NAME="Acme Data" \
PRODUCER_WEBSITE="https://acme.example" \
IDENTITY_KEY="02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" \
TITLE="Open Images – 50k subset" \
npm run cli:onboard
```

Output includes:
- versionId, txid
- producerId (derived from manifest.provenance.producer.identityKey)
- price quote and ready state
- shareable links:
  - /ready?versionId=…
  - /bundle?versionId=…
  - /price?versionId=…
  - /producers?datasetId=…

Notes
- For production, replace the synthetic rawTx with a properly signed transaction from your wallet embedding the OP_RETURN scriptHex. Then just call `POST /submit` with the real rawTx + manifest to index it.