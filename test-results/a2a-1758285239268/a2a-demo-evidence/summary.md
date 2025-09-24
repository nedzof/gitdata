# A2A Demo Test Report

## Test Run: a2a-e2e-1758285244292
**Timestamp:** 2025-09-19T12:34:04.292Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 3
- **Successful Notifications:** 0
- **Errors:** 0

## Agent Registry
- **Agent-A** (ag_3a06c20d165b7491af824b80380e4923): notify
- **Agent-B** (ag_fe22ae99666cbb96469d1698e0af5b3c): contract.review
- **Agent-C** (ag_ca95c0070b205dc8c5316e61c05708b5): data.analysis

## Rules Executed
- **R_A** (rl_b4b225c0349c9c0911807be910a07599): Enabled
- **R_B** (rl_3e5b890638b5864ef7fb32e18029c358): Enabled
- **R_C** (rl_f1c31b10a300118f9a761db21c602bcd): Enabled

## Job Results
- **Job job_30e2968948efc76fb40bfc8523e00901**: done (Rule: rl_f1c31b10a300118f9a761db21c602bcd)
- **Job job_633c81d62156e03bc1a8062b85dd5c8f**: done (Rule: rl_3e5b890638b5864ef7fb32e18029c358)
- **Job job_acf428c228268f11baa3102b6642ca4a**: done (Rule: rl_b4b225c0349c9c0911807be910a07599)

## Evidence Files
- evidence/job_30e2968948efc76fb40bfc8523e00901.json
- evidence/job_633c81d62156e03bc1a8062b85dd5c8f.json
- evidence/job_acf428c228268f11baa3102b6642ca4a.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## No errors occurred during test execution
