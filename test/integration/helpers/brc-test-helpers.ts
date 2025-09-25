/**
 * BRC Test Helpers
 * Utility functions for testing all BRC standards in integration scenarios
 */

import { webcrypto } from 'crypto';
import { createHash, randomBytes } from 'crypto';
import axios, { AxiosResponse } from 'axios';

export interface TestIdentity {
  privateKey: string;
  publicKey: string;
  identityKey: string;
  certificates?: any[];
}

export interface PaymentQuote {
  quoteId: string;
  amount: number;
  paymentAddress: string;
  expiresAt: string;
}

export interface ContentMetadata {
  contentId: string;
  uhrpUrl: string;
  producer: string;
  timestamp: string;
  price: number;
}

/**
 * BRC-31 Identity Authentication Helpers
 */
export class BRC31TestHelper {
  static async generateTestIdentity(role: 'producer' | 'consumer' = 'producer'): Promise<TestIdentity> {
    const keyPair = await webcrypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );

    const privateKeyJwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey);
    const publicKeyJwk = await webcrypto.subtle.exportKey('jwk', keyPair.publicKey);

    return {
      privateKey: JSON.stringify(privateKeyJwk),
      publicKey: JSON.stringify(publicKeyJwk),
      identityKey: createHash('sha256').update(JSON.stringify(publicKeyJwk)).digest('hex')
    };
  }

  static async registerIdentity(
    baseUrl: string,
    identity: TestIdentity,
    role: 'producer' | 'consumer',
    capabilities: string[] = []
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/overlay/brc31/handshake`, {
      identityKey: identity.identityKey,
      publicKey: identity.publicKey,
      nonce: Date.now().toString(),
      requestedCertificates: [],
      metadata: {
        name: `Test ${role}`,
        description: `E2E test ${role} identity`,
        capabilities
      }
    });
  }

  static async authenticateIdentity(
    baseUrl: string,
    identity: TestIdentity
  ): Promise<{ token: string; expiresAt: string }> {
    // Use BRC-31 handshake endpoint for authentication
    const handshakeResponse = await axios.post(`${baseUrl}/overlay/brc31/handshake`, {
      identityKey: identity.identityKey,
      nonce: Date.now().toString(),
      requestedCertificates: []
    });

    // For testing purposes, return mock authentication result
    return {
      token: handshakeResponse.data.token || 'mock-test-token',
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    };
  }
}

/**
 * BRC-88 Service Discovery Helpers
 */
export class BRC88TestHelper {
  static async advertiseService(
    baseUrl: string,
    producerIdentity: TestIdentity,
    serviceConfig: {
      serviceType: string;
      endpoint: string;
      capabilities: string[];
      pricing: {
        basePrice: number;
        currency: string;
        unit: string;
      };
    }
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/agents/register`, {
      name: `Test Agent - ${serviceConfig.serviceType}`,
      type: serviceConfig.serviceType,
      capabilities: serviceConfig.capabilities,
      endpoint: serviceConfig.endpoint,
      metadata: {
        identityKey: producerIdentity.identityKey,
        pricing: serviceConfig.pricing,
        timestamp: new Date().toISOString()
      }
    });
  }

  static async discoverServices(
    baseUrl: string,
    consumerIdentity: TestIdentity,
    criteria: {
      serviceType?: string;
      capabilities?: string[];
      maxPrice?: number;
      producer?: string;
    }
  ): Promise<AxiosResponse> {
    const searchParams = new URLSearchParams();
    if (criteria.serviceType) searchParams.append('type', criteria.serviceType);
    if (criteria.capabilities) searchParams.append('capabilities', criteria.capabilities.join(','));
    if (criteria.producer) searchParams.append('producer', criteria.producer);

    return axios.get(`${baseUrl}/agents/search?${searchParams.toString()}`);
  }
}

/**
 * BRC-24 Lookup Services Helpers
 */
export class BRC24TestHelper {
  static async registerContent(
    baseUrl: string,
    producerIdentity: TestIdentity,
    contentItems: Array<{
      contentId: string;
      contentType: string;
      uhrpUrl: string;
      metadata: any;
    }>
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/lookup/register`, {
      identityKey: producerIdentity.identityKey,
      contentItems
    });
  }

  static async searchContent(
    baseUrl: string,
    consumerIdentity: TestIdentity,
    query: {
      contentType?: string;
      tags?: string[];
      producer?: string;
      maxPrice?: number;
    },
    pagination: { limit: number; offset: number } = { limit: 20, offset: 0 }
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/lookup/search`, {
      identityKey: consumerIdentity.identityKey,
      query,
      pagination
    });
  }
}

/**
 * BRC-41 PacketPay Micropayments Helpers
 */
