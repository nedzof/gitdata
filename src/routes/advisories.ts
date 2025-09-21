import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import type { AdvisoryRow } from '../db';
import {
  insertAdvisory,
  insertAdvisoryTargets,
} from '../db';
import { initAdvisoryValidator, validateAdvisory } from '../validators/advisory';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function advisoriesRouter(): Router {
  const router = makeRouter();
  initAdvisoryValidator();

  // POST /advisories
  // Body: { type:'BLOCK'|'WARN', reason:string, expiresAt?:number, payload?:object, targets:{ versionIds?:string[], producerIds?:string[] } }
  router.post('/advisories', async (req: Request, res: Response) => {
    try {

      const { type, reason, expiresAt, payload, targets } = req.body || {};
      if (type !== 'BLOCK' && type !== 'WARN') return json(res, 400, { error: 'bad-request', hint: 'type must be BLOCK or WARN' });
      if (typeof reason !== 'string' || reason.length < 3) return json(res, 400, { error: 'bad-request', hint: 'reason required' });
      const advisoryId = 'adv_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
      const now = Math.floor(Date.now() / 1000);

      const doc = {
        advisoryId,
        type,
        reason,
        createdAt: now,
        ...(typeof expiresAt === 'number' ? { expiresAt } : {}),
        ...(payload && typeof payload === 'object' ? { payload } : {}),
      };
      const v = validateAdvisory(doc);
      if (!v.ok) return json(res, 422, { error: 'schema-validation-failed', details: v.errors });

      const advRow: AdvisoryRow = {
        advisory_id: advisoryId,
        type,
        reason,
        created_at: now,
        expires_at: typeof expiresAt === 'number' ? Number(expiresAt) : null,
        payload_json: payload ? JSON.stringify(payload) : null,
      };

      const tgtList: { version_id?: string | null; producer_id?: string | null }[] = [];
      if (targets && typeof targets === 'object') {
        const vIds: string[] = Array.isArray(targets.versionIds) ? targets.versionIds : [];
        for (const vId of vIds) {
          if (/^[0-9a-fA-F]{64}$/.test(String(vId || ''))) tgtList.push({ version_id: String(vId).toLowerCase(), producer_id: null });
        }
        const pIds: string[] = Array.isArray(targets.producerIds) ? targets.producerIds : [];
        for (const pId of pIds) {
          if (typeof pId === 'string' && pId.length > 2) tgtList.push({ version_id: null, producer_id: pId });
        }
      }
      if (tgtList.length === 0) return json(res, 400, { error: 'bad-request', hint: 'at least one target (versionIds or producerIds) required' });

      // Use PostgreSQL only
      await insertAdvisory(advRow);
      await insertAdvisoryTargets(advisoryId, tgtList);
      return json(res, 200, { status: 'ok', advisoryId });
    } catch (e: any) {
      console.error('[advisories POST] Error details:', e);
      return json(res, 500, { error: 'advisory-create-failed', message: String(e?.message || e), stack: e?.stack });
    }
  });

  // GET /advisories?versionId=... | /advisories?producerId=...
  router.get('/advisories', async (req: Request, res: Response) => {

    const versionId = req.query.versionId ? String(req.query.versionId).toLowerCase() : undefined;
    const producerId = req.query.producerId ? String(req.query.producerId) : undefined;
    const now = Math.floor(Date.now() / 1000);
    if (!versionId && !producerId) return json(res, 400, { error: 'bad-request', hint: 'versionId or producerId required' });

    try {
      let list: AdvisoryRow[] = [];

      // Use PostgreSQL only
      const { listAdvisoriesForVersionActiveAsync, listAdvisoriesForProducerActiveAsync, getProducerIdForVersionAsync } = await import('../db');

      if (versionId) {
        console.log(`[advisories GET] Looking for advisories for versionId: ${versionId}, now: ${now}`);
        list = await listAdvisoriesForVersionActiveAsync(versionId, now);
        console.log(`[advisories GET] Found ${list.length} version-scoped advisories`);

        // Also check producer-scoped advisories for this version's producer
        const pid = await getProducerIdForVersionAsync(versionId);
        console.log(`[advisories GET] Producer ID for version: ${pid}`);
        if (pid) {
          const producerAdvs = await listAdvisoriesForProducerActiveAsync(pid, now);
          console.log(`[advisories GET] Found ${producerAdvs.length} producer-scoped advisories`);
          list = list.concat(producerAdvs);
        }
      }
      if (producerId) {
        const producerAdvs = await listAdvisoriesForProducerActiveAsync(producerId, now);
        list = list.concat(producerAdvs);
      }

      // De-dupe by advisory_id
      const map = new Map<string, AdvisoryRow>();
      for (const a of list) map.set(a.advisory_id, a);
      const out = Array.from(map.values()).map((a) => ({
        advisoryId: a.advisory_id,
        type: a.type,
        reason: a.reason,
        createdAt: a.created_at,
        expiresAt: a.expires_at ?? undefined,
        payload: a.payload_json ? JSON.parse(a.payload_json) : undefined,
      }));
      return json(res, 200, { items: out });
    } catch (e: any) {
      return json(res, 500, { error: 'advisories-fetch-failed', message: String(e?.message || e) });
    }
  });

  return router;
}