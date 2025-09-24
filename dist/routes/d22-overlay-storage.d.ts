/**
 * D22 - BSV Overlay Network Storage Backend
 * Enhanced Storage API Endpoints with Overlay Integration
 * Provides BRC-26 UHRP compliant storage access and management
 */
import type { WalletClient } from '@bsv/sdk';
import { Router } from 'express';
import { Pool } from 'pg';
export declare function createD22OverlayStorageRoutes(pool: Pool, walletClient: WalletClient): Router;
export default createD22OverlayStorageRoutes;
export declare function d22OverlayStorageRouter(): Router;
