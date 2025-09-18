// postman/tests/bundle_schema_test_tv4.js

pm.test("Status 200", () => pm.response.to.have.status(200));
const json = pm.response.json();

// Minimal inline schema (no $ref)
const bundleSchema = {
  type: "object",
  required: ["bundleType", "target", "graph", "manifests", "proofs"],
  properties: {
    bundleType: { const: "datasetLineageBundle" },
    target: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
    graph: {
      type: "object",
      required: ["nodes", "edges"],
      properties: {
        nodes: {
          type: "array",
          items: {
            type: "object",
            required: ["versionId", "manifestHash", "txo"],
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
            required: ["child", "parent"],
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
        required: ["manifestHash", "manifest"],
        properties: {
          manifestHash: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
          manifest: { type: "object" } // we don't $ref in tv4 minimal mode
        },
        additionalProperties: true
      }
    },
    proofs: {
      type: "array",
      items: {
        type: "object",
        required: ["versionId", "envelope"],
        properties: {
          versionId: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
          envelope: {
            type: "object",
            required: ["rawTx", "proof"],
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
    confsUsed: { type: ["integer", "null"] },
    bestHeight: { type: ["integer", "null"] }
  },
  additionalProperties: true
};

pm.test("Bundle matches schema (tv4)", function () {
  const valid = tv4.validate(json, bundleSchema);
  if (!valid) console.log("tv4 error:", tv4.error);
  pm.expect(valid, JSON.stringify(tv4.error, null, 2)).to.be.true;
});
