"use strict";
/**
 * D07 BSV Overlay Network Streaming Content Delivery Service
 * Handles webhook-based content delivery with quota enforcement
 */
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
exports.deliverContentToWebhook = deliverContentToWebhook;
exports.createStreamingSubscription = createStreamingSubscription;
exports.handleMarketPurchaseWithStreaming = handleMarketPurchaseWithStreaming;
const crypto = __importStar(require("crypto"));
const pg_1 = require("pg");
// Using built-in fetch (Node.js 18+)
const pool = new pg_1.Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'overlay',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password',
});
/**
 * Validate quota before streaming delivery
 */
async function validateStreamingQuota(receiptId, estimatedBytes) {
    try {
        // Get receipt and quota policy
        const receiptQuery = `
      SELECT r.*, qp.*
      FROM overlay_receipts r
      LEFT JOIN quota_policies qp ON r.quota_tier = qp.policy_name
      WHERE r.receipt_id = $1
    `;
        const receiptResult = await pool.query(receiptQuery, [receiptId]);
        if (receiptResult.rows.length === 0) {
            return { allowed: false, errorMessage: 'Receipt not found' };
        }
        const policy = receiptResult.rows[0];
        // Check hourly quota
        const now = new Date();
        const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
        const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);
        const usageQuery = `
      SELECT bytes_used, requests_used
      FROM quota_usage_windows
      WHERE receipt_id = $1 AND window_type = 'hour'
      AND window_start = $2 AND window_end = $3
    `;
        const usageResult = await pool.query(usageQuery, [receiptId, windowStart, windowEnd]);
        const usage = usageResult.rows[0] || { bytes_used: 0, requests_used: 0 };
        const bytesAllowed = policy.bytes_per_hour || Number.MAX_SAFE_INTEGER;
        const requestsAllowed = policy.requests_per_hour || Number.MAX_SAFE_INTEGER;
        if (parseInt(usage.bytes_used) + estimatedBytes > bytesAllowed) {
            return {
                allowed: false,
                errorMessage: `Hourly quota exceeded: ${usage.bytes_used + estimatedBytes} > ${bytesAllowed} bytes`,
            };
        }
        if (parseInt(usage.requests_used) + 1 > requestsAllowed) {
            return {
                allowed: false,
                errorMessage: `Hourly request quota exceeded: ${usage.requests_used + 1} > ${requestsAllowed}`,
            };
        }
        return { allowed: true };
    }
    catch (error) {
        console.error('Streaming quota validation error:', error);
        return { allowed: false, errorMessage: 'Quota validation failed' };
    }
}
/**
 * Update quota usage after successful delivery
 */
async function updateStreamingQuotaUsage(receiptId, bytesDelivered) {
    const now = new Date();
    const windows = [
        {
            type: 'hour',
            start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()),
        },
        { type: 'day', start: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
        { type: 'month', start: new Date(now.getFullYear(), now.getMonth(), 1) },
    ];
    for (const window of windows) {
        const windowEnd = new Date(window.start);
        if (window.type === 'hour')
            windowEnd.setHours(windowEnd.getHours() + 1);
        else if (window.type === 'day')
            windowEnd.setDate(windowEnd.getDate() + 1);
        else
            windowEnd.setMonth(windowEnd.getMonth() + 1);
        // Get policy ID
        const policyQuery = `
      SELECT qp.id as policy_id
      FROM overlay_receipts r
      JOIN quota_policies qp ON r.quota_tier = qp.policy_name
      WHERE r.receipt_id = $1
    `;
        const policyResult = await pool.query(policyQuery, [receiptId]);
        const policyId = policyResult.rows[0]?.policy_id;
        if (!policyId)
            continue;
        // Upsert usage window
        const upsertQuery = `
      INSERT INTO quota_usage_windows (receipt_id, policy_id, window_type, window_start, window_end, bytes_used, requests_used)
      VALUES ($1, $2, $3, $4, $5, $6, 1)
      ON CONFLICT (receipt_id, window_type, window_start)
      DO UPDATE SET
        bytes_used = quota_usage_windows.bytes_used + $6,
        requests_used = quota_usage_windows.requests_used + 1,
        updated_at = NOW()
    `;
        await pool.query(upsertQuery, [
            receiptId,
            policyId,
            window.type,
            window.start,
            windowEnd,
            bytesDelivered,
        ]);
    }
}
/**
 * Record streaming usage in the database
 */
async function recordStreamingUsage(subscription, result) {
    const sessionId = crypto.randomUUID();
    const streamingQuery = `
    INSERT INTO streaming_usage (
      receipt_id, content_hash, session_id, bytes_streamed,
      delivery_method, source_host, latency_ms, completion_percentage,
      agent_id, stream_start_time, stream_end_time
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
  `;
    await pool.query(streamingQuery, [
        subscription.receiptId,
        subscription.contentHash,
        sessionId,
        result.bytesDelivered,
        'webhook',
        result.hostUsed || 'local',
        result.deliveryTime,
        result.success ? 100.0 : 0.0,
        subscription.agentId,
    ]);
}
/**
 * Deliver content to a webhook with streaming quota enforcement
 */
