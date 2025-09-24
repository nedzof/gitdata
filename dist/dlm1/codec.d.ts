export type Hex = string;
export type DLM1Manifest = {
    type: 'datasetVersionManifest';
    datasetId: string;
    versionId?: string;
    description?: string;
    content: {
        contentHash: Hex;
        sizeBytes?: number;
        mimeType?: string;
        schema?: {
            uri?: string;
            schemaHash?: Hex;
        };
        [k: string]: unknown;
    };
    lineage?: {
        parents?: Hex[];
        transforms?: Array<{
            name: string;
            parametersHash?: string;
            [k: string]: unknown;
        }>;
        [k: string]: unknown;
    };
    provenance: {
        producer?: {
            identityKey?: string;
            [k: string]: unknown;
        };
        createdAt: string;
        locations?: Array<{
            type: string;
            uri: string;
            [k: string]: unknown;
        }>;
        [k: string]: unknown;
    };
    policy: {
        license: string;
        classification: 'public' | 'internal' | 'restricted' | 'clinical-research';
        pii_flags?: string[];
        [k: string]: unknown;
    };
    signatures?: {
        producer?: {
            publicKey: string;
            signature: string;
            [k: string]: unknown;
        };
        endorsements?: Array<{
            role?: string;
            publicKey: string;
            signature: string;
            expiresAt?: string;
            [k: string]: unknown;
        }>;
        [k: string]: unknown;
    };
    [k: string]: unknown;
};
/**
 * Derive versionId:
 * - If manifest.versionId is a 64-hex, use it (lowercase).
 * - Else compute sha256(canonicalizeManifest(manifest)) as lower 64-hex.
 */
export declare function deriveVersionId(manifest: DLM1Manifest): Hex;
/**
 * Extract parents from manifest.lineage.parents (64-hex), unique + lowercase.
 */
export declare function extractParentsLegacy(manifest: any): Hex[];
export type Dlm1Anchor = {
    mh: Hex;
    p?: Hex[];
};
export declare function encodeDLM1(anchor: Dlm1Anchor): Uint8Array;
export declare function decodeDLM1(buf: Uint8Array): Dlm1Anchor;
/**
 * Convenience: build DLM1 anchor fields from a manifest per your schema.
 */
export declare function anchorFromManifest(manifest: any): Dlm1Anchor;
export declare function canonicalizeManifest(manifest: any): string;
export declare function sha256Hex(s: string): string;
/** Derive versionId from canonical manifest; if explicit versionId is provided it must match or throw */
export declare function deriveManifestIds(manifest: any): {
    versionId: string;
    manifestHash: string;
};
export declare function extractParents(manifest: any): string[];
export declare function buildDlm1AnchorFromManifest(manifest: any): {
    cbor: Uint8Array;
    versionId: string;
    parents: string[];
};
