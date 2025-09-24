/**
 * Enhanced BSV Overlay API Routes with Full BRC-31 Authentication
 *
 * Updated overlay routes that use BRC-31 authentication for all endpoints,
 * with backward compatibility for existing clients.
 */
import { Router } from 'express';
import type { GitdataOverlayServices } from '../overlay/index';
export interface EnhancedBRC31OverlayRouter {
    router: Router;
    setOverlayServices?: (services: GitdataOverlayServices) => void;
}
export declare function enhancedBRC31OverlayRouter(): EnhancedBRC31OverlayRouter;
export declare const overlayBrc31Router: typeof enhancedBRC31OverlayRouter;
