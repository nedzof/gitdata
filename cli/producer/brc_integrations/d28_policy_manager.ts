/**
 * D28 Policy Manager
 *
 * Manages policy definitions and metadata for producer content according to D28 specification.
 * Allows producers to define comprehensive policies for their data including compliance,
 * quality, provenance, and access control requirements.
 */

import * as crypto from 'crypto';

interface PolicyDefinition {
  policyId: string;
  name: string;
  description: string;
  enabled: boolean;
  policyJson: PolicyConstraints;
  createdAt: Date;
  updatedAt: Date;
}

interface PolicyConstraints {
  // SPV & Trust
  minConfs?: number;
  allowRecalled?: boolean;

  // Classification & Content
  classificationAllowList?: string[];
  requiredSchemaHash?: string;
  requiredMimeTypes?: string[];
  requiredOntologyTags?: string[];

  // Producer & Provenance
  producerAllowList?: string[];
  producerBlockList?: string[];
  maxLineageDepth?: number;
  requiredAncestor?: string;

  // Compliance & Legal
  licenseAllowList?: string[];
  piiFlagsBlockList?: string[];
  geoOriginAllowList?: string[];

  // Economics
  maxPricePerByte?: number;
  maxTotalCostForLineage?: number;
  maxDataAgeSeconds?: number;
  minProducerUptime?: number;
  requiresBillingAccount?: boolean;

  // Quality & Data Profile
  minRowCount?: number;
  maxRowCount?: number;
  maxNullValuePercentage?: number;
  requiredDistributionProfileHash?: string;
  maxOutlierScore?: number;
  minUniquenessRatio?: number;

  // MLOps
  requiredFeatureSetId?: string;
  requiresValidSplit?: boolean;
  maxBiasScore?: number;
  maxDriftScore?: number;
  requiredParentModelId?: string;

  // Security
  blockIfInThreatFeed?: boolean;
  minAnonymizationLevel?: {
    type: 'k-anon' | 'dp';
    k?: number;
    epsilon?: number;
  };
}

interface ContentMetadata {
  versionId: string;
  contentHash: string;
  classification: string;
  schemaHash?: string;
  mimeType: string;
  ontologyTags: string[];
  license: string;
  piiFlags: string[];
  geoOrigin: string;
  price: number;
  size: number;
  rowCount?: number;
  nullPercentage?: number;
  profileHash?: string;
  outlierScore?: number;
  uniquenessRatio?: number;
  featureSetId?: string;
  splitTag?: string;
  biasScore?: number;
  driftScore?: number;
  parentModelId?: string;
  anonymizationLevel?: any;
  createdAt: Date;
}

interface PolicyDecision {
  decision: 'allow' | 'warn' | 'block';
  reasons: string[];
  warnings?: string[];
  evidence: any;
}

export class D28PolicyManager {
  private overlayUrl: string;
  private policies: Map<string, PolicyDefinition> = new Map();

  constructor(overlayUrl: string) {
    this.overlayUrl = overlayUrl;
  }

