# A2A Demo Test Report

## Test Run: a2a-e2e-1758306113888
**Timestamp:** 2025-09-19T18:21:53.888Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_99ec876777e8e30e693f6d85553ca937): notify
- **Agent-B** (ag_095bd7df58dcf55f5634ee02df888e67): contract.review
- **Agent-C** (ag_982e5f0d908044282035f882b275a14a): data.analysis

## Rules Executed
- **R_A** (rl_08767ea1917cd7000549a72fd1e4ffac): Enabled
- **R_B** (rl_16cac7ae0191780d96073c0428ab1b8a): Enabled
- **R_C** (rl_c0bf2413655999557085b332b61810af): Enabled

## Job Results
- **Job job_1bacb4c1f28ae986b01e7426f4ab6d18**: done (Rule: rl_c0bf2413655999557085b332b61810af)
- **Job job_306b2417751efc1df814161bc593b42f**: done (Rule: rl_16cac7ae0191780d96073c0428ab1b8a)
- **Job job_80b5b80a8e485b99c66ed504cac967b3**: done (Rule: rl_08767ea1917cd7000549a72fd1e4ffac)

## Evidence Files
- evidence/job_1bacb4c1f28ae986b01e7426f4ab6d18.json
- evidence/job_306b2417751efc1df814161bc593b42f.json
- evidence/job_80b5b80a8e485b99c66ed504cac967b3.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
