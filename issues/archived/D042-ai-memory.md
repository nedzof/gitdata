Of course. This is an exceptionally detailed and well-structured set of specifications. The goal is to consolidate them into a single, coherent deliverable, removing redundant explanations and commentary while preserving every critical technical detail.

The result is a unified, production-ready specification that flows logically from high-level concepts to the finest implementation details.

D42 (Consolidated): Interoperable AI Memory Substrate

Labels: ai, memory, security, openlineage, redis, spv, interoperability, bsv Assignee: TBA Estimate: 8–12 PT (Consolidated scope)

1. Purpose and Scope

This deliverable defines an interoperable, immutable “AI memory” substrate for agents. Memory fragments are append-only, hash-identified content blobs with cryptographic provenance. The system is vendor-neutral and SPV-first, meaning trust derives from verifiable proofs, not a centralized indexer.

Core Principles:
SPV-First: Cryptographic truth is established via SPV proofs (/bundle endpoint), not a trusted database.
Immutable & Append-Only: Memory fragments are never altered; corrections are made by writing new, linked fragments.
Confidentiality by Default: Payloads are client-side encrypted using ECDH and AES-GCM. The server never handles plaintext.
Verifiable Provenance: All writes are authenticated with BRC-31/AIP signatures.
Interoperability: Standardized schemas (JSON Schema) and on-chain protocols (MAP/B) ensure vendor-neutral communication.
Lineage Integration: Discovery and visualization flow through OpenLineage, making memory a first-class citizen in the data ecosystem.
2. Core Concepts
Memory Fragment (Kᵢ): An atomic, immutable unit of memory identified by its contentHash. It contains provenance, references, an optional encrypted payload, and an SPV anchor.
Memory Batch Anchor: A Merkle root of multiple fragment contentHash values, committed to the BSV blockchain via a domain-separated OP_RETURN envelope. This allows for efficient, verifiable batch anchoring.
3. Data Contracts & Schemas

