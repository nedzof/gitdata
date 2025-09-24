#!/usr/bin/env node

/**
 * BSV Overlay Network Producer CLI (D15)
 *
 * A comprehensive TypeScript-based CLI tool for producing data and services on the BSV Overlay Network.
 * Leverages the complete BRC stack for enterprise-grade data publishing, streaming, and monetization.
 *
 * Features:
 * - BRC-31: Identity Authentication with cryptographic signatures
 * - BRC-88: SHIP/SLAP Service Advertisement
 * - BRC-22: Transaction Submission to BSV Network
 * - BRC-26: UHRP Content Publishing and Distribution
 * - BRC-24: Service Registration with lookup services
 * - BRC-64: Usage Analytics and History Tracking
 * - BRC-41: PacketPay HTTP Micropayments Reception
 * - D21: BSV Native Payments with ARC Integration
 * - D22: Multi-node Storage Backend Distribution
 * - Live Streaming: Real-time data feeds with micropayments
 * - Producer Dashboard: Analytics and business intelligence
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ProducerBRCStack } from './brc_integrations/producer_stack';
import { ProducerDatabase } from './database/producer_models';
import { ProducerStreamingService } from './src/streaming_service';
import { ProducerAnalytics } from './src/analytics';
import { ProducerDashboard } from './src/dashboard';
import { D28PolicyManager } from './brc_integrations/d28_policy_manager';

interface ProducerConfig {
  overlayUrl: string;
  databaseUrl: string;
  identityFile: string;
  defaultRegion: string;
  maxRevenueSplits: number;
  debug: boolean;
}

interface ProducerProfile {
  producerId: string;
  identityKey: string;
  displayName: string;
  description: string;
  contactInfo: any;
  capabilities: string[];
  regions: string[];
  reputationScore: number;
  totalRevenue: number;
}

interface ServiceCapability {
  capability: string;
  serviceType: string;
  pricingModel: 'per-request' | 'per-minute' | 'per-mb' | 'subscription';
  baseRate: number;
  maxConsumers: number;
  availability: number;
  regions: string[];
}

interface DatasetManifest {
  title: string;
  description: string;
  content: string | Buffer;
  contentType: string;
  tags: string[];
  price: number;
  licenseType: string;
  distributeGlobally: boolean;
  distributionNodes?: string[];
}

interface StreamConfiguration {
  streamId: string;
  title: string;
  description: string;
  format: 'json' | 'csv' | 'binary' | 'video' | 'audio';
  updateFrequency: number; // milliseconds
  pricePerMinute: number;
  maxConsumers: number;
  qualitySettings: any;
  historicalBuffer: number; // hours
}

interface PaymentMethod {
  type: 'brc41-http' | 'd21-native';
  minPayment: number;
  maxPayment: number;
  splitRules?: any;
  arcProviders?: string[];
}

class OverlayProducerCLI {
  private config: ProducerConfig;
  private brcStack: ProducerBRCStack;
  private database: ProducerDatabase;
  private streamingService: ProducerStreamingService;
  private analytics: ProducerAnalytics;
  private dashboard: ProducerDashboard;
  private policyManager: D28PolicyManager;
  private program: Command;

  constructor(config: ProducerConfig) {
    this.config = config;
    this.brcStack = new ProducerBRCStack(config.overlayUrl, config.databaseUrl);
    this.database = new ProducerDatabase(config.databaseUrl);
    this.streamingService = new ProducerStreamingService(this.brcStack, this.database);
    this.analytics = new ProducerAnalytics(this.database);
    this.dashboard = new ProducerDashboard(this.analytics, this.database);
    this.policyManager = new D28PolicyManager(config.overlayUrl);
    this.program = new Command();

    this.setupCLI();
  }

  private setupCLI(): void {
    this.program
      .name('overlay-producer-cli')
      .description('BSV Overlay Network Producer CLI with full BRC stack integration')
      .version('1.0.0')
      .option('--config <file>', 'Configuration file path')
      .option('--debug', 'Enable debug logging')
      .hook('preAction', async (thisCommand) => {
        if (thisCommand.opts().debug || this.config.debug) {
          console.log('[DEBUG] Command:', thisCommand.name(), 'Args:', thisCommand.args);
        }
      });

    this.setupIdentityCommands();
    this.setupRegistrationCommands();
    this.setupAdvertisementCommands();
    this.setupPublishingCommands();
    this.setupStreamingCommands();
    this.setupPaymentCommands();
    this.setupDistributionCommands();
    this.setupAnalyticsCommands();
    this.setupDashboardCommands();
    this.setupPolicyCommands();
    this.setupManagementCommands();
  }

  private setupIdentityCommands(): void {
    const identity = this.program
      .command('identity')
      .description('Producer identity management');

    identity
      .command('setup')
      .description('Setup producer identity with BRC-31 authentication')
      .option('--generate-key', 'Generate new identity key')
      .option('--register-overlay', 'Register with overlay network')
      .option('--backup-key <file>', 'Backup identity key to file')
      .option('--display-name <name>', 'Producer display name')
      .option('--description <desc>', 'Producer description')
      .action(async (options) => {
        try {
          console.log('🔑 Setting up producer identity...');

          let identityKey: string;
          if (options.generateKey) {
            identityKey = crypto.randomBytes(32).toString('hex');
            console.log('✅ Generated new identity key');
          } else {
            identityKey = this.loadIdentityKey();
          }

          const identity = await this.brcStack.authenticateProducer(identityKey);

          if (options.registerOverlay) {
            const registration = await this.brcStack.registerProducerIdentity({
              identityKey,
              displayName: options.displayName || 'BSV Producer',
              description: options.description || 'BSV Overlay Network Producer',
              contactInfo: {},
              capabilities: [],
              regions: [this.config.defaultRegion]
            });

            await this.database.storeProducerIdentity(registration);
            console.log('✅ Registered with overlay network');
            console.log(`Producer ID: ${registration.producerId}`);
          }

          if (options.backupKey) {
            fs.writeFileSync(options.backupKey, identityKey, { mode: 0o600 });
            console.log(`✅ Identity backed up to: ${options.backupKey}`);
          }

          console.log('✅ Producer identity setup complete');

        } catch (error) {
          console.error('❌ Identity setup failed:', error.message);
          process.exit(1);
        }
      });

    identity
      .command('verify')
      .description('Verify producer identity and reputation')
      .option('--check-reputation', 'Check reputation score')
      .option('--validate-advertisements', 'Validate service advertisements')
      .option('--test-payment-endpoints', 'Test payment endpoints')
      .action(async (options) => {
        try {
          console.log('🔍 Verifying producer identity...');

          const producer = await this.database.getProducerProfile();
          if (!producer) {
            throw new Error('Producer identity not found. Run identity setup first.');
          }

          console.log(`Producer ID: ${producer.producerId}`);
          console.log(`Display Name: ${producer.displayName}`);
          console.log(`Capabilities: ${producer.capabilities.join(', ')}`);

          if (options.checkReputation) {
            console.log(`Reputation Score: ${producer.reputationScore}/5.0`);
            console.log(`Total Revenue: ${producer.totalRevenue} satoshis`);
          }

          if (options.validateAdvertisements) {
            const ads = await this.database.getActiveAdvertisements(producer.producerId);
            console.log(`Active Advertisements: ${ads.length}`);
            for (const ad of ads) {
              console.log(`  - ${ad.capability}: ${ad.baseRate} sats/${ad.pricingModel}`);
            }
          }

          if (options.testPaymentEndpoints) {
            const paymentConfig = await this.brcStack.testPaymentEndpoints(producer.producerId);
            console.log('Payment Endpoints Status:');
            console.log(`  HTTP Micropayments: ${paymentConfig.httpActive ? '✅' : '❌'}`);
            console.log(`  D21 Native: ${paymentConfig.nativeActive ? '✅' : '❌'}`);
          }

          console.log('✅ Identity verification complete');

        } catch (error) {
          console.error('❌ Identity verification failed:', error.message);
          process.exit(1);
        }
      });
  }

  private setupRegistrationCommands(): void {
    this.program
      .command('register')
      .description('Register producer with full BRC stack integration')
      .requiredOption('--name <name>', 'Producer name')
      .requiredOption('--description <desc>', 'Producer description')
      .requiredOption('--capabilities <caps>', 'Comma-separated capabilities')
      .option('--regions <regions>', 'Comma-separated regions', this.config.defaultRegion)
      .option('--generate-identity', 'Generate new identity')
      .option('--advertise-on-overlay', 'Advertise on overlay network')
      .action(async (options) => {
        try {
          console.log('📝 Registering producer with BRC stack...');

          const capabilities = options.capabilities.split(',').map(s => s.trim());
          const regions = options.regions.split(',').map(s => s.trim());

          let identityKey: string;
          if (options.generateIdentity) {
            identityKey = crypto.randomBytes(32).toString('hex');
          } else {
            identityKey = this.loadIdentityKey();
          }

          // BRC-31: Authenticate producer identity
          const identity = await this.brcStack.authenticateProducer(identityKey);

          // Register producer profile
          const profile: ProducerProfile = {
            producerId: identity.producerId,
            identityKey: identity.publicKey,
            displayName: options.name,
            description: options.description,
            contactInfo: {},
            capabilities,
            regions,
            reputationScore: 0.0,
            totalRevenue: 0
          };

          await this.database.storeProducerIdentity(profile);

          // BRC-24: Register with lookup services
          const serviceRegistration = await this.brcStack.registerWithLookupServices({
            producerId: profile.producerId,
            capabilities,
            regions,
            basePricing: {}
          });

          console.log('✅ Producer registered successfully');
          console.log(`Producer ID: ${profile.producerId}`);
          console.log(`Capabilities: ${capabilities.join(', ')}`);
          console.log(`Regions: ${regions.join(', ')}`);

          if (options.advertiseOnOverlay) {
            console.log('📢 Starting service advertisement...');
            // BRC-88: Advertise services
            const defaultCapabilities: ServiceCapability[] = capabilities.map(cap => ({
              capability: cap,
              serviceType: 'data-feed',
              pricingModel: 'per-request' as const,
              baseRate: 100,
              maxConsumers: 1000,
              availability: 99.0,
              regions
            }));

            const advertisements = await this.advertiseServices(defaultCapabilities);
            console.log(`✅ Advertised ${advertisements.length} services`);
          }

          console.log('✅ Producer registration complete');

        } catch (error) {
          console.error('❌ Producer registration failed:', error.message);
          process.exit(1);
        }
      });
  }

  private setupAdvertisementCommands(): void {
    const advertise = this.program
      .command('advertise')
      .description('Advertise services via BRC-88 SHIP/SLAP');

    advertise
      .command('create')
      .description('Create service advertisement')
      .requiredOption('--service-type <type>', 'Service type')
      .requiredOption('--capability <cap>', 'Service capability')
      .requiredOption('--pricing-model <model>', 'Pricing model (per-request, per-minute, per-mb, subscription)')
      .requiredOption('--rate <rate>', 'Base rate in satoshis', parseInt)
      .option('--availability <pct>', 'Availability percentage', '99.0')
      .option('--max-consumers <num>', 'Maximum consumers', '1000', parseInt)
      .option('--geographic-scope <regions>', 'Geographic regions', 'global')
      .action(async (options) => {
        try {
          console.log('📢 Creating service advertisement...');

          const producer = await this.database.getProducerProfile();
          if (!producer) {
            throw new Error('Producer not registered. Run register command first.');
          }

          const capability: ServiceCapability = {
            capability: options.capability,
            serviceType: options.serviceType,
            pricingModel: options.pricingModel as any,
            baseRate: options.rate,
            maxConsumers: options.maxConsumers,
            availability: parseFloat(options.availability),
            regions: options.geographicScope.split(',').map(s => s.trim())
          };

          const advertisements = await this.advertiseServices([capability]);
          console.log(`✅ Advertisement created: ${advertisements[0].advertisementId}`);

        } catch (error) {
          console.error('❌ Advertisement creation failed:', error.message);
          process.exit(1);
        }
      });
  }

  private setupPublishingCommands(): void {
    const publish = this.program
      .command('publish')
      .description('Publish content to overlay network');

    publish
      .command('dataset')
      .description('Publish dataset with BRC-22 + BRC-26')
      .requiredOption('--file <path>', 'Dataset file path')
      .requiredOption('--title <title>', 'Dataset title')
      .option('--description <desc>', 'Dataset description')
      .option('--tags <tags>', 'Comma-separated tags')
      .option('--price <price>', 'Price in satoshis', '1000', parseInt)
      .option('--license <license>', 'License type', 'commercial')
      .option('--distribute-nodes <num>', 'Number of distribution nodes', '3', parseInt)
      .action(async (options) => {
        try {
          console.log('📤 Publishing dataset...');

          if (!fs.existsSync(options.file)) {
            throw new Error(`File not found: ${options.file}`);
          }

          const content = fs.readFileSync(options.file);
          const contentType = path.extname(options.file).substring(1) || 'application/octet-stream';

          const manifest: DatasetManifest = {
            title: options.title,
            description: options.description || '',
            content,
            contentType,
            tags: options.tags ? options.tags.split(',').map(s => s.trim()) : [],
            price: options.price,
            licenseType: options.license,
            distributeGlobally: true,
            distributionNodes: []
          };

          const result = await this.publishDataset(manifest);

          console.log('✅ Dataset published successfully');
          console.log(`Content ID: ${result.contentId}`);
          console.log(`UHRP Hash: ${result.uhrpHash}`);
          console.log(`Transaction ID: ${result.transactionId}`);
          console.log(`Distribution Nodes: ${result.distributionNodes.length}`);

        } catch (error) {
          console.error('❌ Dataset publication failed:', error.message);
          process.exit(1);
        }
      });

    publish
      .command('batch')
      .description('Batch publish multiple files')
      .requiredOption('--directory <dir>', 'Source directory')
      .option('--pattern <pattern>', 'File pattern', '*')
      .option('--base-price <price>', 'Base price in satoshis', '1000', parseInt)
      .option('--parallel-uploads <num>', 'Parallel uploads', '3', parseInt)
      .option('--auto-generate-descriptions', 'Auto-generate descriptions')
      .action(async (options) => {
        try {
          console.log('📤 Batch publishing datasets...');

          // Implementation for batch publishing
          const files = fs.readdirSync(options.directory)
            .filter(file => file.match(options.pattern))
            .slice(0, 10); // Limit for demo

          console.log(`Found ${files.length} files to publish`);

          let published = 0;
          for (const file of files) {
            try {
              const filePath = path.join(options.directory, file);
              const content = fs.readFileSync(filePath);

              const manifest: DatasetManifest = {
                title: file,
                description: options.autoGenerateDescriptions ? `Dataset: ${file}` : '',
                content,
                contentType: 'application/json',
                tags: ['batch-upload'],
                price: options.basePrice,
                licenseType: 'commercial',
                distributeGlobally: true
              };

              const result = await this.publishDataset(manifest);
              console.log(`  ✅ ${file} -> ${result.contentId}`);
              published++;

            } catch (error) {
              console.log(`  ❌ ${file}: ${error.message}`);
            }
          }

          console.log(`✅ Batch publish complete: ${published}/${files.length} files`);

        } catch (error) {
          console.error('❌ Batch publish failed:', error.message);
          process.exit(1);
        }
      });
  }

  private setupStreamingCommands(): void {
    const stream = this.program
      .command('stream')
      .description('Live streaming service management');

    stream
      .command('create')
      .description('Create live data stream')
      .requiredOption('--stream-id <id>', 'Stream identifier')
      .requiredOption('--title <title>', 'Stream title')
      .option('--format <format>', 'Stream format (json, csv, binary)', 'json')
      .option('--update-frequency <ms>', 'Update frequency in ms', '1000', parseInt)
      .option('--price-per-minute <price>', 'Price per minute in satoshis', '50', parseInt)
      .option('--max-consumers <num>', 'Maximum consumers', '100', parseInt)
      .action(async (options) => {
        try {
          console.log('📺 Creating live stream...');

          const streamConfig: StreamConfiguration = {
            streamId: options.streamId,
            title: options.title,
            description: `Live ${options.format} stream`,
            format: options.format as any,
            updateFrequency: options.updateFrequency,
            pricePerMinute: options.pricePerMinute,
            maxConsumers: options.maxConsumers,
            qualitySettings: {},
            historicalBuffer: 0
          };

          const stream = await this.streamingService.createStream(streamConfig);

          console.log('✅ Stream created successfully');
          console.log(`Stream ID: ${stream.streamId}`);
          console.log(`Format: ${stream.format}`);
          console.log(`Price: ${stream.pricePerMinute} sats/min`);

        } catch (error) {
          console.error('❌ Stream creation failed:', error.message);
          process.exit(1);
        }
      });

    stream
      .command('start')
      .description('Start streaming service')
      .requiredOption('--stream-id <id>', 'Stream identifier')
      .option('--source <url>', 'Data source URL')
      .option('--redundancy <num>', 'Redundancy factor', '1', parseInt)
      .action(async (options) => {
        try {
          console.log('▶️ Starting stream service...');

          const result = await this.streamingService.startStream(
            options.streamId,
            options.source || 'mock://test-data',
            {
              redundancy: options.redundancy
            }
          );

          console.log('✅ Stream started successfully');
          console.log(`Stream Status: ${result.status}`);
          console.log(`Active Consumers: ${result.activeConsumers}`);

        } catch (error) {
          console.error('❌ Stream start failed:', error.message);
          process.exit(1);
        }
      });
  }

  private setupPaymentCommands(): void {
    const payments = this.program
      .command('payments')
      .description('Payment configuration and management');

    payments
      .command('setup')
      .description('Setup payment reception capabilities')
      .option('--enable-http', 'Enable BRC-41 HTTP micropayments')
      .option('--enable-d21', 'Enable D21 native BSV payments')
      .option('--min-payment <amount>', 'Minimum payment', '1', parseInt)
      .option('--max-payment <amount>', 'Maximum payment', '100000', parseInt)
      .option('--auto-settle', 'Enable automatic settlement')
      .action(async (options) => {
        try {
          console.log('💳 Setting up payment reception...');

          const methods: PaymentMethod[] = [];

          if (options.enableHttp) {
            methods.push({
              type: 'brc41-http',
              minPayment: options.minPayment,
              maxPayment: options.maxPayment
            });
          }

          if (options.enableD21) {
            methods.push({
              type: 'd21-native',
              minPayment: options.minPayment,
              maxPayment: options.maxPayment,
              splitRules: { overlay: 0.1, producer: 0.9 },
              arcProviders: ['taal']
            });
          }

          if (methods.length === 0) {
            methods.push({
              type: 'brc41-http',
              minPayment: options.minPayment,
              maxPayment: options.maxPayment
            });
          }

          const config = await this.setupPaymentReception(methods);

          console.log('✅ Payment reception configured');
          console.log(`HTTP Endpoint: ${config.httpEndpoint || 'Not enabled'}`);
          console.log(`D21 Native: ${config.nativeEnabled ? 'Enabled' : 'Not enabled'}`);

        } catch (error) {
          console.error('❌ Payment setup failed:', error.message);
          process.exit(1);
        }
      });
  }

  private setupDistributionCommands(): void {
    const distribute = this.program
      .command('distribute')
      .description('D22 multi-node content distribution');

    distribute
      .command('content')
      .description('Distribute content across overlay nodes')
      .requiredOption('--content-hash <hash>', 'Content UHRP hash')
      .option('--target-nodes <nodes>', 'Target node URLs (comma-separated)')
      .option('--replication-factor <num>', 'Replication factor', '3', parseInt)
      .option('--geographic-distribution <scope>', 'Geographic scope', 'global')
      .action(async (options) => {
        try {
          console.log('🌐 Distributing content across nodes...');

          const targetNodes = options.targetNodes
            ? options.targetNodes.split(',').map(s => s.trim())
            : [];

          const result = await this.distributeContent(
            options.contentHash,
            targetNodes,
            {
              replicationFactor: options.replicationFactor,
              geographicScope: options.geographicDistribution
            }
          );

          console.log('✅ Content distribution initiated');
          console.log(`Nodes: ${result.distributedNodes.length}`);
          console.log(`Replication Factor: ${result.replicationFactor}`);

        } catch (error) {
          console.error('❌ Content distribution failed:', error.message);
          process.exit(1);
        }
      });
  }

  private setupAnalyticsCommands(): void {
    const analytics = this.program
      .command('analytics')
      .description('Producer analytics and tracking');

    analytics
      .command('view')
      .description('View producer analytics')
      .option('--period <period>', 'Time period (24h, 7d, 30d)', '7d')
      .option('--metrics <metrics>', 'Metrics to include (comma-separated)')
      .option('--export-format <format>', 'Export format (json, csv)', 'json')
      .action(async (options) => {
        try {
          console.log('📊 Generating analytics report...');

          const metrics = options.metrics
            ? options.metrics.split(',').map(s => s.trim())
            : ['revenue', 'downloads', 'streaming_hours'];

          const report = await this.analytics.generateReport(options.period, metrics);

          if (options.exportFormat === 'json') {
            console.log(JSON.stringify(report, null, 2));
          } else {
            console.log('Analytics Summary:');
            console.log(`Period: ${options.period}`);
            console.log(`Total Revenue: ${report.totalRevenue} satoshis`);
            console.log(`Total Downloads: ${report.totalDownloads}`);
            console.log(`Streaming Hours: ${report.streamingHours}`);
            console.log(`Active Consumers: ${report.activeConsumers}`);
          }

        } catch (error) {
          console.error('❌ Analytics generation failed:', error.message);
          process.exit(1);
        }
      });

    analytics
      .command('track')
      .description('Track specific analytics event')
      .requiredOption('--event <event>', 'Event type')
      .requiredOption('--resource-id <id>', 'Resource identifier')
      .option('--consumer-id <id>', 'Consumer identifier')
      .option('--revenue <amount>', 'Revenue amount', '0', parseInt)
      .option('--metadata <json>', 'Event metadata (JSON)')
      .action(async (options) => {
        try {
          console.log('📝 Tracking analytics event...');

          await this.analytics.trackEvent({
            eventType: options.event,
            resourceId: options.resourceId,
            consumerId: options.consumerId,
            revenue: options.revenue,
            metadata: options.metadata ? JSON.parse(options.metadata) : {}
          });

          console.log('✅ Event tracked successfully');

        } catch (error) {
          console.error('❌ Event tracking failed:', error.message);
          process.exit(1);
        }
      });
  }

  private setupDashboardCommands(): void {
    this.program
      .command('dashboard')
      .description('Generate producer dashboard')
      .option('--include-charts', 'Include data charts')
      .option('--real-time-metrics', 'Include real-time metrics')
      .option('--export-html <file>', 'Export as HTML file')
      .option('--auto-refresh <seconds>', 'Auto-refresh interval', '30', parseInt)
      .action(async (options) => {
        try {
          console.log('📈 Generating producer dashboard...');

          const dashboard = await this.dashboard.generate({
            includeCharts: options.includeCharts,
            realTimeMetrics: options.realTimeMetrics,
            autoRefresh: options.autoRefresh
          });

          if (options.exportHtml) {
            fs.writeFileSync(options.exportHtml, dashboard.html);
            console.log(`✅ Dashboard exported to: ${options.exportHtml}`);
          } else {
            console.log('📊 Dashboard Summary:');
            console.log(dashboard.summary);
          }

        } catch (error) {
          console.error('❌ Dashboard generation failed:', error.message);
          process.exit(1);
        }
      });
  }

  private setupPolicyCommands(): void {
    const policy = this.program
      .command('policy')
      .description('D28 Policy management for producer content');

    // Create policy
    policy
      .command('create')
      .description('Create a new policy definition')
      .requiredOption('--name <name>', 'Policy name')
      .requiredOption('--description <desc>', 'Policy description')
      .option('--template <template>', 'Use policy template (financial-strict, research-quality, business-balanced)')
      .option('--policy-json <json>', 'Policy JSON as string')
      .option('--policy-file <file>', 'Policy JSON from file')
      .action(async (options) => {
        try {
          console.log('📋 Creating policy definition...');

          let policyJson;

          if (options.template) {
            const templates = this.policyManager.createExamplePolicies();
            policyJson = templates[options.template];
            if (!policyJson) {
              throw new Error(`Unknown template: ${options.template}. Available: ${Object.keys(templates).join(', ')}`);
            }
          } else if (options.policyJson) {
            policyJson = JSON.parse(options.policyJson);
          } else if (options.policyFile) {
            const fileContent = fs.readFileSync(options.policyFile, 'utf8');
            policyJson = JSON.parse(fileContent);
          } else {
            throw new Error('Must specify --template, --policy-json, or --policy-file');
          }

          const policy = await this.policyManager.createPolicy({
            name: options.name,
            description: options.description,
            policyJson
          });

          console.log('✅ Policy created successfully');
          console.log(`Policy ID: ${policy.policyId}`);
          console.log(`Name: ${policy.name}`);

        } catch (error) {
          console.error('❌ Policy creation failed:', error.message);
          process.exit(1);
        }
      });

    // List policies
    policy
      .command('list')
      .description('List all policy definitions')
      .option('--enabled-only', 'Show only enabled policies')
      .action(async (options) => {
        try {
          console.log('📋 Listing policy definitions...');

          const policies = await this.policyManager.listPolicies();
          const filteredPolicies = options.enabledOnly
            ? policies.filter(p => p.enabled)
            : policies;

          if (filteredPolicies.length === 0) {
            console.log('No policies found');
            return;
          }

          console.log(`Found ${filteredPolicies.length} policies:`);
          filteredPolicies.forEach(policy => {
            console.log(`  - ${policy.policyId}: ${policy.name} ${policy.enabled ? '✅' : '❌'}`);
            console.log(`    Description: ${policy.description}`);
            console.log(`    Created: ${policy.createdAt.toISOString()}`);
          });

        } catch (error) {
          console.error('❌ Policy listing failed:', error.message);
          process.exit(1);
        }
      });

    // Show policy details
    policy
      .command('show')
      .description('Show policy details')
      .requiredOption('--policy-id <id>', 'Policy ID')
      .option('--export-json', 'Export policy as JSON')
      .action(async (options) => {
        try {
          console.log(`📋 Showing policy: ${options.policyId}`);

          const policy = await this.policyManager.getPolicy(options.policyId);
          if (!policy) {
            throw new Error(`Policy not found: ${options.policyId}`);
          }

          if (options.exportJson) {
            console.log(JSON.stringify(policy, null, 2));
          } else {
            console.log(`Policy ID: ${policy.policyId}`);
            console.log(`Name: ${policy.name}`);
            console.log(`Description: ${policy.description}`);
            console.log(`Status: ${policy.enabled ? 'Enabled' : 'Disabled'}`);
            console.log(`Created: ${policy.createdAt.toISOString()}`);
            console.log(`Updated: ${policy.updatedAt.toISOString()}`);
            console.log('Policy JSON:');
            console.log(JSON.stringify(policy.policyJson, null, 2));
          }

        } catch (error) {
          console.error('❌ Policy show failed:', error.message);
          process.exit(1);
        }
      });

    // Update policy
    policy
      .command('update')
      .description('Update existing policy')
      .requiredOption('--policy-id <id>', 'Policy ID')
      .option('--name <name>', 'Update policy name')
      .option('--description <desc>', 'Update policy description')
      .option('--enable', 'Enable policy')
      .option('--disable', 'Disable policy')
      .option('--policy-json <json>', 'Update policy JSON as string')
      .option('--policy-file <file>', 'Update policy JSON from file')
      .action(async (options) => {
        try {
          console.log(`📋 Updating policy: ${options.policyId}`);

          const updates: any = {};

          if (options.name) updates.name = options.name;
          if (options.description) updates.description = options.description;
          if (options.enable) updates.enabled = true;
          if (options.disable) updates.enabled = false;

          if (options.policyJson) {
            updates.policyJson = JSON.parse(options.policyJson);
          } else if (options.policyFile) {
            const fileContent = fs.readFileSync(options.policyFile, 'utf8');
            updates.policyJson = JSON.parse(fileContent);
          }

          const updatedPolicy = await this.policyManager.updatePolicy(options.policyId, updates);

          console.log('✅ Policy updated successfully');
          console.log(`Policy ID: ${updatedPolicy.policyId}`);
          console.log(`Name: ${updatedPolicy.name}`);
          console.log(`Status: ${updatedPolicy.enabled ? 'Enabled' : 'Disabled'}`);

        } catch (error) {
          console.error('❌ Policy update failed:', error.message);
          process.exit(1);
        }
      });

    // Delete policy
    policy
      .command('delete')
      .description('Delete policy definition')
      .requiredOption('--policy-id <id>', 'Policy ID')
      .option('--confirm', 'Skip confirmation prompt')
      .action(async (options) => {
        try {
          if (!options.confirm) {
            console.log('⚠️  This will permanently delete the policy. Use --confirm to proceed.');
            return;
          }

          console.log(`🗑️ Deleting policy: ${options.policyId}`);

          await this.policyManager.deletePolicy(options.policyId);

          console.log('✅ Policy deleted successfully');

        } catch (error) {
          console.error('❌ Policy deletion failed:', error.message);
          process.exit(1);
        }
      });

    // Define content metadata
    policy
      .command('define-metadata')
      .description('Define metadata for producer content')
      .requiredOption('--content-id <id>', 'Content identifier')
      .requiredOption('--classification <class>', 'Content classification')
      .requiredOption('--mime-type <type>', 'MIME type')
      .requiredOption('--license <license>', 'License type')
      .requiredOption('--price <price>', 'Price in satoshis', parseInt)
      .requiredOption('--size <size>', 'Content size in bytes', parseInt)
      .option('--schema-hash <hash>', 'Schema hash')
      .option('--ontology-tags <tags>', 'Comma-separated ontology tags')
      .option('--pii-flags <flags>', 'Comma-separated PII flags')
      .option('--geo-origin <origin>', 'Geographic origin')
      .option('--row-count <count>', 'Number of rows', parseInt)
      .option('--null-percentage <pct>', 'Null value percentage', parseFloat)
      .option('--feature-set-id <id>', 'Feature set ID')
      .option('--split-tag <tag>', 'Split tag (train/val/test)')
      .action(async (options) => {
        try {
          console.log(`📊 Defining metadata for content: ${options.contentId}`);

          const metadata = await this.policyManager.defineContentMetadata(options.contentId, {
            classification: options.classification,
            mimeType: options.mimeType,
            license: options.license,
            price: options.price,
            size: options.size,
            schemaHash: options.schemaHash,
            ontologyTags: options.ontologyTags ? options.ontologyTags.split(',').map(t => t.trim()) : [],
            piiFlags: options.piiFlags ? options.piiFlags.split(',').map(t => t.trim()) : [],
            geoOrigin: options.geoOrigin || 'unknown',
            rowCount: options.rowCount,
            nullPercentage: options.nullPercentage,
            featureSetId: options.featureSetId,
            splitTag: options.splitTag
          });

          console.log('✅ Content metadata defined successfully');
          console.log(`Version ID: ${metadata.versionId}`);
          console.log(`Classification: ${metadata.classification}`);
          console.log(`License: ${metadata.license}`);
          console.log(`Price: ${metadata.price} satoshis`);

        } catch (error) {
          console.error('❌ Metadata definition failed:', error.message);
          process.exit(1);
        }
      });

    // Evaluate policy against content
    policy
      .command('evaluate')
      .description('Evaluate content against policy (like /ready endpoint)')
      .requiredOption('--version-id <id>', 'Content version ID')
      .requiredOption('--policy-id <id>', 'Policy ID')
      .option('--metadata-file <file>', 'Content metadata JSON file')
      .action(async (options) => {
        try {
          console.log(`🔍 Evaluating policy ${options.policyId} against content ${options.versionId}`);

          // For demo, create sample metadata or load from file
          let metadata;
          if (options.metadataFile) {
            const fileContent = fs.readFileSync(options.metadataFile, 'utf8');
            metadata = JSON.parse(fileContent);
          } else {
            // Sample metadata for demo
            metadata = await this.policyManager.defineContentMetadata(options.versionId, {
              versionId: options.versionId,
              contentHash: crypto.randomBytes(32).toString('hex'),
              classification: 'public',
              mimeType: 'application/json',
              license: 'commercial',
              price: 1000,
              size: 1024 * 1024,
              ontologyTags: ['test-data'],
              piiFlags: [],
              geoOrigin: 'US'
            });
          }

          const decision = await this.policyManager.evaluatePolicy(
            options.versionId,
            options.policyId,
            metadata
          );

          console.log('🎯 Policy Evaluation Result:');
          console.log(`Decision: ${decision.decision.toUpperCase()}`);

          if (decision.reasons.length > 0) {
            console.log(`Reasons: ${decision.reasons.join(', ')}`);
          }

          if (decision.warnings && decision.warnings.length > 0) {
            console.log(`Warnings: ${decision.warnings.join(', ')}`);
          }

          if (decision.evidence && Object.keys(decision.evidence).length > 0) {
            console.log('Evidence:');
            console.log(JSON.stringify(decision.evidence, null, 2));
          }

        } catch (error) {
          console.error('❌ Policy evaluation failed:', error.message);
          process.exit(1);
        }
      });

    // List policy templates
    policy
      .command('templates')
      .description('List available policy templates')
      .action(async () => {
        try {
          console.log('📋 Available policy templates:');

          const templates = this.policyManager.createExamplePolicies();

          Object.entries(templates).forEach(([name, template]) => {
            console.log(`\n  ${name}:`);
            console.log(`    Classification: ${template.classificationAllowList?.join(', ') || 'Any'}`);
            console.log(`    Min Confirmations: ${template.minConfs || 'Any'}`);
            console.log(`    Max Price/Byte: ${template.maxPricePerByte || 'Any'}`);
            console.log(`    Geo Restrictions: ${template.geoOriginAllowList?.join(', ') || 'None'}`);
            console.log(`    PII Blocks: ${template.piiFlagsBlockList?.join(', ') || 'None'}`);
          });

          console.log('\nUsage: node producer.js policy create --name "My Policy" --template financial-strict');

        } catch (error) {
          console.error('❌ Template listing failed:', error.message);
          process.exit(1);
        }
      });
  }

  private setupManagementCommands(): void {
    const manage = this.program
      .command('manage')
      .description('Producer management commands');

    manage
      .command('consumers')
      .description('Manage consumer relationships')
      .option('--list-active', 'List active subscriptions')
      .option('--show-payment-status', 'Show payment status')
      .option('--export-csv <file>', 'Export consumer list')
      .action(async (options) => {
        try {
          console.log('👥 Managing consumer relationships...');

          const consumers = await this.database.getConsumerRelationships();

          if (options.listActive) {
            console.log(`Active Consumers: ${consumers.length}`);
            consumers.forEach(consumer => {
              console.log(`  - ${consumer.consumerId}: ${consumer.totalPayments} sats`);
            });
          }

          if (options.exportCsv) {
            const csv = this.generateConsumerCSV(consumers);
            fs.writeFileSync(options.exportCsv, csv);
            console.log(`✅ Consumer list exported to: ${options.exportCsv}`);
          }

        } catch (error) {
          console.error('❌ Consumer management failed:', error.message);
          process.exit(1);
        }
      });
  }

  // Core functionality methods
  private async advertiseServices(capabilities: ServiceCapability[]): Promise<any[]> {
    const producer = await this.database.getProducerProfile();
    const advertisements = [];

    for (const capability of capabilities) {
      const advertisement = await this.brcStack.createServiceAdvertisement(
        producer.producerId,
        capability
      );

      await this.database.storeAdvertisement(advertisement);
      advertisements.push(advertisement);
    }

    return advertisements;
  }

  private async publishDataset(manifest: DatasetManifest): Promise<any> {
    const producer = await this.database.getProducerProfile();

    // BRC-26: Store content with UHRP
    const uhrpHash = await this.brcStack.storeContent(manifest.content, manifest.contentType);

    // BRC-22: Submit data transaction
    const transactionResult = await this.brcStack.submitDataTransaction({
      producerId: producer.producerId,
      contentHash: uhrpHash,
      metadata: {
        title: manifest.title,
        description: manifest.description,
        tags: manifest.tags,
        price: manifest.price
      }
    });

    // D22: Distribute across nodes
    const distributionResult = await this.distributeContent(uhrpHash, [], {
      replicationFactor: 3,
      geographicScope: 'global'
    });

    const contentRecord = {
      contentId: crypto.randomUUID(),
      producerId: producer.producerId,
      uhrpHash,
      title: manifest.title,
      description: manifest.description,
      contentType: manifest.contentType,
      tags: manifest.tags,
      pricing: { basePrice: manifest.price },
      transactionId: transactionResult.transactionId,
      distributionNodes: distributionResult.distributedNodes
    };

    await this.database.storePublishedContent(contentRecord);

    return {
      contentId: contentRecord.contentId,
      uhrpHash,
      transactionId: transactionResult.transactionId,
      distributionNodes: distributionResult.distributedNodes
    };
  }

  private async setupPaymentReception(methods: PaymentMethod[]): Promise<any> {
    const producer = await this.database.getProducerProfile();
    const config = { httpEndpoint: null, nativeEnabled: false };

    for (const method of methods) {
      if (method.type === 'brc41-http') {
        const endpoint = await this.brcStack.setupHttpMicropayments(
          producer.producerId,
          method.minPayment,
          method.maxPayment
        );
        config.httpEndpoint = endpoint;
      } else if (method.type === 'd21-native') {
        await this.brcStack.enableNativePayments(
          producer.producerId,
          method.splitRules,
          method.arcProviders
        );
        config.nativeEnabled = true;
      }
    }

    return config;
  }

  private async distributeContent(contentHash: string, targetNodes: string[], options: any): Promise<any> {
    const result = await this.brcStack.distributeToNodes(contentHash, targetNodes, options);

    // Store distribution records
    for (const node of result.distributedNodes) {
      await this.database.storeDistributionRecord({
        distributionId: crypto.randomUUID(),
        contentId: contentHash,
        overlayNodeId: node,
        distributionStatus: 'syncing',
        replicationFactor: options.replicationFactor
      });
    }

    return result;
  }

  private loadIdentityKey(): string {
    if (fs.existsSync(this.config.identityFile)) {
      return fs.readFileSync(this.config.identityFile, 'utf8').trim();
    }
    throw new Error(`Identity file not found: ${this.config.identityFile}`);
  }

  private generateConsumerCSV(consumers: any[]): string {
    const headers = ['Consumer ID', 'First Interaction', 'Total Payments', 'Status'];
    const rows = consumers.map(c => [
      c.consumerId,
      c.firstInteraction,
      c.totalPayments,
      c.status
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  public async run(): Promise<void> {
    try {
      await this.database.initialize();
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error('❌ CLI execution failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI Configuration and Startup
async function main(): Promise<void> {
  const defaultConfig: ProducerConfig = {
    overlayUrl: process.env.OVERLAY_URL || 'http://localhost:3000',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost/overlay_producer',
    identityFile: process.env.PRODUCER_IDENTITY_FILE || './producer_identity.key',
    defaultRegion: process.env.DEFAULT_REGION || 'global',
    maxRevenueSplits: parseInt(process.env.MAX_REVENUE_SPLITS || '10'),
    debug: process.env.DEBUG === 'true'
  };

  const cli = new OverlayProducerCLI(defaultConfig);
  await cli.run();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Application startup failed:', error);
    process.exit(1);
  });
}

export { OverlayProducerCLI, ProducerConfig, ProducerProfile };