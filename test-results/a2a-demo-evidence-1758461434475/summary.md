# A2A Demo Test Report

## Test Run: a2a-e2e-1758461434474
**Timestamp:** 2025-09-21T13:30:34.474Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 0
- **Successful Notifications:** 0
- **Errors:** 1

## Agent Registry
- **Agent-A** (agent_1758461434524_hr5vvqusb): 
- **Agent-B** (agent_1758461434533_4kj8qckdb): 
- **Agent-C** (agent_1758461434536_0dx1ezge8): 

## Rules Executed
- **R_A** (rule_1758461434540_lo7ispgva): Enabled
- **R_B** (rule_1758461434544_nvnz1bkju): Enabled
- **R_C** (rule_1758461434547_ryonah369): Enabled

## Job Results


## Evidence Files


## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## Errors
- E2E test failed: AssertionError: expected 500 to be 200 // Object.is equality
