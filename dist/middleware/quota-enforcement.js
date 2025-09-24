"use strict";
/**
 * D07 Quota Enforcement Middleware
 * Real-time quota validation and enforcement for streaming requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceBurstQuotas = exports.enforceAgentStreamingQuotas = exports.enforceStreamingQuotas = void 0;
exports.validateQuota = validateQuota;
exports.validateConcurrentStreams = validateConcurrentStreams;
exports.enforceQuotas = enforceQuotas;
const pg_1 = require("pg");
// Database connection
const pool = new pg_1.Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'overlay',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'password',
});
/**
 * Validate quota for a receipt and requested bytes
 */
async function validateQuota(receiptId, requestedBytes = 0, windowType = 'hour') {
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
            return {
                allowed: false,
                quotaStatus: null,
                errorMessage: 'Receipt not found',
            };
        }
        const receipt = receiptResult.rows[0];
        const policy = receipt;
        // Calculate current time window
        const now = new Date();
        let windowStart;
        let windowEnd;
        switch (windowType) {
            case 'hour':
                windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
                windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000); // +1 hour
                break;
            case 'day':
                windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000); // +1 day
                break;
            case 'month':
                windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
                windowEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                break;
        }
        // Get current usage for the window
        const usageQuery = `
      SELECT bytes_used, requests_used, burst_bytes_used
      FROM quota_usage_windows
      WHERE receipt_id = $1 AND window_type = $2
      AND window_start = $3 AND window_end = $4
    `;
        const usageResult = await pool.query(usageQuery, [
            receiptId,
            windowType,
            windowStart,
            windowEnd,
        ]);
        const usage = usageResult.rows[0] || {
            bytes_used: 0,
            requests_used: 0,
            burst_bytes_used: 0,
        };
        // Get quota limits for this window type
        const bytesAllowed = policy[`bytes_per_${windowType}`] || Number.MAX_SAFE_INTEGER;
        const requestsAllowed = policy[`requests_per_${windowType}`] || Number.MAX_SAFE_INTEGER;
        const currentBytesUsed = parseInt(usage.bytes_used) || 0;
        const currentRequestsUsed = parseInt(usage.requests_used) || 0;
        // Check if quota would be exceeded
        if (currentBytesUsed + requestedBytes > bytesAllowed) {
            return {
                allowed: false,
                quotaStatus: {
                    windowType,
                    bytesUsed: currentBytesUsed,
                    bytesAllowed,
                    requestsUsed: currentRequestsUsed,
                    requestsAllowed,
                },
                errorMessage: `${windowType} byte quota exceeded: ${currentBytesUsed + requestedBytes} > ${bytesAllowed}`,
                remainingBytes: Math.max(0, bytesAllowed - currentBytesUsed),
                remainingRequests: Math.max(0, requestsAllowed - currentRequestsUsed),
            };
        }
        if (currentRequestsUsed + 1 > requestsAllowed) {
            return {
                allowed: false,
                quotaStatus: {
                    windowType,
                    bytesUsed: currentBytesUsed,
                    bytesAllowed,
                    requestsUsed: currentRequestsUsed,
                    requestsAllowed,
                },
                errorMessage: `${windowType} request quota exceeded: ${currentRequestsUsed + 1} > ${requestsAllowed}`,
                remainingBytes: Math.max(0, bytesAllowed - currentBytesUsed),
                remainingRequests: Math.max(0, requestsAllowed - currentRequestsUsed),
            };
        }
        return {
            allowed: true,
            quotaStatus: {
                windowType,
                bytesUsed: currentBytesUsed,
                bytesAllowed,
                requestsUsed: currentRequestsUsed,
                requestsAllowed,
                utilizationPercentage: (currentBytesUsed / bytesAllowed) * 100,
            },
            remainingBytes: bytesAllowed - currentBytesUsed,
            remainingRequests: requestsAllowed - currentRequestsUsed,
        };
    }
    catch (error) {
        console.error('Quota validation error:', error);
        return {
            allowed: false,
            quotaStatus: null,
            errorMessage: 'Quota validation failed',
        };
    }
}
/**
 * Check concurrent streaming limits
 */
