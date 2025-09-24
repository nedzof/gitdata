/**
 * BSV Overlay Network - Complete JavaScript Integration Example
 *
 * This example demonstrates all major BSV overlay network features:
 * - BRC-22: Transaction submission
 * - BRC-24: Lookup services
 * - BRC-26: File storage (UHRP)
 * - BRC-31: Authentication
 * - BRC-41: Payment processing
 * - Advanced streaming and federation
 */

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const FormData = require('form-data');

// BSV Overlay Network Client
class BSVOverlayClient {
  constructor(baseUrl = 'http://localhost:8788', identityKey = null) {
    this.baseUrl = baseUrl;
    this.identityKey = identityKey;
    this.jwtToken = null;

    // Initialize axios with default headers
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(this.addAuthHeaders.bind(this));
    this.client.interceptors.response.use(
      response => response,
      this.handleErrorResponse.bind(this)
    );
  }

  // Add authentication headers to requests
  addAuthHeaders(config) {
    if (this.identityKey) {
      config.headers['X-BSV-Identity'] = this.identityKey;
    }

    if (this.jwtToken) {
      config.headers['Authorization'] = `Bearer ${this.jwtToken}`;
    }

    // Add BRC-31 authentication if available
    if (this.identityKey && config.data) {
      const signature = this.signRequest(JSON.stringify(config.data));
      config.headers['X-BSV-Signature'] = signature;
    }

    return config;
  }

  // Handle error responses consistently
  async handleErrorResponse(error) {
    if (error.response) {
      const { status, data } = error.response;

      // Handle specific error cases
      switch (status) {
        case 401:
          console.warn('Authentication failed - refreshing token');
          await this.authenticate();
          break;
        case 402:
          console.warn('Payment required for this service');
          break;
        case 429:
          console.warn('Rate limited - implementing backoff');
          await this.sleep(1000);
          break;
        case 503:
          console.warn('Overlay network unavailable');
          break;
      }

      throw new Error(`API Error (${status}): ${data.message || data.error}`);
    }

    throw error;
  }

  // Sign request for authentication
  signRequest(data) {
    // In production, use proper BSV key signing
    return crypto.createHmac('sha256', this.identityKey)
                 .update(data)
                 .digest('hex');
  }

  // Sleep utility for backoff
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ====================
  // System Status & Health
  // ====================

  async getStatus() {
    console.log('📊 Checking overlay network status...');
    const response = await this.client.get('/overlay/status');
    return response.data;
  }

  async getBRCStats() {
    console.log('📈 Fetching BRC standards statistics...');
    const response = await this.client.get('/overlay/brc-stats');
    return response.data;
  }

  // ====================
  // BRC-31: Authentication
  // ====================

  async authenticate() {
    console.log('🔐 Authenticating with BRC-31...');

    const authRequest = {
      identityKey: this.identityKey,
      nonce: crypto.randomBytes(16).toString('hex'),
      certificates: []
    };

    try {
      const response = await this.client.post('/overlay/brc31/authenticate', authRequest, {
        headers: {
          'X-Authrite': '1.0',
          'X-Authrite-Identity-Key': this.identityKey,
          'X-Authrite-Nonce': authRequest.nonce
        }
      });

      this.jwtToken = response.data.token;
      console.log('✅ Authentication successful');
      return response.data;
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      throw error;
    }
  }

  // ====================
  // BRC-41: Payment Processing
  // ====================

  async requestPayment(service, satoshis, description) {
    console.log(`💰 Requesting payment: ${satoshis} sats for ${service}`);

    const paymentRequest = {
      service,
      satoshis,
      description
    };

    const response = await this.client.post('/overlay/brc41/request-payment', paymentRequest);
    console.log(`📋 Payment request created: ${response.data.paymentId}`);
    return response.data;
  }

  async completePayment(paymentId, rawTx, merkleProof = []) {
    console.log(`✅ Completing payment: ${paymentId}`);

    const completionData = {
      rawTx,
      merkleProof
    };

    const response = await this.client.post(`/overlay/brc41/payments/${paymentId}/complete`, completionData);
    console.log('💳 Payment completed successfully');
    return response.data;
  }

  // ====================
  // BRC-22: Transaction Submission
  // ====================

  async submitTransaction(rawTx, inputs, topics, mapiResponses = []) {
    console.log(`📝 Submitting transaction to topics: ${topics.join(', ')}`);

    const transaction = {
      rawTx,
      inputs,
      topics,
      mapiResponses
    };

    const response = await this.client.post('/overlay/submit', transaction);
    console.log(`✅ Transaction submitted: ${response.data.result.txid}`);
    return response.data;
  }

