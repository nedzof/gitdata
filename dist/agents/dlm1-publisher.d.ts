export interface PublishableArtifact {
    id: string;
    type: string;
    content: string;
    metadata: any;
    jobId: string;
}
export interface DLM1Manifest {
    name: string;
    description: string;
    license: string;
    classification: string;
    datasetId: string;
    provenance: {
        createdBy: string;
        createdAt: string;
        method: string;
        inputs?: string[];
    };
    contentHash: string;
    content?: {
        type: string;
        encoding?: string;
        inline?: string;
        url?: string;
    };
}
export declare function publishArtifactToDLM1(db: Database.Database, artifactId: string, overlayUrl?: string): Promise<{
    success: boolean;
    versionId?: string;
    error?: string;
}>;
export declare function publishContractArtifact(db: Database.Database, jobId: string, contractContent: string, contractMetadata: any, overlayUrl?: string): Promise<{
    success: boolean;
    artifactId?: string;
    versionId?: string;
    error?: string;
}>;
export declare function createArtifactRoutes(db: Database.Database): any;
