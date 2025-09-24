export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean';
    required?: boolean;
    default?: any;
    description?: string;
}
export interface TemplateSchema {
    variables: TemplateVariable[];
    metadata?: {
        title?: string;
        description?: string;
        version?: string;
    };
}
export declare function renderTemplate(template: string, variables: Record<string, any>): string;
export declare function validateTemplateVariables(variables: Record<string, any>, schema: TemplateSchema): {
    valid: boolean;
    errors: string[];
};
export declare function generateContract(template: any, variables: Record<string, any>): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    metadata?: any;
}>;
export declare function generateContract(db: any, templateId: string, variables: Record<string, any>): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    metadata?: any;
}>;
export declare const EXAMPLE_CONTRACT_TEMPLATE = "# Data Processing Agreement\n\n**Agreement ID:** {{AGREEMENT_ID}}\n**Generated:** {{GENERATED_AT}}\n\n## Parties\n\n**Data Provider:** {{PROVIDER_NAME}}\n**Data Consumer:** {{CONSUMER_NAME}}\n\n## Terms\n\nThis agreement governs the processing of data with the following specifications:\n\n- **Dataset ID:** {{DATASET_ID}}\n- **Version ID:** {{VERSION_ID}}\n- **Processing Type:** {{PROCESSING_TYPE}}\n- **Price per Unit:** {{PRICE_SATS}} satoshis\n- **Quantity:** {{QUANTITY}} units\n- **Total Cost:** {{TOTAL_COST}} satoshis\n\n## Processing Rules\n\n{{#PROCESSING_RULES}}\n- {{.}}\n{{/PROCESSING_RULES}}\n\n## Data Usage Rights\n\nThe consumer is granted the following rights:\n- {{USAGE_RIGHTS}}\n\n## Obligations\n\n### Provider Obligations:\n- Ensure data quality and accuracy\n- Provide timely access to specified data\n- Maintain data confidentiality where required\n\n### Consumer Obligations:\n- Use data only for specified purposes\n- Pay agreed amounts promptly\n- Comply with all applicable regulations\n\n## Payment Terms\n\nPayment of {{TOTAL_COST}} satoshis is due upon completion of data processing.\nPayment will be made via BSV transaction to the specified address.\n\n## Effective Period\n\nThis agreement is effective from {{START_DATE}} to {{END_DATE}}.\n\n---\n\n*This agreement was generated automatically by the Gitdata Agent Marketplace.*\n*Template: {{TEMPLATE_NAME}} ({{TEMPLATE_ID}})*\n";
export declare const EXAMPLE_TEMPLATE_SCHEMA: TemplateSchema;