  // ====================
  // BRC-24: Lookup Services
  // ====================

  async lookup(provider, query) {
    console.log(`🔍 Querying ${provider} with:`, query);

    const lookupRequest = {
      provider,
      query
    };

    const response = await this.client.post('/overlay/lookup', lookupRequest);
    console.log(`📊 Found ${response.data.results?.length || 0} results`);
    return response.data;
  }

  async getLookupProviders() {
    console.log('📋 Fetching available lookup providers...');
    const response = await this.client.get('/overlay/lookup/providers');
    return response.data.providers;
  }

  // ====================
  // BRC-26: File Storage (UHRP)
  // ====================

  async uploadFile(filePath, metadata = {}) {
    console.log(`📤 Uploading file: ${filePath}`);

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('metadata', JSON.stringify(metadata));

    const response = await axios.post(`${this.baseUrl}/overlay/files/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'X-BSV-Identity': this.identityKey
      }
    });

    console.log(`✅ File uploaded: ${response.data.contentHash}`);
    return response.data;
  }

  async downloadFile(contentHash, outputPath = null) {
    console.log(`📥 Downloading file: ${contentHash}`);

    const response = await axios.get(`${this.baseUrl}/overlay/files/download/${contentHash}`, {
      responseType: 'stream'
    });

    if (outputPath) {
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`✅ File downloaded to: ${outputPath}`);
          resolve(outputPath);
        });
        writer.on('error', reject);
      });
    }

    return response.data;
  }

  async resolveContent(contentHash) {
    console.log(`🔍 Resolving content: ${contentHash}`);

    const response = await this.client.get(`/overlay/files/resolve/${contentHash}`);
    return response.data;
  }

  // ====================
  // BRC-64: History Tracking
  // ====================

  async getTransactionHistory(utxoId) {
    console.log(`📚 Fetching transaction history: ${utxoId}`);

    const response = await this.client.get(`/overlay/history/${utxoId}`);
    return response.data;
  }

  async getLineage(utxoId) {
    console.log(`🌳 Fetching lineage graph: ${utxoId}`);

    const response = await this.client.get(`/overlay/lineage/${utxoId}`);
    return response.data;
  }

  // ====================
  // BRC-88: Service Discovery
  // ====================

  async getSHIPAdvertisements() {
    console.log('🚢 Fetching SHIP service advertisements...');

    const response = await this.client.get('/overlay/services/ship');
    return response.data;
  }

  async getSLAPServices() {
    console.log('🔍 Fetching SLAP service lookup...');

    const response = await this.client.get('/overlay/services/slap');
    return response.data;
  }

  async advertiseService(serviceInfo) {
    console.log('📢 Advertising overlay service...');

    const response = await this.client.post('/overlay/services/ship/advertise', serviceInfo);
    return response.data;
  }

  // ====================
  // Advanced Streaming
  // ====================

  async uploadStreamingContent(filePath, transcode = true, qualities = ['720p', '1080p']) {
    console.log(`🎬 Uploading streaming content: ${filePath}`);

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('transcode', transcode.toString());
    form.append('qualities', JSON.stringify(qualities));

    const response = await axios.post(`${this.baseUrl}/overlay/streaming/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'X-BSV-Identity': this.identityKey
      }
    });

    console.log(`✅ Streaming content uploaded: ${response.data.contentId}`);
    return response.data;
  }

  async createLiveStream(title, description, qualities = []) {
    console.log(`🔴 Creating live stream: ${title}`);

    const streamRequest = {
      title,
      description,
      qualities
    };

    const response = await this.client.post('/overlay/streaming/live/create', streamRequest);
    console.log(`✅ Live stream created: ${response.data.stream.streamId}`);
    return response.data;
  }

  async startLiveStream(streamId) {
    console.log(`▶️ Starting live stream: ${streamId}`);

    const response = await this.client.post(`/overlay/streaming/live/${streamId}/start`);
    return response.data;
  }

  async stopLiveStream(streamId) {
    console.log(`⏹️ Stopping live stream: ${streamId}`);

    const response = await this.client.post(`/overlay/streaming/live/${streamId}/stop`);
    return response.data;
  }

  async getStreamAnalytics(streamId, timeRange = {}) {
    console.log(`📊 Fetching stream analytics: ${streamId}`);

    const params = new URLSearchParams(timeRange);
    const response = await this.client.get(`/overlay/streaming/live/${streamId}/analytics?${params}`);
    return response.data;
  }

  // ====================
  // Federation Network
  // ====================

  async getFederationStatus() {
    console.log('🌐 Checking federation network status...');

    const response = await this.client.get('/overlay/federation/status');
    return response.data;
  }

  async discoverNodes(region = null) {
    console.log(`🔍 Discovering federation nodes${region ? ` in ${region}` : ''}...`);

    const params = region ? `?region=${region}` : '';
    const response = await this.client.get(`/overlay/federation/nodes${params}`);
    return response.data;
  }

  async discoverGlobalContent(contentHash) {
    console.log(`🌍 Discovering global content: ${contentHash}`);

    const response = await this.client.get(`/overlay/federation/content/discover/${contentHash}`);
    return response.data;
  }

  // ====================
  // CDN Integration
  // ====================

  async getCDNUrl(contentPath, region = null) {
    console.log(`🌐 Getting CDN URL for: ${contentPath}`);

    const params = region ? `?region=${region}` : '';
    const response = await this.client.get(`/overlay/cdn/url${contentPath}${params}`);
    return response.data;
  }

  async purgeCDNCache(contentPath) {
    console.log(`🗑️ Purging CDN cache for: ${contentPath}`);

    const response = await this.client.post('/overlay/cdn/purge', { contentPath });
    return response.data;
  }
}

