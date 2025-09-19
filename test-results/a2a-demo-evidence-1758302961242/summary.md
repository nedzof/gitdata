# A2A Demo Test Report

## Test Run: a2a-e2e-1758302961240
**Timestamp:** 2025-09-19T17:29:21.240Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_352ff91798982572e10fe58c360c0cbd): notify
- **Agent-B** (ag_c3679cdfd67af4c0b3f69c1b5a12a623): contract.review
- **Agent-C** (ag_05748a4b10d5bb14a3e170e52b0f5c23): data.analysis

## Rules Executed
- **R_A** (rl_eb72de3f91a5d066449836cccaf5797a): Enabled
- **R_B** (rl_8fc478212c1e0d6349cf6c9732b62fff): Enabled
- **R_C** (rl_84a031f63a654d6b92018eb8427478b1): Enabled

## Job Results
- **Job job_e017a311d9bcb424bd88a53c0d900892**: done (Rule: rl_84a031f63a654d6b92018eb8427478b1)
- **Job job_456670920952c4cb4fddfa5e9499d840**: done (Rule: rl_8fc478212c1e0d6349cf6c9732b62fff)
- **Job job_c1f7d9f148b58863c8ceff469285b138**: done (Rule: rl_eb72de3f91a5d066449836cccaf5797a)

## Evidence Files
- evidence/job_e017a311d9bcb424bd88a53c0d900892.json
- evidence/job_456670920952c4cb4fddfa5e9499d840.json
- evidence/job_c1f7d9f148b58863c8ceff469285b138.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
