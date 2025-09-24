/**
 * D19 Identity Routes: BRC-31 Producer Identity Registration with BRC-100 Wallet Connect
 *
 * Features:
 * - BRC-31 identity registration and verification
 * - BRC-100 compatible wallet connection
 * - Producer capability management
 * - Reputation scoring system
 * - Overlay network integration
 */
import { Router } from 'express';
import type { PostgreSQLClient } from '../db/postgresql';
declare const router: import("express-serve-static-core").Router;
export declare function initializeIdentityRoutes(database: PostgreSQLClient): Router;
export default router;
export declare const identityRouter: () => import("express-serve-static-core").Router;
