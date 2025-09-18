// postman/tests/bundle_schema_test_ajv.js

pm.test("Status 200", () => pm.response.to.have.status(200));
const data = pm.response.json();

// --- Schemas (inline) ---
const manifestSchema = {
  $id: "dlm1-manifest.schema.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "DLM1 Off-chain Manifest",
  type: "object",
  required: ["type","datasetId","content","provenance","policy"],
  properties: {
    type: { const: "datasetVersionManifest" },
    datasetId: { type: "string", minLength: 3 },
    versionId: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
    description: { type: "string" },
    content: {
      type: "object",
      required: ["contentHash"],
      properties: {
        contentHash: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
        sizeBytes: { type: "integer", minimum: 0 },
        mimeType: { type: "string" }
      },
      additionalProperties: true
    },
    lineage: {
      type: "object",
      properties: {
        parents: { type: "array", items: { type: "string", pattern: "^[0-9a-fA-F]{64}$" } }
      },
      additionalProperties: true
    },
    provenance: {
      type: "object",
      required: ["createdAt"],
      properties: {
        producer: { type: "object", properties: { identityKey: { type: "string" } }, additionalProperties: true },
        createdAt: { type: "string" }
      },
      additionalProperties: true
    },
    policy: {
      type: "object",
      required: ["license","classification"],
      properties: {
        license: { type: "string" },
        classification: { type: "string" }
      },
      additionalProperties: true
    },
    signatures: { type: "object", additionalProperties: true }
  },
  additionalProperties: true
};

const bundleSchema = {
  $id: "lineage-bundle.schema.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Lineage Bundle",
  type: "object",
  required: ["bundleType","target","graph","manifests","proofs"],
  properties: {
    bundleType: { const: "datasetLineageBundle" },
    target: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
    graph: {
      type: "object",
      required: ["nodes","edges"],
      properties: {
        nodes: {
          type: "array",
          items: {
            type: "object",
            required: ["versionId","manifestHash","txo"],
            properties: {
              versionId: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
              manifestHash: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
              txo: { type: "string", minLength: 10 }
            },
            additionalProperties: true
          }
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            required: ["child","parent"],
            properties: {
              child: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
              parent: { type: "string", pattern: "^[0-9a-fA-F]{64}$" }
            },
            additionalProperties: true
          }
        }
      },
      additionalProperties: true
    },
    manifests: {
      type: "array",
      items: {
        type: "object",
        required: ["manifestHash","manifest"],
        properties: {
          manifestHash: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
          manifest: { $ref: "dlm1-manifest.schema.json" }
        },
        additionalProperties: true
      }
    },
    proofs: {
      type: "array",
      items: {
        type: "object",
        required: ["versionId","envelope"],
        properties: {
          versionId: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
          envelope: {
            type: "object",
            required: ["rawTx","proof"],
            properties: {
              rawTx: { type: "string", minLength: 10 },
              proof: { type: "object" }
            },
            additionalProperties: true
          }
        },
        additionalProperties: true
      }
    },
    confsUsed: { type: ["integer","null"] },
    bestHeight: { type: ["integer","null"] }
  },
  additionalProperties: true
};

// --- Load Ajv from CDN, validate, assert ---
pm.sendRequest("https://cdnjs.cloudflare.com/ajax/libs/ajv/6.12.6/ajv.min.js", function (err, res) {
  pm.test("Ajv loaded", function () {
    pm.expect(err).to.eql(null);
    pm.expect(res.code).to.eql(200);
  });
  // Evaluate Ajv library in Postman sandbox
  eval(res.text());
  const ajv = new Ajv({ allErrors: true, jsonPointers: true, schemaId: 'auto' });
  // Optional formats if needed:
  // ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-07.json'));

  ajv.addSchema(manifestSchema, manifestSchema.$id);
  const validate = ajv.compile(bundleSchema);
  const valid = validate(data);
  if (!valid) console.log("Ajv errors:", validate.errors);
  pm.test("Bundle matches schema (Ajv)", () => pm.expect(valid, JSON.stringify(validate.errors, null, 2)).to.be.true);
});
