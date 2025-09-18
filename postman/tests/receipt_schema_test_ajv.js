// postman/tests/receipt_schema_test_ajv.js

pm.test("Status 200", () => pm.response.to.have.status(200));
const json = pm.response.json();
pm.sendRequest("https://cdnjs.cloudflare.com/ajax/libs/ajv/6.12.6/ajv.min.js", (err, res) => {
  pm.test("Ajv loaded", () => { pm.expect(err).to.eql(null); pm.expect(res.code).to.eql(200); });
  eval(res.text());
  const ajv = new Ajv({ allErrors: true, schemaId: 'auto' });
  const schema = {
    $id: "receipt.schema.json",
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
  const validate = ajv.compile(schema);
  const ok = validate(json);
  if (!ok) console.log(validate.errors);
  pm.test("Receipt schema (Ajv)", () => pm.expect(ok, JSON.stringify(validate.errors, null, 2)).to.be.true);
});
