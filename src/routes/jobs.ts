import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import Database from 'better-sqlite3';
import {
  listJobs,
  getJob,
  type JobRow
} from '../db';
import { rateLimit } from '../middleware/limits';

export function jobsRouter(db: Database.Database): Router {
  const router = makeRouter();

  // Apply rate limiting to all job routes
  router.use(rateLimit('jobs'));

  // GET /jobs - List jobs
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { ruleId, state, limit } = req.query;

      const opts: Parameters<typeof listJobs>[1] = {};

      if (ruleId && typeof ruleId === 'string') {
        opts.ruleId = ruleId.trim();
      }

      if (state && typeof state === 'string') {
        opts.state = state.trim();
      }

      if (limit) {
        const limitNum = parseInt(String(limit));
        if (limitNum > 0 && limitNum <= 100) {
          opts.limit = limitNum;
        }
      }

      const jobs = listJobs(db, opts);

      const results = jobs.map(job => ({
        jobId: job.job_id,
        ruleId: job.rule_id,
        state: job.state,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        retryCount: job.retry_count,
        lastError: job.last_error,
        evidence: job.evidence_json ? JSON.parse(job.evidence_json) : null
      }));

      res.json({ jobs: results });

    } catch (e: any) {
      console.error('List jobs error:', e);
      res.status(500).json({ error: 'list-failed', message: String(e?.message || e) });
    }
  });

  // GET /jobs/:id - Get specific job
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const jobId = req.params.id;

      const job = getJob(db, jobId);
      if (!job) {
        return res.status(404).json({ error: 'job-not-found' });
      }

      res.json({
        jobId: job.job_id,
        ruleId: job.rule_id,
        state: job.state,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        retryCount: job.retry_count,
        lastError: job.last_error,
        evidence: job.evidence_json ? JSON.parse(job.evidence_json) : null
      });

    } catch (e: any) {
      console.error('Get job error:', e);
      res.status(500).json({ error: 'get-failed', message: String(e?.message || e) });
    }
  });

  return router;
}