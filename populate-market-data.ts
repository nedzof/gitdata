#!/usr/bin/env npx tsx

/**
 * Market Data Population Script
 *
 * This script populates the manifests table with sample assets to demonstrate
 * the market functionality. It creates realistic BSV Overlay Network assets
 * including research papers, datasets, models, and code packages.
 */

import crypto from 'crypto';

async function generateContentHash(content: string): Promise<string> {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function generateVersionId(): Promise<string> {
  return crypto.randomBytes(32).toString('hex');
}

async function generateDatasetId(): Promise<string> {
  return crypto.randomBytes(16).toString('hex');
}

interface ManifestMetadata {
  title: string;
  description: string;
  tags: string[];
  format: string;
  license: string;
  classification: string;
  category: string;
  producer_id: string;
  price_sat?: number;
  size_bytes?: number;
}

const sampleAssets: ManifestMetadata[] = [
  {
    title: "Analysing the Bitcoin Whitepaper",
    description: "Academic analysis of Bitcoin whitepaper by S. Tominaga AKA CSW. Comprehensive examination of the technical foundations and implications.",
    tags: ["bitcoin", "whitepaper", "analysis", "cryptocurrency", "blockchain", "research"],
    format: "application/pdf",
    license: "CC-BY-4.0",
    classification: "public",
    category: "academic-research",
    producer_id: "producer_academic_001",
    price_sat: 50000,
    size_bytes: 175600
  },
  {
    title: "Global AI Training Dataset - Financial Markets 2024",
    description: "Comprehensive financial market data including stock prices, trading volumes, and market indicators for AI model training.",
    tags: ["ai", "machine-learning", "finance", "dataset", "trading", "markets"],
    format: "application/parquet",
    license: "Commercial",
    classification: "premium",
    category: "dataset",
    producer_id: "producer_fintech_002",
    price_sat: 250000,
    size_bytes: 15728640
  },
  {
    title: "Quantum-Resistant Encryption Implementation",
    description: "Production-ready implementation of post-quantum cryptographic algorithms for secure communication protocols.",
    tags: ["quantum", "cryptography", "security", "encryption", "algorithms", "post-quantum"],
    format: "application/zip",
    license: "MIT",
    classification: "public",
    category: "software",
    producer_id: "producer_crypto_003",
    price_sat: 100000,
    size_bytes: 2097152
  },
  {
    title: "Climate Change Prediction Model - Arctic Region",
    description: "Advanced machine learning model trained on 50 years of Arctic climate data for temperature and ice coverage prediction.",
    tags: ["climate", "machine-learning", "prediction", "arctic", "environmental", "model"],
    format: "application/x-tensorflow",
    license: "Apache-2.0",
    classification: "public",
    category: "ai-model",
    producer_id: "producer_climate_004",
    price_sat: 75000,
    size_bytes: 524288000
  },
  {
    title: "Medical Imaging Dataset - Brain MRI Scans",
    description: "Anonymized collection of 10,000 brain MRI scans with expert annotations for medical AI research and development.",
    tags: ["medical", "imaging", "mri", "brain", "healthcare", "ai", "research"],
    format: "application/dicom",
    license: "CC-BY-NC-SA-4.0",
    classification: "restricted",
    category: "medical-data",
    producer_id: "producer_medical_005",
    price_sat: 500000,
    size_bytes: 1073741824
  },
  {
    title: "Decentralized Social Media Protocol Specification",
    description: "Technical specification and reference implementation for a censorship-resistant social media protocol built on BSV.",
    tags: ["social-media", "protocol", "decentralized", "bsv", "specification", "implementation"],
    format: "text/markdown",
    license: "CC0-1.0",
    classification: "public",
    category: "specification",
    producer_id: "producer_protocol_006",
    price_sat: 25000,
    size_bytes: 102400
  },
  {
    title: "Satellite Earth Observation Data - Europe 2024",
    description: "High-resolution satellite imagery and environmental monitoring data covering Europe for the year 2024.",
    tags: ["satellite", "earth-observation", "imagery", "europe", "environmental", "monitoring"],
    format: "image/geotiff",
    license: "Commercial",
    classification: "premium",
    category: "geospatial",
    producer_id: "producer_satellite_007",
    price_sat: 1000000,
    size_bytes: 5368709120
  },
  {
    title: "Smart Contract Security Audit Framework",
    description: "Automated security audit framework for smart contracts with vulnerability detection and gas optimization suggestions.",
    tags: ["smart-contracts", "security", "audit", "blockchain", "tools", "automation"],
    format: "application/javascript",
    license: "GPL-3.0",
    classification: "public",
    category: "tools",
    producer_id: "producer_security_008",
    price_sat: 150000,
    size_bytes: 10485760
  }
];

async function populateMarketData(): Promise<void> {
  console.log('🚀 Starting market data population...');

  try {
    const { getHybridDatabase } = await import('./src/db/hybrid');
    const db = getHybridDatabase();

    console.log('📊 Database connected successfully');

    // Check if manifests table has data
    const countResult = await db.pg.query('SELECT COUNT(*) FROM manifests');
    const existingCount = parseInt(countResult.rows[0].count);

    console.log(`📋 Found ${existingCount} existing manifests`);

    if (existingCount > 0) {
      console.log('⚠️  Market already has data. Use --force to clear and repopulate.');
      if (!process.argv.includes('--force')) {
        return;
      }

      console.log('🗑️  Clearing existing data...');
      await db.pg.query('DELETE FROM manifests');
      console.log('✅ Existing data cleared');
    }

    console.log(`📦 Creating ${sampleAssets.length} sample assets...`);

    for (let i = 0; i < sampleAssets.length; i++) {
      const asset = sampleAssets[i];
      const versionId = await generateVersionId();
      const datasetId = await generateDatasetId();
      const contentHash = await generateContentHash(asset.title + asset.description);
      const manifestHash = await generateContentHash(JSON.stringify({
        title: asset.title,
        description: asset.description
      }));

      const manifestJson = {
        version: "1.0",
        metadata: {
          title: asset.title,
          description: asset.description,
          tags: asset.tags,
          format: asset.format,
          license: asset.license,
          category: asset.category,
          producer_id: asset.producer_id,
          price_sat: asset.price_sat,
          size_bytes: asset.size_bytes
        }
      };

      await db.pg.query(`
        INSERT INTO manifests (
          version_id,
          dataset_id,
          title,
          license,
          classification,
          content_hash,
          manifest_hash,
          producer_id,
          manifest_json,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        versionId,
        datasetId,
        asset.title,
        asset.license,
        asset.classification,
        contentHash,
        manifestHash,
        null, // producer_id - set to null to avoid foreign key constraint
        JSON.stringify(manifestJson)
      ]);

      console.log(`✅ Created asset ${i + 1}/${sampleAssets.length}: "${asset.title}"`);
    }

    // Verify the data was inserted
    const finalCount = await db.pg.query('SELECT COUNT(*) FROM manifests');
    const newCount = parseInt(finalCount.rows[0].count);

    console.log(`\n🎉 Market population completed successfully!`);
    console.log(`📈 Total assets in market: ${newCount}`);
    console.log(`🌐 BSV Overlay Network marketplace is now ready for testing`);

    // Show some sample data
    const samples = await db.pg.query(`
      SELECT title, classification, producer_id, created_at
      FROM manifests
      ORDER BY created_at DESC
      LIMIT 3
    `);

    console.log('\n📋 Sample assets created:');
    samples.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.title} (${row.classification}) by ${row.producer_id}`);
    });

  } catch (error) {
    console.error('❌ Failed to populate market data:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  populateMarketData();
}