(Schemas to be hosted at https://your-domain/schemas/v1/ and validated in CI with Ajv)

3.1. spv-proof-bundle-v1.json The canonical, self-contained structure for all SPV proofs. It binds a leaf hash to a transaction and a block header chain.

{
  "$id": "https://your-domain/schemas/v1/spv-proof-bundle-v1.json",
  "title": "SPV Proof Bundle v1",
  "type": "object",
  "required": ["version", "network", "type", "leaf", "batch", "tx", "block", "headersChain", "policy"],
  "properties": {
    "version": { "const": "spv-1" },
    "network": { "enum": ["mainnet", "testnet", "stn"] },
    "type": { "enum": ["KFv1", "TLv1", "TRv1"] },
    "leaf": {
      "type": "object",
      "required": ["hash", "index"],
      "properties": {
        "hash": { "$ref": "primitives.json#/$defs/Hex32" },
        "index": { "type": "integer", "minimum": 0 }
      }
    },
    "batch": {
      "type": "object",
      "required": ["root", "siblings", "domain"],
      "properties": {
        "root": { "$ref": "primitives.json#/$defs/Hex32" },
        "siblings": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
        "domain": { "enum": ["KFv1", "TLv1", "TRv1"] }
      }
    },
    "tx": {
      "type": "object",
      "required": ["txid", "vout", "scriptPubKey"],
      "properties": {
        "txid": { "$ref": "primitives.json#/$defs/Hex32" },
        "vout": { "type": "integer", "minimum": 0 },
        "scriptPubKey": { "type": "string", "pattern": "^[0-9a-fA-F]+$" }
      }
    },
    "block": {
      "type": "object",
      "required": ["height", "header", "txMerkle"],
      "properties": {
        "height": { "type": "integer", "minimum": 0 },
        "header": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" },
        "txMerkle": {
          "type": "object",
          "required": ["siblings", "index"],
          "properties": {
            "siblings": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
            "index": { "type": "integer", "minimum": 0 }
          }
        }
      }
    },
    "headersChain": { "type": "array", "items": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" }, "minItems": 1 },
    "policy": {
      "type": "object",
      "required": ["minConfs", "anchoredAt"],
      "properties": {
        "minConfs": { "type": "integer", "minimum": 0 },
        "anchoredAt": { "type": "string", "format": "date-time" }
      }
    },
    "meta": {
      "type": "object",
      "properties": {
        "batchId": { "type": "string", "format": "uuid" }
      }
    }
  }
}


3.2. ai-memory-fragment-v1.json (KFv1) The core object representing a single, encrypted memory fragment.

{
  "$id": "https://your-domain/schemas/v1/ai-memory-fragment-v1.json",
  "title": "AI Memory Fragment v1 (KFv1)",
  "type": "object",
  "required": ["fragmentId", "contentHash", "createdAt", "owner", "kind", "provenance", "proofBundle"],
  "properties": {
    "fragmentId": { "type": "string" },
    "contentHash": { "$ref": "primitives.json#/$defs/Hex32" },
    "createdAt": { "type": "string", "format": "date-time" },
    "owner": { "$ref": "identity.json" },
    "writer": { "$ref": "identity.json" },
    "kind": { "enum": ["prompt", "completion", "embedding", "state", "log", "custom", "vocabulary"] },
    "tags": { "type": "array", "items": { "type": "string" } },
    "status": { "enum": ["active", "archived"], "default": "active" },
    "parents": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
    "provenance": {
      "type": "object",
      "required": ["source", "timestamp", "issuer", "context"],
      "properties": {
        "source": { "type": "string", "format": "uri" },
        "timestamp": { "type": "string", "format": "date-time" },
        "issuer": { "$ref": "primitives.json#/$defs/PubKey" },
        "context": {
          "type": "object",
          "required": ["uuid", "access"],
          "properties": {
            "uuid": { "type": "string", "format": "uuid" },
            "access": { "type": "string" }
          }
        }
      }
    },
    "encryptedPayload": { "type": "string", "contentEncoding": "base64" },
    "encryption": {
      "type": "object",
      "properties": {
        "alg": { "const": "aes-256-gcm" },
        "ephemeralPubKey": { "$ref": "primitives.json#/$defs/PubKey" },
        "recipientPubKey": { "$ref": "primitives.json#/$defs/PubKey" },
        "kdf": { "const": "hkdf-sha256" },
        "nonce": { "type": "string", "pattern": "^[0-9a-f]{24}$" }
      }
    },
    "payloadRef": {
      "type": "object",
      "required": ["url", "sha256", "length"],
      "properties": {
        "url": { "type": "string", "format": "uri" },
        "sha256": { "$ref": "primitives.json#/$defs/Hex32" },
        "length": { "type": "integer", "minimum": 0 }
      }
    },
    "proofBundle": { "$ref": "spv-proof-bundle-v1.json" }
  }
}


3.3. ai-memory-write-request-v1.json The client-side request to write a new memory fragment, authenticated with a signature.

{
  "$id": "https://your-domain/schemas/v1/ai-memory-write-request-v1.json",
  "title": "AI Memory Write Request v1",
  "type": "object",
  "required": ["owner", "writer", "kind", "createdAt", "contentHash", "signature"],
  "properties": {
    "owner": { "$ref": "identity.json" },
    "writer": { "$ref": "identity.json" },
    "kind": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "contentHash": { "$ref": "primitives.json#/$defs/Hex32" },
    "encryptedPayload": { "type": ["string", "null"], "contentEncoding": "base64" },
    "encryption": { "$ref": "ai-memory-fragment-v1.json#/properties/encryption" },
    "payloadRef": { "$ref": "ai-memory-fragment-v1.json#/properties/payloadRef" },
    "signature": { "$ref": "brc31-signature.json" }
  }
}


3.4. ai-memory-access-policy-v1.json A declarative, signed policy defining read access rules.

{
  "$id": "https://your-domain/schemas/v1/ai-memory-access-policy-v1.json",
  "title": "AI Memory Access Policy v1",
  "type": "object",
  "required": ["policyId", "scope", "rules", "createdAt", "signature"],
  "properties": {
    "policyId": { "type": "string" },
    "scope": { "enum": ["owner", "fragment"] },
    "ownerKey": { "$ref": "primitives.json#/$defs/PubKey" },
    "rules": {
      "type": "object",
      "properties": {
        "allowReaders": { "type": "array", "items": { "$ref": "primitives.json#/$defs/PubKey" } },
        "allowTags": { "type": "array", "items": { "type": "string" } },
        "expiresAt": { "type": "integer", "minimum": 0 }
      }
    },
    "createdAt": { "type": "string", "format": "date-time" },
    "signature": { "$ref": "brc31-signature.json" }
  }
}


3.5. map-message-v1.json Schema for the MAP protocol OP_RETURN output, used for on-chain metadata and context.

{
  "$id": "https://your-domain/schemas/v1/map-message-v1.json",
  "title": "MAP Message Body v1",
  "type": "object",
  "required": ["app", "type", "anchorDomain", "anchorRoot", "anchorBatchId", "contentHash"],
  "properties": {
    "app": { "type": "string" },
    "type": { "const": "message" },
    "context": { "enum": ["global", "channel", "bapID", "dm"], "default": "global" },
    "contextValue": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "anchorDomain": { "enum": ["KFv1", "TLv1", "TRv1"] },
    "anchorRoot": { "$ref": "primitives.json#/$defs/Hex32" },
    "anchorBatchId": { "type": "string", "format": "uuid" },
    "contentHash": { "$ref": "primitives.json#/$defs/Hex32" },
    "payloadRef": { "$ref": "ai-memory-fragment-v1.json#/properties/payloadRef" },
    "senderEphemeralPubKey": { "$ref": "primitives.json#/$defs/PubKey" }
  }
}

4. On-Chain Transaction Structure

A standard memory transaction consists of multiple OP_RETURN outputs to separate concerns while maintaining atomic commitment.

Output 1: B Protocol (Optional)
Carries public, unencrypted content or attachments (e.g., text/plain).
Omitted for confidential or large payloads, which use payloadRef instead.
Output 2: MAP Protocol
Carries application-level metadata as key-value pairs.
Includes app, type, context, and crucially, the anchorRoot, anchorBatchId, and contentHash to link the application context to the cryptographic commitment.
May include an AIP signature for wallet-verifiable authorship.
Output 3: ANCHR Envelope (The Commitment)
The canonical, domain-separated commitment used for all SPV verification.
Format: OP_FALSE OP_RETURN <"ANCHR"> <domain> <merkle_root> <batch_id>
Example (KFv1): 006a05414e434852044b46763120<root_hex>10<batch_id_hex>
5. Redis Data Model

Redis serves as the "workbench" for fast access to hot data and indexes. All data in Redis is considered ephemeral and rebuildable from the durable layers (Postgres/BSV).

Fragment Metadata: ai:ns:<env>:mem:<fragmentId> (Redis Hash)
Indexes (Redis Sets/Sorted Sets):
ai:ns:<env>:mem:by_time (ZSET score: createdAt)
ai:ns:<env>:mem:by_owner:<pubkey> (SET)
ai:ns:<env>:mem:by_tag:<tag> (SET)
ai:ns:<env>:mem:by_kind:<kind> (SET)
Policies: ai:ns:<env>:policy:<policyId> (Hash)
SPV Cache:
spv:tip (Hash: {height, header, updatedAt})
bundle:<fragmentId> (String: Cached JSON proof bundle)
Search Cache: ai:cache:mem:search:<query_hash> (Temporary SET via SINTERSTORE)
6. API Endpoints
POST /ai/memory/write: Validates a signed ai-memory-write-request, persists the fragment metadata to Redis, and emits an OpenLineage event.
GET /ai/memory/:fragmentId: Returns the public metadata for a fragment. Payload access is subject to policy checks.
GET /ai/memory/search: Queries Redis indexes to find fragments. Uses SINTERSTORE for complex queries to ensure performance.
POST /ai/memory/policy: Validates and persists a signed access policy.
GET /ready: Returns the current network status and policy (minConfs, tip height, etc.).
GET /bundle/:fragmentId: Returns the complete, self-contained spv-proof-bundle for a given fragment, used for client-side verification.
POST /anchor (Internal): An internal endpoint for the batching service to submit a new Merkle root for anchoring on-chain.
7. Security & Cryptography
Authentication: Writes are authenticated via BRC-31 or AIP signatures over the canonical request payload. The writer identity is cryptographically proven.
Confidentiality: Payloads are encrypted client-side using ECDH on the secp256k1 curve to derive a shared secret, which is then used with HKDF-SHA256 to generate a unique AES-256-GCM key for each fragment.
Domain Separation: A strict domain separation scheme is enforced. The domain tag (e.g., "KFv1") must be identical in the ANCHR envelope, the MAP metadata, the proofBundle, and the HKDF context string to prevent cross-domain attacks.
Access Control: Policies are enforced server-side before serving any encrypted payload or payloadRef. Access decisions can be accompanied by a signed "Policy Receipt" for client-side auditability.
8. Integration & Validation
OpenLineage:
A custom openlineage-memory-facet is attached to run events to link model runs directly to the memory fragments they produce.
This makes memory creation and usage visible and traceable within the broader data lineage graph.
CI/CD & Schema Validation:
All JSON schemas are validated in CI using ajv-cli.
A suite of "golden vector" files (valid and invalid examples) ensures that any code changes do not break schema compliance.
The CI pipeline includes a validate:mem script to run these checks automatically.
9. Future Extensions
Data Tiering: Implement a lifecycle policy to move older fragment metadata from Redis (active) to a durable store like PostgreSQL (archived) to manage costs.
Vocabulary Registry: Use the memory store itself to create a self-describing registry of kind and tag definitions to enhance semantic interoperability.
Streaming: Add SSE (Server-Sent Events) endpoints for real-time streaming of agent logs or memory updates.


Core Principles:
SPV-First: Cryptographic truth is established via SPV proofs (/bundle endpoint), not a trusted database.
Immutable & Append-Only: Memory fragments are never altered; corrections are made by writing new, linked fragments.
Confidentiality by Default: Payloads are client-side encrypted using ECDH and AES-GCM. The server never handles plaintext.
Verifiable Provenance: All writes are authenticated with BRC-31/AIP signatures.
Interoperability: Standardized schemas (JSON Schema) and on-chain protocols (MAP/B) ensure vendor-neutral communication.
Lineage Integration: Discovery and visualization flow through OpenLineage, making memory a first-class citizen in the data ecosystem.
2. Core Concepts
Memory Fragment (Kᵢ): An atomic, immutable unit of memory identified by its contentHash. It contains provenance, references, an optional encrypted payload, and an SPV anchor.
Memory Batch Anchor: A Merkle root of multiple fragment contentHash values, committed to the BSV blockchain via a domain-separated OP_RETURN envelope. This allows for efficient, verifiable batch anchoring.
3. Data Contracts & Schemas

(Schemas to be hosted at https://your-domain/schemas/v1/ and validated in CI with Ajv)

3.1. spv-proof-bundle-v1.json

The canonical, self-contained structure for all SPV proofs. It binds a leaf hash to a transaction and a block header chain.

{
  "$id": "https://your-domain/schemas/v1/spv-proof-bundle-v1.json",
  "title": "SPV Proof Bundle v1",
  "type": "object",
  "required": ["version", "network", "type", "leaf", "batch", "tx", "block", "headersChain", "policy"],
  "properties": {
    "version": { "const": "spv-1" },
    "network": { "enum": ["mainnet", "testnet", "stn"] },
    "type": { "enum": ["KFv1", "TLv1", "TRv1"] },
    "leaf": {
      "type": "object",
      "required": ["hash", "index"],
      "properties": {
        "hash": { "$ref": "primitives.json#/$defs/Hex32" },
        "index": { "type": "integer", "minimum": 0 }
      }
    },
    "batch": {
      "type": "object",
      "required": ["root", "siblings", "domain"],
      "properties": {
        "root": { "$ref": "primitives.json#/$defs/Hex32" },
        "siblings": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
        "domain": { "enum": ["KFv1", "TLv1", "TRv1"] }
      }
    },
    "tx": {
      "type": "object",
      "required": ["txid", "vout", "scriptPubKey"],
      "properties": {
        "txid": { "$ref": "primitives.json#/$defs/Hex32" },
        "vout": { "type": "integer", "minimum": 0 },
        "scriptPubKey": { "type": "string", "pattern": "^[0-9a-fA-F]+$" }
      }
    },
    "block": {
      "type": "object",
      "required": ["height", "header", "txMerkle"],
      "properties": {
        "height": { "type": "integer", "minimum": 0 },
        "header": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" },
        "txMerkle": {
          "type": "object",
          "required": ["siblings", "index"],
          "properties": {
            "siblings": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
            "index": { "type": "integer", "minimum": 0 }
          }
        }
      }
    },
    "headersChain": { "type": "array", "items": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" }, "minItems": 1 },
    "policy": {
      "type": "object",
      "required": ["minConfs", "anchoredAt"],
      "properties": {
        "minConfs": { "type": "integer", "minimum": 0 },
        "anchoredAt": { "type": "string", "format": "date-time" }
      }
    },
    "meta": {
      "type": "object",
      "properties": {
        "batchId": { "type": "string", "format": "uuid" }
      }
    }
  }
}

3.2. ai-memory-fragment-v1.json (KFv1)

The core object representing a single, encrypted memory fragment.

{
  "$id": "https://your-domain/schemas/v1/ai-memory-fragment-v1.json",
  "title": "AI Memory Fragment v1 (KFv1)",
  "type": "object",
  "required": ["fragmentId", "contentHash", "createdAt", "owner", "kind", "provenance", "proofBundle"],
  "properties": {
    "fragmentId": { "type": "string" },
    "contentHash": { "$ref": "primitives.json#/$defs/Hex32" },
    "createdAt": { "type": "string", "format": "date-time" },
    "owner": { "$ref": "identity.json" },
    "writer": { "$ref": "identity.json" },
    "kind": { "enum": ["prompt", "completion", "embedding", "state", "log", "custom", "vocabulary"] },
    "tags": { "type": "array", "items": { "type": "string" } },
    "status": { "enum": ["active", "archived"], "default": "active" },
    "parents": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
    "provenance": {
      "type": "object",
      "required": ["source", "timestamp", "issuer", "context"],
      "properties": {
        "source": { "type": "string", "format": "uri" },
        "timestamp": { "type": "string", "format": "date-time" },
        "issuer": { "$ref": "primitives.json#/$defs/PubKey" },
        "context": {
          "type": "object",
          "required": ["uuid", "access"],
          "properties": {
            "uuid": { "type": "string", "format": "uuid" },
            "access": { "type": "string" }
          }
        }
      }
    },
    "encryptedPayload": { "type": "string", "contentEncoding": "base64" },
    "encryption": {
      "type": "object",
      "properties": {
        "alg": { "const": "aes-256-gcm" },
        "ephemeralPubKey": { "$ref": "primitives.json#/$defs/PubKey" },
        "recipientPubKey": { "$ref": "primitives.json#/$defs/PubKey" },
        "kdf": { "const": "hkdf-sha256" },
        "nonce": { "type": "string", "pattern": "^[0-9a-f]{24}$" }
      }
    },
    "payloadRef": {
      "type": "object",
      "required": ["url", "sha256", "length"],
      "properties": {
        "url": { "type": "string", "format": "uri" },
        "sha256": { "$ref": "primitives.json#/$defs/Hex32" },
        "length": { "type": "integer", "minimum": 0 }
      }
    },
    "proofBundle": { "$ref": "spv-proof-bundle-v1.json" }
  }
}

3.3. ai-memory-write-request-v1.json

The client-side request to write a new memory fragment, authenticated with a signature.

{
  "$id": "https://your-domain/schemas/v1/ai-memory-write-request-v1.json",
  "title": "AI Memory Write Request v1",
  "type": "object",
  "required": ["owner", "writer", "kind", "createdAt", "contentHash", "signature"],
  "properties": {
    "owner": { "$ref": "identity.json" },
    "writer": { "$ref": "identity.json" },
    "kind": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "contentHash": { "$ref": "primitives.json#/$defs/Hex32" },
    "encryptedPayload": { "type": ["string", "null"], "contentEncoding": "base64" },
    "encryption": { "$ref": "ai-memory-fragment-v1.json#/properties/encryption" },
    "payloadRef": { "$ref": "ai-memory-fragment-v1.json#/properties/payloadRef" },
    "signature": { "$ref": "brc31-signature.json" }
  }
}

3.4. ai-memory-access-policy-v1.json

A declarative, signed policy defining read access rules.

{
  "$id": "https://your-domain/schemas/v1/ai-memory-access-policy-v1.json",
  "title": "AI Memory Access Policy v1",
  "type": "object",
  "required": ["policyId", "scope", "rules", "createdAt", "signature"],
  "properties": {
    "policyId": { "type": "string" },
    "scope": { "enum": ["owner", "fragment"] },
    "ownerKey": { "$ref": "primitives.json#/$defs/PubKey" },
    "rules": {
      "type": "object",
      "properties": {
        "allowReaders": { "type": "array", "items": { "$ref": "primitives.json#/$defs/PubKey" } },
        "allowTags": { "type": "array", "items": { "type": "string" } },
        "expiresAt": { "type": "integer", "minimum": 0 }
      }
    },
    "createdAt": { "type": "string", "format": "date-time" },
    "signature": { "$ref": "brc31-signature.json" }
  }
}

3.5. map-message-v1.json

Schema for the MAP protocol OP_RETURN output, used for on-chain metadata and context.

{
  "$id": "https://your-domain/schemas/v1/map-message-v1.json",
  "title": "MAP Message Body v1",
  "type": "object",
  "required": ["app", "type", "anchorDomain", "anchorRoot", "anchorBatchId", "contentHash"],
  "properties": {
    "app": { "type": "string" },
    "type": { "const": "message" },
    "context": { "enum": ["global", "channel", "bapID", "dm"], "default": "global" },
    "contextValue": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "anchorDomain": { "enum": ["KFv1", "TLv1", "TRv1"] },
    "anchorRoot": { "$ref": "primitives.json#/$defs/Hex32" },
    "anchorBatchId": { "type": "string", "format": "uuid" },
    "contentHash": { "$ref": "primitives.json#/$defs/Hex32" },
    "payloadRef": { "$ref": "ai-memory-fragment-v1.json#/properties/payloadRef" },
    "senderEphemeralPubKey": { "$ref": "primitives.json#/$defs/PubKey" }
  }
}

4. On-Chain Transaction Structure

A standard memory transaction consists of multiple OP_RETURN outputs to separate concerns while maintaining atomic commitment.

Output 1: B Protocol (Optional)
Carries public, unencrypted content or attachments (e.g., text/plain).
Omitted for confidential or large payloads, which use payloadRef instead.
Output 2: MAP Protocol
Carries application-level metadata as key-value pairs.
Includes app, type, context, and crucially, the anchorRoot, anchorBatchId, and contentHash to link the application context to the cryptographic commitment.
May include an AIP signature for wallet-verifiable authorship.
Output 3: ANCHR Envelope (The Commitment)
The canonical, domain-separated commitment used for all SPV verification.
Format: OP_FALSE OP_RETURN <"ANCHR"> <domain> <merkle_root> <batch_id>
Example (KFv1): 006a05414e434852044b46763120<root_hex>10<batch_id_hex>
5. Redis Data Model

Redis serves as the "workbench" for fast access to hot data and indexes. All data in Redis is considered ephemeral and rebuildable from the durable layers (Postgres/BSV).

Fragment Metadata: ai:ns:<env>:mem:<fragmentId> (Redis Hash)
Indexes (Redis Sets/Sorted Sets):
ai:ns:<env>:mem:by_time (ZSET score: createdAt)
ai:ns:<env>:mem:by_owner:<pubkey> (SET)
ai:ns:<env>:mem:by_tag:<tag> (SET)
ai:ns:<env>:mem:by_kind:<kind> (SET)
Policies: ai:ns:<env>:policy:<policyId> (Hash)
SPV Cache:
spv:tip (Hash: {height, header, updatedAt})
bundle:<fragmentId> (String: Cached JSON proof bundle)
Search Cache: ai:cache:mem:search:<query_hash> (Temporary SET via SINTERSTORE)
6. API Endpoints
POST /ai/memory/write: Validates a signed ai-memory-write-request, persists the fragment metadata to Redis, and emits an OpenLineage event.
GET /ai/memory/:fragmentId: Returns the public metadata for a fragment. Payload access is subject to policy checks.
GET /ai/memory/search: Queries Redis indexes to find fragments. Uses SINTERSTORE for complex queries to ensure performance.
POST /ai/memory/policy: Validates and persists a signed access policy.
GET /ready: Returns the current network status and policy (minConfs, tip height, etc.).
GET /bundle/:fragmentId: Returns the complete, self-contained spv-proof-bundle for a given fragment, used for client-side verification.
POST /anchor (Internal): An internal endpoint for the batching service to submit a new Merkle root for anchoring on-chain.
7. Security & Cryptography
Authentication: Writes are authenticated via BRC-31 or AIP signatures over the canonical request payload. The writer identity is cryptographically proven.
Confidentiality: Payloads are encrypted client-side using ECDH on the secp256k1 curve to derive a shared secret, which is then used with HKDF-SHA256 to generate a unique AES-256-GCM key for each fragment.
Domain Separation: A strict domain separation scheme is enforced. The domain tag (e.g., "KFv1") must be identical in the ANCHR envelope, the MAP metadata, the proofBundle, and the HKDF context string to prevent cross-domain attacks.
Access Control: Policies are enforced server-side before serving any encrypted payload or payloadRef. Access decisions can be accompanied by a signed "Policy Receipt" for client-side auditability.
8. Integration & Validation
OpenLineage:
A custom openlineage-memory-facet is attached to run events to link model runs directly to the memory fragments they produce.
This makes memory creation and usage visible and traceable within the broader data lineage graph.
CI/CD & Schema Validation:
All JSON schemas are validated in CI using ajv-cli.
A suite of "golden vector" files (valid and invalid examples) ensures that any code changes do not break schema compliance.
The CI pipeline includes a validate:mem script to run these checks automatically.
9. Future Extensions
Data Tiering: Implement a lifecycle policy to move older fragment metadata from Redis (active) to a durable store like PostgreSQL (archived) to manage costs.
Vocabulary Registry: Use the memory store itself to create a self-describing registry of kind and tag definitions to enhance semantic interoperability.
Streaming: Add SSE (Server-Sent Events) endpoints for real-time streaming of agent logs or memory updates.

Excellent baseline. Here are precise, production-grade fixes you can apply immediately. I’ve kept your structure intact and focused on enforceable constraints, byte-level clarity, and CI-verifiable changes.

A) Critical fixes (apply these first)
- Upgrade schemas to draft 2020-12 and enable additionalProperties: false on all security-critical objects (root and nested).
- Enforce domain consistency: bundle.type == batch.domain and, for fragments, proofBundle.type == "KFv1".
- Normalize contentHash rule (pick one network-wide and state it):
  - If encryptedPayload present: contentHash = sha256(encryptedPayload_bytes)
  - Else if payloadRef present: contentHash = payloadRef.sha256 (clients SHOULD verify bytes at URL)
- ANCHR example is truncated. Replace with the full script hex (see C).
- Add tx.value (integer) in spv-proof bundle.tx for completeness.
- Add error taxonomy and cache headers to /bundle.
- Redis TTL/invalidation: explicit TTLs and reorg invalidation policy (see E).

B) Schema patches (drop-in replacements or diffs)

Use this header on all schemas:
"$schema": "https://json-schema.org/draft/2020-12/schema"

spv-proof-bundle-v1.json (tightened)
{
  "$id": "https://your-domain/schemas/v1/spv-proof-bundle-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SPV Proof Bundle v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["version","network","type","leaf","batch","tx","block","headersChain","policy"],
  "properties": {
    "version": { "const": "spv-1" },
    "network": { "type": "string", "enum": ["mainnet","testnet","stn"] },
    "type": { "type": "string", "enum": ["KFv1","TLv1","TRv1"] },
    "leaf": {
      "type": "object", "additionalProperties": false,
      "required": ["hash","index"],
      "properties": {
        "hash": { "$ref": "primitives.json#/$defs/Hex32" },
        "index": { "type": "integer", "minimum": 0 }
      }
    },
    "batch": {
      "type": "object", "additionalProperties": false,
      "required": ["root","siblings","domain"],
      "properties": {
        "root": { "$ref": "primitives.json#/$defs/Hex32" },
        "siblings": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
        "domain": { "type": "string", "enum": ["KFv1","TLv1","TRv1"] }
      }
    },
    "tx": {
      "type": "object", "additionalProperties": false,
      "required": ["txid","vout","scriptPubKey"],
      "properties": {
        "txid": { "$ref": "primitives.json#/$defs/Hex32" },
        "vout": { "type": "integer", "minimum": 0 },
        "scriptPubKey": { "type": "string", "pattern": "^[0-9a-fA-F]+$" },
        "value": { "type": "integer", "minimum": 0 }
      }
    },
    "block": {
      "type": "object", "additionalProperties": false,
      "required": ["height","header","txMerkle"],
      "properties": {
        "height": { "type": "integer", "minimum": 0 },
        "header": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" },
        "txMerkle": {
          "type": "object", "additionalProperties": false,
          "required": ["siblings","index"],
          "properties": {
            "siblings": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
            "index": { "type": "integer", "minimum": 0 }
          }
        }
      }
    },
    "headersChain": { "type": "array", "minItems": 1, "items": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" } },
    "policy": {
      "type": "object", "additionalProperties": false,
      "required": ["minConfs","anchoredAt"],
      "properties": {
        "minConfs": { "type": "integer", "minimum": 0 },
        "anchoredAt": { "type": "string", "format": "date-time" }
      }
    },
    "meta": {
      "type": "object", "additionalProperties": false,
      "properties": { "batchId": { "type": "string", "format": "uuid" } }
    }
  },
  "allOf": [
    { "if": { "properties": { "type": { "const": "KFv1" } } }, "then": { "properties": { "batch": { "properties": { "domain": { "const": "KFv1" } } } } } },
    { "if": { "properties": { "type": { "const": "TLv1" } } }, "then": { "properties": { "batch": { "properties": { "domain": { "const": "TLv1" } } } } } },
    { "if": { "properties": { "type": { "const": "TRv1" } } }, "then": { "properties": { "batch": { "properties": { "domain": { "const": "TRv1" } } } } } }
  ]
}

ai-memory-fragment-v1.json (enforce KFv1)
- Add at root:
"additionalProperties": false,
"allOf": [
  {
    "properties": {
      "proofBundle": {
        "properties": { "type": { "const": "KFv1" } }
      }
    }
  }
]

ai-memory-write-request-v1.json and ai-memory-access-policy-v1.json
- Add "$schema": "https://json-schema.org/draft/2020-12/schema"
- Add "additionalProperties": false at root.

map-message-v1.json
- Add "$schema": "https://json-schema.org/draft/2020-12/schema"
- Add "additionalProperties": false at root.

C) Correct ANCHR script example (full hex)
- Format: OP_FALSE OP_RETURN "ANCHR" <domain> <root32> <batchId16>
- Example (KFv1; root=e3b0…b855; batchId=00112233-4455-6677-8899-aabbccddeeff):
006a05414e434852044b46763120e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8551000112233445566778899aabbccddeeff

D) Normative rules (document clearly)
- contentHash:
  - Inline: sha256(encryptedPayload_bytes)
  - External: must equal payloadRef.sha256 (client SHOULD verify bytes)
- Signature base (BRC-31):
  - Canonical JSON of ai-memory-write-request-v1 without signature, UTF-8, keys sorted; signature.identityKey must equal writer.identityKey; nonce unique per identityKey over a sliding window.
- HKDF info string (required fields):
  - info = "MEMv1|" + domain + "|sess=" + sessionId + "|uuid=" + batchId + "|root=" + rootHex + "|lvl=" + access + "|ts=" + isoTime
  - domain must match ANCHR domain and proofBundle.type.

E) Redis TTLs and invalidation
- spv:tip → TTL 30s
- bundle:<fragmentId> → TTL 3600s; on tip change, invalidate bundles whose confirmations < minConfs
- ai:cache:mem:search:<queryId> → TTL 60s; use SINTERSTORE for >2 filters

