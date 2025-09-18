// postman/tests/advisory_schema_test_tv4.js

pm.test("Status 200", () => pm.response.to.have.status(200));
// On POST /advisories we get {status:"ok"} — schema test belongs on GET /advisories.
// For GET /advisories, validate each item:

if (pm.request.method === "GET") {
  const arr = pm.response.json();
  pm.test("Advisories is array", () => pm.expect(arr).to.be.an('array'));
  const advisorySchema = {
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
  arr.forEach((a, idx) => {
    const ok = tv4.validate(a, advisorySchema);
    if (!ok) console.log("tv4 error at index", idx, tv4.error);
    pm.test(`Advisory[${idx}] schema (tv4)`, () => pm.expect(ok, JSON.stringify(tv4.error, null, 2)).to.be.true);
  });
}