  /**
   * Create a new policy definition
   */
  async createPolicy(policyData: {
    name: string;
    description: string;
    policyJson: PolicyConstraints;
  }): Promise<PolicyDefinition> {
    try {
      console.log('[D28] Creating policy definition...');

      const policy: PolicyDefinition = {
        policyId: `pol_${crypto.randomUUID().substring(0, 8)}`,
        name: policyData.name,
        description: policyData.description,
        enabled: true,
        policyJson: policyData.policyJson,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Validate policy JSON structure
      this.validatePolicyJson(policy.policyJson);

      // Store policy
      this.policies.set(policy.policyId, policy);

      console.log(`[D28] ✅ Policy created: ${policy.policyId}`);
      return policy;

    } catch (error) {
      console.error('[D28] ❌ Policy creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Update existing policy
   */
  async updatePolicy(policyId: string, updates: Partial<PolicyDefinition>): Promise<PolicyDefinition> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    const updatedPolicy = {
      ...policy,
      ...updates,
      updatedAt: new Date()
    };

    if (updates.policyJson) {
      this.validatePolicyJson(updates.policyJson);
    }

    this.policies.set(policyId, updatedPolicy);
    return updatedPolicy;
  }

  /**
   * Delete policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    if (!this.policies.has(policyId)) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    this.policies.delete(policyId);
    console.log(`[D28] Policy deleted: ${policyId}`);
  }

  /**
   * List all policies
   */
  async listPolicies(): Promise<PolicyDefinition[]> {
    return Array.from(this.policies.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get specific policy
   */
  async getPolicy(policyId: string): Promise<PolicyDefinition | null> {
    return this.policies.get(policyId) || null;
  }

  /**
   * Define content metadata for producer content
   */
  async defineContentMetadata(contentId: string, metadata: Partial<ContentMetadata>): Promise<ContentMetadata> {
    const fullMetadata: ContentMetadata = {
      versionId: metadata.versionId || `ver_${crypto.randomUUID().substring(0, 8)}`,
      contentHash: metadata.contentHash || '',
      classification: metadata.classification || 'unclassified',
      mimeType: metadata.mimeType || 'application/octet-stream',
      ontologyTags: metadata.ontologyTags || [],
      license: metadata.license || 'commercial',
      piiFlags: metadata.piiFlags || [],
      geoOrigin: metadata.geoOrigin || 'unknown',
      price: metadata.price || 0,
      size: metadata.size || 0,
      createdAt: new Date(),
      ...metadata
    };

    console.log(`[D28] Content metadata defined for: ${contentId}`);
    return fullMetadata;
  }

  /**
   * Evaluate content against policy
   */
  async evaluatePolicy(versionId: string, policyId: string, metadata: ContentMetadata): Promise<PolicyDecision> {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    console.log(`[D28] Evaluating policy ${policyId} against content ${versionId}`);

    const decision: PolicyDecision = {
      decision: 'allow',
      reasons: [],
      warnings: [],
      evidence: {}
    };

    const constraints = policy.policyJson;
    let hasBlocks = false;
    let hasWarnings = false;

    // 1. Classification & Content Checks
    if (constraints.classificationAllowList &&
        !constraints.classificationAllowList.includes(metadata.classification)) {
      decision.reasons.push('POLICY.CONTENT.CLASSIFICATION_NOT_ALLOWED');
      decision.evidence.classificationMismatch = {
        required: constraints.classificationAllowList,
        actual: metadata.classification
      };
      hasBlocks = true;
    }

    if (constraints.requiredMimeTypes &&
        !constraints.requiredMimeTypes.includes(metadata.mimeType)) {
      decision.reasons.push('POLICY.CONTENT.MIME_NOT_ALLOWED');
      decision.evidence.mimeTypeMismatch = {
        required: constraints.requiredMimeTypes,
        actual: metadata.mimeType
      };
      hasBlocks = true;
    }

    if (constraints.requiredOntologyTags) {
      const missingTags = constraints.requiredOntologyTags.filter(
        tag => !metadata.ontologyTags.includes(tag)
      );
      if (missingTags.length > 0) {
        decision.reasons.push('POLICY.CONTENT.TAGS_MISSING');
        decision.evidence.missingOntologyTags = missingTags;
        hasBlocks = true;
      }
    }

    if (constraints.requiredSchemaHash &&
        metadata.schemaHash !== constraints.requiredSchemaHash) {
      decision.reasons.push('POLICY.CONTENT.SCHEMA_MISMATCH');
      decision.evidence.schemaMismatch = {
        required: constraints.requiredSchemaHash,
        actual: metadata.schemaHash
      };
      hasBlocks = true;
    }

    // 2. Compliance & Legal Checks
    if (constraints.licenseAllowList &&
        !constraints.licenseAllowList.includes(metadata.license)) {
      decision.reasons.push('POLICY.COMPLIANCE.LICENSE_NOT_ALLOWED');
      decision.evidence.licenseMismatch = {
        required: constraints.licenseAllowList,
        actual: metadata.license
      };
      hasBlocks = true;
    }

    if (constraints.piiFlagsBlockList) {
      const blockedPiiFlags = metadata.piiFlags.filter(
        flag => constraints.piiFlagsBlockList.includes(flag)
      );
      if (blockedPiiFlags.length > 0) {
        decision.reasons.push('POLICY.COMPLIANCE.PII_BLOCKED');
        decision.evidence.blockedPiiFlags = blockedPiiFlags;
        hasBlocks = true;
      }
    }

    if (constraints.geoOriginAllowList &&
        !constraints.geoOriginAllowList.includes(metadata.geoOrigin)) {
      decision.reasons.push('POLICY.COMPLIANCE.GEO_NOT_ALLOWED');
      decision.evidence.geoOriginMismatch = {
        required: constraints.geoOriginAllowList,
        actual: metadata.geoOrigin
      };
      hasBlocks = true;
    }

    // 3. Economics Checks
    if (constraints.maxPricePerByte && metadata.size > 0) {
      const pricePerByte = metadata.price / metadata.size;
      if (pricePerByte > constraints.maxPricePerByte) {
        decision.reasons.push('POLICY.ECON.PRICE_PER_BYTE_EXCEEDED');
        decision.evidence.pricePerByteExceeded = {
          limit: constraints.maxPricePerByte,
          actual: pricePerByte
        };
        hasBlocks = true;
      }
    }

    if (constraints.maxDataAgeSeconds) {
      const ageSeconds = (Date.now() - metadata.createdAt.getTime()) / 1000;
      if (ageSeconds > constraints.maxDataAgeSeconds) {
        decision.reasons.push('POLICY.ECON.DATA_TOO_OLD');
        decision.evidence.dataAge = {
          limit: constraints.maxDataAgeSeconds,
          actual: ageSeconds
        };
        hasBlocks = true;
      }
    }

    if (constraints.requiresBillingAccount) {
      // This would check if billing account exists - mock for now
      decision.warnings.push('POLICY.ECON.BILLING_ACCOUNT_RECOMMENDED');
      hasWarnings = true;
    }

    // 4. Quality & Data Profile Checks
    if (constraints.minRowCount && metadata.rowCount &&
        metadata.rowCount < constraints.minRowCount) {
      decision.reasons.push('POLICY.QA.ROWS_TOO_FEW');
      decision.evidence.rowCountTooLow = {
        minimum: constraints.minRowCount,
        actual: metadata.rowCount
      };
      hasBlocks = true;
    }

    if (constraints.maxRowCount && metadata.rowCount &&
        metadata.rowCount > constraints.maxRowCount) {
      decision.reasons.push('POLICY.QA.ROWS_TOO_MANY');
      decision.evidence.rowCountTooHigh = {
        maximum: constraints.maxRowCount,
        actual: metadata.rowCount
      };
      hasBlocks = true;
    }

    if (constraints.maxNullValuePercentage && metadata.nullPercentage !== undefined &&
        metadata.nullPercentage > constraints.maxNullValuePercentage) {
      decision.reasons.push('POLICY.QA.NULL_PERCENT_EXCEEDED');
      decision.evidence.nullPercentageExceeded = {
        limit: constraints.maxNullValuePercentage,
        actual: metadata.nullPercentage
      };
      hasBlocks = true;
    }

    if (constraints.requiredDistributionProfileHash &&
        metadata.profileHash !== constraints.requiredDistributionProfileHash) {
      decision.reasons.push('POLICY.QA.PROFILE_HASH_MISMATCH');
      decision.evidence.profileHashMismatch = {
        required: constraints.requiredDistributionProfileHash,
        actual: metadata.profileHash
      };
      hasBlocks = true;
    }

    if (constraints.maxOutlierScore && metadata.outlierScore !== undefined &&
        metadata.outlierScore > constraints.maxOutlierScore) {
      decision.reasons.push('POLICY.QA.OUTLIER_TOO_HIGH');
      decision.evidence.outlierScoreExceeded = {
        limit: constraints.maxOutlierScore,
        actual: metadata.outlierScore
      };
      hasBlocks = true;
    }

    if (constraints.minUniquenessRatio && metadata.uniquenessRatio !== undefined &&
        metadata.uniquenessRatio < constraints.minUniquenessRatio) {
      decision.reasons.push('POLICY.QA.UNIQUENESS_TOO_LOW');
      decision.evidence.uniquenessRatioTooLow = {
        minimum: constraints.minUniquenessRatio,
        actual: metadata.uniquenessRatio
      };
      hasBlocks = true;
    }

    // 5. MLOps Checks
    if (constraints.requiredFeatureSetId &&
        metadata.featureSetId !== constraints.requiredFeatureSetId) {
      decision.reasons.push('POLICY.MLOPS.FEATURE_SET_MISSING');
      decision.evidence.featureSetMismatch = {
        required: constraints.requiredFeatureSetId,
        actual: metadata.featureSetId
      };
      hasBlocks = true;
    }

    if (constraints.requiresValidSplit &&
        (!metadata.splitTag || !['train', 'val', 'test'].includes(metadata.splitTag))) {
      decision.reasons.push('POLICY.MLOPS.SPLIT_INVALID');
      decision.evidence.invalidSplit = {
        required: ['train', 'val', 'test'],
        actual: metadata.splitTag
      };
      hasBlocks = true;
    }

    if (constraints.maxBiasScore && metadata.biasScore !== undefined &&
        metadata.biasScore > constraints.maxBiasScore) {
      decision.reasons.push('POLICY.MLOPS.BIAS_TOO_HIGH');
      decision.evidence.biasScoreExceeded = {
        limit: constraints.maxBiasScore,
        actual: metadata.biasScore
      };
      hasBlocks = true;
    }

    if (constraints.maxDriftScore && metadata.driftScore !== undefined &&
        metadata.driftScore > constraints.maxDriftScore) {
      decision.reasons.push('POLICY.MLOPS.DRIFT_TOO_HIGH');
      decision.evidence.driftScoreExceeded = {
        limit: constraints.maxDriftScore,
        actual: metadata.driftScore
      };
      hasBlocks = true;
    }

    if (constraints.requiredParentModelId &&
        metadata.parentModelId !== constraints.requiredParentModelId) {
      decision.reasons.push('POLICY.MLOPS.PARENT_MODEL_MISMATCH');
      decision.evidence.parentModelMismatch = {
        required: constraints.requiredParentModelId,
        actual: metadata.parentModelId
      };
      hasBlocks = true;
    }

    // Determine final decision
    if (hasBlocks) {
      decision.decision = 'block';
    } else if (hasWarnings) {
      decision.decision = 'warn';
    } else {
      decision.decision = 'allow';
    }

    console.log(`[D28] Policy evaluation result: ${decision.decision} (${decision.reasons.length} issues)`);
    return decision;
  }

  /**
   * Create example policies for common use cases
   */
  createExamplePolicies(): { [key: string]: PolicyConstraints } {
    return {
      // Financial Services - Strict Compliance
      'financial-strict': {
        minConfs: 12,
        classificationAllowList: ['restricted', 'confidential'],
        allowRecalled: false,
        licenseAllowList: ['commercial', 'enterprise'],
        piiFlagsBlockList: ['has_customer_name', 'has_address', 'has_account_number'],
        geoOriginAllowList: ['EU', 'US'],
        maxPricePerByte: 0.5,
        maxDataAgeSeconds: 3600, // 1 hour
        minProducerUptime: 99.9,
        requiresBillingAccount: true,
        minRowCount: 1000000,
        maxNullValuePercentage: 1.0,
        maxOutlierScore: 3.5,
        minUniquenessRatio: 0.98,
        blockIfInThreatFeed: true,
        minAnonymizationLevel: { type: 'k-anon', k: 5 }
      },

      // Research - Quality Focused
      'research-quality': {
        minConfs: 6,
        classificationAllowList: ['public', 'research'],
        requiredMimeTypes: ['application/json', 'text/csv'],
        licenseAllowList: ['research', 'cc-by', 'open'],
        maxPricePerByte: 0.01,
        maxDataAgeSeconds: 86400 * 30, // 30 days
        minRowCount: 10000,
        maxNullValuePercentage: 5.0,
        maxOutlierScore: 5.0,
        minUniquenessRatio: 0.8,
        requiresValidSplit: true,
        maxBiasScore: 0.3
      },

      // General Business - Balanced
      'business-balanced': {
        minConfs: 3,
        classificationAllowList: ['public', 'internal', 'commercial'],
        licenseAllowList: ['commercial', 'business'],
        geoOriginAllowList: ['global'],
        maxPricePerByte: 0.1,
        maxDataAgeSeconds: 86400 * 7, // 7 days
        minProducerUptime: 95.0,
        maxNullValuePercentage: 10.0,
        maxOutlierScore: 7.0,
        minUniquenessRatio: 0.5
      }
    };
  }

  /**
   * Validate policy JSON structure
   */
  private validatePolicyJson(policyJson: PolicyConstraints): void {
    // Validate numeric constraints
    if (policyJson.minConfs !== undefined && policyJson.minConfs < 0) {
      throw new Error('minConfs must be non-negative');
    }

    if (policyJson.maxPricePerByte !== undefined && policyJson.maxPricePerByte < 0) {
      throw new Error('maxPricePerByte must be non-negative');
    }

    if (policyJson.minProducerUptime !== undefined &&
        (policyJson.minProducerUptime < 0 || policyJson.minProducerUptime > 100)) {
      throw new Error('minProducerUptime must be between 0 and 100');
    }

    // Validate arrays
    if (policyJson.classificationAllowList !== undefined &&
        !Array.isArray(policyJson.classificationAllowList)) {
      throw new Error('classificationAllowList must be an array');
    }

    if (policyJson.producerAllowList !== undefined &&
        !Array.isArray(policyJson.producerAllowList)) {
      throw new Error('producerAllowList must be an array');
    }

    // Validate anonymization level
    if (policyJson.minAnonymizationLevel !== undefined) {
      const level = policyJson.minAnonymizationLevel;
      if (!['k-anon', 'dp'].includes(level.type)) {
        throw new Error('minAnonymizationLevel.type must be "k-anon" or "dp"');
      }
      if (level.type === 'k-anon' && (level.k === undefined || level.k < 1)) {
        throw new Error('k-anonymity requires k >= 1');
      }
      if (level.type === 'dp' && (level.epsilon === undefined || level.epsilon <= 0)) {
        throw new Error('differential privacy requires epsilon > 0');
      }
    }
  }

  /**
   * Health check for D28 policy manager
   */
  async healthCheck(): Promise<any> {
    return {
      component: 'D28 Policy Manager',
      status: 'healthy',
      activePolicies: this.policies.size,
      timestamp: new Date().toISOString()
    };
  }
}

export {
  PolicyDefinition,
  PolicyConstraints,
  ContentMetadata,
  PolicyDecision
};