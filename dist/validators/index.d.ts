/**
 * Compile and cache Ajv validators.
 * Pass schemaPath if your schema is not in ./schemas/dlm1-manifest.schema.json
 */
export declare function initValidators(schemaPath?: string): void;
export declare function validateDlm1Manifest(manifest: unknown): {
    ok: boolean;
    errors?: any;
};
