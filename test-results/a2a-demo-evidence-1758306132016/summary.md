# A2A Demo Test Report

## Test Run: a2a-e2e-1758306132015
**Timestamp:** 2025-09-19T18:22:12.015Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_6c971a27fa88c68dae335638eaad2a9b): notify
- **Agent-B** (ag_f88b599ea88da87977b793ee169fe57f): contract.review
- **Agent-C** (ag_d69d5c52b48a249458777bd61049d1bd): data.analysis

## Rules Executed
- **R_A** (rl_c31a1e806840aec2e44cd4d5b48066b7): Enabled
- **R_B** (rl_e7d77af100f4b61a51e2a295ef3652e1): Enabled
- **R_C** (rl_6d17c5a8eb3d949c3494c2ff805f5f11): Enabled

## Job Results
- **Job job_3f7d38ea301c72a675ab938db91da794**: done (Rule: rl_6d17c5a8eb3d949c3494c2ff805f5f11)
- **Job job_36d531700e62018c7e575d0717b0d14d**: done (Rule: rl_e7d77af100f4b61a51e2a295ef3652e1)
- **Job job_76165b6f8f763c09578fde5820f5d2f2**: done (Rule: rl_c31a1e806840aec2e44cd4d5b48066b7)

## Evidence Files
- evidence/job_3f7d38ea301c72a675ab938db91da794.json
- evidence/job_36d531700e62018c7e575d0717b0d14d.json
- evidence/job_76165b6f8f763c09578fde5820f5d2f2.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
