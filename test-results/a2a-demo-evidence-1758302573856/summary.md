# A2A Demo Test Report

## Test Run: a2a-e2e-1758302573854
**Timestamp:** 2025-09-19T17:22:53.854Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_198f13ab3e12466361dd321fc41f485e): notify
- **Agent-B** (ag_fe743d885521b7b5faa1409e7f1ed05b): contract.review
- **Agent-C** (ag_451f28628917e3c29331fb0f4ced73b5): data.analysis

## Rules Executed
- **R_A** (rl_f7042795bc6d69529a50d21f7d063e04): Enabled
- **R_B** (rl_7a36c0ba2a07592094bf684a092dbcc5): Enabled
- **R_C** (rl_f17ce5a6ead75aa51344fe37344ad7bc): Enabled

## Job Results
- **Job job_1ce9e74bdf7a3cb3d723ac7701485611**: done (Rule: rl_f17ce5a6ead75aa51344fe37344ad7bc)
- **Job job_ba8943e584d58a458e03695cebcd871c**: done (Rule: rl_7a36c0ba2a07592094bf684a092dbcc5)
- **Job job_336fc3a19ba49e6ba7e017792b48cb48**: done (Rule: rl_f7042795bc6d69529a50d21f7d063e04)

## Evidence Files
- evidence/job_1ce9e74bdf7a3cb3d723ac7701485611.json
- evidence/job_ba8943e584d58a458e03695cebcd871c.json
- evidence/job_336fc3a19ba49e6ba7e017792b48cb48.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
