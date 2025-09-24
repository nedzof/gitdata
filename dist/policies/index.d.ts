import type { Router } from 'express';
export interface PolicyJSON {
    minConfs?: number;
    allowRecalled?: boolean;
    classificationAllowList?: string[];
    producerAllowList?: string[];
    producerBlockList?: string[];
    maxLineageDepth?: number;
    requiredAncestor?: string;
    requiredSchemaHash?: string;
    requiredMimeTypes?: string[];
    requiredOntologyTags?: string[];
    licenseAllowList?: string[];
    geoOriginAllowList?: string[];
    maxPricePerByte?: number;
    maxTotalCostForLineage?: number;
    maxDataAgeSeconds?: number;
    maxRowCount?: number;
    requiredDistributionProfileHash?: string;
    requiredFeatureSetId?: string;
    requiredParentModelId?: string;
    blockIfInThreatFeed?: boolean;
}
export interface PolicyDecision {
    decision: 'allow' | 'warn' | 'block';
    reasons: string[];
    warnings?: string[];
    evidence: Record<string, any>;
}
export declare function runPolicyMigrations(db?: Database.Database): Promise<void>;
export declare function evaluatePolicy(versionId: string, policy: PolicyJSON, manifest?: any, lineage?: any[], externalData?: Record<string, any>): Promise<PolicyDecision>;
export declare function policiesRouter(db: any): Router;
