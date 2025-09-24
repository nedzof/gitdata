"use strict";
/**
 * BRC-41 PacketPay HTTP Payment Mechanism Types
 *
 * This module defines all types and interfaces for BRC-41 compliance
 * based on the PacketPay specification for HTTP micropayments.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRC41ServicePricingError = exports.BRC41PaymentExpiredError = exports.BRC41PaymentInvalidError = exports.BRC41PaymentRequiredError = exports.BRC41Error = exports.SERVICE_TYPES = exports.DEFAULT_SERVICE_PRICING = exports.MAX_PAYMENT_SATOSHIS = exports.MIN_PAYMENT_SATOSHIS = exports.PAYMENT_EXPIRY_MS = exports.BRC29_PROTOCOL_ID = exports.BRC41_VERSION = void 0;
// ==================== Constants ====================
exports.BRC41_VERSION = '1.0';
exports.BRC29_PROTOCOL_ID = '3241645161d8';
exports.PAYMENT_EXPIRY_MS = 300000; // 5 minutes
exports.MIN_PAYMENT_SATOSHIS = 1; // Minimum 1 satoshi payment
exports.MAX_PAYMENT_SATOSHIS = 100000000; // Maximum 1 BSV payment
/**
 * Default service pricing configuration
 */
exports.DEFAULT_SERVICE_PRICING = {
    baseFee: 1000, // 1000 satoshis base
    perByteRate: 10, // 10 satoshis per byte
    complexityMultiplier: 1.0,
    priorityMultipliers: {
        low: 0.8,
        normal: 1.0,
        high: 1.5,
    },
    discounts: {
        bulk: 0.9, // 10% bulk discount
        subscriber: 0.8, // 20% subscriber discount
        highTrust: 0.85, // 15% high trust discount
    },
};
/**
 * Service identifiers for different API endpoints
 */
exports.SERVICE_TYPES = {
    BRC24_LOOKUP: 'brc24-lookup',
    BRC24_QUERY: 'brc24-query',
    BRC26_STORE: 'brc26-store',
    BRC26_RETRIEVE: 'brc26-retrieve',
    DATA_SEARCH: 'data-search',
    ANALYTICS: 'analytics',
};
// ==================== Error Types ====================
class BRC41Error extends Error {
    constructor(message, code, statusCode = 402) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'BRC41Error';
    }
}
exports.BRC41Error = BRC41Error;
class BRC41PaymentRequiredError extends BRC41Error {
    constructor(paymentRequest) {
        super('Payment required to access this resource', 'BRC41_PAYMENT_REQUIRED', 402);
        this.paymentRequest = paymentRequest;
    }
}
exports.BRC41PaymentRequiredError = BRC41PaymentRequiredError;
class BRC41PaymentInvalidError extends BRC41Error {
    constructor(message, reason) {
        super(message, 'BRC41_PAYMENT_INVALID', 402);
        this.reason = reason;
    }
}
exports.BRC41PaymentInvalidError = BRC41PaymentInvalidError;
class BRC41PaymentExpiredError extends BRC41Error {
    constructor(paymentId) {
        super('Payment request has expired', 'BRC41_PAYMENT_EXPIRED', 402);
        this.paymentId = paymentId;
    }
}
exports.BRC41PaymentExpiredError = BRC41PaymentExpiredError;
class BRC41ServicePricingError extends BRC41Error {
    constructor(message, service) {
        super(message, 'BRC41_SERVICE_PRICING_ERROR', 500);
        this.service = service;
    }
}
exports.BRC41ServicePricingError = BRC41ServicePricingError;
//# sourceMappingURL=types.js.map