F) /bundle endpoint headers and errors
- Response headers: Cache-Control: public, max-age=60; ETag: "spv-bundle-<fragmentId>-<blockHeight>"
- Errors:
  - 400 schema_error
  - 401 signature_invalid (for signed requests)
  - 403 policy_denied
  - 409 duplicate
  - 422 content_hash_mismatch
  - 503 tip_unavailable

G) SPV verification order (implementers’ checklist)
- Domain equality: bundle.type == batch.domain
- Leaf→Root using siblings[] and leaf.index → equals batch.root
- Root present in ANCHR scriptPubKey with same domain and meta.batchId
- Tx→Block via txMerkle to header
- Header ∈ headersChain and chain valid to tip
- Confirmations ≥ policy.minConfs

H) Optional (recommended) additions
- tx.value in spv bundle.tx (already added above).
- MAP authorship (wallet-verifiable): add optional aipPubkey, aipSigDER to map-message-v1.json.
- Policy receipts: on authorized GET (payload/presigned), include server-signed policyReceipt { policyId, decision, timestamp, signature }.

I) CI gates (ajv + tests)
- Use Ajv strict + ajv-formats.
- Good/bad vectors for:
  - Domain mismatch (must fail)
  - Invalid hex lengths (must fail)
  - Missing required fields
  - Reused nonce (server-side logic)
