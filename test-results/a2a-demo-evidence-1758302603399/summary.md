# A2A Demo Test Report

## Test Run: a2a-e2e-1758302603398
**Timestamp:** 2025-09-19T17:23:23.398Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_2f7bec62c6ac8c6c9bf4106a5e22233e): notify
- **Agent-B** (ag_d7dba87a1c0dbe298cca8598fae705ed): contract.review
- **Agent-C** (ag_6cf91ed7c08827cdd9fb5d5468e04b3b): data.analysis

## Rules Executed
- **R_A** (rl_0f1a66c789b398c7bcbb33ddad28977a): Enabled
- **R_B** (rl_7f503db1024b0d143d79cdce40cde055): Enabled
- **R_C** (rl_ab8cf1ebbb506a62039856fc3aa5a39c): Enabled

## Job Results
- **Job job_de37e1b7f0b127de1aac76747a023920**: done (Rule: rl_ab8cf1ebbb506a62039856fc3aa5a39c)
- **Job job_219046692f6d30ae2b8b755417fa6992**: done (Rule: rl_7f503db1024b0d143d79cdce40cde055)
- **Job job_3a24f1956abaae7841ba1c85e79d3d6b**: done (Rule: rl_0f1a66c789b398c7bcbb33ddad28977a)

## Evidence Files
- evidence/job_de37e1b7f0b127de1aac76747a023920.json
- evidence/job_219046692f6d30ae2b8b755417fa6992.json
- evidence/job_3a24f1956abaae7841ba1c85e79d3d6b.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
