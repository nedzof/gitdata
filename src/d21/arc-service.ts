/**
 * D21 ARC Broadcasting Service
 *
 * Implements BSV transaction broadcasting using ARC from BSV SDK.
 * Provides comprehensive transaction lifecycle management with multi-provider support.
 */

import { randomBytes } from 'crypto';
import type { Pool } from 'pg';
import {
  ArcConfig,
  Arc,
  Transaction,
  NodejsHttpClient,
  MerklePath
} from '@bsv/sdk';
import https from 'https';

import type { DatabaseAdapter } from '../overlay/brc26-uhrp.js';

import type {
  D21ARCBroadcastService,
  D21ARCProvider,
  D21ARCBroadcastRequest,
  D21ARCBroadcastResult,
  ARCSubmitTxResponse,
  ARCTxStatus,
  ARCFeeQuote,
  ARCPolicyQuote,
} from './types.js';
import {
  D21ARCError,
  DEFAULT_ARC_CONFIG,
  DEFAULT_ARC_PROVIDERS,
} from './types.js';

export class D21ARCBroadcastServiceImpl implements D21ARCBroadcastService {
  private database: DatabaseAdapter;
  private providers: Map<string, D21ARCProvider> = new Map();
  private arcInstances: Map<string, Arc> = new Map();
  private callbackBaseUrl: string;
  private initialized = false;

  constructor(database: DatabaseAdapter, callbackBaseUrl?: string) {
    this.database = database;
    this.callbackBaseUrl = callbackBaseUrl || 'http://localhost:3000';
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🔧 Initializing D21 ARC Broadcasting Service...');

    try {
      // Create ARC-specific database schema
      await this.createARCSchema();

      // Initialize default ARC providers
      await this.initializeProviders();

      this.initialized = true;
      console.log('✅ D21 ARC Broadcasting Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize D21 ARC Broadcasting Service:', error);
      throw error;
    }
  }

