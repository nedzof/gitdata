#!/usr/bin/env tsx

import { Client } from 'pg';

// Generate realistic hex IDs
function generateHex(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Generate realistic timestamps
function randomTimestamp(daysAgo: number = 30): string {
  const now = Date.now();
  const daysMs = daysAgo * 24 * 60 * 60 * 1000;
  const randomTime = now - Math.random() * daysMs;
  return new Date(randomTime).toISOString();
}

function epochSeconds(daysAgo: number = 30): number {
  const now = Date.now();
  const daysMs = daysAgo * 24 * 60 * 60 * 1000;
  return Math.floor((now - Math.random() * daysMs) / 1000);
}

// Realistic producer data
const producers = [
  { id: 'acme-corp', name: 'ACME Corporation', website: 'https://acme.com', type: 'enterprise' },
  { id: 'data-dynamics', name: 'Data Dynamics Inc', website: 'https://datadynamics.com', type: 'analytics' },
  { id: 'blockchain-solutions', name: 'Blockchain Solutions Ltd', website: 'https://blockchainsolutions.io', type: 'crypto' },
  { id: 'ai-innovations', name: 'AI Innovations Group', website: 'https://aiinnovations.ai', type: 'ai' },
  { id: 'financial-insights', name: 'Financial Insights Corp', website: 'https://fininsights.com', type: 'finance' },
  { id: 'research-institute', name: 'Open Research Institute', website: 'https://openresearch.org', type: 'research' },
  { id: 'climate-data', name: 'Climate Data Collective', website: 'https://climatedata.org', type: 'environmental' },
  { id: 'health-analytics', name: 'Health Analytics Partners', website: 'https://healthanalytics.com', type: 'healthcare' }
];

// Dataset templates with realistic data
const datasetTemplates = [
  // Financial Data
  {
    dataset_id: 'stock-prices-nyse',
    title: 'NYSE Stock Prices Dataset',
    description: 'Comprehensive historical stock price data for all NYSE-listed companies with minute-level granularity. Includes OHLC data, volume, and adjusted prices.',
    tags: ['finance', 'stocks', 'timeseries', 'nyse', 'ohlc'],
    producer: 'financial-insights',
    type: 'data',
    classification: 'public',
    license: 'cc-by-4.0'
  },
  {
    dataset_id: 'crypto-orderbook',
    title: 'Cryptocurrency Order Book Data',
    description: 'Real-time order book snapshots from major cryptocurrency exchanges including depth, spread analysis, and liquidity metrics.',
    tags: ['cryptocurrency', 'orderbook', 'bitcoin', 'ethereum', 'trading'],
    producer: 'blockchain-solutions',
    type: 'data',
    classification: 'commercial',
    license: 'custom'
  },
  {
    dataset_id: 'market-sentiment',
    title: 'Financial Market Sentiment Analysis',
    description: 'Daily sentiment scores derived from social media, news articles, and analyst reports for major market indices and individual stocks.',
    tags: ['sentiment', 'nlp', 'finance', 'analysis', 'social-media'],
    producer: 'ai-innovations',
    type: 'data',
    classification: 'public',
    license: 'mit'
  },

  // Healthcare Data
  {
    dataset_id: 'clinical-trials-outcomes',
    title: 'Clinical Trial Outcomes Database',
    description: 'Anonymized clinical trial results including patient demographics, treatment protocols, outcomes, and adverse events across multiple therapeutic areas.',
    tags: ['healthcare', 'clinical-trials', 'medical', 'outcomes', 'anonymized'],
    producer: 'health-analytics',
    type: 'data',
    classification: 'restricted',
    license: 'custom'
  },
  {
    dataset_id: 'genomic-variants',
    title: 'Population Genomic Variants',
    description: 'Large-scale genomic variant data from diverse populations with associated phenotype information and population frequency data.',
    tags: ['genomics', 'variants', 'population', 'healthcare', 'genetics'],
    producer: 'research-institute',
    type: 'data',
    classification: 'restricted',
    license: 'cc-by-nc-4.0'
  },

  // Climate and Environmental Data
  {
    dataset_id: 'global-temperature',
    title: 'Global Temperature Measurements',
    description: 'Hourly temperature readings from weather stations worldwide spanning the last 50 years, with quality control flags and metadata.',
    tags: ['climate', 'temperature', 'weather', 'global', 'timeseries'],
    producer: 'climate-data',
    type: 'data',
    classification: 'public',
    license: 'cc0'
  },
  {
    dataset_id: 'carbon-emissions',
    title: 'Corporate Carbon Emissions Data',
    description: 'Self-reported and verified carbon emission data from Fortune 500 companies including scope 1, 2, and 3 emissions with methodology notes.',
    tags: ['carbon', 'emissions', 'sustainability', 'corporate', 'esg'],
    producer: 'climate-data',
    type: 'data',
    classification: 'public',
    license: 'cc-by-4.0'
  },

  // Technology and AI Data
  {
    dataset_id: 'software-vulnerabilities',
    title: 'Software Vulnerability Database',
    description: 'Comprehensive database of software vulnerabilities with CVE mappings, severity scores, affected versions, and patch information.',
    tags: ['security', 'vulnerabilities', 'cve', 'software', 'cybersecurity'],
    producer: 'acme-corp',
    type: 'data',
    classification: 'public',
    license: 'cc-by-4.0'
  },
  {
    dataset_id: 'code-repositories',
    title: 'Open Source Code Repository Metrics',
    description: 'Metrics and metadata from millions of open source repositories including commit frequency, contributor patterns, and code quality metrics.',
    tags: ['opensource', 'github', 'code', 'metrics', 'development'],
    producer: 'data-dynamics',
    type: 'data',
    classification: 'public',
    license: 'mit'
  },

  // AI Models
  {
    dataset_id: 'sentiment-classifier-v2',
    title: 'Multi-language Sentiment Classification Model',
    description: 'Transformer-based sentiment classification model supporting 15 languages with 94% accuracy on standardized benchmarks.',
    tags: ['ai', 'nlp', 'sentiment', 'transformer', 'multilingual'],
    producer: 'ai-innovations',
    type: 'ai',
    classification: 'commercial',
    license: 'custom'
  },
  {
    dataset_id: 'fraud-detection-ensemble',
    title: 'Financial Fraud Detection Model',
    description: 'Ensemble model combining gradient boosting and neural networks for real-time fraud detection with 99.7% precision.',
    tags: ['ai', 'fraud-detection', 'ensemble', 'finance', 'realtime'],
    producer: 'financial-insights',
    type: 'ai',
    classification: 'commercial',
    license: 'custom'
  },

  // Recalled/Advisory Data
  {
    dataset_id: 'recalled-medical-devices',
    title: 'Medical Device Recall Database',
    description: 'Database of recalled medical devices with recall reasons, affected lot numbers, and safety classifications.',
    tags: ['medical-devices', 'recalls', 'safety', 'fda', 'healthcare'],
    producer: 'health-analytics',
    type: 'data',
    classification: 'public',
    license: 'cc-by-4.0',
    hasAdvisory: true,
    advisoryType: 'WARN',
    advisoryReason: 'Contains potentially outdated recall information - verify with FDA database'
  },
  {
    dataset_id: 'deprecated-crypto-model',
    title: 'Cryptocurrency Price Prediction Model v1',
    description: 'Legacy machine learning model for cryptocurrency price prediction. This model has been superseded by newer versions.',
    tags: ['ai', 'cryptocurrency', 'prediction', 'deprecated', 'legacy'],
    producer: 'blockchain-solutions',
    type: 'ai',
    classification: 'public',
    license: 'mit',
    hasAdvisory: true,
    advisoryType: 'BLOCK',
    advisoryReason: 'Model contains known biases and should not be used in production'
  },

  // Additional interesting datasets
  {
    dataset_id: 'social-media-trends',
    title: 'Social Media Trending Topics',
    description: 'Real-time trending topics and engagement metrics from major social media platforms with sentiment analysis.',
    tags: ['social-media', 'trends', 'sentiment', 'engagement', 'realtime'],
    producer: 'data-dynamics',
    type: 'data',
    classification: 'commercial',
    license: 'custom'
  },
  {
    dataset_id: 'supply-chain-logistics',
    title: 'Global Supply Chain Logistics Data',
    description: 'Shipping routes, port congestion data, and delivery time predictions for global supply chain optimization.',
    tags: ['logistics', 'supply-chain', 'shipping', 'optimization', 'global'],
    producer: 'acme-corp',
    type: 'data',
    classification: 'commercial',
    license: 'custom'
  },
  {
    dataset_id: 'energy-consumption',
    title: 'Smart Grid Energy Consumption',
    description: 'Hourly energy consumption data from smart meters across residential and commercial properties.',
    tags: ['energy', 'smart-grid', 'consumption', 'residential', 'commercial'],
    producer: 'climate-data',
    type: 'data',
    classification: 'restricted',
    license: 'cc-by-nc-4.0'
  }
];

async function populatePostgreSQLDatabase() {
  console.log('🚀 Starting PostgreSQL database population with realistic dummy data...');

  const client = new Client({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'overlay',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password'
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    console.log('📋 Clearing existing data...');
    // Clear existing data in proper order (respecting foreign key constraints)
    await client.query('DELETE FROM advisory_targets');
    await client.query('DELETE FROM advisories');
    await client.query('DELETE FROM edges');
    await client.query('DELETE FROM price_rules');
    await client.query('DELETE FROM prices');
    await client.query('DELETE FROM manifests');
    await client.query('DELETE FROM declarations');
    await client.query('DELETE FROM producers');

    console.log('👥 Inserting producers...');
    // Insert producers
    for (const producer of producers) {
      await client.query(`
        INSERT INTO producers (producer_id, display_name, website, identity_key, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        producer.id,
        producer.name,
        producer.website,
        generateHex(66), // Mock identity key
        new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000) // Random time in last year
      ]);
    }

    console.log('📊 Inserting datasets and manifests...');
    let parentVersionIds: string[] = [];

    for (const template of datasetTemplates) {
      // Generate multiple versions for some datasets
      const numVersions = Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 2 : 1;

      for (let version = 0; version < numVersions; version++) {
        const versionId = generateHex(64);
        const contentHash = generateHex(64);
        const txid = generateHex(64);
        const createdAt = randomTimestamp(365);
        const epochTime = epochSeconds(365);

        // Create manifest JSON with metadata
        const manifestJson = {
          datasetId: template.dataset_id,
          description: template.description,
          version: version + 1,
          provenance: {
            createdAt,
            issuer: generateHex(66)
          },
          policy: {
            license: template.license,
            classification: template.classification
          },
          content: {
            contentHash,
            mediaType: template.type === 'ai' ? 'application/octet-stream' : 'application/json',
            sizeBytes: Math.floor(Math.random() * 1000000000) + 1024 // 1KB to 1GB
          },
          metadata: {
            tags: template.tags,
            category: template.type,
            producer: template.producer
          }
        };

        // Add lineage for newer versions
        if (version > 0 && parentVersionIds.length > 0) {
          const parentId = parentVersionIds[Math.floor(Math.random() * parentVersionIds.length)];
          manifestJson.parents = [parentId];
          await client.query(
            'INSERT INTO edges (child_version_id, parent_version_id) VALUES ($1, $2)',
            [versionId, parentId]
          );
        }

        // Insert declaration
        await client.query(`
          INSERT INTO declarations (version_id, txid, type, status, created_at, block_hash, height)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          versionId,
          txid,
          'DLM1',
          'confirmed',
          epochTime,
          generateHex(64), // block hash
          Math.floor(Math.random() * 1000000) + 500000 // block height
        ]);

        // Insert manifest
        await client.query(`
          INSERT INTO manifests (version_id, manifest_hash, content_hash, title, license, classification, created_at, manifest_json, dataset_id, producer_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          versionId,
          generateHex(64), // manifest hash
          contentHash,
          template.title + (numVersions > 1 ? ` v${version + 1}` : ''),
          template.license,
          template.classification,
          createdAt,
          JSON.stringify(manifestJson),
          template.dataset_id,
          template.producer
        ]);

        // Insert pricing (varied by type and classification)
        let price = 1000; // Base price in satoshis
        if (template.type === 'ai') price *= 50; // AI models are more expensive
        if (template.classification === 'commercial') price *= 10;
        if (template.classification === 'restricted') price *= 25;

        price += Math.floor(Math.random() * price * 0.5); // Add some variance
        await client.query('INSERT INTO prices (version_id, satoshis) VALUES ($1, $2)', [versionId, price]);

        parentVersionIds.push(versionId);
      }
    }

    console.log('⚠️  Inserting advisories...');
    // Insert advisories for flagged datasets
    for (const template of datasetTemplates) {
      if (template.hasAdvisory) {
        const advisoryId = generateHex(32);
        const createdAt = epochSeconds(30);
        const expiresAt = template.advisoryType === 'BLOCK' ? null : epochSeconds(-30); // WARN advisories expire in 30 days

        await client.query(`
          INSERT INTO advisories (advisory_id, type, reason, created_at, expires_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          advisoryId,
          template.advisoryType,
          template.advisoryReason,
          createdAt,
          expiresAt
        ]);

        // Find all version IDs for this dataset
        const versions = await client.query('SELECT version_id FROM assets WHERE dataset_id = $1', [template.dataset_id]);
        for (const row of versions.rows) {
          await client.query(
            'INSERT INTO advisory_targets (advisory_id, version_id, producer_id) VALUES ($1, $2, $3)',
            [advisoryId, row.version_id, null]
          );
        }
      }
    }

    console.log('💰 Inserting price rules...');
    // Insert some producer-level price rules
    const now = epochSeconds(0);

    // Bulk pricing for some producers
    await client.query(`
      INSERT INTO price_rules (version_id, producer_id, tier_from, satoshis, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [null, 'ai-innovations', 1, 50000, now, now]);

    await client.query(`
      INSERT INTO price_rules (version_id, producer_id, tier_from, satoshis, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [null, 'ai-innovations', 10, 45000, now, now]); // Volume discount

    await client.query(`
      INSERT INTO price_rules (version_id, producer_id, tier_from, satoshis, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [null, 'financial-insights', 1, 25000, now, now]);

    await client.query(`
      INSERT INTO price_rules (version_id, producer_id, tier_from, satoshis, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [null, 'health-analytics', 1, 75000, now, now]); // Premium healthcare data

    // Get final counts
    const producerCount = await client.query('SELECT COUNT(*) as count FROM producers');
    const manifestCount = await client.query('SELECT COUNT(*) as count FROM manifests');
    const advisoryCount = await client.query('SELECT COUNT(*) as count FROM advisories');
    const edgeCount = await client.query('SELECT COUNT(*) as count FROM edges');

    console.log('✅ PostgreSQL database population completed successfully!');
    console.log(`📈 Inserted:`);
    console.log(`   - ${producerCount.rows[0].count} producers`);
    console.log(`   - ${datasetTemplates.length} dataset types`);
    console.log(`   - ${manifestCount.rows[0].count} dataset versions`);
    console.log(`   - ${advisoryCount.rows[0].count} advisories`);
    console.log(`   - ${edgeCount.rows[0].count} lineage relationships`);

  } catch (error) {
    console.error('❌ Error populating PostgreSQL database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  populatePostgreSQLDatabase().catch(console.error);
}

export { populatePostgreSQLDatabase };