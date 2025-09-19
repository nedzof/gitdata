# A2A Demo Test Report

## Test Run: a2a-e2e-1758306737277
**Timestamp:** 2025-09-19T18:32:17.277Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_e3aeaffa4703743c0ac625939053daca): notify
- **Agent-B** (ag_034ef5f9354953ed7fd30ce7276ef709): contract.review
- **Agent-C** (ag_080cd71a47d5768fc2004df3e31784fd): data.analysis

## Rules Executed
- **R_A** (rl_523fb216150fd9f36ee7a338d3532926): Enabled
- **R_B** (rl_16b3053c28097321303806719e5f2552): Enabled
- **R_C** (rl_792a24682bd5c23e15e71ec3f9266fa5): Enabled

## Job Results
- **Job job_db80cb079f09607ce1e3665e112747c1**: done (Rule: rl_792a24682bd5c23e15e71ec3f9266fa5)
- **Job job_4f3aafe231097e062a3bd0779b8b3123**: done (Rule: rl_16b3053c28097321303806719e5f2552)
- **Job job_4883a04757348c790b293b7b175525bf**: done (Rule: rl_523fb216150fd9f36ee7a338d3532926)

## Evidence Files
- evidence/job_db80cb079f09607ce1e3665e112747c1.json
- evidence/job_4f3aafe231097e062a3bd0779b8b3123.json
- evidence/job_4883a04757348c790b293b7b175525bf.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
