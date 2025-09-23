import { describe, test, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { upsertManifest, replaceEdges } from '../../src/db';
import { catalogRouter } from '../../src/routes/catalog';

describe('Catalog Integration Test', () => {
  test('should handle search and resolve operations', async () => {
    // Configure for PostgreSQL database tests
    console.log('Test environment configured for hybrid database tests');
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use(catalogRouter());

    // Insert two versions for dataset "ds-x" with a parent relation
    const datasetId = 'ds-x';
    const vParent = 'b'.repeat(64);
    const vChild = 'a'.repeat(64);

    // Clean up any existing data
    const { getPostgreSQLClient } = await import('../../src/db/postgresql');
    const pgClient = getPostgreSQLClient();
    await pgClient.query('DELETE FROM assets WHERE dataset_id = $1', [datasetId]);
    await pgClient.query('DELETE FROM edges WHERE child_version_id = $1 OR parent_version_id = $1', [vChild]);

    const mParent = {
      type: 'datasetVersionManifest',
      datasetId,
      content: { contentHash: 'c'.repeat(64) },
      metadata: { tags: ['geno', 'omics'] },
      provenance: { createdAt: '2024-05-01T00:00:00Z' },
      policy: { license: 'cc-by-4.0', classification: 'public' },
    };
    const mChild = {
      type: 'datasetVersionManifest',
      datasetId,
      content: { contentHash: 'd'.repeat(64) },
      metadata: { tags: ['tox', 'sim'] },
      provenance: { createdAt: '2024-05-02T00:00:00Z' },
      policy: { license: 'cc-by-4.0', classification: 'public' },
    };

    // Upsert manifests (mimic fields stored in DB)
    await upsertManifest({
      version_id: vParent,
      manifest_hash: vParent,
      content_hash: mParent.content.contentHash,
      title: 'Geno Screener',
      license: 'cc-by-4.0',
      classification: 'public',
      created_at: mParent.provenance.createdAt,
      manifest_json: JSON.stringify(mParent),
      dataset_id: datasetId,
      producer_id: null,
    });
    await upsertManifest({
      version_id: vChild,
      manifest_hash: vChild,
      content_hash: mChild.content.contentHash,
      title: 'Tox Sim',
      license: 'cc-by-4.0',
      classification: 'public',
      created_at: mChild.provenance.createdAt,
      manifest_json: JSON.stringify(mChild),
      dataset_id: datasetId,
      producer_id: null,
    });
    await replaceEdges(vChild, [vParent]);

    // 1) /search by datasetId
    const s1 = await request(app).get(`/search?datasetId=${datasetId}`);
    expect(s1.status).toBe(200);
    expect(s1.body.items.length).toBeGreaterThanOrEqual(2);

    // 2) /search by tag=geno
    const s2 = await request(app).get(`/search?tag=geno`);
    expect(s2.status).toBe(200);
    const tagsHit = s2.body.items.some((it: any) => it.versionId === vParent);
    expect(tagsHit).toBe(true);

    // 3) /search by q free text ("Tox")
    const s3 = await request(app).get(`/search?q=Tox`);
    expect(s3.status).toBe(200);
    const toxHit = s3.body.items.some((it: any) => it.versionId === vChild);
    expect(toxHit).toBe(true);

    // 4) /resolve by versionId returns parents
    const r1 = await request(app).get(`/resolve?versionId=${vChild}`);
    expect(r1.status).toBe(200);
    expect(r1.body.items[0].parents).toEqual([vParent]);

    // 5) /resolve by datasetId returns both with parents
    const r2 = await request(app).get(`/resolve?datasetId=${datasetId}&limit=10`);
    expect(r2.status).toBe(200);
    const ids = r2.body.items.map((x: any) => x.versionId).sort();
    expect(ids).toEqual([vChild, vParent].sort());

    console.log('✅ D18 /search & /resolve tests passed.');
  });
});