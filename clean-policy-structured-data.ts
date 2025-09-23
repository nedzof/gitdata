#!/usr/bin/env npx tsx

/**
 * Policy Database Migration: Remove Structured Data Fields
 *
 * This script cleans up existing policy documents in the database by removing
 * structured data fields that are not applicable to unstructured content (documents, media).
 *
 * Removed fields:
 * - piiFlagsBlockList
 * - requiresBillingAccount
 * - minAnonymizationLevel
 * - minProducerUptime
 * - minRowCount
 * - maxNullValuePercentage
 * - maxOutlierScore
 * - minUniquenessRatio
 * - requiresValidSplit
 * - maxBiasScore
 * - maxDriftScore
 *
 * Usage: npx tsx clean-policy-structured-data.ts
 */

async function cleanPolicyStructuredData(): Promise<void> {
  console.log('🔧 Starting policy database cleanup for unstructured data optimization...');

  try {
    const { getHybridDatabase } = await import('./src/db/hybrid');
    const db = getHybridDatabase();

    console.log('📊 Database connected successfully');

    // Get all existing policies
    const policiesResult = await db.pg.query('SELECT policy_id, name, doc FROM policies');
    const policies = policiesResult.rows;

    console.log(`📋 Found ${policies.length} existing policies to check`);

    const fieldsToRemove = [
      'piiFlagsBlockList',
      'requiresBillingAccount',
      'minAnonymizationLevel',
      'minProducerUptime',
      'minRowCount',
      'maxNullValuePercentage',
      'maxOutlierScore',
      'minUniquenessRatio',
      'requiresValidSplit',
      'maxBiasScore',
      'maxDriftScore'
    ];

    let updatedCount = 0;

    for (const policy of policies) {
      try {
        const policyDoc = JSON.parse(policy.doc);
        let wasModified = false;

        // Remove structured data fields
        for (const field of fieldsToRemove) {
          if (field in policyDoc) {
            delete policyDoc[field];
            wasModified = true;
            console.log(`   Removed ${field} from policy "${policy.name}"`);
          }
        }

        // Update the policy if it was modified
        if (wasModified) {
          await db.pg.query(
            'UPDATE policies SET doc = $1, updated_at = NOW() WHERE policy_id = $2',
            [JSON.stringify(policyDoc), policy.policy_id]
          );
          updatedCount++;
          console.log(`✅ Updated policy: "${policy.name}" (ID: ${policy.policy_id})`);
        }

      } catch (error) {
        console.warn(`⚠️  Failed to process policy ${policy.policy_id}: ${error.message}`);
      }
    }

    console.log(`\n🎉 Policy cleanup completed successfully!`);
    console.log(`📈 Total policies processed: ${policies.length}`);
    console.log(`🔄 Policies updated: ${updatedCount}`);
    console.log(`📋 Policies unchanged: ${policies.length - updatedCount}`);

    if (updatedCount > 0) {
      console.log('\n📝 Changes made:');
      console.log('   • Removed structured data fields not applicable to unstructured content');
      console.log('   • Optimized policy configurations for per-KB billing model');
      console.log('   • Updated policy timestamps to reflect modifications');
    }

    console.log('\n✨ Database is now optimized for unstructured data policies!');

  } catch (error) {
    console.error('❌ Failed to clean policy data:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  cleanPolicyStructuredData();
}