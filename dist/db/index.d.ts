export { HybridDatabase, getHybridDatabase, closeHybridDatabase } from './hybrid';
export { PostgreSQLClient, getPostgreSQLClient, closePostgreSQLConnection } from './postgresql';
export { RedisClient, getRedisClient, closeRedisConnection, CacheKeys, getCacheTTLs as getRedisConnectionTTLs, } from './redis';
export declare function initSchema(): Promise<any>;
export { getTestDatabase, resetTestDatabase } from './test-setup';
export declare function isTestEnvironment(): boolean;
export declare function closeTestDatabase(): Promise<void>;
export declare function getDatabase(): any;
export type DeclarationRow = {
    version_id: string;
    txid: string | null;
    type: 'DLM1' | 'TRN1' | 'UNKNOWN';
    status: 'pending' | 'confirmed';
    created_at: number;
    block_hash: string | null;
    height: number | null;
    opret_vout: number | null;
    raw_tx: string | null;
    proof_json: string | null;
};
export type ManifestRow = {
    version_id: string;
    manifest_hash: string;
    content_hash: string | null;
    title: string | null;
    license: string | null;
    classification: string | null;
    created_at: string | null;
    manifest_json: string;
    dataset_id?: string | null;
    producer_id?: string | null;
};
export type ProducerRow = {
    producer_id: string;
    name: string | null;
    website: string | null;
    identity_key: string | null;
    created_at: number;
};
export type ReceiptRow = {
    receipt_id: string;
    version_id: string;
    quantity: number;
    content_hash: string | null;
    amount_sat: number;
    status: 'pending' | 'paid' | 'consumed' | 'expired';
    created_at: number;
    expires_at: number;
    bytes_used: number;
    last_seen: number | null;
};
export type RevenueEventRow = {
    event_id?: number;
    receipt_id: string;
    version_id: string;
    amount_sat: number;
    quantity: number;
    created_at: number;
    type: 'pay' | 'refund' | 'adjust';
};
export type PriceRule = {
    rule_id?: number;
    version_id?: string | null;
    producer_id?: string | null;
    tier_from: number;
    satoshis: number;
    created_at: number;
    updated_at: number;
};
export type AdvisoryRow = {
    advisory_id: string;
    type: 'BLOCK' | 'WARN';
    reason: string;
    created_at: number;
    expires_at: number | null;
    payload_json: string | null;
};
export type AgentRow = {
    agent_id: string;
    name: string;
    capabilities_json: string;
    webhook_url: string;
    identity_key?: string | null;
    status: 'unknown' | 'up' | 'down';
    last_ping_at?: number | null;
    created_at: number;
};
export type RuleRow = {
    rule_id: string;
    name: string;
    enabled: 0 | 1;
    when_json: string;
    find_json: string;
    actions_json: string;
    owner_producer_id?: string | null;
    created_at: number;
    updated_at: number;
};
export type JobRow = {
    job_id: string;
    rule_id: string;
    target_id?: string | null;
    state: 'queued' | 'running' | 'done' | 'failed' | 'dead';
    attempts: number;
    next_run_at: number;
    last_error?: string | null;
    evidence_json?: string | null;
    created_at: number;
    updated_at: number;
};
export type ContractTemplateRow = {
    template_id: string;
    name: string;
    description?: string | null;
    template_content: string;
    template_type: 'pdf' | 'markdown' | 'html' | 'json';
    variables_json?: string | null;
    owner_producer_id?: string | null;
    created_at: number;
    updated_at: number;
};
export type ArtifactRow = {
    artifact_id: string;
    job_id: string;
    artifact_type: string;
    content_hash: string;
    file_path?: string | null;
    content_data?: Buffer | null;
    version_id?: string | null;
    metadata_json?: string | null;
    created_at: number;
    published_at?: number | null;
};
export type OLEventRow = {
    event_id: string;
    event_time: string;
    namespace: string;
    job_name: string;
    run_id: string;
    event_type: string;
    payload_json: string;
    hash: string;
    created_at: number;
};
export type OLJobRow = {
    job_id: string;
    namespace: string;
    name: string;
    latest_facets_json?: string;
    created_at: number;
    updated_at: number;
};
export type OLRunRow = {
    run_key: string;
    namespace: string;
    job_name: string;
    run_id: string;
    state: string;
    start_time?: string;
    end_time?: string;
    facets_json?: string;
    created_at: number;
    updated_at: number;
};
export type OLDatasetRow = {
    dataset_key: string;
    namespace: string;
    name: string;
    latest_facets_json?: string;
    created_at: number;
    updated_at: number;
};
export type OLEdgeRow = {
    edge_id: string;
    namespace: string;
    parent_dataset_name: string;
    child_dataset_name: string;
    run_id: string;
    created_at: number;
};
export type OpenLineageEvent = {
    eventType: 'START' | 'COMPLETE' | 'ABORT';
    eventTime: string;
    producer: string;
    job: {
        namespace: string;
        name: string;
        facets?: Record<string, any>;
    };
    run: {
        runId: string;
        facets?: Record<string, any>;
    };
    inputs?: Array<{
        namespace: string;
        name: string;
        facets?: Record<string, any>;
    }>;
    outputs?: Array<{
        namespace: string;
        name: string;
        facets?: Record<string, any>;
    }>;
};
export type SearchItem = {
    version_id: string;
    dataset_id: string | null;
    title: string | null;
    license: string | null;
    classification: string | null;
    content_hash: string | null;
    created_at: string | null;
    manifest_json: string;
};
export declare function upsertManifest(manifest: Partial<ManifestRow>): Promise<void>;
export declare function createManifest(manifest: Partial<ManifestRow>): Promise<string>;
export declare function getManifest(versionId: string): Promise<ManifestRow | null>;
export declare function upsertProducer(producer: Partial<ProducerRow>): Promise<string>;
export declare function getProducerById(producerId: string): Promise<ProducerRow | null>;
export declare function getProducerByDatasetId(datasetId: string): Promise<ProducerRow | null>;
export declare function replaceEdges(child: string, parents: string[]): Promise<void>;
export declare function setPrice(versionId: string, satoshis: number): Promise<void>;
export declare function getPrice(versionId: string): Promise<number | null>;
export declare function insertReceipt(receipt: Omit<ReceiptRow, 'bytes_used' | 'last_seen'> & Partial<Pick<ReceiptRow, 'bytes_used' | 'last_seen'>>): Promise<void>;
export declare function getReceipt(receiptId: string): Promise<ReceiptRow | null>;
export declare function getRecentReceipts(limit?: number, offset?: number): Promise<ReceiptRow[]>;
export declare function setReceiptStatus(receiptId: string, status: string): Promise<void>;
export declare function updateReceiptUsage(receiptId: string, bytesUsed: number): Promise<void>;
export declare function ingestOpenLineageEvent(event: OpenLineageEvent): Promise<boolean>;
export declare function queryLineage(options: {
    node: string;
    depth?: number;
    direction?: 'up' | 'down' | 'both';
    namespace?: string;
}): Promise<{
    node: string;
    depth: number;
    direction: string;
    nodes: Array<{
        namespace: string;
        name: string;
        type: 'dataset';
        facets?: any;
    }>;
    edges: Array<{
        from: string;
        to: string;
        rel: 'parent';
    }>;
    stats: {
        nodes: number;
        edges: number;
        truncated: boolean;
    };
}>;
export declare function upsertDeclaration(row: Partial<DeclarationRow>): Promise<void>;
export declare function getDeclarationByVersion(versionId: string): Promise<DeclarationRow | null>;
export declare function getDeclarationByTxid(txid: string): Promise<DeclarationRow | null>;
export declare function setOpretVout(versionId: string, vout: number): Promise<void>;
export declare function setProofEnvelope(versionId: string, envelopeJson: string): Promise<void>;
export declare function insertAdvisory(db: any, advisory: Partial<AdvisoryRow>): void;
export declare function insertAdvisory(advisory: Partial<AdvisoryRow>): Promise<void>;
export declare function insertAdvisoryTargets(db: any, advisoryId: string, targets: Array<{
    version_id?: string | null;
    producer_id?: string | null;
}>): void;
export declare function insertAdvisoryTargets(advisoryId: string, targets: Array<{
    version_id?: string | null;
    producer_id?: string | null;
}>): Promise<void>;
export declare function listAdvisoriesForVersionActiveAsync(versionId: string, now: number): Promise<AdvisoryRow[]>;
export declare function listAdvisoriesForProducerActiveAsync(producerId: string, now: number): Promise<AdvisoryRow[]>;
export declare function getProducerIdForVersionAsync(versionId: string): Promise<string | null>;
export declare function listAdvisoriesForVersionActive(db: any, versionId: string, now: number): AdvisoryRow[];
export declare function listAdvisoriesForProducerActive(db: any, producerId: string, now: number): AdvisoryRow[];
export declare function getProducerIdForVersion(db: any, versionId: string): string | null;
export declare function getBestUnitPrice(versionId: string, quantity: number, defaultSats: number): Promise<{
    satoshis: number;
    source: string;
    tier_from?: number;
}>;
export declare function getBestUnitPrice(db: any, versionId: string, quantity: number, defaultSats: number): {
    satoshis: number;
    source: string;
    tier_from?: number;
};
export declare function upsertPriceRule(db: any, rule: {
    version_id?: string | null;
    producer_id?: string | null;
    tier_from: number;
    satoshis: number;
}): void;
export declare function upsertPriceRule(rule: {
    version_id?: string;
    producer_id?: string;
    tier_from: number;
    satoshis: number;
}): Promise<void>;
export declare function deletePriceRule(db: any, params: {
    version_id?: string;
    producer_id?: string;
    tier_from?: number | null;
}): void;
export declare function deletePriceRule(versionId?: string, producerId?: string, tierFrom?: number): Promise<void>;
export declare function listListings(limit?: number, offset?: number): Promise<any[]>;
export declare function healthCheck(): Promise<{
    pg: boolean;
    redis: boolean;
}>;
export declare function getOLDataset(namespace: string, name: string): Promise<any>;
export declare function getOLRun(namespace: string, runId: string): Promise<any>;
export declare function getOLJob(namespace: string, name: string): Promise<any>;
export declare function searchOLDatasets(namespace: string, query?: string): Promise<any[]>;
export declare function listJobs(state?: string, limit?: number, offset?: number): Promise<JobRow[]>;
export declare function upsertAgent(agent: Partial<any>): Promise<string>;
export declare function getAgent(agentId: string): Promise<any>;
export declare function searchAgents(q?: string, capability?: string, limit?: number, offset?: number): Promise<any[]>;
export declare function setAgentPing(agentId: string, success: boolean): Promise<void>;
export declare function createRule(rule: Partial<RuleRow>): Promise<string>;
export declare function getRule(ruleId: string): Promise<RuleRow | null>;
export declare function listRules(enabled?: boolean): Promise<RuleRow[]>;
export declare function updateRule(ruleId: string, updates: Partial<RuleRow>): Promise<RuleRow | null>;
export declare function deleteRule(ruleId: string): Promise<boolean>;
export declare function listJobsByRule(ruleId: string, state?: string, limit?: number, offset?: number): Promise<JobRow[]>;
export declare function createTemplate(template: Partial<ContractTemplateRow>): Promise<string>;
export declare function getTemplate(templateId: string): Promise<ContractTemplateRow | null>;
export declare function listTemplates(limit?: number, offset?: number): Promise<ContractTemplateRow[]>;
export declare function updateTemplate(templateId: string, updates: Partial<ContractTemplateRow>): Promise<ContractTemplateRow | null>;
export declare function deleteTemplate(templateId: string): Promise<boolean>;
export declare function searchManifests(q?: string, limit?: number, offset?: number): Promise<any[]>;
export declare function listVersionsByDataset(datasetId: string): Promise<any[]>;
export declare function getParents(versionId: string): Promise<string[]>;
