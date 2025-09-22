#!/usr/bin/env npx tsx

import { getHybridDatabase } from '../src/db/hybrid.ts';

interface DatasetChain {
  name: string;
  description: string;
  datasets: {
    versionId: string;
    title: string;
    classification: 'public' | 'internal' | 'restricted';
    tags: string[];
    producer: string;
  }[];
  relationships: {
    parent: string;
    child: string;
    relationshipType: 'derived' | 'processed' | 'enriched' | 'filtered' | 'aggregated';
  }[];
}

const connectedDataChains: DatasetChain[] = [
  {
    name: "Financial Data Pipeline",
    description: "Complete pipeline from raw market data to AI-ready features",
    datasets: [
      {
        versionId: 'f100000000000000000000000000000000000000000000000000000000000001',
        title: 'Raw NYSE Market Feed',
        classification: 'public',
        tags: ['finance', 'raw-data', 'market-feed', 'real-time'],
        producer: 'market-data-corp'
      },
      {
        versionId: 'f100000000000000000000000000000000000000000000000000000000000002',
        title: 'Cleaned Market Data',
        classification: 'public',
        tags: ['finance', 'cleaned', 'processed', 'quality-assured'],
        producer: 'data-quality-systems'
      },
      {
        versionId: 'f100000000000000000000000000000000000000000000000000000000000003',
        title: 'Technical Indicators Dataset',
        classification: 'internal',
        tags: ['finance', 'indicators', 'technical-analysis', 'features'],
        producer: 'quant-analytics'
      },
      {
        versionId: 'f100000000000000000000000000000000000000000000000000000000000004',
        title: 'Risk-Adjusted Returns Model',
        classification: 'restricted',
        tags: ['finance', 'risk', 'models', 'proprietary'],
        producer: 'risk-modeling-ai'
      }
    ],
    relationships: [
      { parent: 'f100000000000000000000000000000000000000000000000000000000000001', child: 'f100000000000000000000000000000000000000000000000000000000000002', relationshipType: 'processed' },
      { parent: 'f100000000000000000000000000000000000000000000000000000000000002', child: 'f100000000000000000000000000000000000000000000000000000000000003', relationshipType: 'enriched' },
      { parent: 'f100000000000000000000000000000000000000000000000000000000000003', child: 'f100000000000000000000000000000000000000000000000000000000000004', relationshipType: 'derived' }
    ]
  },
  {
    name: "Healthcare Research Chain",
    description: "Patient data processing from collection to AI model training",
    datasets: [
      {
        versionId: 'h200000000000000000000000000000000000000000000000000000000000001',
        title: 'Patient Demographics Database',
        classification: 'restricted',
        tags: ['healthcare', 'demographics', 'raw', 'protected'],
        producer: 'health-systems'
      },
      {
        versionId: 'h200000000000000000000000000000000000000000000000000000000000002',
        title: 'Anonymized Patient Records',
        classification: 'internal',
        tags: ['healthcare', 'anonymized', 'privacy-compliant', 'research'],
        producer: 'privacy-tech'
      },
      {
        versionId: 'h200000000000000000000000000000000000000000000000000000000000003',
        title: 'Clinical Features Extract',
        classification: 'internal',
        tags: ['healthcare', 'features', 'clinical', 'ml-ready'],
        producer: 'medical-ai'
      },
      {
        versionId: 'h200000000000000000000000000000000000000000000000000000000000004',
        title: 'Disease Prediction Model Data',
        classification: 'restricted',
        tags: ['healthcare', 'predictions', 'ai-model', 'validated'],
        producer: 'predictive-health'
      }
    ],
    relationships: [
      { parent: 'h200000000000000000000000000000000000000000000000000000000000001', child: 'h200000000000000000000000000000000000000000000000000000000000002', relationshipType: 'processed' },
      { parent: 'h200000000000000000000000000000000000000000000000000000000000002', child: 'h200000000000000000000000000000000000000000000000000000000000003', relationshipType: 'filtered' },
      { parent: 'h200000000000000000000000000000000000000000000000000000000000003', child: 'h200000000000000000000000000000000000000000000000000000000000004', relationshipType: 'derived' }
    ]
  },
  {
    name: "Climate Modeling Pipeline",
    description: "Global temperature data from sensors to climate predictions",
    datasets: [
      {
        versionId: 'c300000000000000000000000000000000000000000000000000000000000001',
        title: 'Global Temperature Sensors',
        classification: 'public',
        tags: ['climate', 'sensors', 'temperature', 'global'],
        producer: 'climate-observatory'
      },
      {
        versionId: 'c300000000000000000000000000000000000000000000000000000000000002',
        title: 'Regional Climate Aggregates',
        classification: 'public',
        tags: ['climate', 'regional', 'aggregated', 'time-series'],
        producer: 'climate-analytics'
      },
      {
        versionId: 'c300000000000000000000000000000000000000000000000000000000000003',
        title: 'Climate Change Indicators',
        classification: 'public',
        tags: ['climate', 'indicators', 'change-detection', 'analysis'],
        producer: 'environmental-science'
      }
    ],
    relationships: [
      { parent: 'c300000000000000000000000000000000000000000000000000000000000001', child: 'c300000000000000000000000000000000000000000000000000000000000002', relationshipType: 'aggregated' },
      { parent: 'c300000000000000000000000000000000000000000000000000000000000002', child: 'c300000000000000000000000000000000000000000000000000000000000003', relationshipType: 'derived' }
    ]
  },
  {
    name: "Multi-Source Research Dataset",
    description: "Cross-domain data integration for comprehensive AI research",
    datasets: [
      {
        versionId: 'm400000000000000000000000000000000000000000000000000000000000001',
        title: 'Integrated Research Dataset',
        classification: 'internal',
        tags: ['research', 'integrated', 'multi-domain', 'comprehensive'],
        producer: 'research-institute'
      }
    ],
    relationships: [
      // This dataset derives from multiple sources across domains
      { parent: 'f100000000000000000000000000000000000000000000000000000000000004', child: 'm400000000000000000000000000000000000000000000000000000000000001', relationshipType: 'derived' },
      { parent: 'h200000000000000000000000000000000000000000000000000000000000003', child: 'm400000000000000000000000000000000000000000000000000000000000001', relationshipType: 'derived' },
      { parent: 'c300000000000000000000000000000000000000000000000000000000000003', child: 'm400000000000000000000000000000000000000000000000000000000000001', relationshipType: 'derived' }
    ]
  },
  {
    name: "Standalone Root Datasets",
    description: "Independent datasets that serve as roots for other chains",
    datasets: [
      {
        versionId: 'r500000000000000000000000000000000000000000000000000000000000001',
        title: 'IoT Sensor Network Data',
        classification: 'public',
        tags: ['iot', 'sensors', 'real-time', 'infrastructure'],
        producer: 'iot-networks'
      },
      {
        versionId: 'r500000000000000000000000000000000000000000000000000000000000002',
        title: 'Social Media Analytics Feed',
        classification: 'public',
        tags: ['social', 'analytics', 'sentiment', 'trends'],
        producer: 'social-insights'
      },
      {
        versionId: 'r500000000000000000000000000000000000000000000000000000000000003',
        title: 'Blockchain Transaction Index',
        classification: 'public',
        tags: ['blockchain', 'transactions', 'index', 'crypto'],
        producer: 'blockchain-analytics'
      }
    ],
    relationships: []
  }
];