export class BRC41TestHelper {
  static async createPaymentQuote(
    baseUrl: string,
    consumerIdentity: TestIdentity,
    serviceProvider: string,
    serviceType: string,
    resourceId: string,
    expectedCost: number
  ): Promise<PaymentQuote> {
    const response = await axios.post(`${baseUrl}/api/payments/quote`, {
      identityKey: consumerIdentity.identityKey,
      serviceProvider,
      serviceType,
      resourceId,
      expectedCost,
      currency: 'BSV'
    });

    return {
      quoteId: response.data.quoteId,
      amount: response.data.amount,
      paymentAddress: response.data.paymentAddress,
      expiresAt: response.data.expiresAt
    };
  }

  static async submitPayment(
    baseUrl: string,
    quote: PaymentQuote,
    consumerIdentity: TestIdentity,
    producerIdentity: TestIdentity
  ): Promise<AxiosResponse> {
    const transactionId = 'test-tx-' + randomBytes(16).toString('hex');

    return axios.post(`${baseUrl}/api/payments/submit`, {
      quoteId: quote.quoteId,
      transactionHex: this.generateMockTransactionHex(),
      transactionId,
      amount: quote.amount,
      payerIdentity: consumerIdentity.identityKey,
      recipientIdentity: producerIdentity.identityKey
    });
  }

  static async checkPaymentStatus(
    baseUrl: string,
    transactionId: string
  ): Promise<AxiosResponse> {
    return axios.get(`${baseUrl}/api/payments/${transactionId}/status`);
  }

  private static generateMockTransactionHex(): string {
    // Generate a mock transaction hex for testing
    const mockTx = '0100000001' + // version + input count
      randomBytes(32).toString('hex') + // previous tx hash
      '00000000' + // output index
      '6a' + // script length
      randomBytes(106).toString('hex') + // script sig
      'ffffffff' + // sequence
      '01' + // output count
      randomBytes(8).toString('hex') + // value
      '19' + // script pub key length
      '76a914' + randomBytes(20).toString('hex') + '88ac' + // standard P2PKH
      '00000000'; // lock time

    return mockTx;
  }
}

/**
 * BRC-26 UHRP Content Storage Helpers
 */
export class BRC26TestHelper {
  static async publishContent(
    baseUrl: string,
    producerIdentity: TestIdentity,
    content: {
      data: Buffer;
      contentType: string;
      metadata: any;
    },
    uhrpConfig: {
      addressing: 'content-hash' | 'identity-based';
      distribution: 'single-node' | 'multi-node';
      replication: number;
      encryption: boolean;
    }
  ): Promise<AxiosResponse> {
    // Use overlay storage endpoint
    return axios.post(`${baseUrl}/overlay/files/store`, {
      identityKey: producerIdentity.identityKey,
      content: {
        data: content.data.toString('base64'),
        contentType: content.contentType,
        metadata: content.metadata
      },
      uhrpConfig
    });
  }

  static async retrieveContent(
    baseUrl: string,
    consumerIdentity: TestIdentity,
    contentHash: string,
    accessToken?: string
  ): Promise<AxiosResponse> {
    // Use overlay storage endpoint
    return axios.get(`${baseUrl}/v1/overlay/data/${contentHash}`, {
      headers: {
        'Authorization': `Bearer ${accessToken || 'mock-access-token'}`,
        'X-Identity-Key': consumerIdentity.identityKey
      }
    });
  }
}

/**
 * BRC-22 Transaction Submission Helpers
 */
export class BRC22TestHelper {
  static async submitTransaction(
    baseUrl: string,
    identity: TestIdentity,
    transactionHex: string,
    metadata?: any
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/transactions/submit`, {
      identityKey: identity.identityKey,
      transaction: {
        hex: transactionHex,
        inputs: this.parseInputsFromHex(transactionHex),
        outputs: this.parseOutputsFromHex(transactionHex)
      },
      metadata: metadata || { purpose: 'test-submission' }
    });
  }

  static async checkTransactionStatus(
    baseUrl: string,
    transactionId: string
  ): Promise<AxiosResponse> {
    return axios.get(`${baseUrl}/api/transactions/${transactionId}/status`);
  }

  private static parseInputsFromHex(hex: string): any[] {
    // Mock input parsing for testing
    return [{
      txid: randomBytes(32).toString('hex'),
      vout: 0,
      scriptSig: 'mock-script-sig'
    }];
  }

  private static parseOutputsFromHex(hex: string): any[] {
    // Mock output parsing for testing
    return [{
      satoshis: 1000,
      scriptPubKey: 'mock-script-pub-key'
    }];
  }
}

/**
 * BRC-64 History Tracking Helpers
 */
export class BRC64TestHelper {
  static async trackAnalyticsEvents(
    baseUrl: string,
    identity: TestIdentity,
    events: Array<{
      eventType: string;
      timestamp: string;
      metadata: any;
    }>
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/analytics/track`, {
      identityKey: identity.identityKey,
      events
    });
  }

  static async getUsageHistory(
    baseUrl: string,
    identity: TestIdentity,
    timeRange: {
      startDate: string;
      endDate: string;
    },
    eventTypes?: string[]
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/analytics/history`, {
      identityKey: identity.identityKey,
      timeRange,
      eventTypes: eventTypes || ['payment-sent', 'content-accessed', 'stream-subscribed'],
      includeMetrics: true
    });
  }

  static async getContentLineage(
    baseUrl: string,
    identity: TestIdentity,
    contentId: string
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/analytics/lineage`, {
      identityKey: identity.identityKey,
      contentId,
      includeProvenance: true,
      includeAccessHistory: true
    });
  }
}