- Unit tests:
  - Merkle leaf→root reconstruction
  - ANCHR encode/decode round-trip
  - HKDF domain separation (KFv1 vs TLv1 vs TRv1 yield different keys)

J) One-line clarifications in your doc
- Replace all "$schema": "http://json-schema.org/draft-07/schema#" with 2020-12.
- Add “additionalProperties: false” to all objects shown in your schemas.
- Replace truncated ANCHR example with the complete script above.
- In 6. APIs clarify: GET /bundle/:fragmentId returns the proof bundle for that fragment’s contentHash.

If you want, I can emit a PR-ready patch (schemas + examples + Ajv config) and a small Jest suite for Merkle/ANCHR/HKDF checks so this spec is enforced by CI from day one.

Perfect. Here’s a PR-ready patch you can drop into your repo to enforce the D42 spec in CI from day one. It upgrades schemas, adds strict validation, and includes a small Jest suite for Merkle/ANCHR/HKDF domain separation. Everything is SPV-first and BSV-aligned.

How to apply
- Create a feature branch (e.g., feat/d42-ci).
- Add/replace the files below at the indicated paths.
- Run: npm ci && npm run validate:mem && npm test
- Open a PR titled: D42: Schemas + SPV bundle + Merkle/ANCHR/HKDF tests + CI

package.json (add scripts and dev deps)
- Merge these into your existing package.json.

{
  "scripts": {
    "validate:mem": "node ./scripts/ajv-validate.mjs",
    "validate:mem-bad": "node ./scripts/ajv-validate-bad.mjs",
    "test": "jest --colors",
    "build": "tsc -p ."
  },
  "devDependencies": {
    "ajv": "^8.17.1",
    "ajv-cli": "^5.0.0",
    "ajv-formats": "^3.0.1",
    "@types/jest": "^29.5.12",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.6.3"
  }
}

tsconfig.json (if not present)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "rootDir": "./",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.mjs"]
}

