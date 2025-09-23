// Basic jobs router for testing
import { Router } from 'express';

export function jobsRouter() {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({ items: [], total: 0 });
  });

  router.post('/', (req, res) => {
    res.json({ success: true, jobId: 'test-job-id' });
  });

  return router;
}
