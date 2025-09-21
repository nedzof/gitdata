import type { Request, Response, Router } from 'express';
import { Router as makeRouter } from 'express';
import { listJobs, listJobsByRule } from '../db';

function json(res: Response, code: number, body: any) { return res.status(code).json(body); }

export function jobsRouter(): Router {
  const router = makeRouter();

  // GET / (list jobs)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const state = req.query.state ? String(req.query.state) : undefined;
      const ruleId = req.query.ruleId ? String(req.query.ruleId) : undefined;

      let jobs;
      if (ruleId) {
        jobs = await listJobsByRule(ruleId, state);
      } else {
        jobs = await listJobs(state);
      }

      const formattedJobs = jobs.map(job => ({
        jobId: job.job_id,
        ruleId: job.rule_id,
        targetId: job.target_id,
        state: job.state,
        attempts: job.attempts,
        nextRunAt: job.next_run_at,
        lastError: job.last_error,
        evidence: job.evidence_json ? JSON.parse(job.evidence_json) : null,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      }));

      return json(res, 200, { jobs: formattedJobs });
    } catch (e:any) {
      return json(res, 500, { error: 'list-failed', message: String(e?.message || e) });
    }
  });

  return router;
}