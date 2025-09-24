interface FacetRegistry {
    version: string;
    description: string;
    baseUrl: string;
    facets: Record<string, FacetDefinition>;
    validation: ValidationConfig;
}
interface FacetDefinition {
    version: string;
    schemaUrl: string;
    localPath?: string;
    description: string;
    context: string[];
    required: boolean;
}
interface ValidationConfig {
    strictMode: boolean;
    allowUnknownFacets: boolean;
    maxFacetSize: number;
    validateSchemas: boolean;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare class FacetValidator {
    private ajv;
    private registry;
    private compiledSchemas;
    constructor();
    private loadSchemas;
    validateOpenLineageEvent(event: any): ValidationResult;
    private validateCoreStructure;
    private validateFacets;
    private validateSingleFacet;
    getFacetRegistry(): FacetRegistry;
    isKnownFacet(facetName: string): boolean;
    getRequiredFacets(context: string): string[];
}
export {};
