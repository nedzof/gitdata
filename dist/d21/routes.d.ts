/**
 * D21 BSV Native Payment Extensions Routes
 *
 * Express routes that extend BRC-41 with native BSV infrastructure:
 * - Payment templates with deterministic revenue splits
 * - ARC broadcasting with comprehensive lifecycle tracking
 * - Cross-network settlement coordination
 * - AI agent payment workflows
 */
import { Router } from 'express';
import { type BRC31Request } from '../brc31/middleware.js';
import type { DatabaseAdapter } from '../overlay/brc26-uhrp.js';
import D21PaymentTemplateServiceImpl from './template-service.js';
import D21ARCBroadcastServiceImpl from './arc-service.js';
export interface D21Request extends BRC31Request {
    d21?: {
        templateService: D21PaymentTemplateServiceImpl;
        arcService: D21ARCBroadcastServiceImpl;
    };
}
export default function createD21Routes(database: DatabaseAdapter, callbackBaseUrl?: string): Router;
/**
 * Integration with BRC-41 payment system
 */
export declare function integrateBRC41Payments(d21Router: Router, brc41PaymentService: any): void;
