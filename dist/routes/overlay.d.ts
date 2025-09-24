import { Router } from 'express';
import type { OverlayManager } from '../overlay/overlay-manager';
import type { OverlayPaymentService } from '../overlay/overlay-payments';
export interface OverlayRouter {
    router: Router;
    setOverlayServices?: (manager: OverlayManager, paymentService: OverlayPaymentService) => void;
}
export declare function overlayRouter(): OverlayRouter;
