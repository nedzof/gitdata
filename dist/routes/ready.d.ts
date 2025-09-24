import type { Router } from 'express';
/**
 * /ready
 * DFS over lineage (depth ≤ BUNDLE_MAX_DEPTH), verify SPV envelope for each node against current headers,
 * enforce min confirmations. No pinning — confirmations are computed live from headers.
 *
 * Response: { ready: boolean, reason?: string, confirmations?: number }
 * - confirmations (if present) is the minimum confirmations across all verified nodes at time of check.
 */
export declare function readyRouter(): Router;
