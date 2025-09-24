/**
 * Phase 5: Advanced Features API Routes
 *
 * Provides HTTP endpoints for federation management, live streaming,
 * and advanced overlay network capabilities.
 */
import { Router } from 'express';
import type { FederationManager } from '../overlay/federation-manager';
import type { AdvancedStreamingService } from '../streaming/advanced-streaming-service';
export interface Phase5Router {
    router: Router;
    setAdvancedServices?: (services: {
        federationManager?: FederationManager;
        advancedStreamingService?: AdvancedStreamingService;
    }) => void;
}
export declare function phase5AdvancedRouter(): Phase5Router;
