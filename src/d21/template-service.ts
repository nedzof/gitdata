/**
 * D21 Payment Template Service
 *
 * Provides deterministic payment template generation with custom revenue splits.
 * Templates ensure reproducible payment outputs and integrate with BRC-41 payments.
 */

import { createHash, randomBytes } from 'crypto';
import type { Pool } from 'pg';

import type { DatabaseAdapter } from '../overlay/brc26-uhrp.js';
import { getBRC31Identity } from '../brc31/middleware.js';

import type {
  D21PaymentTemplate,
  D21PaymentTemplateService,
  PaymentSplitRules,
  PaymentOutput,
} from './types.js';
import {
  D21TemplateError,
  DEFAULT_SPLIT_RULES,
  TEMPLATE_EXPIRY_MS,
} from './types.js';

export class D21PaymentTemplateServiceImpl implements D21PaymentTemplateService {
  private database: DatabaseAdapter;
  private initialized = false;

  constructor(database: DatabaseAdapter) {
    this.database = database;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🔧 Initializing D21 Payment Template Service...');

    try {
      // Ensure D21 template tables exist
      await this.createTemplateSchema();

      this.initialized = true;
      console.log('✅ D21 Payment Template Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize D21 Payment Template Service:', error);
      throw error;
    }
  }

  private async createTemplateSchema(): Promise<void> {
    // Create D21 payment templates table
    await this.database.execute(`
        CREATE TABLE IF NOT EXISTS d21_payment_templates (
          template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_hash VARCHAR(64) NOT NULL UNIQUE,

          -- Links to BRC-41 payment system
          brc41_payment_id VARCHAR(100),

          -- Template configuration
          split_rules JSONB NOT NULL,
          output_scripts JSONB NOT NULL,
          total_amount_satoshis BIGINT NOT NULL,

          -- Template metadata and versioning
          deterministic_inputs JSONB NOT NULL,
          template_version VARCHAR(10) DEFAULT '2.0',
          created_by VARCHAR(66),

          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP NOT NULL,
          is_used BOOLEAN DEFAULT FALSE
        )
      `);

    // Create indexes
    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_d21_templates_hash
      ON d21_payment_templates(template_hash)
    `);

    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_d21_templates_brc41
      ON d21_payment_templates(brc41_payment_id)
    `);