  private async createARCSchema(): Promise<void> {
    // Create D21 ARC transactions table
    await this.database.execute(`
        CREATE TABLE IF NOT EXISTS d21_arc_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          txid VARCHAR(64) NOT NULL UNIQUE,

          -- Links to BRC-41 and D21 systems
          brc41_payment_id VARCHAR(100),
          d21_template_id UUID,

          -- ARC-specific tracking
          raw_tx_hex TEXT NOT NULL,
          broadcast_provider VARCHAR(255),
          arc_response JSONB,
          arc_status VARCHAR(50) DEFAULT 'UNKNOWN',

          -- ARC lifecycle timestamps
          queued_at TIMESTAMP,
          received_at TIMESTAMP,
          stored_at TIMESTAMP,
          announced_at TIMESTAMP,
          sent_to_network_at TIMESTAMP,
          seen_on_network_at TIMESTAMP,
          mined_at TIMESTAMP,
          rejected_at TIMESTAMP,

          -- Block information
          block_hash VARCHAR(64),
          block_height INTEGER,

          -- Callback configuration
          callback_url TEXT,
          callback_sent BOOLEAN DEFAULT FALSE,

          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

    // Create D21 ARC providers table
    await this.database.execute(`
        CREATE TABLE IF NOT EXISTS d21_arc_providers (
          provider_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          provider_name VARCHAR(100) NOT NULL UNIQUE,
          api_url TEXT NOT NULL,

          -- Provider configuration
          timeout_seconds INTEGER DEFAULT 30,
          is_active BOOLEAN DEFAULT TRUE,
          priority_order INTEGER DEFAULT 1,
          supports_callbacks BOOLEAN DEFAULT FALSE,

          -- Performance tracking
          success_rate DECIMAL(5,4) DEFAULT 1.0,
          average_response_time_ms INTEGER,
          total_broadcasts BIGINT DEFAULT 0,
          successful_broadcasts BIGINT DEFAULT 0,
          failed_broadcasts BIGINT DEFAULT 0,

          -- Authentication
          api_key_encrypted TEXT,
          authentication_method VARCHAR(20) DEFAULT 'none',
          rate_limit_per_minute INTEGER DEFAULT 100,

          -- ARC-specific features
          supported_endpoints JSONB DEFAULT '[]',
          min_fee_rate DECIMAL(10,8) DEFAULT 1.0,
          max_tx_size INTEGER DEFAULT 1000000,

          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

    // Create indexes
    await this.database.execute(`
        CREATE INDEX IF NOT EXISTS idx_d21_arc_txid
        ON d21_arc_transactions(txid)
      `);

    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_d21_arc_status
      ON d21_arc_transactions(arc_status)
    `);

    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_d21_arc_providers_active
      ON d21_arc_providers(is_active, priority_order)
    `);

    console.log('📊 D21 ARC schema ready');
  }

  private async initializeProviders(): Promise<void> {
    const client = await (this.database as any).getClient();

    try {
      // Load existing providers from database
      const existingResult = await client.query(
        'SELECT * FROM d21_arc_providers ORDER BY priority_order ASC'
      );

      if (existingResult.rows.length === 0) {
        // No providers exist, insert defaults
        console.log('🌐 Initializing default ARC providers...');

        for (const providerConfig of DEFAULT_ARC_PROVIDERS) {
          const providerId = randomBytes(16).toString('hex');

          await client.query(`
            INSERT INTO d21_arc_providers (
              provider_id, provider_name, api_url, timeout_seconds,
              is_active, priority_order, supports_callbacks,
              authentication_method, rate_limit_per_minute,
              supported_endpoints, min_fee_rate, max_tx_size
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            providerId,
            providerConfig.providerName,
            providerConfig.apiUrl,
            providerConfig.timeoutSeconds,
            providerConfig.isActive,
            providerConfig.priorityOrder,
            providerConfig.supportsCallbacks,
            providerConfig.authenticationMethod,
            providerConfig.rateLimitPerMinute,
            JSON.stringify(providerConfig.supportedEndpoints),
            providerConfig.minFeeRate,
            providerConfig.maxTxSize,
          ]);

          const provider: D21ARCProvider = {
            providerId,
            ...providerConfig,
          };

          this.providers.set(providerId, provider);

          // Initialize BSV SDK ARC instance for this provider
          await this.initializeARCInstance(provider);
        }

        console.log(`✅ Initialized ${DEFAULT_ARC_PROVIDERS.length} default ARC providers`);
      } else {
        // Load existing providers into memory
        for (const row of existingResult.rows) {
          const provider: D21ARCProvider = {
            providerId: row.provider_id,
            providerName: row.provider_name,
            apiUrl: row.api_url,
            timeoutSeconds: row.timeout_seconds,
            isActive: row.is_active,
            priorityOrder: row.priority_order,
            supportsCallbacks: row.supports_callbacks,
            successRate: parseFloat(row.success_rate),
            averageResponseTimeMs: row.average_response_time_ms || 0,
            totalBroadcasts: parseInt(row.total_broadcasts),
            successfulBroadcasts: parseInt(row.successful_broadcasts),
            failedBroadcasts: parseInt(row.failed_broadcasts),
            authenticationMethod: row.authentication_method,
            rateLimitPerMinute: row.rate_limit_per_minute,
            supportedEndpoints: row.supported_endpoints,
            minFeeRate: parseFloat(row.min_fee_rate),
            maxTxSize: row.max_tx_size,
            apiKeyEncrypted: row.api_key_encrypted,
          };

          this.providers.set(provider.providerId, provider);

          // Initialize BSV SDK ARC instance for this provider
          if (provider.isActive) {
            await this.initializeARCInstance(provider);
          }
        }

        console.log(`📡 Loaded ${existingResult.rows.length} ARC providers from database`);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Initialize BSV SDK ARC instance for a provider
   */
  private async initializeARCInstance(provider: D21ARCProvider): Promise<void> {
    try {
      const arcConfig: ArcConfig = {
        deploymentId: provider.providerId,
        apiKey: provider.apiKeyEncrypted || '',
        callbackUrl: `${this.callbackBaseUrl}/d21/arc/callback/${provider.providerId}`,
        callbackToken: randomBytes(32).toString('hex'),
        httpClient: new NodejsHttpClient(https)
      };

      const arcInstance = new Arc(provider.apiUrl, arcConfig);
      this.arcInstances.set(provider.providerId, arcInstance);

      console.log(`✅ Initialized ARC instance for ${provider.providerName}`);

    } catch (error) {
      console.error(`❌ Failed to initialize ARC instance for ${provider.providerName}:`, error);
    }
  }

  /**
   * Broadcast transaction using BSV SDK ARC
   */
  async broadcastTransaction(request: D21ARCBroadcastRequest): Promise<D21ARCBroadcastResult> {
    await this.initialize();

    console.log(`📡 Broadcasting transaction via BSV SDK ARC...`);

    try {
      // Select optimal ARC provider
      const provider = request.preferredProvider
        ? this.providers.get(request.preferredProvider)
        : await this.selectOptimalProvider();

      if (!provider || !provider.isActive) {
        throw new D21ARCError(
          'No suitable ARC provider available',
          request.preferredProvider || 'unknown'
        );
      }

      const arcInstance = this.arcInstances.get(provider.providerId);
      if (!arcInstance) {
        throw new D21ARCError(
          'ARC instance not initialized for provider',
          provider.providerId
        );
      }

      console.log(`🎯 Using ARC provider: ${provider.providerName}`);

      // Create transaction from raw hex
      const transaction = Transaction.fromHex(request.rawTx);
      const txid = transaction.id('hex');

      // Submit transaction to ARC using BSV SDK
      const startTime = Date.now();
      const arcResponse = await arcInstance.submitTransaction(transaction);
      const responseTime = Date.now() - startTime;

      // Convert ARC response to our format
      const formattedResponse: ARCSubmitTxResponse = {
        txid: txid,
        status: this.mapARCStatus(arcResponse.txStatus || 'UNKNOWN'),
        blockHash: arcResponse.blockHash,
        blockHeight: arcResponse.blockHeight,
        timestamp: new Date().toISOString(),
        txStatus: arcResponse.txStatus,
        extraInfo: arcResponse.extraInfo,
      };

      // Store transaction in database
      await this.storeARCTransaction(request, provider, formattedResponse, txid);

      // Update provider performance metrics
      await this.updateProviderMetrics(provider.providerId, true, responseTime);

      // Wait for specific status if requested
      let finalResponse = formattedResponse;
      if (request.waitForStatus && formattedResponse.status !== request.waitForStatus) {
        console.log(`⏳ Waiting for status: ${request.waitForStatus}`);
        finalResponse = await this.waitForTransactionStatus(
          txid,
          request.waitForStatus,
          request.maxTimeout || DEFAULT_ARC_CONFIG.waitForStatusTimeout
        );
      }

      const result: D21ARCBroadcastResult = {
        txid,
        broadcastProvider: provider.providerName,
        status: finalResponse.status,
        broadcastResponse: finalResponse,
        timestamp: new Date(),
        announceTime: this.parseARCTimestamp(finalResponse.timestamp),
      };

      console.log(`✅ Transaction broadcast successful: ${txid.slice(0, 10)}...`);
      return result;

    } catch (error) {
      console.error('❌ ARC broadcast failed:', error);

      // Update provider metrics on failure
      if (request.preferredProvider) {
        await this.updateProviderMetrics(request.preferredProvider, false, 0);
      }

      throw new D21ARCError(
        `ARC broadcast failed: ${error.message}`,
        request.preferredProvider || 'unknown'
      );
    }
  }

  /**
   * Get transaction status from ARC
   */
  async getTransactionStatus(txid: string, providerId?: string): Promise<ARCSubmitTxResponse> {
    await this.initialize();

    const provider = providerId
      ? this.providers.get(providerId)
      : await this.selectOptimalProvider();

    if (!provider) {
      throw new D21ARCError('No suitable ARC provider available', providerId || 'unknown', txid);
    }

    try {
      const response = await fetch(`${provider.apiUrl}/v1/tx/${txid}`, {
        method: 'GET',
        headers: this.getAuthHeaders(provider),
        signal: AbortSignal.timeout(provider.timeoutSeconds * 1000),
      });

      if (!response.ok) {
        throw new Error(`ARC status check failed: ${response.status} ${response.statusText}`);
      }

      const statusResponse: ARCSubmitTxResponse = await response.json();

      // Update our database with latest status
      await this.updateTransactionStatus(txid, statusResponse);

      return statusResponse;

    } catch (error) {
      throw new D21ARCError(
        `Failed to get transaction status: ${error.message}`,
        provider.providerId,
        txid
      );
    }
  }

  /**
   * Wait for transaction to reach specific status
   */
  async waitForTransactionStatus(
    txid: string,
    targetStatus: ARCTxStatus,
    timeout: number = DEFAULT_ARC_CONFIG.waitForStatusTimeout
  ): Promise<ARCSubmitTxResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const status = await this.getTransactionStatus(txid);

        if (status.status === targetStatus) {
          return status;
        }

        // If transaction is rejected or failed, don't wait further
        if (status.status === 'REJECTED' || status.status === 'DOUBLE_SPEND_ATTEMPTED') {
          throw new D21ARCError(
            `Transaction reached terminal status: ${status.status}`,
            'unknown',
            txid
          );
        }

        // Wait 1 second before next check
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        if (error instanceof D21ARCError) {
          throw error;
        }
        // Continue waiting on temporary errors
      }
    }

    throw new D21ARCError(
      `Timeout waiting for transaction status: ${targetStatus}`,
      'unknown',
      txid
    );
  }

  /**
   * Batch broadcast multiple transactions
   */
  async batchBroadcast(requests: D21ARCBroadcastRequest[]): Promise<D21ARCBroadcastResult[]> {
    await this.initialize();

    console.log(`📦 Batch broadcasting ${requests.length} transactions...`);

    // For now, process sequentially. In production, implement proper batch ARC API
    const results: D21ARCBroadcastResult[] = [];

    for (const request of requests) {
      try {
        const result = await this.broadcastTransaction(request);
        results.push(result);
      } catch (error) {
        console.error(`Failed to broadcast transaction in batch:`, error);
        // Continue with other transactions
      }
    }

    console.log(`✅ Batch broadcast completed: ${results.length}/${requests.length} successful`);
    return results;
  }

  /**
   * Get all available ARC providers
   */
  async getProviders(): Promise<D21ARCProvider[]> {
    await this.initialize();
    return Array.from(this.providers.values());
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(providerId: string): Promise<{
    isHealthy: boolean;
    responseTime: number;
    successRate: number;
    lastChecked: Date;
    currentFeeQuote?: ARCFeeQuote;
  }> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new D21ARCError('Provider not found', providerId);
    }

    try {
      const startTime = Date.now();

      // Check if provider responds to fee quote request
      const feeQuote = await this.getFeeQuote(providerId);
      const responseTime = Date.now() - startTime;

      return {
        isHealthy: true,
        responseTime,
        successRate: provider.successRate,
        lastChecked: new Date(),
        currentFeeQuote: feeQuote,
      };

    } catch (error) {
      return {
        isHealthy: false,
        responseTime: 0,
        successRate: provider.successRate,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Select optimal ARC provider
   */
  async selectOptimalProvider(criteria?: {
    maxLatency?: number;
    minSuccessRate?: number;
    preferredProviders?: string[];
    minFeeRate?: number;
    maxTxSize?: number;
  }): Promise<D21ARCProvider> {
    await this.initialize();

    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.isActive)
      .filter(p => !criteria?.minSuccessRate || p.successRate >= criteria.minSuccessRate)
      .filter(p => !criteria?.maxLatency || p.averageResponseTimeMs <= criteria.maxLatency)
      .filter(p => !criteria?.minFeeRate || p.minFeeRate <= criteria.minFeeRate)
      .sort((a, b) => {
        // Prioritize by order, then by success rate, then by response time
        if (a.priorityOrder !== b.priorityOrder) {
          return a.priorityOrder - b.priorityOrder;
        }
        if (a.successRate !== b.successRate) {
          return b.successRate - a.successRate;
        }
        return a.averageResponseTimeMs - b.averageResponseTimeMs;
      });

    if (availableProviders.length === 0) {
      throw new D21ARCError('No suitable ARC providers available', 'unknown');
    }

    return availableProviders[0];
  }

  /**
   * Get policy quote from ARC provider
   */
  async getPolicyQuote(providerId: string): Promise<ARCPolicyQuote> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new D21ARCError('Provider not found', providerId);
    }

    try {
      const response = await fetch(`${provider.apiUrl}/v1/policy`, {
        method: 'GET',
        headers: this.getAuthHeaders(provider),
        signal: AbortSignal.timeout(provider.timeoutSeconds * 1000),
      });

      if (!response.ok) {
        throw new Error(`Policy quote failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      throw new D21ARCError(
        `Failed to get policy quote: ${error.message}`,
        providerId
      );
    }
  }

  /**
   * Get fee quote from ARC provider
   */
  async getFeeQuote(providerId: string): Promise<ARCFeeQuote> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new D21ARCError('Provider not found', providerId);
    }

    try {
      const response = await fetch(`${provider.apiUrl}/v1/feeQuote`, {
        method: 'GET',
        headers: this.getAuthHeaders(provider),
        signal: AbortSignal.timeout(provider.timeoutSeconds * 1000),
      });

      if (!response.ok) {
        throw new Error(`Fee quote failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      throw new D21ARCError(
        `Failed to get fee quote: ${error.message}`,
        providerId
      );
    }
  }

  // ==================== Private Methods ====================

  /**
   * Map ARC status to our internal status enum
   */
  private mapARCStatus(arcStatus: string): ARCTxStatus {
    // Map various possible ARC status strings to our enum
    const statusMap: Record<string, ARCTxStatus> = {
      'UNKNOWN': 'UNKNOWN',
      'QUEUED': 'QUEUED',
      'RECEIVED': 'RECEIVED',
      'STORED': 'STORED',
      'ANNOUNCED_TO_NETWORK': 'ANNOUNCED_TO_NETWORK',
      'SENT_TO_NETWORK': 'SENT_TO_NETWORK',
      'SEEN_ON_NETWORK': 'SEEN_ON_NETWORK',
      'MINED': 'MINED',
      'REJECTED': 'REJECTED',
      'DOUBLE_SPEND_ATTEMPTED': 'DOUBLE_SPEND_ATTEMPTED',
    };

    return statusMap[arcStatus.toUpperCase()] || 'UNKNOWN';
  }

  private getAuthHeaders(provider: D21ARCProvider): Record<string, string> {
    const headers: Record<string, string> = {};

    if (provider.authenticationMethod === 'bearer_token' && provider.apiKeyEncrypted) {
      // In production, decrypt the API key
      headers.Authorization = `Bearer ${provider.apiKeyEncrypted}`;
    } else if (provider.authenticationMethod === 'api_key' && provider.apiKeyEncrypted) {
      headers['X-API-Key'] = provider.apiKeyEncrypted;
    }

    return headers;
  }

  private async storeARCTransaction(
    request: D21ARCBroadcastRequest,
    provider: D21ARCProvider,
    response: ARCSubmitTxResponse,
    txid: string
  ): Promise<void> {
    const client = await (this.database as any).getClient();

    try {
      await client.query(`
        INSERT INTO d21_arc_transactions (
          txid, brc41_payment_id, d21_template_id, raw_tx_hex,
          broadcast_provider, arc_response, arc_status,
          callback_url, received_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (txid) DO UPDATE SET
          arc_response = EXCLUDED.arc_response,
          arc_status = EXCLUDED.arc_status,
          updated_at = NOW()
      `, [
        txid,
        request.templateId, // This could link to BRC-41 payment
        request.templateId,
        request.rawTx,
        provider.providerName,
        JSON.stringify(response),
        response.status,
        request.callbackUrl,
        new Date(),
      ]);

    } finally {
      client.release();
    }
  }

  private async updateTransactionStatus(
    txid: string,
    statusResponse: ARCSubmitTxResponse
  ): Promise<void> {
    const client = await (this.database as any).getClient();

    try {
      const statusTimestamps: Record<string, string> = {
        'RECEIVED': 'received_at',
        'STORED': 'stored_at',
        'ANNOUNCED_TO_NETWORK': 'announced_at',
        'SENT_TO_NETWORK': 'sent_to_network_at',
        'SEEN_ON_NETWORK': 'seen_on_network_at',
        'MINED': 'mined_at',
        'REJECTED': 'rejected_at',
      };

      const timestampField = statusTimestamps[statusResponse.status];
      const updates = ['arc_status = $2', 'arc_response = $3', 'updated_at = NOW()'];
      const values = [txid, statusResponse.status, JSON.stringify(statusResponse)];

      if (timestampField) {
        updates.push(`${timestampField} = $${values.length + 1}`);
        values.push(this.parseARCTimestamp(statusResponse.timestamp));
      }

      if (statusResponse.blockHash) {
        updates.push(`block_hash = $${values.length + 1}`);
        values.push(statusResponse.blockHash);
      }

      if (statusResponse.blockHeight) {
        updates.push(`block_height = $${values.length + 1}`);
        values.push(statusResponse.blockHeight);
      }

      await client.query(`
        UPDATE d21_arc_transactions
        SET ${updates.join(', ')}
        WHERE txid = $1
      `, values);

    } finally {
      client.release();
    }
  }

  private async updateProviderMetrics(
    providerId: string,
    success: boolean,
    responseTime: number
  ): Promise<void> {
    const client = await (this.database as any).getClient();

    try {
      await client.query(`
        UPDATE d21_arc_providers
        SET
          total_broadcasts = total_broadcasts + 1,
          successful_broadcasts = successful_broadcasts + $2,
          failed_broadcasts = failed_broadcasts + $3,
          average_response_time_ms = CASE
            WHEN total_broadcasts = 0 THEN $4
            ELSE (average_response_time_ms * total_broadcasts + $4) / (total_broadcasts + 1)
          END,
          success_rate = CASE
            WHEN total_broadcasts + 1 = 0 THEN 1.0
            ELSE (successful_broadcasts + $2)::DECIMAL / (total_broadcasts + 1)
          END,
          updated_at = NOW()
        WHERE provider_id = $1
      `, [providerId, success ? 1 : 0, success ? 0 : 1, responseTime]);

      // Update in-memory cache
      const provider = this.providers.get(providerId);
      if (provider) {
        provider.totalBroadcasts += 1;
        if (success) {
          provider.successfulBroadcasts += 1;
        } else {
          provider.failedBroadcasts += 1;
        }
        provider.successRate = provider.successfulBroadcasts / provider.totalBroadcasts;
        provider.averageResponseTimeMs = Math.round(
          (provider.averageResponseTimeMs * (provider.totalBroadcasts - 1) + responseTime) /
          provider.totalBroadcasts
        );
      }

    } finally {
      client.release();
    }
  }

  private parseARCTimestamp(timestamp: string): Date {
    return new Date(timestamp);
  }

  /**
   * Handle ARC callback for merkle proofs (based on BSV SDK example)
   */
  async handleARCCallback(providerId: string, callbackData: {
    txid: string;
    merklePath: string;
    blockHeight: number;
  }): Promise<void> {
    try {
      const provider = this.providers.get(providerId);
      const arcInstance = this.arcInstances.get(providerId);

      if (!provider || !arcInstance) {
        throw new D21ARCError('Invalid provider for callback', providerId, callbackData.txid);
      }

      console.log(`📨 Received ARC callback for ${callbackData.txid.slice(0, 10)}... from ${provider.providerName}`);

      // Parse merkle path from hex
      const merklePath = MerklePath.fromHex(callbackData.merklePath);

      // Handle the merkle proof (this would typically update transaction status)
      // Following the BSV SDK example pattern
      await this.handleNewMerkleProof(
        callbackData.txid,
        merklePath,
        callbackData.blockHeight
      );

      console.log(`✅ Processed merkle proof for ${callbackData.txid.slice(0, 10)}...`);

    } catch (error) {
      console.error(`❌ Failed to handle ARC callback:`, error);
      throw error;
    }
  }

  /**
   * Process merkle proof and update transaction status
   */
  private async handleNewMerkleProof(
    txid: string,
    merklePath: MerklePath,
    blockHeight: number
  ): Promise<void> {
    const client = await (this.database as any).getClient();

    try {
      // Update transaction with merkle proof and mark as mined
      await client.query(`
        UPDATE d21_arc_transactions
        SET
          arc_status = 'MINED',
          mined_at = NOW(),
          block_height = $2,
          updated_at = NOW()
        WHERE txid = $1
      `, [txid, blockHeight]);

      // Store merkle path for SPV verification if needed
      // In a production system, you might want to store the full merkle path

      console.log(`🔗 Updated transaction ${txid.slice(0, 10)}... as MINED at block ${blockHeight}`);

    } finally {
      client.release();
    }
  }

  /**
   * Get ARC instance for external use (e.g., in routes)
   */
  getARCInstance(providerId: string): Arc | undefined {
    return this.arcInstances.get(providerId);
  }

  /**
   * Get callback URL for a provider (for route setup)
   */
  getCallbackUrl(providerId: string): string {
    return `${this.callbackBaseUrl}/d21/arc/callback/${providerId}`;
  }
}

export default D21ARCBroadcastServiceImpl;