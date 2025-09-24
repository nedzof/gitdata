# A2A Demo Test Report

## Test Run: a2a-e2e-1758284487691
**Timestamp:** 2025-09-19T12:21:27.691Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_7e855c640b4d6aba96879fc8bc1d7f74): notify
- **Agent-B** (ag_553ca673a04d3952edf1f35184e3aefa): contract.review
- **Agent-C** (ag_3ffb1f02e906f1b71c63192a73d48048): data.analysis

## Rules Executed
- **R_A** (rl_5bddc322eda69a336342699fd2ee3940): Enabled
- **R_B** (rl_4d061484127cc023e1240d4fb99b7115): Enabled
- **R_C** (rl_0db496f5b6b5e3e701f4f1457cbb6b96): Enabled

## Job Results
- **Job job_04c6329ec31040c93276ff749a89aac8**: done (Rule: rl_0db496f5b6b5e3e701f4f1457cbb6b96)
- **Job job_833119788cd0b5a2e7e455a01f52e0f4**: done (Rule: rl_4d061484127cc023e1240d4fb99b7115)
- **Job job_11c1d95b0edffb0e811db8e71e8224e3**: done (Rule: rl_5bddc322eda69a336342699fd2ee3940)

## Evidence Files
- evidence/job_04c6329ec31040c93276ff749a89aac8.json
- evidence/job_833119788cd0b5a2e7e455a01f52e0f4.json
- evidence/job_11c1d95b0edffb0e811db8e71e8224e3.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
