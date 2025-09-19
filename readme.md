# Gitdata: The Trust Layer for the AI Economy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Gitdata is a decentralized protocol and high-performance overlay network designed to bring verifiable trust to the AI data supply chain. It provides a standardized, cryptographically secure method for establishing, resolving, and monetizing data lineage, ensuring that AI models are trained on data with proven provenance.

## The Problem

The AI economy runs on data, but the origin, integrity, and history of that data are often a black box. This lack of verifiable lineage introduces significant risks, including model bias, unreliable outputs, and a general lack of trust. Gitdatasolves this by creating an open, immutable, and performant trust layer for data.

## Core Concepts

The system is built on a few simple but powerful primitives that combine on-chain immutability with off-chain performance.

*   **DLM1 (Data Lineage Manifest v1):** The core on-chain declaration. A small, CBOR-encoded data structure embedded in a Bitcoin `OP_RETURN` that anchors a dataset's manifest hash and its parental lineage to an immutable ledger.
*   **Lineage Bundle:** A JSON object served by the overlay network that provides the complete, verifiable history of a dataset. It includes the target manifest, all ancestor manifests, and the SPV (Simplified Payment Verification) proofs needed to validate their on-chain presence.
*   **SPV Envelope:** A signed wrapper containing an SPV proof (transaction, Merkle proof, block headers) that proves a specific transaction was included in the blockchain. This allows for lightweight, trustless verification without needing a full node.
*   **Receipts (TRN1):** An on-chain anchor and off-chain token that proves a payment was made for a resource. Receipts grant consumers time-limited, bandwidth-capped access to download data, enabling a transparent and auditable marketplace.
*   **`/ready` Endpoint:** A simple, powerful API call that answers the critical question: "Is this data trustworthy and ready for use?" It performs a comprehensive check of a dataset's lineage, policy compliance, and any active advisories, returning a simple `true` or `false`.

## System Architecture

The Gitdatauses a three-layer architecture to balance decentralization, performance, and user experience.

1.  **On-Chain Anchors (Trust Layer):** The Bitcoin blockchain is used as the ultimate, immutable source of truth for all lineage (DLM1) and payment (TRN1) commitments.
2.  **Overlay Service (Performance & Logic Layer):** A high-performance service that indexes the blockchain, constructs lineage bundles, manages access policies, issues receipts, and serves data. This is the primary interaction point for all users.
3.  **Client-Side Tooling (UX Layer):** A developer-first suite of tools, including a JS/TS SDK and a powerful CLI, designed to make interacting with the protocol simple, fast, and scriptable.

## Getting Started

### Prerequisites

*   Node.js (v16 or higher)
*   npm

### Installation

Install the CLI and SDK from NPM:

```bash
npm install -g @genius-system/cli
npm install @genius-system/sdk
```

## Usage Examples

### 1. Producer: Onboard and Publish Your First Dataset

The `producer-onboard` command is an all-in-one interactive script to get a new data provider registered and published in minutes.

```bash
# This will guide you through creating an identity, registering,
# pricing, and publishing your first dataset.
genius producer-onboard
```

### 2. Consumer: Verify and Download Data (The "One-Shot")

This command demonstrates the entire consumer lifecycle: check if data is ready, pay for it, and download it securely.

```bash
# The one-shot command handles the full publish -> pay -> ready -> download flow
genius one-shot --versionId <your-dataset-version-id>
```

### 3. In Your Application (JS/TS SDK)

Integrate data verification directly into your AI/ML pipelines.

```typescript
import { genius } from '@genius-system/sdk';

const VERSION_ID = '...'; // The dataset version you want to use

async function preflightCheck() {
  // 1. Check if the data is trustworthy before using it
  const { ready, reason } = await genius.ready(VERSION_ID);

  if (!ready) {
    console.error(`Preflight check failed: ${reason}`);
    throw new Error('Data verification failed!');
  }

  console.log('Data lineage verified. Proceeding with training job...');

  // 2. (If required) Pay for and stream the data
  // const quote = await genius.pay(VERSION_ID, 1);
  // ... handle payment ...
  // const dataStream = await genius.streamData(quote.contentHash, quote.receiptId);
  // ... pipe stream to your ML pipeline ...
}

preflightCheck();
```

### 4. In Your CI/CD Pipeline (Python Verifier)

Use the standalone Python verifier for simple, language-agnostic integration.

```bash
# This script exits 0 if ready, 1 if not. Perfect for CI.
python verify_ready.py --versionId <your-dataset-version-id> --overlay-host https://api.genius.system

if [ $? -eq 0 ]; then
  echo "Verification successful. Starting MLFlow job."
  mlflow run ...
else
  echo "Verification failed. Aborting job."
  exit 1
fi
```

## Join the Community

We are building an open, transparent foundation for the future of AI. Contributions, feedback, and ideas are welcome.

*   **Issues:** [GitHub Issues](https://github.com/your-repo/genius-system/issues)
*   **Discussions:** [GitHub Discussions](https://github.com/your-repo/genius-system/discussions)

## Docs & Postman

- Developer Guide: docs/README-dev.md
- Postman Collection: postman/collection.postman_collection.json
- Environment: postman/env.postman_environment.json

Run locally (Newman):
```bash
npm run postman
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
