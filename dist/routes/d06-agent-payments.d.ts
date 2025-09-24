/**
 * D06 - Agent Marketplace Payment Integration Routes
 * API endpoints for autonomous agent payment management
 */
import type { Router } from 'express';
import type { Pool } from 'pg';
export declare function d06AgentPaymentsRouter(database: Pool): Router;