.github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run validate:mem
      - run: npm run validate:mem-bad
      - run: npm test

Schemas (draft 2020-12, strict, domain-enforced)

schemas/v1/spv-proof-bundle-v1.json
{
  "$id": "https://your-domain/schemas/v1/spv-proof-bundle-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SPV Proof Bundle v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["version","network","type","leaf","batch","tx","block","headersChain","policy"],
  "properties": {
    "version": { "const": "spv-1" },
    "network": { "type": "string", "enum": ["mainnet","testnet","stn"] },
    "type": { "type": "string", "enum": ["KFv1","TLv1","TRv1"] },
    "leaf": {
      "type": "object", "additionalProperties": false,
      "required": ["hash","index"],
      "properties": {
        "hash": { "$ref": "primitives.json#/$defs/Hex32" },
        "index": { "type": "integer", "minimum": 0 }
      }
    },
    "batch": {
      "type": "object", "additionalProperties": false,
      "required": ["root","siblings","domain"],
      "properties": {
        "root": { "$ref": "primitives.json#/$defs/Hex32" },
        "siblings": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
        "domain": { "type": "string", "enum": ["KFv1","TLv1","TRv1"] }
      }
    },
    "tx": {
      "type": "object", "additionalProperties": false,
      "required": ["txid","vout","scriptPubKey"],
      "properties": {
        "txid": { "$ref": "primitives.json#/$defs/Hex32" },
        "vout": { "type": "integer", "minimum": 0 },
        "scriptPubKey": { "type": "string", "pattern": "^[0-9a-fA-F]+$" },
        "value": { "type": "integer", "minimum": 0 }
      }
    },
    "block": {
      "type": "object", "additionalProperties": false,
      "required": ["height","header","txMerkle"],
      "properties": {
        "height": { "type": "integer", "minimum": 0 },
        "header": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" },
        "txMerkle": {
          "type": "object", "additionalProperties": false,
          "required": ["siblings","index"],
          "properties": {
            "siblings": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
            "index": { "type": "integer", "minimum": 0 }
          }
        }
      }
    },
    "headersChain": { "type": "array", "minItems": 1, "items": { "type": "string", "pattern": "^[0-9a-fA-F]{160}$" } },
    "policy": {
      "type": "object", "additionalProperties": false,
      "required": ["minConfs","anchoredAt"],
      "properties": {
        "minConfs": { "type": "integer", "minimum": 0 },
        "anchoredAt": { "type": "string", "format": "date-time" }
      }
    },
    "meta": {
      "type": "object", "additionalProperties": false,
      "properties": { "batchId": { "type": "string", "format": "uuid" } }
    }
  },
  "allOf": [
    { "if": { "properties": { "type": { "const": "KFv1" } } }, "then": { "properties": { "batch": { "properties": { "domain": { "const": "KFv1" } } } } } },
    { "if": { "properties": { "type": { "const": "TLv1" } } }, "then": { "properties": { "batch": { "properties": { "domain": { "const": "TLv1" } } } } } },
    { "if": { "properties": { "type": { "const": "TRv1" } } }, "then": { "properties": { "batch": { "properties": { "domain": { "const": "TRv1" } } } } } }
  ]
}

schemas/v1/ai-memory-fragment-v1.json
{
  "$id": "https://your-domain/schemas/v1/ai-memory-fragment-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AI Memory Fragment v1 (KFv1)",
  "type": "object",
  "additionalProperties": false,
  "required": ["fragmentId","contentHash","createdAt","owner","kind","provenance","proofBundle"],
  "properties": {
    "fragmentId": { "type": "string" },
    "contentHash": { "$ref": "primitives.json#/$defs/Hex32" },
    "createdAt": { "type": "string", "format": "date-time" },
    "owner": { "$ref": "identity.json" },
    "writer": { "$ref": "identity.json" },
    "kind": { "type": "string", "enum": ["prompt","completion","embedding","state","log","custom","vocabulary"] },
    "tags": { "type": "array", "items": { "type": "string" } },
    "status": { "type": "string", "enum": ["active","archived"], "default": "active" },
    "parents": { "type": "array", "items": { "$ref": "primitives.json#/$defs/Hex32" } },
    "provenance": {
      "type": "object", "additionalProperties": false,
      "required": ["source","timestamp","issuer","context"],
      "properties": {
        "source": { "type": "string", "format": "uri" },
        "timestamp": { "type": "string", "format": "date-time" },
        "issuer": { "$ref": "primitives.json#/$defs/PubKey" },
        "context": {
          "type": "object", "additionalProperties": false,
          "required": ["uuid","access"],
          "properties": {
            "uuid": { "type": "string", "format": "uuid" },
            "access": { "type": "string" }
          }
        }
      }
    },
    "encryptedPayload": { "type": "string", "contentEncoding": "base64" },
    "encryption": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "alg": { "const": "aes-256-gcm" },
        "ephemeralPubKey": { "$ref": "primitives.json#/$defs/PubKey" },
        "recipientPubKey": { "$ref": "primitives.json#/$defs/PubKey" },
        "kdf": { "const": "hkdf-sha256" },
        "nonce": { "type": "string", "pattern": "^[0-9a-f]{24}$" }
      }
    },
    "payloadRef": {
      "type": "object", "additionalProperties": false,
      "required": ["url","sha256","length"],
      "properties": {
        "url": { "type": "string", "format": "uri" },
        "sha256": { "$ref": "primitives.json#/$defs/Hex32" },
        "length": { "type": "integer", "minimum": 0 }
      }
    },
    "proofBundle": { "$ref": "spv-proof-bundle-v1.json" }
  },
  "allOf": [
    { "properties": { "proofBundle": { "properties": { "type": { "const": "KFv1" } } } } }
  ]
}

schemas/v1/ai-memory-write-request-v1.json
{
  "$id": "https://your-domain/schemas/v1/ai-memory-write-request-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AI Memory Write Request v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["owner","writer","kind","createdAt","contentHash","signature"],
  "properties": {
    "owner": { "$ref": "identity.json" },
    "writer": { "$ref": "identity.json" },
    "kind": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "contentHash": { "$ref": "primitives.json#/$defs/Hex32" },
    "encryptedPayload": { "type": ["string","null"], "contentEncoding": "base64" },
    "encryption": { "$ref": "ai-memory-fragment-v1.json#/properties/encryption" },
    "payloadRef": { "$ref": "ai-memory-fragment-v1.json#/properties/payloadRef" },
    "signature": { "$ref": "brc31-signature.json" }
  }
}

schemas/v1/ai-memory-access-policy-v1.json
{
  "$id": "https://your-domain/schemas/v1/ai-memory-access-policy-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AI Memory Access Policy v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["policyId","scope","rules","createdAt","signature"],
  "properties": {
    "policyId": { "type": "string" },
    "scope": { "type": "string", "enum": ["owner","fragment"] },
    "ownerKey": { "$ref": "primitives.json#/$defs/PubKey" },
    "rules": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "allowReaders": { "type": "array", "items": { "$ref": "primitives.json#/$defs/PubKey" } },
        "allowTags": { "type": "array", "items": { "type": "string" } },
        "expiresAt": { "type": "integer", "minimum": 0 }
      }
    },
    "createdAt": { "type": "string", "format": "date-time" },
    "signature": { "$ref": "brc31-signature.json" }
  }
}

schemas/v1/map-message-v1.json
{
  "$id": "https://your-domain/schemas/v1/map-message-v1.json",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "MAP Message Body v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["app","type","anchorDomain","anchorRoot","anchorBatchId","contentHash"],
  "properties": {
    "app": { "type": "string" },
    "type": { "const": "message" },
    "context": { "type": "string", "enum": ["global","channel","bapID","dm"], "default": "global" },
    "contextValue": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "anchorDomain": { "type": "string", "enum": ["KFv1","TLv1","TRv1"] },
    "anchorRoot": { "$ref": "primitives.json#/$defs/Hex32" },
    "anchorBatchId": { "type": "string", "format": "uuid" },
    "contentHash": { "$ref": "primitives.json#/$defs/Hex32" },
    "payloadRef": { "$ref": "ai-memory-fragment-v1.json#/properties/payloadRef" },
    "senderEphemeralPubKey": { "$ref": "primitives.json#/$defs/PubKey" }
  }
}

Ajv validation scripts

scripts/ajv-validate.mjs
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);

const schemas = [
  'schemas/v1/spv-proof-bundle-v1.json',
  'schemas/v1/ai-memory-fragment-v1.json',
  'schemas/v1/ai-memory-write-request-v1.json',
  'schemas/v1/ai-memory-access-policy-v1.json',
  'schemas/v1/map-message-v1.json'
];

for (const p of schemas) {
  ajv.addSchema(JSON.parse(fs.readFileSync(p,'utf8')), p);
}

const vectors = [
  'examples/good/spv-bundle-kf-single.json',
  'examples/good/fragment-kf.json',
  'examples/good/write-request.json',
  'examples/good/policy.json',
  'examples/good/map-message.json'
];