/**
 * D21 BSV Native Payments Helpers
 */
export class D21TestHelper {
  static async processNativeBSVPayment(
    baseUrl: string,
    consumerIdentity: TestIdentity,
    producerIdentity: TestIdentity,
    amount: number,
    resourceId: string
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/payments/native-bsv`, {
      identityKey: consumerIdentity.identityKey,
      serviceProvider: producerIdentity.identityKey,
      paymentType: 'native-bsv',
      amount,
      resourceId,
      arcConfig: {
        useARC: true,
        provider: 'taal',
        callback: `${baseUrl}/callbacks/arc-payment`
      }
    });
  }
}

/**
 * D22 Storage Backend Helpers
 */
export class D22TestHelper {
  static async distributeContent(
    baseUrl: string,
    producerIdentity: TestIdentity,
    content: any[],
    distributionStrategy: {
      nodes: string[];
      replicationFactor: number;
      loadBalancing: string;
      geoDistribution: boolean;
    }
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/storage/distribute`, {
      identityKey: producerIdentity.identityKey,
      content,
      distributionStrategy
    });
  }

  static async checkContentAvailability(
    baseUrl: string,
    consumerIdentity: TestIdentity,
    contentIds: string[]
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/storage/availability`, {
      identityKey: consumerIdentity.identityKey,
      contentIds,
      includePerformanceMetrics: true
    });
  }
}

/**
 * Streaming Test Helpers
 */
export class StreamingTestHelper {
  static async startStreamingSession(
    baseUrl: string,
    producerIdentity: TestIdentity,
    streamConfig: {
      streamType: string;
      pricing: {
        model: string;
        rate: number;
        currency: string;
      };
      quality?: any;
    }
  ): Promise<AxiosResponse> {
    const sessionId = randomBytes(16).toString('hex');

    return axios.post(`${baseUrl}/api/streaming/start`, {
      identityKey: producerIdentity.identityKey,
      sessionConfig: {
        streamId: sessionId,
        ...streamConfig
      }
    });
  }

  static async subscribeToStream(
    baseUrl: string,
    consumerIdentity: TestIdentity,
    streamId: string,
    paymentSetup: {
      maxAmount: number;
      autoPayInterval: number;
    }
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/streaming/subscribe`, {
      identityKey: consumerIdentity.identityKey,
      streamId,
      paymentSetup
    });
  }

  static async endStreamingSession(
    baseUrl: string,
    producerIdentity: TestIdentity,
    sessionId: string
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/streaming/end`, {
      sessionId,
      identityKey: producerIdentity.identityKey
    });
  }
}

/**
 * Integration Test Utilities
 */
export class IntegrationTestUtils {
  static async waitForServiceReady(url: string, timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await axios.get(`${url}/health`, { timeout: 5000 });
        if (response.status === 200 && response.data.status === 'ok') {
          return;
        }
      } catch (error) {
        // Service not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`Service at ${url} did not become ready within ${timeoutMs}ms`);
  }

  static async validateCrossBRCConsistency(
    baseUrl: string,
    testId: string,
    expectedBRCs: string[],
    producer: string,
    consumer: string
  ): Promise<AxiosResponse> {
    return axios.post(`${baseUrl}/api/integration/verify`, {
      testId,
      expectedBRCs,
      producer,
      consumer
    });
  }

  static generateTestStreamData(streamId: string, sequence: number, size = 1024): {
    streamId: string;
    contentType: string;
    data: Buffer;
    metadata: any;
  } {
    const testData = {
      timestamp: new Date().toISOString(),
      sequence,
      data: randomBytes(size).toString('base64'),
      metadata: {
        streamId,
        contentType: 'application/json',
        encoding: 'base64'
      }
    };

    return {
      streamId,
      contentType: 'application/json',
      data: Buffer.from(JSON.stringify(testData)),
      metadata: {
        producer: 'test-producer-001',
        timestamp: testData.timestamp,
        sequence,
        price: 100
      }
    };
  }
}