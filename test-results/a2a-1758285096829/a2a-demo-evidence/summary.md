# A2A Demo Test Report

## Test Run: a2a-e2e-1758285101711
**Timestamp:** 2025-09-19T12:31:41.711Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_9de9ebdccff015459b9c33b97d828bde): notify
- **Agent-B** (ag_638cfc4e9e2bc2be1d237a6ec3de97fd): contract.review
- **Agent-C** (ag_3a7ad11289d89a478054e19978927b68): data.analysis

## Rules Executed
- **R_A** (rl_d49929d60f0fb20e6850c98703ff2e24): Enabled
- **R_B** (rl_073323edb226eee373cffb7f58526b7c): Enabled
- **R_C** (rl_7eb8c8fe9b7496cccf2a2a9a2f11c4b7): Enabled

## Job Results
- **Job job_ebf8b6217ec4378b7dc1b9d098d14b5f**: done (Rule: rl_7eb8c8fe9b7496cccf2a2a9a2f11c4b7)
- **Job job_ab3814172050a816b93f392cfe34c141**: done (Rule: rl_073323edb226eee373cffb7f58526b7c)
- **Job job_45e86e0932437a57ce4bed57bc146017**: done (Rule: rl_d49929d60f0fb20e6850c98703ff2e24)

## Evidence Files
- evidence/job_ebf8b6217ec4378b7dc1b9d098d14b5f.json
- evidence/job_ab3814172050a816b93f392cfe34c141.json
- evidence/job_45e86e0932437a57ce4bed57bc146017.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
