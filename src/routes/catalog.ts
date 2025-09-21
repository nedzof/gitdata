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
   * GET /search?q=...&datasetId=...&tag=...&limit=&cursor=
   * - q: free-text-ish
   * - datasetId: exact
   * - tag: parsed from manifest_json.metadata.tags or manifest.tags (array of strings)
   * Paging: limit (default 20, max 100), cursor "offset:<n>"
   */
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const q = req.query.q ? String(req.query.q) : undefined;
      const datasetId = req.query.datasetId ? String(req.query.datasetId) : undefined;
      const tag = req.query.tag ? String(req.query.tag).toLowerCase() : undefined;
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
      const filtered = rows.filter((r) => {
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