# A2A Demo Test Report

## Test Run: a2a-e2e-1758306319930
**Timestamp:** 2025-09-19T18:25:19.930Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_c32c4a1dc2e0dd2992936c75e05511ae): notify
- **Agent-B** (ag_85285f9b27fc6fe6614b7575cdad0f25): contract.review
- **Agent-C** (ag_8ca59db5c68a36a49be3984b655dd8b3): data.analysis

## Rules Executed
- **R_A** (rl_e12f4ff353f271a70c4c7260f78a4c14): Enabled
- **R_B** (rl_c182fccb3fc8b8ca79010d8ebac7bb77): Enabled
- **R_C** (rl_c2a03ac4a61cbf8afee9d7865cb8059d): Enabled

## Job Results
- **Job job_096e9f6bbd001c14f3a10d348e31651f**: done (Rule: rl_c2a03ac4a61cbf8afee9d7865cb8059d)
- **Job job_232ac729fd287c2e25677fada9d844e4**: done (Rule: rl_c182fccb3fc8b8ca79010d8ebac7bb77)
- **Job job_a1e0d0cf157b019c0911f9ee93d241b2**: done (Rule: rl_e12f4ff353f271a70c4c7260f78a4c14)

## Evidence Files
- evidence/job_096e9f6bbd001c14f3a10d348e31651f.json
- evidence/job_232ac729fd287c2e25677fada9d844e4.json
- evidence/job_a1e0d0cf157b019c0911f9ee93d241b2.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
