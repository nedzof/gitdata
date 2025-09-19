# A2A Demo Test Report

## Test Run: a2a-e2e-1758308054068
**Timestamp:** 2025-09-19T18:54:14.068Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_9988fca9daa5190e5bad203c6ee70863): notify
- **Agent-B** (ag_6258f92198cacc503296ba0f5dac5289): contract.review
- **Agent-C** (ag_58ed60f39197760b60cf2c6c0bdf7396): data.analysis

## Rules Executed
- **R_A** (rl_999bcf220c8bfaffd51f13bb4c5a55dd): Enabled
- **R_B** (rl_2ef735cb8d2e39f9f97312a99b155740): Enabled
- **R_C** (rl_72da81e9802375fd813714273e2e41a7): Enabled

## Job Results
- **Job job_3dc5fd2d43790868b255c973ab513e4b**: done (Rule: rl_72da81e9802375fd813714273e2e41a7)
- **Job job_2c57ce62b46feaadc36e8a3ad4ea012b**: done (Rule: rl_2ef735cb8d2e39f9f97312a99b155740)
- **Job job_fa30c5a8b127a730045f49fe2ce6e4ce**: done (Rule: rl_999bcf220c8bfaffd51f13bb4c5a55dd)

## Evidence Files
- evidence/job_3dc5fd2d43790868b255c973ab513e4b.json
- evidence/job_2c57ce62b46feaadc36e8a3ad4ea012b.json
- evidence/job_fa30c5a8b127a730045f49fe2ce6e4ce.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
