"use strict";
/**
 * BRC-31 Authrite Mutual Authentication Types
 *
 * This module defines all types and interfaces for complete BRC-31 compliance
 * based on the official specification.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRC31CertificateError = exports.BRC31AuthenticationError = exports.BRC31ValidationError = exports.BRC31Error = exports.DEFAULT_BRC31_OPTIONS = exports.BRC31_SECURITY_LEVEL = exports.BRC31_PROTOCOL_ID = exports.BRC31_VERSION = void 0;
// ==================== Constants ====================
exports.BRC31_VERSION = '0.1';
exports.BRC31_PROTOCOL_ID = 'authrite message signature';
exports.BRC31_SECURITY_LEVEL = 2;
exports.DEFAULT_BRC31_OPTIONS = {
    minIdentityLevel: 'public-key',
    nonceExpiryMs: 300000, // 5 minutes
    maxCertificateAge: 86400000, // 24 hours
    trustedCertifiers: [],
};
// ==================== Error Types ====================
class BRC31Error extends Error {
    constructor(message, code, statusCode = 401) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'BRC31Error';
    }
}
exports.BRC31Error = BRC31Error;
class BRC31ValidationError extends BRC31Error {
    constructor(message, field) {
        super(message, 'BRC31_VALIDATION_ERROR', 400);
        this.field = field;
    }
}
exports.BRC31ValidationError = BRC31ValidationError;
class BRC31AuthenticationError extends BRC31Error {
    constructor(message, reason) {
        super(message, 'BRC31_AUTH_ERROR', 401);
        this.reason = reason;
    }
}
exports.BRC31AuthenticationError = BRC31AuthenticationError;
class BRC31CertificateError extends BRC31Error {
    constructor(message, certificateType) {
        super(message, 'BRC31_CERT_ERROR', 401);
        this.certificateType = certificateType;
    }
}
exports.BRC31CertificateError = BRC31CertificateError;
//# sourceMappingURL=types.js.map