    console.log('📊 D21 payment template schema ready');
  }

  /**
   * Generate deterministic payment template
   */
  async generateTemplate(params: {
    brc41PaymentId?: string;
    splitRules: PaymentSplitRules;
    totalSatoshis: number;
    createdBy: string;
    metadata?: Record<string, any>;
  }): Promise<D21PaymentTemplate> {
    await this.initialize();

    console.log(`💳 Generating payment template for ${params.totalSatoshis} satoshis`);

    try {
      // Validate split rules
      this.validateSplitRules(params.splitRules);

      // Generate deterministic inputs for reproducibility
      const deterministicInputs = {
        splitRules: params.splitRules,
        totalSatoshis: params.totalSatoshis,
        createdBy: params.createdBy,
        timestamp: Date.now(),
        nonce: randomBytes(8).toString('hex'),
        ...params.metadata,
      };

      // Calculate template hash
      const templateHash = this.calculateTemplateHash(deterministicInputs);

      // Generate payment outputs based on split rules
      const outputScripts = await this.generatePaymentOutputs(
        params.splitRules,
        params.totalSatoshis,
        params.createdBy
      );

      const template: D21PaymentTemplate = {
        templateId: randomBytes(16).toString('hex'),
        templateHash,
        brc41PaymentId: params.brc41PaymentId,
        splitRules: params.splitRules,
        outputScripts,
        totalAmountSatoshis: params.totalSatoshis,
        deterministicInputs,
        templateVersion: '2.0',
        createdBy: params.createdBy,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + TEMPLATE_EXPIRY_MS),
        isUsed: false,
      };

      // Store template in database
      await this.storeTemplate(template);

      console.log(`✅ Generated payment template: ${templateHash.slice(0, 10)}...`);
      return template;

    } catch (error) {
      console.error('❌ Failed to generate payment template:', error);
      throw new D21TemplateError('Failed to generate payment template', 'unknown');
    }
  }

  /**
   * Retrieve payment template by hash
   */
  async getTemplate(templateHash: string): Promise<D21PaymentTemplate | null> {
    await this.initialize();

    const row = await this.database.queryOne(
      `SELECT * FROM d21_payment_templates WHERE template_hash = $1`,
      [templateHash]
    );

    if (!row) {
      return null;
    }

    return {
      templateId: row.template_id,
      templateHash: row.template_hash,
      brc41PaymentId: row.brc41_payment_id,
      splitRules: row.split_rules,
      outputScripts: row.output_scripts,
      totalAmountSatoshis: parseInt(row.total_amount_satoshis),
      deterministicInputs: row.deterministic_inputs,
      templateVersion: row.template_version,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      isUsed: row.is_used,
    };
  }

  /**
   * Verify template reproducibility
   */
  async verifyTemplate(templateHash: string): Promise<boolean> {
    const template = await this.getTemplate(templateHash);
    if (!template) return false;

    try {
      // Recalculate hash from deterministic inputs
      const recalculatedHash = this.calculateTemplateHash(template.deterministicInputs);

      // Verify hash matches
      const hashMatches = recalculatedHash === templateHash;

      // Verify split rules add up to 1.0
      const splitSum = Object.values(template.splitRules).reduce((sum, val) => sum + val, 0);
      const splitsValid = Math.abs(splitSum - 1.0) < 0.0001; // Allow for floating point precision

      // Verify outputs match expected totals
      const outputTotal = template.outputScripts.reduce((sum, output) => sum + output.satoshis, 0);
      const totalsMatch = outputTotal === template.totalAmountSatoshis;

      return hashMatches && splitsValid && totalsMatch;

    } catch (error) {
      console.error('Template verification failed:', error);
      return false;
    }
  }

  /**
   * Get template usage analytics
   */
  async getTemplateUsage(templateHash: string): Promise<{
    totalUses: number;
    totalVolumeSatoshis: number;
    averageTransactionSize: number;
  }> {
    await this.initialize();

    // Query usage from both D21 ARC transactions and BRC-41 links
    const row = await this.database.queryOne(`
      SELECT
        COUNT(*) as total_uses,
        COALESCE(SUM(total_amount_satoshis), 0) as total_volume
      FROM d21_payment_templates pt
      LEFT JOIN d21_arc_transactions at ON pt.template_id = at.d21_template_id
      WHERE pt.template_hash = $1
    `, [templateHash]);

    const totalUses = parseInt(row?.total_uses) || 0;
    const totalVolume = parseInt(row?.total_volume) || 0;
    const averageSize = totalUses > 0 ? Math.round(totalVolume / totalUses) : 0;

    return {
      totalUses,
      totalVolumeSatoshis: totalVolume,
      averageTransactionSize: averageSize,
    };
  }

  // ==================== Private Methods ====================

  private validateSplitRules(splitRules: PaymentSplitRules): void {
    const totalSplit = Object.values(splitRules).reduce((sum, val) => sum + val, 0);

    if (Math.abs(totalSplit - 1.0) > 0.0001) {
      throw new D21TemplateError(
        `Split rules must sum to 1.0, got ${totalSplit}`,
        'invalid_splits'
      );
    }

    // Validate individual splits
    for (const [recipient, percentage] of Object.entries(splitRules)) {
      if (percentage < 0 || percentage > 1) {
        throw new D21TemplateError(
          `Split percentage for ${recipient} must be between 0 and 1, got ${percentage}`,
          'invalid_split_range'
        );
      }
    }
  }

  private calculateTemplateHash(deterministicInputs: Record<string, any>): string {
    // Create deterministic string representation
    const sortedKeys = Object.keys(deterministicInputs).sort();
    const deterministicString = sortedKeys
      .map(key => `${key}:${JSON.stringify(deterministicInputs[key])}`)
      .join('|');

    return createHash('sha256').update(deterministicString).digest('hex');
  }

  private async generatePaymentOutputs(
    splitRules: PaymentSplitRules,
    totalSatoshis: number,
    createdBy: string
  ): Promise<PaymentOutput[]> {
    const outputs: PaymentOutput[] = [];
    let remainingSatoshis = totalSatoshis;

    // Generate outputs for each split rule
    for (const [recipient, percentage] of Object.entries(splitRules)) {
      const satoshis = Math.floor(totalSatoshis * percentage);
      remainingSatoshis -= satoshis;

      if (satoshis > 0) {
        const scriptHex = await this.generateScriptForRecipient(recipient, createdBy);

        outputs.push({
          scriptHex,
          satoshis,
          recipient,
          description: this.getRecipientDescription(recipient),
        });
      }
    }

    // Add any remaining satoshis to the first output (to handle rounding)
    if (remainingSatoshis > 0 && outputs.length > 0) {
      outputs[0].satoshis += remainingSatoshis;
    }

    return outputs;
  }

  private async generateScriptForRecipient(recipient: string, createdBy: string): Promise<string> {
    // For now, generate a simple P2PKH script
    // In production, this would integrate with wallet management and recipient lookup

    // Generate deterministic script based on recipient and creator
    const scriptSeed = createHash('sha256')
      .update(`${recipient}:${createdBy}:${Date.now()}`)
      .digest('hex')
      .slice(0, 40); // 20 bytes for address hash

    // Simple P2PKH script format: OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
    return `76a914${scriptSeed}88ac`;
  }

  private getRecipientDescription(recipient: string): string {
    const descriptions: Record<string, string> = {
      overlay: 'Platform fee',
      producer: 'Producer revenue share',
      agent: 'Agent commission',
    };

    return descriptions[recipient] || `Payment to ${recipient}`;
  }

  private async storeTemplate(template: D21PaymentTemplate): Promise<void> {
    await this.database.execute(`
      INSERT INTO d21_payment_templates (
        template_id, template_hash, brc41_payment_id,
        split_rules, output_scripts, total_amount_satoshis,
        deterministic_inputs, template_version, created_by,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      template.templateId,
      template.templateHash,
      template.brc41PaymentId,
      JSON.stringify(template.splitRules),
      JSON.stringify(template.outputScripts),
      template.totalAmountSatoshis,
      JSON.stringify(template.deterministicInputs),
      template.templateVersion,
      template.createdBy,
      template.expiresAt,
    ]);

    console.log(`📝 Stored template: ${template.templateHash.slice(0, 10)}...`);
  }
}

export default D21PaymentTemplateServiceImpl;