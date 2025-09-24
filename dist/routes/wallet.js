"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletRouter = walletRouter;
const express_1 = require("express");
const db = __importStar(require("../db"));
function json(res, code, body) {
    return res.status(code).json(body);
}
function walletRouter() {
    const router = (0, express_1.Router)();
    // GET /wallet/purchases - Get purchase history from BRC100 wallet
    router.get('/wallet/purchases', async (req, res) => {
        try {
            const { status, producer, limit = 50, offset = 0 } = req.query;
            // TODO: Integrate with actual BRC100 wallet API
            // For now, simulate purchase data from database records
            let purchases = [];
            try {
                // Get all receipts/payments from the database as a proxy for purchases
                const receipts = await db.getRecentReceipts(Number(limit), Number(offset));
                purchases = await Promise.all(receipts.map(async (receipt) => {
                    // Get manifest data for the purchase
                    let manifest = null;
                    let assetStatus = 'active';
                    let recallInfo = null;
                    try {
                        manifest = await db.getManifest(receipt.version_id || receipt.contentHash);
                        // Check if asset has been recalled
                        // TODO: Implement actual recall checking logic
                        assetStatus = 'active';
                    }
                    catch (err) {
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
                        status: assetStatus,
                        ...(recallInfo && {
                            recallReason: recallInfo.reason,
                            recallDate: recallInfo.date,
                        }),
                    };
                }));
                // Apply filters
                if (status) {
                    purchases = purchases.filter((p) => p.status === status);
                }
                if (producer) {
                    purchases = purchases.filter((p) => p.producer.toLowerCase().includes(producer.toLowerCase()));
                }
            }
            catch (dbError) {
                console.log('Database query failed, returning empty purchases list:', dbError);
                purchases = [];
            }
            return json(res, 200, {
                purchases,
                total: purchases.length,
                hasMore: purchases.length === Number(limit),
            });
        }
        catch (error) {
            console.error('Error fetching purchase history:', error);
            return json(res, 500, {
                error: 'Failed to fetch purchase history',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
    // GET /wallet/balance - Get wallet balance
    router.get('/wallet/balance', async (req, res) => {
        try {
            // TODO: Integrate with actual BRC100 wallet API
            // For now, return simulated balance data
            const balance = {
                confirmed: 50000, // satoshis
                unconfirmed: 0,
                total: 50000,
                addresses: [
                    {
                        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // Example address
                        balance: 50000,
                        utxos: [],
                    },
                ],
            };
            return json(res, 200, balance);
        }
        catch (error) {
            console.error('Error fetching wallet balance:', error);
            return json(res, 500, {
                error: 'Failed to fetch wallet balance',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
    // GET /assets/:versionId/status - Check asset recall status and producer status
    router.get('/assets/:versionId/status', async (req, res) => {
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
                status: 'active',
                lastChecked: new Date().toISOString(),
                producerStatus: 'active',
                recallInfo: null,
            };
            return json(res, 200, status);
        }
        catch (error) {
            console.error('Error checking asset status:', error);
            return json(res, 500, {
                error: 'Failed to check asset status',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
    // GET /notifications/settings - Get notification settings
    router.get('/notifications/settings', async (req, res) => {
        try {
            // TODO: Store and retrieve user-specific notification settings
            // For now, return default settings
            const settings = {
                webhookUrl: '',
                emailNotifications: true,
                recallAlerts: true,
                newDataAlerts: true,
                priceChangeAlerts: false,
            };
            return json(res, 200, settings);
        }
        catch (error) {
            console.error('Error fetching notification settings:', error);
            return json(res, 500, {
                error: 'Failed to fetch notification settings',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
    // PUT /notifications/settings - Update notification settings
    router.put('/notifications/settings', async (req, res) => {
        try {
            const settings = req.body;
            // TODO: Validate and store user notification settings
            // For now, just return the updated settings
            const updatedSettings = {
                webhookUrl: settings.webhookUrl || '',
                emailNotifications: settings.emailNotifications ?? true,
                recallAlerts: settings.recallAlerts ?? true,
                newDataAlerts: settings.newDataAlerts ?? true,
                priceChangeAlerts: settings.priceChangeAlerts ?? false,
            };
            return json(res, 200, {
                message: 'Notification settings updated successfully',
                settings: updatedSettings,
            });
        }
        catch (error) {
            console.error('Error updating notification settings:', error);
            return json(res, 500, {
                error: 'Failed to update notification settings',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
    // POST /notifications/test-webhook - Test webhook configuration
    router.post('/notifications/test-webhook', async (req, res) => {
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
                message: 'This is a test notification from Gitdata',
            };
            try {
                // Simulate webhook call
                console.log(`Testing webhook: ${webhookUrl} with payload:`, testPayload);
                return json(res, 200, {
                    success: true,
                    message: 'Webhook test successful',
                    testPayload,
                });
            }
            catch (webhookError) {
                return json(res, 400, {
                    success: false,
                    error: 'Webhook test failed',
                    details: webhookError instanceof Error ? webhookError.message : 'Unknown error',
                });
            }
        }
        catch (error) {
            console.error('Error testing webhook:', error);
            return json(res, 500, {
                error: 'Failed to test webhook',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
    return router;
}
//# sourceMappingURL=wallet.js.map