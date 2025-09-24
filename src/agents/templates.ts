import { getTemplate } from '../db';

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

// Enhanced mustache-style template engine with nested object support
export function renderTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();

    // Support nested object access like {{USER.name}}
    const value = getNestedValue(variables, trimmedKey);

    if (value === undefined || value === null) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

// Helper function to get nested values from objects
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

export function validateTemplateVariables(
  variables: Record<string, any>,
  schema: TemplateSchema,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Apply defaults first
  for (const variable of schema.variables) {
    if (variables[variable.name] === undefined && variable.default !== undefined) {
      variables[variable.name] = variable.default;
    }
  }

  for (const variable of schema.variables) {
    const value = variables[variable.name];

    if (variable.required && (value === undefined || value === null)) {
      errors.push(`Required variable '${variable.name}' is missing`);
      continue;
    }

    if (value !== undefined && value !== null) {
      switch (variable.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`Variable '${variable.name}' must be a string`);
          }
          break;
        case 'number':
          if (typeof value !== 'number' && !isNaN(Number(value))) {
            variables[variable.name] = Number(value);
          } else if (isNaN(Number(value))) {
            errors.push(`Variable '${variable.name}' must be a number`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            if (value === 'true' || value === '1' || value === 1) {
              variables[variable.name] = true;
            } else if (value === 'false' || value === '0' || value === 0) {
              variables[variable.name] = false;
            } else {
              errors.push(`Variable '${variable.name}' must be a boolean`);
            }
          }
          break;
        case 'date':
          if (!(value instanceof Date) && isNaN(Date.parse(value))) {
            errors.push(`Variable '${variable.name}' must be a valid date`);
          } else if (!(value instanceof Date)) {
            variables[variable.name] = new Date(value);
          }
          break;
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Overloaded function signatures
/* eslint-disable no-redeclare */
export function generateContract(
  template: any,
  variables: Record<string, any>,
): Promise<{ success: boolean; content?: string; error?: string; metadata?: any }>;
export function generateContract(
  db: any,
  templateId: string,
  variables: Record<string, any>,
): Promise<{ success: boolean; content?: string; error?: string; metadata?: any }>;

// Implementation that handles both cases
/* eslint-disable no-redeclare */
export async function generateContract(
  templateOrDb: any,
  templateIdOrVariables: string | Record<string, any>,
  variablesOrUndefined?: Record<string, any>,
): Promise<{ success: boolean; content?: string; error?: string; metadata?: any }> {
  try {
    let template: any;
    let variables: Record<string, any>;

    // Determine calling pattern
    if (typeof templateIdOrVariables === 'string') {
      // Called with (db, templateId, variables)
      const db = templateOrDb;
      const templateId = templateIdOrVariables;
      variables = variablesOrUndefined || {};

      if (db && typeof db.getTemplate === 'function') {
        // Test database object with getTemplate method
        template = await db.getTemplate(templateId);
      } else {
        // Use imported getTemplate function for PostgreSQL
        template = await getTemplate(templateId);
      }

      if (!template) {
        return { success: false, error: 'Template not found' };
      }
    } else {
      // Called with (template, variables)
      template = templateOrDb;
      variables = templateIdOrVariables || {};

      if (!template) {
        return { success: false, error: 'Template not found' };
      }
    }

    let schema: TemplateSchema = { variables: [] };
    if (template.variables_json) {
      try {
        schema = JSON.parse(template.variables_json);
      } catch (e) {
        return { success: false, error: 'Invalid template schema' };
      }
    }

    // Validate variables (defaults are applied within validation)
    const validation = validateTemplateVariables(variables, schema);
    if (!validation.valid) {
      return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }

    // Add system variables
    const systemVars = {
      ...variables,
      GENERATED_AT: new Date().toISOString(),
      TEMPLATE_NAME: template.name,
      TEMPLATE_ID: template.template_id,
    };

    const content = renderTemplate(template.template_content, systemVars);

    return {
      success: true,
      content,
      metadata: {
        templateId: template.template_id,
        templateName: template.name,
        templateType: template.template_type,
        generatedAt: systemVars.GENERATED_AT,
        variables: systemVars,
      },
    };
  } catch (error) {
    return { success: false, error: `Template generation failed: ${(error as Error).message}` };
  }
}

// Example markdown contract template
export const EXAMPLE_CONTRACT_TEMPLATE = `# Data Processing Agreement

**Agreement ID:** {{AGREEMENT_ID}}
**Generated:** {{GENERATED_AT}}

## Parties

**Data Provider:** {{PROVIDER_NAME}}
**Data Consumer:** {{CONSUMER_NAME}}

## Terms

This agreement governs the processing of data with the following specifications:

- **Dataset ID:** {{DATASET_ID}}
- **Version ID:** {{VERSION_ID}}
- **Processing Type:** {{PROCESSING_TYPE}}
- **Price per Unit:** {{PRICE_SATS}} satoshis
- **Quantity:** {{QUANTITY}} units
- **Total Cost:** {{TOTAL_COST}} satoshis

## Processing Rules

{{#PROCESSING_RULES}}
- {{.}}
{{/PROCESSING_RULES}}

## Data Usage Rights

The consumer is granted the following rights:
- {{USAGE_RIGHTS}}

## Obligations

### Provider Obligations:
- Ensure data quality and accuracy
- Provide timely access to specified data
- Maintain data confidentiality where required

### Consumer Obligations:
- Use data only for specified purposes
- Pay agreed amounts promptly
- Comply with all applicable regulations

## Payment Terms

Payment of {{TOTAL_COST}} satoshis is due upon completion of data processing.
Payment will be made via BSV transaction to the specified address.

## Effective Period

This agreement is effective from {{START_DATE}} to {{END_DATE}}.

---

*This agreement was generated automatically by the Gitdata Agent Marketplace.*
*Template: {{TEMPLATE_NAME}} ({{TEMPLATE_ID}})*
`;

export const EXAMPLE_TEMPLATE_SCHEMA: TemplateSchema = {
  variables: [
    { name: 'AGREEMENT_ID', type: 'string', required: true },
    { name: 'PROVIDER_NAME', type: 'string', required: true },
    { name: 'CONSUMER_NAME', type: 'string', required: true },
    { name: 'DATASET_ID', type: 'string', required: true },
    { name: 'VERSION_ID', type: 'string', required: true },
    { name: 'PROCESSING_TYPE', type: 'string', required: true },
    { name: 'PRICE_SATS', type: 'number', required: true },
    { name: 'QUANTITY', type: 'number', required: true },
    { name: 'TOTAL_COST', type: 'number', required: true },
    { name: 'USAGE_RIGHTS', type: 'string', required: true },
    {
      name: 'START_DATE',
      type: 'date',
      required: false,
      default: new Date().toISOString().split('T')[0],
    },
    { name: 'END_DATE', type: 'date', required: false },
  ],
  metadata: {
    title: 'Data Processing Agreement Template',
    description: 'Standard template for data processing agreements',
    version: '1.0',
  },
};
