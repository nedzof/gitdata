import type { Router } from 'express';
/**
 * Producers API
 * - GET /producers/:id
 * - GET /producers?datasetId=...  (resolve mapping)
 * - (Optional) GET /producers?q=... (basic search by name, requires additional DB helper; omitted in MVP)
 */
export declare function producersRouter(): Router;
