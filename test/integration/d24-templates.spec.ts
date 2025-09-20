import { test, expect, beforeAll, afterAll, describe } from 'vitest';
import request from 'supertest';
import express from 'express';
import { openDb, initSchema } from '../../src/db';
import { templatesRouter } from '../../src/routes/templates';
import { generateContract, renderTemplate, validateTemplateVariables, EXAMPLE_TEMPLATE_SCHEMA } from '../../src/agents/templates';
import { enforceResourceLimits } from '../../src/middleware/policy';

let app: express.Application;
let db: any;

beforeAll(async () => {
  db = openDb(':memory:');
  initSchema(db);

  app = express();
  app.use(express.json());
  app.use('/templates', enforceResourceLimits(), templatesRouter(db));
});

afterAll(() => {
  if (db) db.close();
});

describe('D24 Template System - Comprehensive Testing', () => {

  describe('Template Engine Core', () => {
    test('should render simple templates with variables', () => {
      const template = 'Hello {{NAME}}, welcome to {{PLATFORM}}!';
      const variables = { NAME: 'Alice', PLATFORM: 'Gitdata' };

      const result = renderTemplate(template, variables);
      expect(result).toBe('Hello Alice, welcome to Gitdata!');
    });

    test('should handle missing variables gracefully', () => {
      const template = 'Hello {{NAME}}, welcome to {{MISSING}}!';
      const variables = { NAME: 'Alice' };

      const result = renderTemplate(template, variables);
      expect(result).toBe('Hello Alice, welcome to !');
    });

    test('should handle complex objects', () => {
      const template = 'User: {{USER}}, Data: {{DATA}}';
      const variables = {
        USER: { name: 'Bob', email: 'bob@example.com' },
        DATA: { value: 42, array: [1, 2, 3] }
      };

      const result = renderTemplate(template, variables);
      expect(result).toContain('{"name":"Bob","email":"bob@example.com"}');
      expect(result).toContain('{"value":42,"array":[1,2,3]}');
    });

    test('should validate template variables correctly', () => {
      const schema = {
        variables: [
          { name: 'NAME', type: 'string', required: true },
          { name: 'AGE', type: 'number', required: true },
          { name: 'ACTIVE', type: 'boolean', required: false, default: true },
          { name: 'CREATED_DATE', type: 'date', required: false }
        ]
      };

      // Valid variables
      const validVariables = { NAME: 'Alice', AGE: 30 };
      const validResult = validateTemplateVariables(validVariables, schema);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      expect(validVariables.ACTIVE).toBe(true); // Default applied

      // Invalid variables
      const invalidVariables = { NAME: 'Alice', AGE: 'not-a-number' };
      const invalidResult = validateTemplateVariables(invalidVariables, schema);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);

      // Missing required variable
      const missingVariables = { NAME: 'Alice' };
      const missingResult = validateTemplateVariables(missingVariables, schema);
      expect(missingResult.valid).toBe(false);
      expect(missingResult.errors.some(e => e.includes('AGE'))).toBe(true);
    });

    test('should handle type coercion', () => {
      const schema = {
        variables: [
          { name: 'NUMBER_STRING', type: 'number', required: true },
          { name: 'BOOL_STRING', type: 'boolean', required: true },
          { name: 'DATE_STRING', type: 'date', required: true }
        ]
      };

      const variables = {
        NUMBER_STRING: '42',
        BOOL_STRING: 'true',
        DATE_STRING: '2024-01-01'
      };

      const result = validateTemplateVariables(variables, schema);
      expect(result.valid).toBe(true);
      expect(typeof variables.NUMBER_STRING).toBe('number');
      expect(typeof variables.BOOL_STRING).toBe('boolean');
      expect(variables.DATE_STRING instanceof Date).toBe(true);
    });
  });

  describe('Template CRUD Operations', () => {
    test('should create, read, update, and delete templates', async () => {
      // Create template
      const createResponse = await request(app)
        .post('/templates')
        .send({
          name: 'Test Contract Template',
          description: 'A template for testing CRUD operations',
          content: `# Contract Agreement

Provider: {{PROVIDER}}
Consumer: {{CONSUMER}}
Amount: {{AMOUNT}} BTC

This agreement was generated on {{GENERATED_AT}}.`,
          type: 'markdown',
          variables: {
            variables: [
              { name: 'PROVIDER', type: 'string', required: true },
              { name: 'CONSUMER', type: 'string', required: true },
              { name: 'AMOUNT', type: 'number', required: true }
            ]
          }
        });

      expect(createResponse.status).toBe(200);
      const templateId = createResponse.body.templateId;
      expect(templateId).toBeDefined();

      // Read template
      const readResponse = await request(app).get(`/templates/${templateId}`);
      expect(readResponse.status).toBe(200);
      expect(readResponse.body.name).toBe('Test Contract Template');
      expect(readResponse.body.content).toContain('Provider: {{PROVIDER}}');

      // Update template
      const updateResponse = await request(app)
        .patch(`/templates/${templateId}`)
        .send({
          name: 'Updated Contract Template',
          description: 'Updated description'
        });

      expect(updateResponse.status).toBe(200);

      // Verify update
      const updatedReadResponse = await request(app).get(`/templates/${templateId}`);
      expect(updatedReadResponse.body.name).toBe('Updated Contract Template');
      expect(updatedReadResponse.body.description).toBe('Updated description');

      // List templates
      const listResponse = await request(app).get('/templates');
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.items.length).toBeGreaterThan(0);
      expect(listResponse.body.items.some((t: any) => t.templateId === templateId)).toBe(true);

      // Delete template
      const deleteResponse = await request(app).delete(`/templates/${templateId}`);
      expect(deleteResponse.status).toBe(200);

      // Verify deletion
      const deletedReadResponse = await request(app).get(`/templates/${templateId}`);
      expect(deletedReadResponse.status).toBe(404);
    });

    test('should validate template creation data', async () => {
      // Missing required fields
      const missingFieldsResponse = await request(app)
        .post('/templates')
        .send({
          name: 'Incomplete Template'
          // Missing content
        });

      expect(missingFieldsResponse.status).toBe(400);
      expect(missingFieldsResponse.body.error).toBe('bad-request');

      // Invalid template type
      const invalidTypeResponse = await request(app)
        .post('/templates')
        .send({
          name: 'Invalid Type Template',
          content: 'Test content',
          type: 'invalid-type'
        });

      // Should succeed - type validation is not strict
      expect(invalidTypeResponse.status).toBe(200);
    });
  });

  describe('Contract Generation', () => {
    let testTemplateId: string;

    beforeAll(async () => {
      // Create a test template
      const response = await request(app)
        .post('/templates')
        .send({
          name: 'Generation Test Template',
          content: `# Data Processing Agreement

**Agreement ID:** {{AGREEMENT_ID}}
**Provider:** {{PROVIDER_NAME}}
**Consumer:** {{CONSUMER_NAME}}
**Dataset:** {{DATASET_ID}}

## Financial Terms
- Price per unit: {{PRICE_SATS}} satoshis
- Quantity: {{QUANTITY}} units
- Total cost: {{TOTAL_COST}} satoshis

## Payment Information
{{#PAYMENT_ADDRESS}}
Payment address: {{PAYMENT_ADDRESS}}
{{/PAYMENT_ADDRESS}}

Generated at: {{GENERATED_AT}}`,
          type: 'markdown',
          variables: {
            variables: [
              { name: 'AGREEMENT_ID', type: 'string', required: true },
              { name: 'PROVIDER_NAME', type: 'string', required: true },
              { name: 'CONSUMER_NAME', type: 'string', required: true },
              { name: 'DATASET_ID', type: 'string', required: true },
              { name: 'PRICE_SATS', type: 'number', required: true },
              { name: 'QUANTITY', type: 'number', required: true },
              { name: 'TOTAL_COST', type: 'number', required: true },
              { name: 'PAYMENT_ADDRESS', type: 'string', required: false }
            ]
          }
        });

      testTemplateId = response.body.templateId;
    });

    test('should generate contracts with valid variables', async () => {
      const generateResponse = await request(app)
        .post(`/templates/${testTemplateId}/generate`)
        .send({
          variables: {
            AGREEMENT_ID: 'AGR-2024-001',
            PROVIDER_NAME: 'DataCorp Ltd',
            CONSUMER_NAME: 'Analytics Inc',
            DATASET_ID: 'financial-quarterly-2024',
            PRICE_SATS: 1000,
            QUANTITY: 5,
            TOTAL_COST: 5000,
            PAYMENT_ADDRESS: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
          }
        });

      expect(generateResponse.status).toBe(200);
      expect(generateResponse.body.status).toBe('ok');
      expect(generateResponse.body.content).toContain('AGR-2024-001');
      expect(generateResponse.body.content).toContain('DataCorp Ltd');
      expect(generateResponse.body.content).toContain('1000 satoshis');
      expect(generateResponse.body.content).toContain('5 units');
      expect(generateResponse.body.content).toContain('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

      // Check metadata
      expect(generateResponse.body.metadata).toBeDefined();
      expect(generateResponse.body.metadata.templateId).toBe(testTemplateId);
      expect(generateResponse.body.metadata.templateName).toBe('Generation Test Template');
    });

    test('should fail generation with missing required variables', async () => {
      const generateResponse = await request(app)
        .post(`/templates/${testTemplateId}/generate`)
        .send({
          variables: {
            AGREEMENT_ID: 'AGR-2024-002',
            PROVIDER_NAME: 'DataCorp Ltd'
            // Missing required variables
          }
        });

      expect(generateResponse.status).toBe(400);
      expect(generateResponse.body.error).toBe('generation-failed');
      expect(generateResponse.body.message).toContain('Required variable');
    });

    test('should apply default values for optional variables', async () => {
      // Create template with defaults
      const templateWithDefaults = await request(app)
        .post('/templates')
        .send({
          name: 'Template with Defaults',
          content: 'Name: {{NAME}}, Age: {{AGE}}, Active: {{ACTIVE}}',
          variables: {
            variables: [
              { name: 'NAME', type: 'string', required: true },
              { name: 'AGE', type: 'number', required: false, default: 25 },
              { name: 'ACTIVE', type: 'boolean', required: false, default: true }
            ]
          }
        });

      const generateResponse = await request(app)
        .post(`/templates/${templateWithDefaults.body.templateId}/generate`)
        .send({
          variables: { NAME: 'John' }
        });

      expect(generateResponse.status).toBe(200);
      expect(generateResponse.body.content).toContain('Age: 25');
      expect(generateResponse.body.content).toContain('Active: true');
    });

    test('should handle type validation and coercion', async () => {
      const generateResponse = await request(app)
        .post(`/templates/${testTemplateId}/generate`)
        .send({
          variables: {
            AGREEMENT_ID: 'AGR-2024-003',
            PROVIDER_NAME: 'DataCorp Ltd',
            CONSUMER_NAME: 'Analytics Inc',
            DATASET_ID: 'test-dataset',
            PRICE_SATS: '1500', // String that should be coerced to number
            QUANTITY: '3', // String that should be coerced to number
            TOTAL_COST: 4500
          }
        });

      expect(generateResponse.status).toBe(200);
      expect(generateResponse.body.content).toContain('1500 satoshis');
      expect(generateResponse.body.content).toContain('3 units');
    });
  });

  describe('Bootstrap and Example Templates', () => {
    test('should bootstrap example template when system is empty', async () => {
      // Clear existing templates
      const listResponse = await request(app).get('/templates');
      for (const template of listResponse.body.items) {
        await request(app).delete(`/templates/${template.templateId}`);
      }

      // Bootstrap should work
      const bootstrapResponse = await request(app)
        .post('/templates/bootstrap');

      expect(bootstrapResponse.status).toBe(200);
      expect(bootstrapResponse.body.templateId).toBeDefined();
      expect(bootstrapResponse.body.message).toBe('Example template created');

      // Verify template was created
      const newListResponse = await request(app).get('/templates');
      expect(newListResponse.body.items).toHaveLength(1);
      expect(newListResponse.body.items[0].name).toBe('Data Processing Agreement');

      // Should fail when templates exist
      const secondBootstrapResponse = await request(app)
        .post('/templates/bootstrap');

      expect(secondBootstrapResponse.status).toBe(400);
      expect(secondBootstrapResponse.body.error).toBe('templates-exist');
    });

    test('should generate contract from example template', async () => {
      // Ensure example template exists
      await request(app).post('/templates/bootstrap');

      const listResponse = await request(app).get('/templates');
      const exampleTemplate = listResponse.body.items[0];

      const generateResponse = await request(app)
        .post(`/templates/${exampleTemplate.templateId}/generate`)
        .send({
          variables: {
            AGREEMENT_ID: 'EXAMPLE-001',
            PROVIDER_NAME: 'Example Provider',
            CONSUMER_NAME: 'Example Consumer',
            DATASET_ID: 'example-dataset',
            VERSION_ID: 'v1.0.0',
            PROCESSING_TYPE: 'analysis',
            PRICE_SATS: 2000,
            QUANTITY: 1,
            TOTAL_COST: 2000,
            USAGE_RIGHTS: 'research and development'
          }
        });

      expect(generateResponse.status).toBe(200);
      expect(generateResponse.body.content).toContain('Data Processing Agreement');
      expect(generateResponse.body.content).toContain('Example Provider');
      expect(generateResponse.body.content).toContain('research and development');
    });
  });

  describe('Template Integration with Database Layer', () => {
    test('should generate contracts using database function', () => {
      // Test the direct database function
      const result = generateContract(db, 'nonexistent-template', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found');
    });
  });

  describe('Advanced Template Features', () => {
    test('should handle templates with complex conditional logic', async () => {
      const complexTemplate = await request(app)
        .post('/templates')
        .send({
          name: 'Complex Template',
          content: `# Contract
{{#PREMIUM}}
This is a premium service.
Premium features included: {{PREMIUM_FEATURES}}
{{/PREMIUM}}

{{^PREMIUM}}
This is a standard service.
{{/PREMIUM}}

Terms: {{TERMS}}`,
          variables: {
            variables: [
              { name: 'PREMIUM', type: 'boolean', required: false, default: false },
              { name: 'PREMIUM_FEATURES', type: 'string', required: false },
              { name: 'TERMS', type: 'string', required: true }
            ]
          }
        });

      // Test with premium = true
      const premiumResponse = await request(app)
        .post(`/templates/${complexTemplate.body.templateId}/generate`)
        .send({
          variables: {
            PREMIUM: true,
            PREMIUM_FEATURES: 'Advanced analytics, Priority support',
            TERMS: 'Standard terms apply'
          }
        });

      expect(premiumResponse.status).toBe(200);
      expect(premiumResponse.body.content).toContain('Advanced analytics');

      // Test with premium = false (default)
      const standardResponse = await request(app)
        .post(`/templates/${complexTemplate.body.templateId}/generate`)
        .send({
          variables: {
            TERMS: 'Standard terms apply'
          }
        });

      expect(standardResponse.status).toBe(200);
      expect(standardResponse.body.content).toContain('Standard terms apply');
    });

    test('should handle large templates efficiently', async () => {
      const largeContent = `# Large Contract Template

${'Clause {{CLAUSE_NUMBER}}: This is a standard clause.\n'.repeat(100)}

Generated: {{GENERATED_AT}}`;

      const largeTemplate = await request(app)
        .post('/templates')
        .send({
          name: 'Large Template',
          content: largeContent,
          variables: {
            variables: [
              { name: 'CLAUSE_NUMBER', type: 'number', required: false, default: 1 }
            ]
          }
        });

      expect(largeTemplate.status).toBe(200);

      const generateResponse = await request(app)
        .post(`/templates/${largeTemplate.body.templateId}/generate`)
        .send({ variables: {} });

      expect(generateResponse.status).toBe(200);
      expect(generateResponse.body.content.length).toBeGreaterThan(1000);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed variable schemas', async () => {
      const malformedSchemaResponse = await request(app)
        .post('/templates')
        .send({
          name: 'Malformed Schema Template',
          content: 'Test content',
          variables: 'invalid-json-string'
        });

      expect(malformedSchemaResponse.status).toBe(200); // Should still create template

      // But generation should handle the malformed schema gracefully
      const generateResponse = await request(app)
        .post(`/templates/${malformedSchemaResponse.body.templateId}/generate`)
        .send({ variables: {} });

      expect(generateResponse.status).toBe(400);
    });

    test('should handle special characters in template content', async () => {
      const specialCharsTemplate = await request(app)
        .post('/templates')
        .send({
          name: 'Special Characters Template',
          content: `Contract with special chars:
          - Unicode: 🚀 💰 📊
          - HTML entities: &lt; &gt; &amp;
          - Emojis: {{EMOJI_STATUS}}
          - Math symbols: ∑ ∆ π
          - Quotes: "Smart quotes" 'apostrophes'`,
          variables: {
            variables: [
              { name: 'EMOJI_STATUS', type: 'string', required: false, default: '✅' }
            ]
          }
        });

      const generateResponse = await request(app)
        .post(`/templates/${specialCharsTemplate.body.templateId}/generate`)
        .send({ variables: {} });

      expect(generateResponse.status).toBe(200);
      expect(generateResponse.body.content).toContain('🚀');
      expect(generateResponse.body.content).toContain('✅');
    });
  });
});