async function deliverContentToWebhook(subscription, contentData) {
    const startTime = Date.now();
    try {
        // Convert content to buffer if needed
        const contentBuffer = Buffer.isBuffer(contentData) ? contentData : Buffer.from(contentData);
        const contentSize = contentBuffer.length;
        // Validate quota before delivery
        const quotaCheck = await validateStreamingQuota(subscription.receiptId, contentSize);
        if (!quotaCheck.allowed) {
            return {
                success: false,
                bytesDelivered: 0,
                deliveryTime: Date.now() - startTime,
                error: quotaCheck.errorMessage,
            };
        }
        // Prepare webhook payload
        const payload = {
            receiptId: subscription.receiptId,
            contentHash: subscription.contentHash,
            contentSize,
            timestamp: new Date().toISOString(),
            data: contentBuffer.toString('base64'), // Base64 encode for JSON transport
            agentId: subscription.agentId,
            deliveryMethod: 'webhook',
        };
        // Deliver to webhook with proper timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        const response = await fetch(subscription.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Receipt-ID': subscription.receiptId,
                'X-Content-Hash': subscription.contentHash,
                'X-Content-Size': contentSize.toString(),
            },
            body: JSON.stringify(payload),
            signal: controller.signal, // Use signal instead of timeout property
        });
        clearTimeout(timeoutId);
        const deliveryTime = Date.now() - startTime;
        if (!response.ok) {
            throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
        }
        // Update quota usage
        await updateStreamingQuotaUsage(subscription.receiptId, contentSize);
        // Record successful delivery
        const result = {
            success: true,
            bytesDelivered: contentSize,
            deliveryTime,
            hostUsed: 'webhook-delivery',
        };
        await recordStreamingUsage(subscription, result);
        console.log(`✅ Content delivered to webhook: ${contentSize} bytes in ${deliveryTime}ms`);
        return result;
    }
    catch (error) {
        const deliveryTime = Date.now() - startTime;
        console.error('Webhook delivery error:', error);
        const result = {
            success: false,
            bytesDelivered: 0,
            deliveryTime,
            error: error.message,
        };
        await recordStreamingUsage(subscription, result);
        return result;
    }
}
/**
 * Set up streaming subscription for content purchased in market
 */
async function createStreamingSubscription(receiptId, webhookUrl, contentHash, agentId) {
    try {
        // Create agent streaming session
        const sessionQuery = `
      INSERT INTO agent_streaming_sessions (
        agent_id, receipt_id, session_type, quality_requirements,
        session_status
      ) VALUES ($1, $2, 'webhook', '{"deliveryMethod": "webhook"}', 'active')
      RETURNING id
    `;
        const result = await pool.query(sessionQuery, [agentId, receiptId]);
        const sessionId = result.rows[0].id;
        console.log(`📡 Streaming subscription created: ${sessionId} for receipt ${receiptId}`);
        return sessionId;
    }
    catch (error) {
        console.error('Error creating streaming subscription:', error);
        throw error;
    }
}
/**
 * Handle market purchase with streaming integration
 */
async function handleMarketPurchaseWithStreaming(receiptId, versionId, webhookUrl, agentId) {
    try {
        // Get content hash from version
        const versionQuery = `
      SELECT content_hash, data_blob
      FROM manifests
      WHERE version_id = $1
    `;
        const versionResult = await pool.query(versionQuery, [versionId]);
        if (versionResult.rows.length === 0) {
            throw new Error(`Version not found: ${versionId}`);
        }
        const { content_hash, data_blob } = versionResult.rows[0];
        // If webhook URL provided, set up streaming delivery
        if (webhookUrl && agentId) {
            console.log(`🚀 Setting up streaming delivery for agent ${agentId}`);
            const subscription = {
                receiptId,
                webhookUrl,
                agentId,
                contentHash: content_hash,
                deliveryConfig: {
                    chunkSize: 1024 * 1024, // 1MB chunks
                    compressionEnabled: true,
                    maxRetries: 3,
                    retryDelayMs: 1000,
                },
            };
            // Create subscription
            await createStreamingSubscription(receiptId, webhookUrl, content_hash, agentId);
            // Deliver content immediately
            if (data_blob) {
                const deliveryResult = await deliverContentToWebhook(subscription, data_blob);
                if (!deliveryResult.success) {
                    console.error(`❌ Failed to deliver content: ${deliveryResult.error}`);
                }
            }
        }
    }
    catch (error) {
        console.error('Error handling market purchase with streaming:', error);
        throw error;
    }
}
exports.default = {
    deliverContentToWebhook,
    createStreamingSubscription,
    handleMarketPurchaseWithStreaming,
};
//# sourceMappingURL=streaming-delivery.js.map