async function populateConnectedData() {
  const db = getHybridDatabase();

  console.log('Starting connected data population...');

  try {
    // First, ensure we have the necessary producers
    const producers = [
      'market-data-corp', 'data-quality-systems', 'quant-analytics', 'risk-modeling-ai',
      'health-systems', 'privacy-tech', 'medical-ai', 'predictive-health',
      'climate-observatory', 'climate-analytics', 'environmental-science',
      'research-institute', 'iot-networks', 'social-insights', 'blockchain-analytics'
    ];

    for (const producerId of producers) {
      try {
        await db.pg.query(`
          INSERT INTO producers (producer_id, display_name, website, identity_key, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (producer_id) DO NOTHING
        `, [
          producerId,
          producerId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          `https://${producerId}.com`,
          `identity_key_${producerId}`,
          new Date().toISOString()
        ]);
      } catch (error) {
        console.log(`Producer ${producerId} already exists or error:`, error.message);
      }
    }

    // Insert all datasets
    let totalDatasets = 0;
    for (const chain of connectedDataChains) {
      console.log(`Processing chain: ${chain.name}`);

      for (const dataset of chain.datasets) {
        const manifestJson = {
          version: "1.0",
          title: dataset.title,
          description: `${chain.description} - ${dataset.title}`,
          metadata: {
            tags: dataset.tags,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            producer: dataset.producer,
            classification: dataset.classification
          },
          data: {
            contentHash: dataset.versionId,
            size: Math.floor(Math.random() * 1000000) + 100000,
            format: "parquet"
          }
        };

        try {
          await db.pg.query(`
            INSERT INTO manifests (
              version_id, manifest_hash, content_hash, title, license,
              classification, created_at, manifest_json, dataset_id, producer_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (version_id) DO NOTHING
          `, [
            dataset.versionId,
            dataset.versionId, // Using same as manifest hash for simplicity
            dataset.versionId.replace(/^./, 'c'), // Different content hash
            dataset.title,
            'cc-by-4.0',
            dataset.classification,
            new Date().toISOString(),
            JSON.stringify(manifestJson),
            `dataset-${dataset.versionId.slice(-8)}`,
            dataset.producer
          ]);

          totalDatasets++;
          console.log(`  ✓ Added dataset: ${dataset.title}`);
        } catch (error) {
          console.log(`  ⚠ Dataset ${dataset.title} already exists or error:`, error.message);
        }
      }
    }

    // Insert relationships (edges)
    let totalRelationships = 0;
    for (const chain of connectedDataChains) {
      for (const relationship of chain.relationships) {
        try {
          await db.pg.query(`
            INSERT INTO edges (parent_version_id, child_version_id, relationship_type)
            VALUES ($1, $2, $3)
            ON CONFLICT (parent_version_id, child_version_id) DO NOTHING
          `, [
            relationship.parent,
            relationship.child,
            relationship.relationshipType
          ]);

          totalRelationships++;
          console.log(`  ✓ Added relationship: ${relationship.parent.slice(-8)} → ${relationship.child.slice(-8)} (${relationship.relationshipType})`);
        } catch (error) {
          console.log(`  ⚠ Relationship already exists or error:`, error.message);
        }
      }
    }

    // Add some sample advisories for demonstration
    const advisories = [
      {
        versionId: 'h200000000000000000000000000000000000000000000000000000000000001',
        type: 'privacy-review',
        reason: 'Dataset contains PII - under privacy compliance review'
      },
      {
        versionId: 'f100000000000000000000000000000000000000000000000000000000000004',
        type: 'quality-issue',
        reason: 'Model accuracy below threshold - retraining in progress'
      }
    ];

    for (const advisory of advisories) {
      try {
        await db.pg.query(`
          INSERT INTO advisories (version_id, type, reason, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (version_id, type) DO NOTHING
        `, [
          advisory.versionId,
          advisory.type,
          advisory.reason,
          new Date().toISOString()
        ]);
        console.log(`  ✓ Added advisory for ${advisory.versionId.slice(-8)}: ${advisory.type}`);
      } catch (error) {
        console.log(`  ⚠ Advisory already exists or error:`, error.message);
      }
    }

    console.log('\n📊 Connected Data Population Summary:');
    console.log(`✅ Processed ${connectedDataChains.length} data chains`);
    console.log(`✅ Added ${totalDatasets} connected datasets`);
    console.log(`✅ Created ${totalRelationships} lineage relationships`);
    console.log(`✅ Added ${advisories.length} advisories`);

    // Query final statistics
    const stats = await db.pg.query(`
      SELECT
        (SELECT COUNT(*) FROM manifests) as total_manifests,
        (SELECT COUNT(*) FROM edges) as total_edges,
        (SELECT COUNT(DISTINCT parent_version_id) FROM edges) as total_parents,
        (SELECT COUNT(DISTINCT child_version_id) FROM edges) as total_children,
        (SELECT COUNT(*) FROM manifests m WHERE NOT EXISTS (SELECT 1 FROM edges e WHERE e.parent_version_id = m.version_id)) as leaf_nodes,
        (SELECT COUNT(*) FROM manifests m WHERE NOT EXISTS (SELECT 1 FROM edges e WHERE e.child_version_id = m.version_id)) as root_nodes
    `);

    const s = stats.rows[0];
    console.log('\n📈 Database Statistics:');
    console.log(`📦 Total Datasets: ${s.total_manifests}`);
    console.log(`🔗 Total Relationships: ${s.total_edges}`);
    console.log(`🌱 Root Nodes (no parents): ${s.root_nodes}`);
    console.log(`🍃 Leaf Nodes (no children): ${s.leaf_nodes}`);
    console.log(`👨‍👧‍👦 Parent Nodes: ${s.total_parents}`);
    console.log(`👶 Child Nodes: ${s.total_children}`);

  } catch (error) {
    console.error('Error populating connected data:', error);
    throw error;
  }
}

if (require.main === module) {
  populateConnectedData()
    .then(() => {
      console.log('\n🎉 Connected data population completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to populate connected data:', error);
      process.exit(1);
    });
}

export { populateConnectedData, connectedDataChains };