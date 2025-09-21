import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { searchManifests, listVersionsByDataset, getParents } from '../db';

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

function parseCursor(s: any): number {
  const n = Number(s);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  // support base64 "offset:<n>"
  if (typeof s === 'string' && s.startsWith('offset:')) {
    const k = Number(s.split(':')[1]);
    if (Number.isFinite(k) && k >= 0) return Math.floor(k);
  }
  return 0;
}

function nextCursor(offset: number, count: number): string | null {
  return count > 0 ? `offset:${offset + count}` : null;
}

export function catalogRouter(): Router {
  const router = makeRouter();

  /**
   * GET /search?q=...&datasetId=...&tag=...&lineage=...&limit=&cursor=
   * - q: free-text-ish
   * - datasetId: exact
   * - tag: parsed from manifest_json.metadata.tags or manifest.tags (array of strings)
   * - lineage: 'parents', 'children', 'leafs' (nodes with no children), 'roots' (nodes with no parents)
   * Paging: limit (default 20, max 100), cursor "offset:<n>"
   */
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const q = req.query.q ? String(req.query.q) : undefined;
      const datasetId = req.query.datasetId ? String(req.query.datasetId) : undefined;
      const tag = req.query.tag ? String(req.query.tag).toLowerCase() : undefined;
      const lineage = req.query.lineage ? String(req.query.lineage).toLowerCase() : undefined;
      const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
      const offset = parseCursor(req.query.cursor);

      // Get results using async PostgreSQL function
      const allRows = await searchManifests(q, limit + offset + 50);

      // Filter by datasetId if specified
      let filteredRows = allRows;
      if (datasetId) {
        filteredRows = allRows.filter(r => r.dataset_id === datasetId);
      }

      // Manual pagination with offset
      const rows = filteredRows.slice(offset, offset + limit);

      // Post-filter by tag if requested (parse manifest_json)
      let filtered = rows.filter((r) => {
        if (!tag) return true;
        try {
          const m = JSON.parse(r.manifest_json || '{}');
          const tags: string[] =
            Array.isArray(m?.metadata?.tags) ? m.metadata.tags :
            Array.isArray(m?.tags) ? m.tags :
            [];
          return tags.map((t) => String(t).toLowerCase()).includes(tag);
        } catch {
          return false;
        }
      });

      // Post-filter by lineage if requested
      if (lineage) {
        const { getParents } = await import('../db');

        // Helper function to get children by querying edges table directly
        async function getChildren(versionId: string): Promise<string[]> {
          const { getHybridDatabase } = await import('../db/hybrid');
          const db = getHybridDatabase();
          const result = await db.pg.query(`
            SELECT child_version_id FROM edges WHERE parent_version_id = $1
          `, [versionId]);
          return result.rows.map((row: any) => row.child_version_id);
        }

        if (lineage === 'leafs') {
          // Filter for nodes that have no children
          const filteredByLineage = [];
          for (const row of filtered) {
            const children = await getChildren(row.version_id);
            if (children.length === 0) {
              filteredByLineage.push(row);
            }
          }
          filtered = filteredByLineage;
        } else if (lineage === 'roots') {
          // Filter for nodes that have no parents
          const filteredByLineage = [];
          for (const row of filtered) {
            const parents = await getParents(row.version_id);
            if (parents.length === 0) {
              filteredByLineage.push(row);
            }
          }
          filtered = filteredByLineage;
        } else if (lineage === 'parents') {
          // Filter for nodes that have children (are parents)
          const filteredByLineage = [];
          for (const row of filtered) {
            const children = await getChildren(row.version_id);
            if (children.length > 0) {
              filteredByLineage.push(row);
            }
          }
          filtered = filteredByLineage;
        } else if (lineage === 'children') {
          // Filter for nodes that have parents (are children)
          const filteredByLineage = [];
          for (const row of filtered) {
            const parents = await getParents(row.version_id);
            if (parents.length > 0) {
              filteredByLineage.push(row);
            }
          }
          filtered = filteredByLineage;
        }
      }

      const items = filtered.map((r) => ({
        versionId: r.version_id,
        datasetId: r.dataset_id,
        title: r.title,
        license: r.license,
        classification: r.classification,
        contentHash: r.content_hash,
        createdAt: r.created_at,
        // tags not extracted here; client can parse manifest if needed
      }));

      return json(res, 200, {
        items,
        limit,
        nextCursor: nextCursor(offset, rows.length),
      });
    } catch (e: any) {
      return json(res, 500, { error: 'search-failed', message: String(e?.message || e) });
    }
  });

  /**
   * GET /resolve?versionId=... | /resolve?datasetId=...&limit=&cursor=
   * - If versionId: return that node + its parents
   * - If datasetId: return paged versions of that dataset with parents per item
   */
  router.get('/resolve', async (req: Request, res: Response) => {
    try {
      const versionId = req.query.versionId ? String(req.query.versionId).toLowerCase() : undefined;
      const datasetId = req.query.datasetId ? String(req.query.datasetId) : undefined;

      if (!versionId && !datasetId) {
        return json(res, 400, { error: 'bad-request', hint: 'provide versionId or datasetId' });
      }

      if (versionId) {
        if (!/^[0-9a-fA-F]{64}$/.test(versionId)) {
          return json(res, 400, { error: 'bad-request', hint: 'versionId=64-hex' });
        }
        const parents = await getParents(versionId);
        return json(res, 200, {
          items: [{ versionId, parents }],
          nextCursor: null,
        });
      }

      // datasetId path
      const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
      const offset = parseCursor(req.query.cursor);
      const versions = await listVersionsByDataset(datasetId!);

      // Manual pagination for versions
      const paginatedVersions = versions.slice(offset, offset + limit);

      const items = await Promise.all(paginatedVersions.map(async (v) => ({
        versionId: v.version_id,
        parents: await getParents(v.version_id),
        createdAt: v.created_at,
        contentHash: v.content_hash,
      })));

      return json(res, 200, {
        items,
        limit,
        nextCursor: nextCursor(offset, paginatedVersions.length),
      });
    } catch (e: any) {
      return json(res, 500, { error: 'resolve-failed', message: String(e?.message || e) });
    }
  });

  return router;
}