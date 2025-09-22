// BSV Overlay Integration Entry Point
// Exports all overlay services and utilities

export { BSVOverlayService } from './bsv-overlay-service';
export { OverlayManager } from './overlay-manager';
export { OverlayPaymentService } from './overlay-payments';
export {
  getOverlayConfig,
  D01A_TOPICS,
  TopicGenerator,
  TopicSubscriptionManager,
  TOPIC_CLASSIFICATION
} from './overlay-config';

export type {
  OverlayConfig,
  D01AData,
  OverlayMessage
} from './bsv-overlay-service';

export type {
  OverlayManagerConfig,
  OverlayDataEvent
} from './overlay-manager';

export type {
  PaymentQuote,
  PaymentRequest,
  PaymentReceipt
} from './overlay-payments';

// Main overlay initialization function
import { OverlayManager } from './overlay-manager';
import { OverlayPaymentService } from './overlay-payments';
import { getOverlayConfig } from './overlay-config';
import Database from 'better-sqlite3';

export interface GitdataOverlayServices {
  overlayManager: OverlayManager;
  paymentService: OverlayPaymentService;
}

/**
 * Initialize BSV overlay services for Gitdata
 */
export async function initializeOverlayServices(
  database: Database.Database,
  environment: 'development' | 'staging' | 'production' = 'development'
): Promise<GitdataOverlayServices> {

  // Create overlay manager
  const overlayManager = new OverlayManager({
    environment,
    database,
    autoConnect: true,
    enablePaymentIntegration: true,
    enableSearchIntegration: true
  });

  // Create payment service
  const paymentService = new OverlayPaymentService(overlayManager, database);

  // Initialize overlay manager
  await overlayManager.initialize();

  // Set up cross-service event handling
  setupCrossServiceEvents(overlayManager, paymentService);

  return {
    overlayManager,
    paymentService
  };
}

/**
 * Set up event handling between overlay services
 */
function setupCrossServiceEvents(
  overlayManager: OverlayManager,
  paymentService: OverlayPaymentService
): void {

  // Forward payment events from overlay manager to payment service
  overlayManager.on('payment-data', (event) => {
    paymentService.emit('overlay-payment-message', event);
  });

  // Forward search results that include payment info
  overlayManager.on('search-results', (event) => {
    if (event.results.some((r: any) => r.paymentRequired)) {
      paymentService.emit('payment-required-data', event);
    }
  });

  // Forward manifest publications for payment tracking
  overlayManager.on('manifest-published', (event) => {
    if (event.manifest.policy?.paymentRequired) {
      paymentService.emit('paid-content-published', event);
    }
  });

  // Handle payment confirmations
  paymentService.on('payment-received', (receipt) => {
    overlayManager.emit('payment-confirmed', receipt);
  });

  // Handle payment failures
  paymentService.on('payment-failed', (error) => {
    overlayManager.emit('payment-error', error);
  });
}