let ok = true;
for (const v of vectors) {
  const doc = JSON.parse(fs.readFileSync(v,'utf8'));
  const id = doc.$schemaId || Object.keys(ajv.schemas)[0];
  const schema = v.includes('spv-bundle') ? 'schemas/v1/spv-proof-bundle-v1.json'
               : v.includes('fragment') ? 'schemas/v1/ai-memory-fragment-v1.json'
               : v.includes('write-request') ? 'schemas/v1/ai-memory-write-request-v1.json'
               : v.includes('policy') ? 'schemas/v1/ai-memory-access-policy-v1.json'
               : 'schemas/v1/map-message-v1.json';
  const validate = ajv.getSchema(schema);
  const valid = validate(doc);
  if (!valid) {
    ok = false;
    console.error('FAIL', v, validate.errors);
  } else {
    console.log('OK', v);
  }
}
process.exit(ok ? 0 : 1);

scripts/ajv-validate-bad.mjs
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);

const schemas = [
  'schemas/v1/spv-proof-bundle-v1.json',
  'schemas/v1/ai-memory-fragment-v1.json'
];
for (const p of schemas) ajv.addSchema(JSON.parse(fs.readFileSync(p,'utf8')), p);

const bad = [
  'examples/bad/spv-bundle-domain-mismatch.json',
  'examples/bad/fragment-missing-proof.json'
];

let ok = true;
for (const v of bad) {
  const data = JSON.parse(fs.readFileSync(v,'utf8'));
  const schema = v.includes('spv-bundle') ? 'schemas/v1/spv-proof-bundle-v1.json'
               : 'schemas/v1/ai-memory-fragment-v1.json';
  const validate = ajv.getSchema(schema);
  const valid = validate(data);
  if (valid) {
    ok = false;
    console.error('UNEXPECTED PASS', v);
  } else {
    console.log('Expected fail', v);
  }
}
process.exit(ok ? 0 : 1);

Core utilities and tests (Merkle, ANCHR, HKDF)

src/merkle.ts
import { createHash } from 'crypto';
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest();

export function computeRootFromProof(leafHex: string, siblingsHex: string[], index: number): string {
  let h = Buffer.from(leafHex, 'hex');
  siblingsHex.forEach((sibHex, depth) => {
    const sib = Buffer.from(sibHex, 'hex');
    const right = ((index >> depth) & 1) === 1;
    h = right ? sha256(Buffer.concat([sib, h])) : sha256(Buffer.concat([h, sib]));
  });
  return h.toString('hex');
}

export function buildRoot(leavesHex: string[]): string {
  if (!leavesHex.length) throw new Error('no leaves');
  let level = leavesHex.map(h => Buffer.from(h, 'hex'));
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i], b = level[i+1] ?? level[i];
      next.push(sha256(Buffer.concat([a, b])));
    }
    level = next;
  }
  return level[0].toString('hex');
}

src/opreturn.ts
function push(hex: string): string {
  const len = hex.length / 2;
  if (len <= 75) return len.toString(16).padStart(2,'0') + hex;
  if (len < 256) return '4c' + len.toString(16).padStart(2,'0') + hex;
  if (len < 65536) return '4d' + len.toString(16).padStart(4,'0') + hex;
  return '4e' + len.toString(16).padStart(8,'0') + hex;
}
const ascii = (s: string) => Buffer.from(s, 'ascii').toString('hex');

export function assembleANCHR(domain: 'KFv1'|'TLv1'|'TRv1', rootHex: string, batchIdUuid: string): string {
  if (!/^[0-9a-f]{64}$/.test(rootHex)) throw new Error('root must be 64-hex');
  const id = batchIdUuid.replace(/-/g,'').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error('uuid must be 32-hex');
  return '00' + '6a'
    + push(ascii('ANCHR'))
    + push(ascii(domain))
    + push(rootHex)
    + push(id);
}

export function decodeANCHR(scriptHex: string) {
  let i = 0;
  const read = (n: number) => { const h = scriptHex.slice(i, i+2*n); i += 2*n; return h; };
  const opf = read(1), opr = read(1);
  if (opf !== '00' || opr !== '6a') throw new Error('not OP_FALSE OP_RETURN');
  const rd = () => {
    const op = parseInt(read(1),16);
    let len = op;
    if (op === 0x4c) len = parseInt(read(1),16);
    else if (op === 0x4d) len = parseInt(read(2),16);
    else if (op === 0x4e) len = parseInt(read(4),16);
    return read(len);
  };
  const tag = Buffer.from(rd(),'hex').toString('ascii');
  const domain = Buffer.from(rd(),'hex').toString('ascii');
  const root = rd();
  const batchIdHex = rd();
  return { tag, domain, root, batchIdHex };
}

src/hkdfInfo.ts
import { hkdfSync } from 'crypto';
export type Domain = 'KFv1'|'TLv1'|'TRv1';
export function infoString(p: { domain: Domain, sessionId: string, uuid: string, root: string, level: string, timestamp: string }) {
  const { domain, sessionId, uuid, root, level, timestamp } = p;
  return `MEMv1|${domain}|sess=${sessionId}|uuid=${uuid}|root=${root}|lvl=${level}|ts=${timestamp}`;
}
export function deriveKey(sharedSecretHex: string, info: string): string {
  const key = hkdfSync('sha256', Buffer.from(sharedSecretHex, 'hex'), Buffer.alloc(0), Buffer.from(info,'utf8'), 32);
  return key.toString('hex');
}

tests/merkle.test.ts
import { buildRoot, computeRootFromProof } from '../src/merkle';
test('single leaf: root==leaf', () => {
  const leaf = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  expect(buildRoot([leaf])).toBe(leaf);
  expect(computeRootFromProof(leaf, [], 0)).toBe(leaf);
});
test('two leaves proof consistency', () => {
  const a = '00'.repeat(32), b = '11'.repeat(32);
  const root = buildRoot([a,b]);
  expect(computeRootFromProof(a,[b],0)).toBe(root);
  expect(computeRootFromProof(b,[a],1)).toBe(root);
});

tests/opreturn.test.ts
import { assembleANCHR, decodeANCHR } from '../src/opreturn';
test('ANCHR assemble/decode round-trip', () => {
  const root = 'aa'.repeat(32);
  const uuid = '00112233-4455-6677-8899-aabbccddeeff';
  const hex = assembleANCHR('KFv1', root, uuid);
  const dec = decodeANCHR(hex);
  expect(dec.tag).toBe('ANCHR');
  expect(dec.domain).toBe('KFv1');
  expect(dec.root).toBe(root);
  expect(dec.batchIdHex).toBe(uuid.replace(/-/g,'').toLowerCase());
});

tests/hkdf.test.ts
import { infoString, deriveKey } from '../src/hkdfInfo';
test('domain separation changes keys', () => {
  const shared = '11'.repeat(32);
  const base = { sessionId:'s', uuid:'00112233-4455-6677-8899-aabbccddeeff', root:'aa'.repeat(32), level:'l3', timestamp:'2025-01-01T00:00:00Z' };
  const k1 = deriveKey(shared, infoString({ ...base, domain:'KFv1' }));
  const k2 = deriveKey(shared, infoString({ ...base, domain:'TLv1' }));
  const k3 = deriveKey(shared, infoString({ ...base, domain:'TRv1' }));
  expect(k1).not.toBe(k2);
  expect(k2).not.toBe(k3);
  expect(k1).not.toBe(k3);
});

Golden vectors (examples)

