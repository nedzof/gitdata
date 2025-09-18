// postman/tests/advisory_schema_test_ajv.js

pm.test("Status 200", () => pm.response.to.have.status(200));
const arr = pm.response.json();
pm.sendRequest("https://cdnjs.cloudflare.com/ajax/libs/ajv/6.12.6/ajv.min.js", (err, res) => {
  pm.test("Ajv loaded", () => { pm.expect(err).to.eql(null); pm.expect(res.code).to.eql(200); });
  eval(res.text());
  const ajv = new Ajv({ allErrors: true, schemaId: 'auto' });
  const schema = {
    $id: "advisory.schema.json",
    type: "object",
    required: ["versionId","severity","reason","signature"],
    properties: {
      versionId: { type: "string", pattern: "^[0-9a-fA-F]{64}$" },
      severity: { type: "string", enum: ["CRITICAL","WARNING"] },
      reason: { type: "string", minLength: 3 },
      issuerKey: { type: "string" },
      issuedAt: { type: "string" },
      signature: { type: "string", minLength: 10 }
    },
    additionalProperties: true
  };
  arr.forEach((item, i) => {
    const validate = ajv.compile(schema);
    const ok = validate(item);
    if (!ok) console.log(`Advisory[${i}]`, validate.errors);
    pm.test(`Advisory[${i}] schema (Ajv)`, () => pm.expect(ok, JSON.stringify(validate.errors, null, 2)).to.be.true);
  });
});