async function validateConcurrentStreams(receiptId) {
    try {
        // Get max concurrent streams from policy
        const policyQuery = `
      SELECT qp.max_concurrent_streams
      FROM overlay_receipts r
      JOIN quota_policies qp ON r.quota_tier = qp.policy_name
      WHERE r.receipt_id = $1
    `;
        const policyResult = await pool.query(policyQuery, [receiptId]);
        if (policyResult.rows.length === 0) {
            return {
                allowed: false,
                activeStreams: 0,
                maxAllowed: 0,
                errorMessage: 'Receipt or policy not found',
            };
        }
        const maxAllowed = policyResult.rows[0].max_concurrent_streams;
        // Count active streams (no end time)
        const activeQuery = `
      SELECT COUNT(*) as active_count
      FROM streaming_usage
      WHERE receipt_id = $1 AND stream_end_time IS NULL
    `;
        const activeResult = await pool.query(activeQuery, [receiptId]);
        const activeStreams = parseInt(activeResult.rows[0].active_count) || 0;
        if (activeStreams >= maxAllowed) {
            return {
                allowed: false,
                activeStreams,
                maxAllowed,
                errorMessage: `Concurrent stream limit exceeded: ${activeStreams} >= ${maxAllowed}`,
            };
        }
        return {
            allowed: true,
            activeStreams,
            maxAllowed,
        };
    }
    catch (error) {
        console.error('Concurrent stream validation error:', error);
        return {
            allowed: false,
            activeStreams: 0,
            maxAllowed: 0,
            errorMessage: 'Concurrent stream validation failed',
        };
    }
}
/**
 * Express middleware for quota enforcement
 * Checks quotas before allowing streaming requests
 */
function enforceQuotas(options = {}) {
    const { estimatedBytesField = 'estimatedBytes', windowType = 'hour', checkConcurrent = true, } = options;
    return async (req, res, next) => {
        try {
            // Extract receipt ID from various possible sources
            const receiptId = req.body?.receiptId ||
                req.query?.receiptId ||
                req.params?.receiptId ||
                req.headers['x-receipt-id'];
            if (!receiptId) {
                return res.status(400).json({
                    error: 'Receipt ID required',
                    message: 'Provide receiptId in body, query, params, or X-Receipt-Id header',
                });
            }
            // Get estimated bytes from request
            const estimatedBytes = parseInt(req.body?.[estimatedBytesField] || req.query?.[estimatedBytesField] || '0');
            // Validate quota
            const quotaCheck = await validateQuota(receiptId, estimatedBytes, windowType);
            if (!quotaCheck.allowed) {
                return res.status(429).json({
                    error: 'Quota exceeded',
                    message: quotaCheck.errorMessage,
                    quotaStatus: quotaCheck.quotaStatus,
                    remainingBytes: quotaCheck.remainingBytes,
                    remainingRequests: quotaCheck.remainingRequests,
                });
            }
            // Check concurrent streams if enabled
            if (checkConcurrent) {
                const concurrentCheck = await validateConcurrentStreams(receiptId);
                if (!concurrentCheck.allowed) {
                    return res.status(429).json({
                        error: 'Concurrent stream limit exceeded',
                        message: concurrentCheck.errorMessage,
                        activeStreams: concurrentCheck.activeStreams,
                        maxAllowed: concurrentCheck.maxAllowed,
                    });
                }
                // Add concurrent info to response locals for use by route handlers
                res.locals.concurrentInfo = concurrentCheck;
            }
            // Add quota info to response locals for use by route handlers
            res.locals.quotaInfo = quotaCheck;
            res.locals.receiptId = receiptId;
            res.locals.estimatedBytes = estimatedBytes;
            next();
        }
        catch (error) {
            console.error('Quota enforcement middleware error:', error);
            res.status(500).json({
                error: 'Quota enforcement failed',
                message: 'Internal server error during quota validation',
            });
        }
    };
}
/**
 * Middleware specifically for streaming data endpoints
 */
exports.enforceStreamingQuotas = enforceQuotas({
    estimatedBytesField: 'estimatedBytes',
    windowType: 'hour',
    checkConcurrent: true,
});
/**
 * Middleware for agent streaming with relaxed limits
 */
exports.enforceAgentStreamingQuotas = enforceQuotas({
    estimatedBytesField: 'totalContentBytes',
    windowType: 'day',
    checkConcurrent: false,
});
/**
 * Middleware for burst requests with shorter windows
 */
exports.enforceBurstQuotas = enforceQuotas({
    estimatedBytesField: 'requestedBytes',
    windowType: 'hour',
    checkConcurrent: true,
});
exports.default = {
    validateQuota,
    validateConcurrentStreams,
    enforceQuotas,
    enforceStreamingQuotas: exports.enforceStreamingQuotas,
    enforceAgentStreamingQuotas: exports.enforceAgentStreamingQuotas,
    enforceBurstQuotas: exports.enforceBurstQuotas,
};
//# sourceMappingURL=quota-enforcement.js.map