examples/good/spv-bundle-kf-single.json
{
  "version": "spv-1",
  "network": "mainnet",
  "type": "KFv1",
  "leaf": { "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "index": 0 },
  "batch": {
    "root": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "siblings": [],
    "domain": "KFv1"
  },
  "tx": {
    "txid": "1111111111111111111111111111111111111111111111111111111111111111",
    "vout": 0,
    "scriptPubKey": "006a05414e434852044b46763120e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b8551000112233445566778899aabbccddeeff",
    "value": 0
  },
  "block": { "height": 1, "header": "00".repeat(80), "txMerkle": { "siblings": [], "index": 0 } },
  "headersChain": ["00".repeat(80)],
  "policy": { "minConfs": 0, "anchoredAt": "2025-01-01T00:00:00Z" },
  "meta": { "batchId": "00112233-4455-6677-8899-aabbccddeeff" }
}

examples/good/fragment-kf.json
{
  "fragmentId": "mf_abc",
  "contentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "createdAt": "2025-01-01T12:00:00Z",
  "owner": { "identityKey": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  "writer": { "identityKey": "02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  "kind": "completion",
  "tags": ["fraud","inference"],
  "status": "active",
  "parents": [],
  "provenance": {
    "source": "https://example.com/doc",
    "timestamp": "2025-01-01T12:00:00Z",
    "issuer": "02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "context": { "uuid": "aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff", "access": "l3" }
  },
  "proofBundle": { "$refNote": "insert spv-bundle-kf-single.json here at runtime" }
}

examples/good/write-request.json
{
  "owner": { "identityKey": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  "writer": { "identityKey": "02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  "kind": "completion",
  "createdAt": "2025-01-01T12:00:00Z",
  "tags": ["fraud","inference"],
  "contentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "encryptedPayload": "BASE64==",
  "encryption": {
    "alg": "aes-256-gcm",
    "ephemeralPubKey": "02cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "recipientPubKey": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "kdf": "hkdf-sha256",
    "nonce": "00112233445566778899aabb"
  },
  "payloadRef": null,
  "signature": { "identityKey": "02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "nonce": "n-abc", "signature": "3045..." }
}

examples/good/policy.json
{
  "policyId": "pol_1",
  "scope": "owner",
  "ownerKey": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "rules": {
    "allowReaders": ["02dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"],
    "allowTags": ["inference","log"],
    "expiresAt": 1790000000
  },
  "createdAt": "2025-01-01T12:00:00Z",
  "signature": { "identityKey": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "nonce": "n-1", "signature": "3045..." }
}

examples/good/map-message.json
{
  "app": "chat.example",
  "type": "message",
  "context": "channel",
  "contextValue": "my-chatroom",
  "tags": ["bitcoin","bsv"],
  "anchorDomain": "KFv1",
  "anchorRoot": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "anchorBatchId": "00112233-4455-6677-8899-aabbccddeeff",
  "contentHash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
}

examples/bad/spv-bundle-domain-mismatch.json
{
  "version": "spv-1",
  "network": "mainnet",
  "type": "KFv1",
  "leaf": { "hash": "00".repeat(32), "index": 0 },
  "batch": { "root": "00".repeat(32), "siblings": [], "domain": "TLv1" },
  "tx": { "txid": "11".repeat(32), "vout": 0, "scriptPubKey": "006a", "value": 0 },
  "block": { "height": 1, "header": "00".repeat(80), "txMerkle": { "siblings": [], "index": 0 } },
  "headersChain": ["00".repeat(80)],
  "policy": { "minConfs": 0, "anchoredAt": "2025-01-01T00:00:00Z" },
  "meta": { "batchId": "00112233-4455-6677-8899-aabbccddeeff" }
}

examples/bad/fragment-missing-proof.json
{
  "fragmentId": "mf_bad",
  "contentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "createdAt": "2025-01-01T12:00:00Z",
  "owner": { "identityKey": "02aa" },
  "kind": "completion",
  "provenance": { "source": "https://x", "timestamp": "2025-01-01T12:00:00Z", "issuer": "02bb", "context": { "uuid": "aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff", "access": "l3" } }
}

Notes
- Primitives and identity schemas: this patch assumes you already host primitives.json ($defs: Hex32, PubKey, ISOTime, Url) and identity.json, plus brc31-signature.json. If you need stubs, I can provide them.
- SPV-first: these tests do not hit the network; they validate Merkle, ANCHR encoding, and HKDF domain separation locally. Integrate your SPV header client separately.
- Keep domain separation consistent across ANCHR, bundle.type, and HKDF info (KFv1/TLv1/TRv1).

Testing:

Great—here are drop-in unit and integration tests to enforce D42 end-to-end. They are SPV-first, BSV-aligned, and vendor-neutral. I’ve included minimal helpers (verifyBundle), an in-memory/Redis-mock Express app for endpoints, and Supertest flows. Wire these into your repo and CI.

Add dev dependencies
- jest, ts-jest, @types/jest
- supertest, @types/supertest
- express, body-parser
- ioredis-mock
- ajv, ajv-formats (already)
- @noble/secp256k1 (for signature tests if needed)

Example package.json additions
{
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/supertest": "^2.0.12",
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "body-parser": "^1.20.2",
    "express": "^4.19.2",
    "ioredis-mock": "^8.9.0",
    "@noble/secp256k1": "^2.0.0",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.6.3"
  },
  "scripts": {
    "test": "jest --colors",
    "build": "tsc -p .",
    "validate:mem": "node ./scripts/ajv-validate.mjs",
    "validate:mem-bad": "node ./scripts/ajv-validate-bad.mjs"
  }
}

Jest config (jest.config.cjs)
module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', {}] },
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 20000
};

1) Unit tests
A. Merkle, ANCHR, HKDF (extend what you have)

tests/unit/merkle.test.ts
import { buildRoot, computeRootFromProof } from '../../src/merkle';

describe('Merkle (single SHA-256)', () => {
  const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  it('single-leaf: root equals leaf', () => {
    const root = buildRoot([EMPTY]);
    expect(root).toBe(EMPTY);
    expect(computeRootFromProof(EMPTY, [], 0)).toBe(EMPTY);
  });

  it('two-leaves: left/right proofs validate', () => {
    const a = '00'.repeat(32), b = '11'.repeat(32);
    const root = buildRoot([a, b]);
    expect(computeRootFromProof(a, [b], 0)).toBe(root);
    expect(computeRootFromProof(b, [a], 1)).toBe(root);
  });

  it('odd count: last duplicated', () => {
    const a = 'aa'.repeat(32), b = 'bb'.repeat(32), c = 'cc'.repeat(32);
    const root = buildRoot([a, b, c]); // c is duplicated at this level
    expect(typeof root).toBe('string');
    expect(root.length).toBe(64);
  });

  it('tamper detection: wrong sibling fails', () => {
    const a = 'aa'.repeat(32), b = 'bb'.repeat(32);
    const root = buildRoot([a, b]);
    const wrong = 'cc'.repeat(32);
    expect(computeRootFromProof(a, [wrong], 0)).not.toBe(root);
  });
});

tests/unit/opreturn.test.ts
import { assembleANCHR, decodeANCHR } from '../../src/opreturn';

describe('ANCHR OP_RETURN envelope', () => {
  it('assemble/decode round-trip', () => {
    const root = 'aa'.repeat(32);
    const uuid = '00112233-4455-6677-8899-aabbccddeeff';
    const hex = assembleANCHR('KFv1', root, uuid);
    const dec = decodeANCHR(hex);
    expect(dec.tag).toBe('ANCHR');
    expect(dec.domain).toBe('KFv1');
    expect(dec.root).toBe(root);
    expect(dec.batchIdHex).toBe(uuid.replace(/-/g, '').toLowerCase());
  });

  it('rejects invalid root hex length', () => {
    expect(() => assembleANCHR('KFv1', 'aa', '00112233-4455-6677-8899-aabbccddeeff')).toThrow();
  });

  it('rejects non OP_FALSE/OP_RETURN', () => {
    expect(() => decodeANCHR('ff6a')).toThrow();
  });
});

tests/unit/hkdf.test.ts
import { infoString, deriveKey } from '../../src/hkdfInfo';

describe('HKDF domain separation', () => {
  const shared = '11'.repeat(32);
  const base = {
    sessionId: 'sess',
    uuid: '00112233-4455-6677-8899-aabbccddeeff',
    root: 'aa'.repeat(32),
    level: 'l3',
    timestamp: '2025-01-01T00:00:00Z'
  };

  it('domain changes the derived key', () => {
    const k1 = deriveKey(shared, infoString({ ...base, domain: 'KFv1' }));
    const k2 = deriveKey(shared, infoString({ ...base, domain: 'TLv1' }));
    const k3 = deriveKey(shared, infoString({ ...base, domain: 'TRv1' }));
    expect(k1).not.toBe(k2);
    expect(k2).not.toBe(k3);
    expect(k1).not.toBe(k3);
  });

  it('context changes the key', () => {
    const k1 = deriveKey(shared, infoString({ ...base, domain: 'KFv1', sessionId: 'A' }));
    const k2 = deriveKey(shared, infoString({ ...base, domain: 'KFv1', sessionId: 'B' }));
    expect(k1).not.toBe(k2);
  });
});

B. Schema validation (good/bad vectors)

tests/unit/schemas.test.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';

describe('Schemas (Ajv strict)', () => {
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);

  const schemaPaths = [
    'schemas/v1/spv-proof-bundle-v1.json',
    'schemas/v1/ai-memory-fragment-v1.json',
    'schemas/v1/ai-memory-write-request-v1.json',
    'schemas/v1/ai-memory-access-policy-v1.json',
    'schemas/v1/map-message-v1.json'
  ];
  beforeAll(() => {
    schemaPaths.forEach(p => ajv.addSchema(JSON.parse(fs.readFileSync(p, 'utf8')), p));
  });

  function validate(file: string, schemaKey: string) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const validate = ajv.getSchema(schemaKey)!;
    const ok = validate(data);
    if (!ok) throw new Error(JSON.stringify(validate.errors, null, 2));
  }

  it('valid examples pass', () => {
    validate('examples/good/spv-bundle-kf-single.json', 'schemas/v1/spv-proof-bundle-v1.json');
    validate('examples/good/fragment-kf.json', 'schemas/v1/ai-memory-fragment-v1.json');
    validate('examples/good/write-request.json', 'schemas/v1/ai-memory-write-request-v1.json');
    validate('examples/good/policy.json', 'schemas/v1/ai-memory-access-policy-v1.json');
    validate('examples/good/map-message.json', 'schemas/v1/map-message-v1.json');
  });

  it('bad vectors fail', () => {
    const badBundle = JSON.parse(fs.readFileSync('examples/bad/spv-bundle-domain-mismatch.json', 'utf8'));
    const schema = ajv.getSchema('schemas/v1/spv-proof-bundle-v1.json')!;
    expect(schema(badBundle)).toBe(false);
  });
});

C. SPV bundle verification unit (local, deterministic)

src/verifyBundle.ts
import { computeRootFromProof } from './merkle';
import { decodeANCHR } from './opreturn';

export function verifySpvBundle(bundle: any): { ok: boolean, reason?: string } {
  try {
    // 1) type == batch.domain
    if (bundle.type !== bundle.batch.domain) return { ok: false, reason: 'domain_mismatch' };
    // 2) leaf -> root
    const root = computeRootFromProof(bundle.leaf.hash, bundle.batch.siblings, bundle.leaf.index);
    if (root !== bundle.batch.root) return { ok: false, reason: 'leaf_to_root_failed' };
    // 3) root in ANCHR script
    const dec = decodeANCHR(bundle.tx.scriptPubKey);
    if (dec.tag !== 'ANCHR') return { ok: false, reason: 'no_anchr' };
    if (dec.domain !== bundle.batch.domain) return { ok: false, reason: 'anchr_domain_mismatch' };
    if (dec.root !== bundle.batch.root) return { ok: false, reason: 'root_mismatch' };
    if (bundle.meta?.batchId && dec.batchIdHex !== bundle.meta.batchId.replace(/-/g, '').toLowerCase())
      return { ok: false, reason: 'batchId_mismatch' };
    // 4) tx->block (txMerkle). For single-tx test vectors, siblings=[]
    // Assume valid; integration tests will plug full SPV client
    // 5) headersChain presence and length
    if (!Array.isArray(bundle.headersChain) || bundle.headersChain.length < 1)
      return { ok: false, reason: 'no_headers_chain' };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e.message };
  }
}

