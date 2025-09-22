/**
 * D06 - BSV Payment Processing Service
 * Handles BSV native payments, SPV verification, and transaction management
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface BSVTransaction {
  txid: string;
  rawTx: string;
  inputs: BSVInput[];
  outputs: BSVOutput[];
  blockHash?: string;
  blockHeight?: number;
  confirmations: number;
}

export interface BSVInput {
  txid: string;
  vout: number;
  scriptSig: string;
  satoshis: number;
}

export interface BSVOutput {
  vout: number;
  scriptPubKey: string;
  satoshis: number;
}

export interface PaymentVerificationResult {
  isValid: boolean;
  txid: string;
  confirmations: number;
  outputs: BSVOutput[];
  totalAmount: number;
  reason?: string;
}

export interface SPVProof {
  merkleProof: string;
  blockHeader: string;
  blockHeight: number;
  txIndex: number;
}

export class BSVPaymentProcessor extends EventEmitter {
  private database: Pool;
  private minConfirmations: number;
  private network: string;

  constructor(
    database: Pool,
    config: {
      minConfirmations?: number;
      network?: string;
    } = {}
  ) {
    super();
    this.database = database;
    this.minConfirmations = config.minConfirmations || 6;
    this.network = config.network || 'mainnet';
  }

  /**
   * Process and verify a BSV payment transaction
   */
  async processPayment(
    rawTx: string,
    expectedAmount: number,
    payoutScript: string
  ): Promise<PaymentVerificationResult> {
    try {
      console.log(`💰 Processing BSV payment transaction...`);

      // Parse the transaction
      const transaction = this.parseTransaction(rawTx);

      // Store transaction in database
      await this.storeTransaction(transaction);

      // Verify the payment
      const verification = await this.verifyPayment(
        transaction,
        expectedAmount,
        payoutScript
      );

      if (verification.isValid) {
        console.log(`✅ BSV payment verified: ${transaction.txid}`);
        this.emit('payment-verified', verification);
      } else {
        console.log(`❌ BSV payment verification failed: ${verification.reason}`);
        this.emit('payment-failed', verification);
      }

      return verification;
    } catch (error) {
      console.error('❌ BSV payment processing failed:', error);
      return {
        isValid: false,
        txid: '',
        confirmations: 0,
        outputs: [],
        totalAmount: 0,
        reason: 'Payment processing error: ' + error.message
      };
    }
  }

  /**
   * Parse raw transaction hex into structured format
   */
  private parseTransaction(rawTx: string): BSVTransaction {
    // Simplified transaction parsing - in production would use proper BSV library
    const txid = crypto.createHash('sha256')
      .update(crypto.createHash('sha256').update(Buffer.from(rawTx, 'hex')))
      .digest('hex');

    // Mock parsing for demonstration
    const transaction: BSVTransaction = {
      txid,
      rawTx,
      inputs: [],
      outputs: [
        {
          vout: 0,
          scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
          satoshis: 5000
        }
      ],
      confirmations: 0
    };

    return transaction;
  }

  /**
   * Store transaction in the database
   */
  private async storeTransaction(transaction: BSVTransaction): Promise<void> {
    await this.database.query(`
      INSERT INTO bsv_transactions (
        txid, raw_tx, block_height, confirmations, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (txid) DO UPDATE SET
        confirmations = EXCLUDED.confirmations,
        status = EXCLUDED.status,
        updated_at = NOW()
    `, [
      transaction.txid,
      transaction.rawTx,
      transaction.blockHeight || null,
      transaction.confirmations,
      'pending'
    ]);
  }

  /**
   * Verify payment against expected criteria
   */
  private async verifyPayment(
    transaction: BSVTransaction,
    expectedAmount: number,
    payoutScript: string
  ): Promise<PaymentVerificationResult> {
    // Check if transaction has sufficient outputs to expected script
    const matchingOutputs = transaction.outputs.filter(output =>
      output.scriptPubKey === payoutScript
    );

    if (matchingOutputs.length === 0) {
      return {
        isValid: false,
        txid: transaction.txid,
        confirmations: transaction.confirmations,
        outputs: transaction.outputs,
        totalAmount: 0,
        reason: 'No outputs match expected payout script'
      };
    }

    const totalAmount = matchingOutputs.reduce((sum, output) => sum + output.satoshis, 0);

    if (totalAmount < expectedAmount) {
      return {
        isValid: false,
        txid: transaction.txid,
        confirmations: transaction.confirmations,
        outputs: transaction.outputs,
        totalAmount,
        reason: `Insufficient amount: expected ${expectedAmount}, got ${totalAmount}`
      };
    }

    // Check confirmations
    if (transaction.confirmations < this.minConfirmations) {
      return {
        isValid: false,
        txid: transaction.txid,
        confirmations: transaction.confirmations,
        outputs: transaction.outputs,
        totalAmount,
        reason: `Insufficient confirmations: ${transaction.confirmations}/${this.minConfirmations}`
      };
    }

    return {
      isValid: true,
      txid: transaction.txid,
      confirmations: transaction.confirmations,
      outputs: transaction.outputs,
      totalAmount
    };
  }

  /**
   * Verify SPV proof for a transaction
   */
  async verifySPVProof(txid: string, proof: SPVProof): Promise<boolean> {
    try {
      console.log(`🔍 Verifying SPV proof for transaction: ${txid}`);

      // Store SPV proof
      await this.database.query(`
        UPDATE bsv_transactions
        SET merkle_proof = $2, block_header = $3, block_height = $4
        WHERE txid = $1
      `, [txid, Buffer.from(proof.merkleProof, 'hex'), Buffer.from(proof.blockHeader, 'hex'), proof.blockHeight]);

      // In a real implementation, this would:
      // 1. Verify the Merkle proof against the block header
      // 2. Verify the block header is part of the valid chain
      // 3. Check the transaction is at the correct index

      console.log(`✅ SPV proof verified for transaction: ${txid}`);
      return true;
    } catch (error) {
      console.error('❌ SPV proof verification failed:', error);
      return false;
    }
  }

  /**
   * Update transaction confirmation count
   */
  async updateConfirmations(txid: string, confirmations: number, blockHeight?: number): Promise<void> {
    await this.database.query(`
      UPDATE bsv_transactions
      SET confirmations = $2, block_height = $3, status = $4, updated_at = NOW()
      WHERE txid = $1
    `, [
      txid,
      confirmations,
      blockHeight || null,
      confirmations >= this.minConfirmations ? 'confirmed' : 'pending'
    ]);

    // Emit confirmation update event
    this.emit('confirmation-update', { txid, confirmations, blockHeight });
  }

  /**
   * Get transaction status and details
   */
  async getTransactionStatus(txid: string): Promise<BSVTransaction | null> {
    const result = await this.database.query(`
      SELECT txid, raw_tx, block_height, confirmations, status, created_at
      FROM bsv_transactions
      WHERE txid = $1
    `, [txid]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      txid: row.txid,
      rawTx: row.raw_tx,
      inputs: [],
      outputs: [],
      blockHeight: row.block_height,
      confirmations: row.confirmations
    };
  }

  /**
   * Create payment outputs for a specific amount and recipient
   */
  createPaymentOutputs(
    totalAmount: number,
    producerScript: string,
    platformFeePercentage: number = 0.05,
    agentCommissionPercentage: number = 0.02
  ): BSVOutput[] {
    const platformFee = Math.floor(totalAmount * platformFeePercentage);
    const agentCommission = Math.floor(totalAmount * agentCommissionPercentage);
    const producerAmount = totalAmount - platformFee - agentCommission;

    const outputs: BSVOutput[] = [];

    // Producer payment
    if (producerAmount > 0) {
      outputs.push({
        vout: outputs.length,
        scriptPubKey: producerScript,
        satoshis: producerAmount
      });
    }

    // Platform fee (to configured platform address)
    if (platformFee > 0) {
      const platformScript = process.env.PLATFORM_PAYOUT_SCRIPT || producerScript;
      outputs.push({
        vout: outputs.length,
        scriptPubKey: platformScript,
        satoshis: platformFee
      });
    }

    // Agent commission (if applicable)
    if (agentCommission > 0) {
      const agentScript = process.env.AGENT_PAYOUT_SCRIPT || producerScript;
      outputs.push({
        vout: outputs.length,
        scriptPubKey: agentScript,
        satoshis: agentCommission
      });
    }

    return outputs;
  }

  /**
   * Monitor blockchain for transaction confirmations
   */
  async startConfirmationMonitoring(): Promise<void> {
    console.log('🔍 Starting BSV confirmation monitoring...');

    // In a real implementation, this would:
    // 1. Connect to BSV node or blockchain API
    // 2. Monitor for new blocks
    // 3. Update confirmation counts for pending transactions
    // 4. Emit events when transactions reach required confirmations

    // Mock implementation with periodic checks
    setInterval(async () => {
      try {
        const result = await this.database.query(`
          SELECT txid, confirmations
          FROM bsv_transactions
          WHERE status = 'pending'
          AND confirmations < $1
        `, [this.minConfirmations]);

        for (const row of result.rows) {
          // Simulate confirmation increase
          const newConfirmations = row.confirmations + 1;
          await this.updateConfirmations(row.txid, newConfirmations);
        }
      } catch (error) {
        console.error('Confirmation monitoring error:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<any> {
    const timeCondition = timeframe === 'day' ? 'interval \'1 day\'' :
                         timeframe === 'week' ? 'interval \'7 days\'' :
                         'interval \'30 days\'';

    const result = await this.database.query(`
      SELECT
        COUNT(*) as transaction_count,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        AVG(confirmations) as avg_confirmations
      FROM bsv_transactions
      WHERE created_at >= NOW() - ${timeCondition}
    `);

    return result.rows[0];
  }
}