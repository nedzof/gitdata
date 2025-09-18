// postman/tests/receipt_schema_test_tv4.js

pm.test("Status 200", () => pm.response.to.have.status(200));
const json = pm.response.json();

const receiptSchema = {
  $id: "receipt",
  type: "object",
  required: ["receiptId","resource","class","quantity","amountSat","expiresAt","signature"],
  properties: {
    receiptId: { type: "string" },
    resource: { type: "string" },
    class: { type: "string" },
    quantity: { type: "integer", minimum: 1 },
    amountSat: { type: "integer", minimum: 0 },
    expiresAt: { type: "string" },
    signature: { type: "string", minLength: 10 },
    attrs: { type: "object" }
  },
  additionalProperties: true
};

pm.test("Receipt matches schema (tv4)", function () {
  const valid = tv4.validate(json, receiptSchema);
  if (!valid) console.log("tv4 error:", tv4.error);
  pm.expect(valid, JSON.stringify(tv4.error, null, 2)).to.be.true;
});
