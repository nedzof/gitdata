# A2A Demo Test Report

## Test Run: a2a-e2e-1758302418053
**Timestamp:** 2025-09-19T17:20:18.053Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_462348ab399f6aadafff3d3aa7c19510): notify
- **Agent-B** (ag_6d6b6111410c26649c0dbd8b96d94d0d): contract.review
- **Agent-C** (ag_3d591bb6eb5bb308c78dc90e6c48729c): data.analysis

## Rules Executed
- **R_A** (rl_551b68ed28debeff69e7ea6912952482): Enabled
- **R_B** (rl_33e88085b6bb9e0fd32ef1ba040d9463): Enabled
- **R_C** (rl_783fc4ef1f002b273af3d94c9843453a): Enabled

## Job Results
- **Job job_0f58b2902c5ef3fb7f0029bb6de2f3a3**: done (Rule: rl_783fc4ef1f002b273af3d94c9843453a)
- **Job job_8df4670c3d0e7299dac0392e93ebace2**: done (Rule: rl_33e88085b6bb9e0fd32ef1ba040d9463)
- **Job job_58ea362ff418b62beebe407abc1d3734**: done (Rule: rl_551b68ed28debeff69e7ea6912952482)

## Evidence Files
- evidence/job_0f58b2902c5ef3fb7f0029bb6de2f3a3.json
- evidence/job_8df4670c3d0e7299dac0392e93ebace2.json
- evidence/job_58ea362ff418b62beebe407abc1d3734.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
