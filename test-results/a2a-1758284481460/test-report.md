# D16 A2A Test Report

## Test Execution Summary
**Timestamp:** 2025-09-19T12:21:21.460Z
**Node Version:** v18.19.1
**Overlay Port:** 3030

## Test Results

### Unit Tests
- **Status:** ❌ FAILED
- **Output:** Command failed: npm test
stderr | test/integration/ready.spec.ts
ready tests failed: Error: Cannot find module '../../src/routes/ready'
Require stack:
- /home/caruk/Downloads/gitdata/test/integration/ready.spec.ts
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1134:15)
    at Function.resolve (node:internal/modules/helpers:188:19)
    at run (/home/caruk/Downloads/gitdata/test/integration/ready.spec.ts:52:32)
    at /home/caruk/Downloads/gitdata/test/integration/ready.spec.ts:165:1
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at VitestExecutor.runModule (file:///home/caruk/Downloads/gitdata/node_modules/vite-node/dist/client.mjs:399:5)
    at VitestExecutor.directRequest (file:///home/caruk/Downloads/gitdata/node_modules/vite-node/dist/client.mjs:381:5)
    at VitestExecutor.cachedRequest (file:///home/caruk/Downloads/gitdata/node_modules/vite-node/dist/client.mjs:206:14)
    at VitestExecutor.executeId (file:///home/caruk/Downloads/gitdata/node_modules/vite-node/dist/client.mjs:173:12)
    at collectTests (file:///home/caruk/Downloads/gitdata/node_modules/@vitest/runner/dist/index.js:851:7) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [ '/home/caruk/Downloads/gitdata/test/integration/ready.spec.ts' ]
}

⎯⎯⎯⎯⎯⎯ Failed Suites 21 ⎯⎯⎯⎯⎯⎯

 FAIL  test/a2a-workflow.test.ts [ test/a2a-workflow.test.ts ]
ReferenceError: describe is not defined
 ❯ test/a2a-workflow.test.ts:26:1
     24| const AGENT_WEBHOOK_URL = `http://localhost:${TEST_PORT}/webhook`;
     25| 
     26| describe('A2A Workflow Integration', () => {
       | ^
     27|   let app: express.Application;
     28|   let db: any;

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/21]⎯

 FAIL  test/opreturn-dlm1.spec.ts [ test/opreturn-dlm1.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/opreturn-dlm1.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/21]⎯

 FAIL  test/opreturn.spec.ts [ test/opreturn.spec.ts ]
AssertionError: Expected values to be strictly equal:

null !== 'DLM1'


- Expected: 
"DLM1"

+ Received: 
null

 ❯ run test/opreturn.spec.ts:124:10
    122|   assert.strictEqual(o1.vout, 0);
    123|   assert.strictEqual(o1.hasOpFalse, true);
    124|   assert.strictEqual(o1.pushesAscii[0], 'DLM1');
       |          ^
    125|   assert.ok(o1.pushesHex[0].toLowerCase() === Buffer.from('DLM1').toSt…
    126| 
 ❯ test/opreturn.spec.ts:166:1

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/21]⎯

 FAIL  test/spv.spec.ts [ test/spv.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/spv.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/21]⎯

 FAIL  test/integration/a2a-e2e.spec.ts [ test/integration/a2a-e2e.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/a2a-e2e.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/21]⎯

 FAIL  test/integration/advisories-spv.spec.ts [ test/integration/advisories-spv.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/advisories-spv.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/21]⎯

 FAIL  test/integration/advisories.spec.ts [ test/integration/advisories.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/advisories.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/21]⎯

 FAIL  test/integration/cache.spec.ts [ test/integration/cache.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/cache.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/21]⎯

 FAIL  test/integration/data.spec.ts [ test/integration/data.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/data.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/21]⎯

 FAIL  test/integration/limits.spec.ts [ test/integration/limits.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/limits.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[10/21]⎯

 FAIL  test/integration/metrics.spec.ts [ test/integration/metrics.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/metrics.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[11/21]⎯

 FAIL  test/integration/pay.spec.ts [ test/integration/pay.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/pay.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[12/21]⎯

 FAIL  test/integration/price.spec.ts [ test/integration/price.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/price.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[13/21]⎯

 FAIL  test/integration/pricebook.spec.ts [ test/integration/pricebook.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/pricebook.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[14/21]⎯

 FAIL  test/integration/producer-onboard.spec.ts [ test/integration/producer-onboard.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/producer-onboard.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[15/21]⎯

 FAIL  test/integration/producers.spec.ts [ test/integration/producers.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/producers.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[16/21]⎯

 FAIL  test/integration/ready.spec.ts [ test/integration/ready.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/ready.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[17/21]⎯

 FAIL  test/integration/sdk-types.spec.ts [ test/integration/sdk-types.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/sdk-types.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[18/21]⎯

 FAIL  test/integration/sdk.spec.ts [ test/integration/sdk.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/sdk.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[19/21]⎯

 FAIL  test/integration/submit-flow.spec.ts [ test/integration/submit-flow.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/submit-flow.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[20/21]⎯

 FAIL  test/integration/tx-builder.spec.ts [ test/integration/tx-builder.spec.ts ]
Error: No test suite found in file /home/caruk/Downloads/gitdata/test/integration/tx-builder.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[21/21]⎯


⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
Error: process.exit unexpectedly called with "1"
 ❯ process.exit node_modules/vitest/dist/chunks/execute.2pr0rHgK.js:600:11
 ❯ test/integration/ready.spec.ts:167:11
    165| })().catch((e) => {
    166|   console.error('ready tests failed:', e);
    167|   process.exit(1);
       |           ^
    168| });
 ❯ processTicksAndRejections node:internal/process/task_queues:95:5

This error originated in "test/integration/ready.spec.ts" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
The latest test that might've caused the error is "test/integration/ready.spec.ts". It might mean one of the following:
- The error was thrown, while Vitest was running this test.
- If the error occurred after the test had been completed, this was the last documented test before it was thrown.



### Integration Tests
- **Status:** ❌ FAILED
- **Output:** ✓ Metrics data verified: {
  requests: 2,
  admissions: 3,
  cacheHits: 1,
  cacheMisses: 1,
  proofSamples: 2
}
OK: /metrics & /health tests passed.


### End-to-End Tests
- **Status:** ✅ PASSED
- **Output:** E2E test completed successfully with evidence collection
- **Evidence Directory:** /tmp/a2a-demo-evidence-1758284487691

## Artifacts Status

### Required Artifacts (D16 Section 9)
- **Postman Collection:** ✅ Present
- **Evidence Directory:** ✅ Generated
- **Summary Report:** ✅ Generated

## D16 Definition of Done (DoD) Compliance

### E2E-Minimal Requirements
- **Agents registered and discoverable:** ✅
- **Rules executed successfully:** ✅
- **Jobs state transitions working:** ✅
- **BRC-31 signed webhook evidence:** ✅

### Acceptance Criteria Met
- **Agent registry/discovery:** ✅
- **Rule CRUD and triggering:** ✅
- **Job queue processing:** ✅
- **Evidence collection:** ✅

## Overall Status
**❌ FAILURE**


## Errors Found: 1



## Generated Files
- Test results: /home/caruk/Downloads/gitdata/test-results/a2a-1758284481460
- A2A evidence: a2a-demo-evidence/
- This report: /home/caruk/Downloads/gitdata/test-results/a2a-1758284481460/test-report.md

---
Generated by D16 A2A Test Runner
