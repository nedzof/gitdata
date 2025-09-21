# A2A Demo Test Report

## Test Run: a2a-e2e-1758461452678
**Timestamp:** 2025-09-21T13:30:52.678Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 0
- **Successful Notifications:** 0
- **Errors:** 1

## Agent Registry
- **Agent-A** (agent_1758461452726_5ihfd8jci): 
- **Agent-B** (agent_1758461452736_odsmlbr2k): 
- **Agent-C** (agent_1758461452740_c00cuslkq): 

## Rules Executed
- **R_A** (rule_1758461452745_o0rpbmj0i): Enabled
- **R_B** (rule_1758461452750_9ruig8dlt): Enabled
- **R_C** (rule_1758461452754_ybm5yesso): Enabled

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
