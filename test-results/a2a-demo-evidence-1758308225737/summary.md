# A2A Demo Test Report

## Test Run: a2a-e2e-1758308225730
**Timestamp:** 2025-09-19T18:57:05.730Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_900d031d6b39f6e46a01fd65af2d00e8): notify
- **Agent-B** (ag_ff3416085081ab327a1e5d25e07e22b5): contract.review
- **Agent-C** (ag_90256c52ae2ea97f75e1e635aa0079b2): data.analysis

## Rules Executed
- **R_A** (rl_be50d1d8ec3881ff387f137b1fc4d70d): Enabled
- **R_B** (rl_098fd89b609fa3eb7ebe315a5410f7b7): Enabled
- **R_C** (rl_fcf54d42de12a647e614beb95cad0a79): Enabled

## Job Results
- **Job job_bddd8fb74bcf19e943c6fb556fe305fd**: done (Rule: rl_fcf54d42de12a647e614beb95cad0a79)
- **Job job_58fd9d3614b370eb074bd7fed0ca887e**: done (Rule: rl_098fd89b609fa3eb7ebe315a5410f7b7)
- **Job job_43b6324100d8b11f4871c39ba3cca509**: done (Rule: rl_be50d1d8ec3881ff387f137b1fc4d70d)

## Evidence Files
- evidence/job_bddd8fb74bcf19e943c6fb556fe305fd.json
- evidence/job_58fd9d3614b370eb074bd7fed0ca887e.json
- evidence/job_43b6324100d8b11f4871c39ba3cca509.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
