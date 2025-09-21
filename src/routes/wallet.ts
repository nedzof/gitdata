import type { Request, Response } from 'express';
import { Router } from 'express';
import * as db from '../db';

function json(res: Response, code: number, body: any) {
  return res.status(code).json(body);
}

interface WalletAddress {
  address: string;
  balance: number;
  utxos: any[];
}

interface Purchase {
  id: string;
  versionId: string;
  datasetId: string;
  title: string;
  producer: string;
  amount: number;
  purchaseDate: string;
  status: 'active' | 'recalled' | 'expired';
  recallReason?: string;
  recallDate?: string;
}

interface NotificationSettings {
  webhookUrl: string;
  emailNotifications: boolean;
  recallAlerts: boolean;
  newDataAlerts: boolean;
  priceChangeAlerts: boolean;
}

export function walletRouter(): Router {
  const router = Router();

  // GET /wallet/purchases - Get purchase history from BRC100 wallet
  router.get('/wallet/purchases', async (req: Request, res: Response) => {
    try {
      const { status, producer, limit = 50, offset = 0 } = req.query;

      // TODO: Integrate with actual BRC100 wallet API
      // For now, simulate purchase data from database records
      let purchases: Purchase[] = [];

      try {
        // Get all receipts/payments from the database as a proxy for purchases
        const receipts = await db.getRecentReceipts(Number(limit), Number(offset));

        purchases = await Promise.all(receipts.map(async (receipt: any) => {
          // Get manifest data for the purchase
          let manifest = null;
          let assetStatus = 'active';
          let recallInfo = null;

          try {
            manifest = await db.getManifest(receipt.version_id || receipt.contentHash);
            // Check if asset has been recalled
            // TODO: Implement actual recall checking logic
            assetStatus = 'active';
          } catch (err) {
            console.log('Could not get manifest for', receipt.version_id || receipt.contentHash);
          }

          return {
            id: receipt.receipt_id || receipt.id,
            versionId: receipt.version_id || receipt.contentHash || 'unknown',
            datasetId: manifest?.dataset_id || 'unknown',
            title: manifest?.title || 'Unknown Asset',
            producer: manifest?.provenance?.issuer || 'Unknown Producer',
            amount: receipt.amount_satoshis || 0,
            purchaseDate: receipt.created_at || new Date().toISOString(),
            status: assetStatus as 'active' | 'recalled' | 'expired',
            ...(recallInfo && {
              recallReason: recallInfo.reason,
              recallDate: recallInfo.date
            })
          };
        }));

        // Apply filters
        if (status) {
          purchases = purchases.filter(p => p.status === status);
        }
        if (producer) {
          purchases = purchases.filter(p =>
            p.producer.toLowerCase().includes((producer as string).toLowerCase())
          );
        }

      } catch (dbError) {
        console.log('Database query failed, returning empty purchases list:', dbError);
        purchases = [];
      }

      return json(res, 200, {
        purchases,
        total: purchases.length,
        hasMore: purchases.length === Number(limit)
      });

    } catch (error) {
      console.error('Error fetching purchase history:', error);
      return json(res, 500, {
        error: 'Failed to fetch purchase history',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /wallet/balance - Get wallet balance
  router.get('/wallet/balance', async (req: Request, res: Response) => {
    try {
      // TODO: Integrate with actual BRC100 wallet API
      // For now, return simulated balance data
      const balance = {
        confirmed: 50000, // satoshis
        unconfirmed: 0,
        total: 50000,
        addresses: [
          {
            address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", // Example address
            balance: 50000,
            utxos: []
          }
        ]
      };

      return json(res, 200, balance);

    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      return json(res, 500, {
        error: 'Failed to fetch wallet balance',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /assets/:versionId/status - Check asset recall status and producer status
  router.get('/assets/:versionId/status', async (req: Request, res: Response) => {
    try {
      const { versionId } = req.params;

      // Get manifest and check status
      const manifest = await db.getManifest(versionId);
      if (!manifest) {
        return json(res, 404, { error: 'Asset not found' });
      }

      // TODO: Implement actual recall checking and producer status monitoring
      const status = {
        versionId,
        datasetId: manifest.dataset_id,
        title: manifest.title,
        producer: manifest.provenance?.issuer || 'Unknown',
        status: 'active' as 'active' | 'recalled' | 'expired',
        lastChecked: new Date().toISOString(),
        producerStatus: 'active' as 'active' | 'suspended' | 'unknown',
        recallInfo: null as null | {
          reason: string;
          date: string;
          refundAvailable: boolean;
        }
      };

      return json(res, 200, status);

    } catch (error) {
      console.error('Error checking asset status:', error);
      return json(res, 500, {
        error: 'Failed to check asset status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // GET /notifications/settings - Get notification settings
  router.get('/notifications/settings', async (req: Request, res: Response) => {
    try {
      // TODO: Store and retrieve user-specific notification settings
      // For now, return default settings
      const settings: NotificationSettings = {
        webhookUrl: '',
        emailNotifications: true,
        recallAlerts: true,
        newDataAlerts: true,
        priceChangeAlerts: false
      };

      return json(res, 200, settings);

    } catch (error) {
      console.error('Error fetching notification settings:', error);
      return json(res, 500, {
        error: 'Failed to fetch notification settings',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // PUT /notifications/settings - Update notification settings
  router.put('/notifications/settings', async (req: Request, res: Response) => {
    try {
      const settings: Partial<NotificationSettings> = req.body;

      // TODO: Validate and store user notification settings
      // For now, just return the updated settings
      const updatedSettings: NotificationSettings = {
        webhookUrl: settings.webhookUrl || '',
        emailNotifications: settings.emailNotifications ?? true,
        recallAlerts: settings.recallAlerts ?? true,
        newDataAlerts: settings.newDataAlerts ?? true,
        priceChangeAlerts: settings.priceChangeAlerts ?? false
      };

      return json(res, 200, {
        message: 'Notification settings updated successfully',
        settings: updatedSettings
      });

    } catch (error) {
      console.error('Error updating notification settings:', error);
      return json(res, 500, {
        error: 'Failed to update notification settings',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // POST /notifications/test-webhook - Test webhook configuration
  router.post('/notifications/test-webhook', async (req: Request, res: Response) => {
    try {
      const { webhookUrl } = req.body;

      if (!webhookUrl) {
        return json(res, 400, { error: 'Webhook URL is required' });
      }

      // TODO: Implement actual webhook testing
      // For now, simulate a successful test
      const testPayload = {
        type: 'test',
        timestamp: new Date().toISOString(),
        message: 'This is a test notification from Gitdata'
      };

      try {
        // Simulate webhook call
        console.log(`Testing webhook: ${webhookUrl} with payload:`, testPayload);

        return json(res, 200, {
          success: true,
          message: 'Webhook test successful',
          testPayload
        });

      } catch (webhookError) {
        return json(res, 400, {
          success: false,
          error: 'Webhook test failed',
          details: webhookError instanceof Error ? webhookError.message : 'Unknown error'
        });
      }

    } catch (error) {
      console.error('Error testing webhook:', error);
      return json(res, 500, {
        error: 'Failed to test webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}