tests/unit/verifyBundle.test.ts
import fs from 'node:fs';
import { verifySpvBundle } from '../../src/verifyBundle';

describe('SPV bundle local verification (deterministic)', () => {
  it('accepts valid single-leaf bundle', () => {
    const b = JSON.parse(fs.readFileSync('examples/good/spv-bundle-kf-single.json', 'utf8'));
    const r = verifySpvBundle(b);
    expect(r.ok).toBe(true);
  });

  it('rejects domain mismatch', () => {
    const b = JSON.parse(fs.readFileSync('examples/bad/spv-bundle-domain-mismatch.json', 'utf8'));
    const r = verifySpvBundle(b);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('domain_mismatch');
  });
});

2) Integration tests (Express + Redis mock + Supertest)
These simulate the core API flow: write → anchor → bundle → verify → get → search → policy.

tests/integration/app.ts
import express from 'express';
import bodyParser from 'body-parser';
import Redis from 'ioredis-mock';
import { assembleANCHR } from '../../src/opreturn';
import { buildRoot } from '../../src/merkle';

export function makeApp() {
  const app = express();
  app.use(bodyParser.json({ limit: '1mb' }));
  const redis = new (Redis as any)();

  // Config
  const minConfs = 0;
  const network = 'mainnet';
  const tip = { height: 1, header: '00'.repeat(80), updatedAt: Date.now() };
  redis.set('spv:tip', JSON.stringify(tip));

  // In-memory storage
  const mem: Record<string, any> = {};
  const bundles: Record<string, any> = {};

  // /ready
  app.get('/ready', (req, res) => {
    res.json({ network, minConfs, allowedDomains: ['KFv1','TLv1','TRv1'], tipHeight: tip.height, tipHeader: tip.header, maxBundleAgeMs: 86400000 });
  });

  // /ai/memory/write
  app.post('/ai/memory/write', async (req, res) => {
    const wr = req.body;
    // Minimal checks (schema/BR31 should be enforced in gateway)
    if (!wr.owner || !wr.writer || !wr.contentHash) return res.status(400).json({ error: 'schema_error' });
    const fragmentId = 'mf_' + Math.random().toString(36).slice(2, 10);
    const fragment = {
      fragmentId,
      contentHash: wr.contentHash,
      createdAt: wr.createdAt || new Date().toISOString(),
      owner: wr.owner,
      writer: wr.writer,
      kind: wr.kind || 'completion',
      tags: wr.tags || [],
      status: 'active',
      parents: [],
      provenance: {
        source: 'https://example.com/doc',
        timestamp: wr.createdAt || new Date().toISOString(),
        issuer: wr.writer.identityKey,
        context: { uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff', access: 'l3' }
      },
      proofBundle: null
    };
    mem[fragmentId] = fragment;
    await redis.sadd(`ai:ns::mem:by_owner:${wr.owner.identityKey}`, fragmentId);
    await redis.zadd('ai:ns::mem:by_time', Date.now()/1000, fragmentId);
    res.json({ fragmentId, status: 'ok' });
  });

  // /anchor (internal)
  app.post('/anchor', async (req, res) => {
    const { type, batchId, contentHashes } = req.body as { type: 'KFv1'|'TLv1'|'TRv1', batchId: string, contentHashes: string[] };
    if (!type || !batchId || !Array.isArray(contentHashes) || contentHashes.length === 0) return res.status(400).json({ error: 'schema_error' });
    const root = buildRoot(contentHashes);
    const scriptPubKey = assembleANCHR(type, root, batchId);
    const txid = '11'.repeat(32);
    const bundleTemplate = {
      version: 'spv-1',
      network,
      type,
      leaf: { hash: contentHashes[0], index: 0 },
      batch: { root, siblings: [], domain: type },
      tx: { txid, vout: 0, scriptPubKey, value: 0 },
      block: { height: tip.height, header: tip.header, txMerkle: { siblings: [], index: 0 } },
      headersChain: [tip.header],
      policy: { minConfs, anchoredAt: new Date().toISOString() },
      meta: { batchId }
    };
    // attach to first fragment that matches
    for (const id in mem) {
      if (mem[id].contentHash === contentHashes[0]) {
        mem[id].proofBundle = bundleTemplate;
        bundles[id] = bundleTemplate;
      }
    }
    res.json({ txid, merkleRoot: root, type, anchoredAt: Date.now(), minConfs });
  });

  // /bundle/:fragmentId
  app.get('/bundle/:id', (req, res) => {
    const b = bundles[req.params.id];
    if (!b) return res.status(404).json({ error: 'not_found' });
    res.set('Cache-Control', 'public, max-age=60');
    res.set('ETag', `spv-bundle-${req.params.id}-${b.block.height}`);
    res.json(b);
  });

  // /ai/memory/:fragmentId
  app.get('/ai/memory/:id', (req, res) => {
    const f = mem[req.params.id];
    if (!f) return res.status(404).json({ error: 'not_found' });
    res.json(f);
  });

  // /ai/memory/search
  app.get('/ai/memory/search', async (req, res) => {
    const { ownerKey } = req.query as any;
    const ids = ownerKey ? await redis.smembers(`ai:ns::mem:by_owner:${ownerKey}`) : Object.keys(mem);
    res.json({ items: ids.map(id => ({ fragmentId: id, contentHash: mem[id].contentHash, createdAt: mem[id].createdAt })), nextOffset: null });
  });

  // /ai/memory/policy
  app.post('/ai/memory/policy', async (req, res) => {
    const pol = req.body;
    if (!pol || !pol.scope || !pol.policyId) return res.status(400).json({ error: 'schema_error' });
    await redis.set(`ai:ns::policy:${pol.policyId}`, JSON.stringify(pol));
    res.json({ policyId: pol.policyId, status: 'ok' });
  });

  return app;
}

tests/integration/flow.test.ts
import request from 'supertest';
import { makeApp } from './app';
import { verifySpvBundle } from '../../src/verifyBundle';

describe('D42 integration flow', () => {
  const app = makeApp();

  const owner = { identityKey: '02'.padEnd(66, 'a') };
  const writer = { identityKey: '02'.padEnd(66, 'b') };
  const contentHash = 'aa'.repeat(32);
  const createdAt = '2025-01-01T12:00:00Z';

  let fragmentId = '';
  it('GET /ready', async () => {
    const r = await request(app).get('/ready').expect(200);
    expect(r.body.network).toBe('mainnet');
    expect(r.body.allowedDomains).toContain('KFv1');
  });

  it('POST /ai/memory/write', async () => {
    const r = await request(app)
      .post('/ai/memory/write')
      .send({ owner, writer, kind: 'completion', createdAt, contentHash, encryptedPayload: 'BASE64==' })
      .expect(200);
    fragmentId = r.body.fragmentId;
    expect(fragmentId).toMatch(/^mf_/);
  });

  it('POST /anchor (internal) -> attach bundle', async () => {
    const batchId = '00112233-4455-6677-8899-aabbccddeeff';
    const r = await request(app)
      .post('/anchor')
      .send