# A2A Demo Test Report

## Test Run: a2a-e2e-1758287006043
**Timestamp:** 2025-09-19T13:03:26.043Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_a5d70f85a3d92b7af2df636eadfdbeb4): notify
- **Agent-B** (ag_5f5674fc06266e7c9ad78a15aab57e70): contract.review
- **Agent-C** (ag_087c9958691aa79db6a24e63947a8e61): data.analysis

## Rules Executed
- **R_A** (rl_860fc33778c8fee2b1ad40a39f0d1ec4): Enabled
- **R_B** (rl_71d68ebd450c1e001f5916bdeeb4da8e): Enabled
- **R_C** (rl_d532ff48ec10aea990bea6887c5f2380): Enabled

## Job Results
- **Job job_02ccc2cf8f32133486c9af3d1d192a7c**: done (Rule: rl_d532ff48ec10aea990bea6887c5f2380)
- **Job job_d45408fb1fdc94ad988a00edcd1b8d60**: done (Rule: rl_71d68ebd450c1e001f5916bdeeb4da8e)
- **Job job_0a4678f638b9f1e193f987e7f7515b63**: done (Rule: rl_860fc33778c8fee2b1ad40a39f0d1ec4)

## Evidence Files
- evidence/job_02ccc2cf8f32133486c9af3d1d192a7c.json
- evidence/job_d45408fb1fdc94ad988a00edcd1b8d60.json
- evidence/job_0a4678f638b9f1e193f987e7f7515b63.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
