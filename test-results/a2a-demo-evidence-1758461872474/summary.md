# A2A Demo Test Report

## Test Run: a2a-e2e-1758461872473
**Timestamp:** 2025-09-21T13:37:52.473Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 0
- **Successful Notifications:** 0
- **Errors:** 1

## Agent Registry
- **Agent-A** (agent_1758461872522_5nbj24c7p): 
- **Agent-B** (agent_1758461872531_1k1oi5g7l): 
- **Agent-C** (agent_1758461872535_56j79mfm3): 

## Rules Executed
- **R_A** (rule_1758461872539_zhjcz87bl): Enabled
- **R_B** (rule_1758461872543_7w04b7bgk): Enabled
- **R_C** (rule_1758461872546_58c7odcgo): Enabled

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
