import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import { upsertProducer } from '../db';
import { requireIdentity } from '../middleware/identity';

/**
 * POST /producers/register { name?, website? }
 * Requires identity signature; associates identity key with producer profile.
 */
export function producersRegisterRouter(db: Database.Database): Router {
  const router = makeRouter();

  router.post('/producers/register', requireIdentity(true), (req: Request & { identityKey?: string }, res: Response) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
      const website = typeof req.body?.website === 'string' ? req.body.website : undefined;
      const pid = upsertProducer(db, { identity_key: req.identityKey!, name, website });
      return res.status(200).json({ status: 'ok', producerId: pid });
    } catch (e: any) {
      return res.status(500).json({ error: 'register-failed', message: String(e?.message || e) });
    }
  });

  return router;
}