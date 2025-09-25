#!/usr/bin/env node

/**
 * BSV Overlay Network Producer CLI (Simplified HTTP API Version)
 *
 * This is a simplified version that uses HTTP API calls instead of direct database connections.
 * Key commands: init, identity setup, register, advertise, publish
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as crypto from 'crypto';
import axios from 'axios';

interface ProducerConfig {
  overlayUrl: string;
  identityFile: string;
  defaultRegion: string;
  debug: boolean;
}

class OverlayProducerCLI {
  private config: ProducerConfig;
  private program: Command;
  private httpClient: any;

  constructor(config: ProducerConfig) {
    this.config = config;
    this.program = new Command();
    this.httpClient = axios.create({
      baseURL: config.overlayUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupCLI();
  }

  private setupCLI(): void {
    this.program
      .name('overlay-producer-cli')
      .description('BSV Overlay Network Producer CLI with HTTP API integration')
      .version('1.0.0')
      .option('--config <file>', 'Configuration file path')
      .option('--debug', 'Enable debug logging');

    // Init command
    this.program
      .command('init')
      .description('Initialize producer - check overlay network connection')
      .option('--generate-key', 'Generate new identity key')
      .option('--register', 'Register with overlay network')
      .action(async (options) => {
        try {
          console.log('🚀 Initializing BSV Overlay Network Producer CLI...');

          // Check overlay network status
          const status = await this.checkOverlayStatus();
          if (!status.connected) {
            console.error('❌ Overlay network not available');
            console.error('Set OVERLAY_ENABLED=true and ensure wallet is connected');
            process.exit(1);
          }

          console.log('✅ Overlay network connection verified');
          console.log(`Environment: ${status.environment}`);
          console.log('🎉 Producer CLI initialized successfully');

          if (options.generateKey || options.register) {
            console.log('\n🔑 Setting up producer identity...');
            await this.setupIdentity(options.generateKey, options.register);
          }

        } catch (error: any) {
          console.error('❌ Initialization failed:', error.message);
          process.exit(1);
        }
      });

    // Identity commands
    const identity = this.program
      .command('identity')
      .description('Producer identity management');

    identity
      .command('setup')
      .description('Setup producer identity')
      .option('--generate-key', 'Generate new identity key')
      .option('--register-overlay', 'Register with overlay network')
      .option('--display-name <name>', 'Producer display name')
      .option('--description <desc>', 'Producer description')
      .action(async (options) => {
        try {
          console.log('🔑 Setting up producer identity...');
          await this.setupIdentity(options.generateKey, options.registerOverlay, {
            displayName: options.displayName,
            description: options.description
          });
        } catch (error: any) {
          console.error('❌ Identity setup failed:', error.message);
          process.exit(1);
        }
      });

    // Register command
    this.program
      .command('register')
      .description('Register producer with overlay network')
      .requiredOption('--name <name>', 'Producer name')
      .requiredOption('--description <desc>', 'Producer description')
      .option('--capabilities <caps>', 'Comma-separated capabilities')
      .option('--regions <regions>', 'Comma-separated regions', this.config.defaultRegion)
      .action(async (options) => {
        try {
          console.log('📝 Registering producer...');

          const capabilities = options.capabilities?.split(',').map((s: string) => s.trim()) || [];
          const regions = options.regions.split(',').map((s: string) => s.trim());

          const identityKey = this.loadIdentityKey();
          const registration = await this.registerProducerIdentity({
            identityKey,
            displayName: options.name,
            description: options.description,
            capabilities,
            regions
          });

          console.log('✅ Producer registered successfully');
          console.log(`Producer ID: ${registration.producerId}`);
          console.log(`Reputation Score: ${registration.reputationScore}`);

        } catch (error: any) {
          console.error('❌ Producer registration failed:', error.message);
          process.exit(1);
        }
      });

    // Publish command
    this.program
      .command('publish')
      .description('Publish content to overlay network')
      .requiredOption('--file <path>', 'File to publish')
      .requiredOption('--title <title>', 'Content title')
      .option('--description <desc>', 'Content description')
      .option('--price <price>', 'Price in satoshis', '1000')
      .action(async (options) => {
        try {
          console.log('📤 Publishing content...');

          if (!fs.existsSync(options.file)) {
            throw new Error(`File not found: ${options.file}`);
          }

          const content = fs.readFileSync(options.file);
          const result = await this.publishContent({
            title: options.title,
            description: options.description || '',
            content,
            price: parseInt(options.price)
          });

          console.log('✅ Content published successfully');
          console.log(`Content ID: ${result.contentId}`);
          console.log(`Message ID: ${result.messageId}`);

        } catch (error: any) {
          console.error('❌ Content publication failed:', error.message);
          process.exit(1);
        }
      });
  }

  private async checkOverlayStatus(): Promise<any> {
    try {
      const response = await this.httpClient.get('/overlay/status');
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to check overlay status: ${error.message}`);
    }
  }

  private async setupIdentity(generateNew: boolean = false, registerOverlay: boolean = false, options: any = {}): Promise<void> {
    let identityKey: string;

    if (generateNew) {
      identityKey = crypto.randomBytes(32).toString('hex');
      console.log('✅ Generated new identity key');

      // Save to file
      fs.writeFileSync(this.config.identityFile, identityKey, { mode: 0o600 });
      console.log(`✅ Identity saved to: ${this.config.identityFile}`);
    } else {
      identityKey = this.loadIdentityKey();
    }

    if (registerOverlay) {
      const registration = await this.registerProducerIdentity({
        identityKey,
        displayName: options.displayName || 'BSV Producer',
        description: options.description || 'BSV Overlay Network Producer',
        capabilities: [],
        regions: [this.config.defaultRegion]
      });

      console.log('✅ Registered with overlay network');
      console.log(`Producer ID: ${registration.producerId}`);
    }

    console.log('✅ Producer identity setup complete');
  }

  private async registerProducerIdentity(data: any): Promise<any> {
    try {
      const registrationData = {
        producerCapabilities: data.capabilities || [],
        overlayTopics: ['DATA_MANIFEST', 'DATASET_COMMERCIAL'],
        geographicRegion: data.regions?.[0] || 'global',
        serviceEndpoints: {},
        walletType: 'cli'
      };

      // Create mock BRC-31 signature
      const nonce = crypto.randomBytes(16).toString('hex');
      const message = JSON.stringify(registrationData) + nonce;
      const signature = crypto.createHash('sha256').update(message).digest('hex');

      const response = await this.httpClient.post('/identity/register', registrationData, {
        headers: {
          'x-brc31-identity-key': data.identityKey,
          'x-brc31-nonce': nonce,
          'x-brc31-signature': signature
        }
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to register producer identity: ${error.response?.data?.message || error.message}`);
    }
  }

  private async publishContent(manifest: any): Promise<any> {
    try {
      const d01aManifest = {
        datasetId: crypto.randomUUID(),
        title: manifest.title,
        description: manifest.description,
        price: manifest.price,
        size: manifest.content.length,
        contentHash: crypto.createHash('sha256').update(manifest.content).digest('hex')
      };

      const response = await this.httpClient.post('/overlay/publish', {
        manifest: d01aManifest
      });

      return {
        contentId: d01aManifest.datasetId,
        messageId: response.data.messageId
      };
    } catch (error: any) {
      throw new Error(`Failed to publish content: ${error.response?.data?.message || error.message}`);
    }
  }

  private loadIdentityKey(): string {
    if (fs.existsSync(this.config.identityFile)) {
      return fs.readFileSync(this.config.identityFile, 'utf8').trim();
    }
    throw new Error(`Identity file not found: ${this.config.identityFile}. Run 'init --generate-key' first.`);
  }

  public async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error: any) {
      console.error('❌ CLI execution failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI Configuration and Startup
async function main(): Promise<void> {
  const defaultConfig: ProducerConfig = {
    overlayUrl: process.env.OVERLAY_URL || 'http://localhost:3000',
    identityFile: process.env.PRODUCER_IDENTITY_FILE || './producer_identity.key',
    defaultRegion: process.env.DEFAULT_REGION || 'global',
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

export { OverlayProducerCLI, ProducerConfig };