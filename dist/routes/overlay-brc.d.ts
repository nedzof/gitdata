import { Router } from 'express';
import type { GitdataOverlayServices } from '../overlay/index';
export interface EnhancedOverlayRouter {
    router: Router;
    setOverlayServices?: (services: GitdataOverlayServices) => void;
}
export declare function enhancedOverlayRouter(): EnhancedOverlayRouter;
export declare const overlayBrcRouter: typeof enhancedOverlayRouter;
