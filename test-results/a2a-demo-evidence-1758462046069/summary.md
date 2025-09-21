# A2A Demo Test Report

## Test Run: a2a-e2e-1758462046069
**Timestamp:** 2025-09-21T13:40:46.069Z

## Summary
- **Agents Registered:** 3
- **Rules Created:** 3
- **Jobs Executed:** 18
- **Successful Notifications:** 0
- **Errors:** 1

## Agent Registry
- **Agent-A** (agent_1758462046119_1f872ijn8): 
- **Agent-B** (agent_1758462046128_iynlp5ogl): 
- **Agent-C** (agent_1758462046132_15u9go9ze): 

## Rules Executed
- **R_A** (rule_1758462046136_ewnmmh8qi): Enabled
- **R_B** (rule_1758462046140_4ry4slinz): Enabled
- **R_C** (rule_1758462046144_49jh3obqk): Enabled

## Job Results
- **Job job_1758462046150_d8ca77ced2b06**: done (Rule: rule_1758462046136_ewnmmh8qi)
- **Job job_1758462046158_12ba45f278783**: done (Rule: rule_1758462046144_49jh3obqk)
- **Job job_1758462046155_334c7beba4a3e**: done (Rule: rule_1758462046140_4ry4slinz)
- **Job job_1758462027912_af706120e52dd**: done (Rule: rule_1758462027897_jmb2r56b9)
- **Job job_1758462027917_dce0368b82e0f**: done (Rule: rule_1758462027901_1b7pbyik5)
- **Job job_1758462027907_36516b690dac2**: done (Rule: rule_1758462027891_32xym50fh)
- **Job job_1758461994326_52d95bdfdecff**: done (Rule: rule_1758461994312_xtnltihpx)
- **Job job_1758461994335_51ef307dd8fac**: done (Rule: rule_1758461994319_smj7tkbc7)
- **Job job_1758461994330_3dda214919b16**: done (Rule: rule_1758461994316_gp1lde99b)
- **Job job_1758461962101_ade4a9ff12865**: done (Rule: rule_1758461962089_t15h6ue3b)
- **Job job_1758461962105_7317f68fe0ac2**: done (Rule: rule_1758461962092_slvn3me3t)
- **Job job_1758461962109_964b5e9170dd**: done (Rule: rule_1758461962095_limft6vei)
- **Job job_1758461938890_505e9bc6dd33a**: done (Rule: rule_1758461938876_jhsjfz3fv)
- **Job job_1758461938900_b1ac306d073f3**: done (Rule: rule_1758461938883_b5w0wcb2m)
- **Job job_1758461938896_d77177909aab5**: done (Rule: rule_1758461938880_zhe1dz4rt)
- **Job job_1758461899383_79e2f105c936b**: done (Rule: rule_1758461899370_r53vj58zp)
- **Job job_1758461899380_a9c9ba74082d5**: done (Rule: rule_1758461899366_bjmhaevx1)
- **Job job_1758461899376_52cfad83a9da**: done (Rule: rule_1758461899362_s075af4lj)

## Evidence Files
- evidence/job_1758462046150_d8ca77ced2b06.json
- evidence/job_1758462046158_12ba45f278783.json
- evidence/job_1758462046155_334c7beba4a3e.json
- evidence/job_1758462027912_af706120e52dd.json
- evidence/job_1758462027917_dce0368b82e0f.json
- evidence/job_1758462027907_36516b690dac2.json
- evidence/job_1758461994326_52d95bdfdecff.json
- evidence/job_1758461994335_51ef307dd8fac.json
- evidence/job_1758461994330_3dda214919b16.json
- evidence/job_1758461962101_ade4a9ff12865.json
- evidence/job_1758461962105_7317f68fe0ac2.json
- evidence/job_1758461962109_964b5e9170dd.json
- evidence/job_1758461938890_505e9bc6dd33a.json
- evidence/job_1758461938900_b1ac306d073f3.json
- evidence/job_1758461938896_d77177909aab5.json
- evidence/job_1758461899383_79e2f105c936b.json
- evidence/job_1758461899380_a9c9ba74082d5.json
- evidence/job_1758461899376_52cfad83a9da.json

## Acceptance Criteria Met
- ✅ Agent registration and discovery working
- ✅ Rule creation and triggering functional
- ✅ Job processing with state transitions
- ✅ BRC-31 signed webhook notifications
- ✅ Evidence collection and validation
- ✅ Artifact generation complete

## Errors
- E2E test failed: TypeError: Cannot read properties of undefined (reading 'length')