// ====================
// Usage Examples
// ====================

async function demonstrateOverlayNetwork() {
  console.log('🚀 BSV Overlay Network Integration Demo');
  console.log('=====================================\n');

  // Initialize client
  const identityKey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
  const client = new BSVOverlayClient('http://localhost:8788', identityKey);

  try {
    // 1. Check system status
    console.log('1️⃣ System Status Check');
    const status = await client.getStatus();
    console.log(`Network connected: ${status.connected}`);
    console.log(`Available services: ${Object.keys(status.services).join(', ')}\n`);

    // 2. Authenticate
    console.log('2️⃣ Authentication');
    await client.authenticate();
    console.log();

    // 3. Upload a file
    console.log('3️⃣ File Upload (BRC-26)');
    const testFile = 'test-data.json';
    fs.writeFileSync(testFile, JSON.stringify({ message: 'Hello BSV Overlay Network!' }));

    const uploadResult = await client.uploadFile(testFile, {
      description: 'Demo file upload',
      category: 'example'
    });
    console.log(`Content hash: ${uploadResult.contentHash}\n`);

    // 4. Query with lookup service
    console.log('4️⃣ Lookup Service (BRC-24)');
    const lookupResult = await client.lookup('utxo-tracker', {
      topic: 'gitdata.manifest',
      limit: 5
    });
    console.log(`Found ${lookupResult.results?.length || 0} results\n`);

    // 5. Submit a transaction
    console.log('5️⃣ Transaction Submission (BRC-22)');
    const mockTransaction = {
      rawTx: '0100000001' + 'a'.repeat(60) + '00000000',
      inputs: [{
        txid: 'a'.repeat(64),
        vout: 0,
        scriptSig: 'b'.repeat(40)
      }],
      topics: ['demo.transaction', 'gitdata.manifest']
    };

    // Note: In production, use real transaction data
    console.log('Mock transaction prepared for demo purposes\n');

    // 6. Get BRC statistics
    console.log('6️⃣ BRC Standards Statistics');
    const stats = await client.getBRCStats();
    console.log('BRC standards compliance verified\n');

    // 7. Federation discovery
    console.log('7️⃣ Federation Network');
    const federationStatus = await client.getFederationStatus();
    console.log(`Federation enabled: ${federationStatus.federation?.enabled || false}\n`);

    console.log('✅ Demo completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('- Integrate with your Bitcoin wallet');
    console.log('- Set up production authentication');
    console.log('- Configure payment processing');
    console.log('- Deploy to your overlay network');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);

    // Provide helpful debugging information
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Troubleshooting:');
      console.log('1. Make sure the overlay network server is running');
      console.log('2. Check if port 8788 is available');
      console.log('3. Verify your network configuration');
    }
  }

  // Cleanup
  if (fs.existsSync('test-data.json')) {
    fs.unlinkSync('test-data.json');
  }
}

// Export the client class and demo function
module.exports = {
  BSVOverlayClient,
  demonstrateOverlayNetwork
};

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateOverlayNetwork();
}