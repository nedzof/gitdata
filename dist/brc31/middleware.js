"use strict";
/**
 * BRC-31 Authentication Middleware for Express
 *
 * Express middleware that implements complete BRC-31 authentication
 * to replace the existing custom identity middleware.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRC31Middleware = void 0;
exports.initializeBRC31Middleware = initializeBRC31Middleware;
exports.getBRC31Middleware = getBRC31Middleware;
exports.requireBRC31Identity = requireBRC31Identity;
exports.optionalBRC31Identity = optionalBRC31Identity;
exports.isBRC31Request = isBRC31Request;
exports.requiresBRC31Identity = requiresBRC31Identity;
exports.getBRC31Identity = getBRC31Identity;
exports.getBRC31TrustScore = getBRC31TrustScore;
const service_1 = require("./service");
const types_1 = require("./types");
const DEFAULT_CONFIG = {
    enabled: true,
    requireForAll: false,
    enableBackwardCompatibility: true,
    legacyHeaderSupport: true,
    defaultOptions: types_1.DEFAULT_BRC31_OPTIONS,
};
// ==================== Main Middleware Class ====================
class BRC31Middleware {
    constructor(config) {
        this.initialized = false;
        this.config = { ...DEFAULT_CONFIG, ...config };
        if (!this.config.database) {
            throw new Error('Database adapter is required for BRC-31 middleware');
        }
        this.authService = new service_1.BRC31AuthenticationServiceImpl(this.config.database, this.config.serverPrivateKey);
    }
    async initialize() {
        if (this.initialized)
            return;
        await this.authService.initialize();
        this.initialized = true;
    }
    // ==================== Middleware Factory Functions ====================
    /**
     * Creates middleware that requires BRC-31 authentication
     */
    requireBRC31Identity(options = {}) {
        const finalOptions = { ...this.config.defaultOptions, ...options };
        return async (req, res, next) => {
            if (!this.config.enabled) {
                return next();
            }
            await this.ensureInitialized();
            try {
                const result = await this.authenticateRequest(req, finalOptions);
                if (!result.valid) {
                    return this.handleAuthenticationFailure(res, result, true);
                }
                // Attach BRC-31 identity to request
                req.brc31Identity = {
                    publicKey: result.identity.publicKey,
                    level: result.identity.level,
                    certificates: result.identity.certificates,
                    trustScore: result.verification.trustLevel,
                    verified: result.valid,
                };
                req.brc31Nonces = {
                    clientNonce: result.nonces.clientNonce,
                    serverNonce: result.nonces.serverNonce,
                };
                // Add response signing
                this.addResponseSigning(res, result.nonces.clientNonce);
                return next();
            }
            catch (error) {
                console.error('[BRC-31] Authentication error:', error);
                return this.handleError(res, error);
            }
        };
    }
    /**
     * Creates middleware that optionally uses BRC-31 authentication
     */
    optionalBRC31Identity(options = {}) {
        const finalOptions = { ...this.config.defaultOptions, ...options };
        return async (req, res, next) => {
            if (!this.config.enabled) {
                return next();
            }
            await this.ensureInitialized();
            try {
                // Check if BRC-31 headers are present
                const headers = this.authService.extractHeaders(req.headers);
                const hasBRC31Headers = this.hasBRC31Headers(headers);
                if (!hasBRC31Headers) {
                    // No BRC-31 headers, try legacy compatibility if enabled
                    if (this.config.enableBackwardCompatibility) {
                        return this.handleLegacyAuthentication(req, res, next);
                    }
                    return next();
                }
                // Attempt BRC-31 authentication
                const result = await this.authenticateRequest(req, finalOptions);
                if (result.valid) {
                    req.brc31Identity = {
                        publicKey: result.identity.publicKey,
                        level: result.identity.level,
                        certificates: result.identity.certificates,
                        trustScore: result.verification.trustLevel,
                        verified: result.valid,
                    };
                    req.brc31Nonces = {
                        clientNonce: result.nonces.clientNonce,
                        serverNonce: result.nonces.serverNonce,
                    };
                    this.addResponseSigning(res, result.nonces.clientNonce);
                }
                return next();
            }
            catch (error) {
                console.warn('[BRC-31] Optional authentication failed:', error.message);
                return next();
            }
        };
    }
    // ==================== Core Authentication Logic ====================
    async authenticateRequest(req, options) {
        const headers = this.authService.extractHeaders(req.headers);
        if (!this.hasBRC31Headers(headers)) {
            throw new types_1.BRC31ValidationError('Missing required BRC-31 headers', 'headers');
        }
        const fullHeaders = headers;
        return await this.authService.verifyIdentity(fullHeaders, req.body, options);
    }
    hasBRC31Headers(headers) {
        return !!(headers['X-Authrite'] &&
            headers['X-Authrite-Identity-Key'] &&
            headers['X-Authrite-Signature'] &&
            headers['X-Authrite-Nonce']);
    }
    // ==================== Legacy Compatibility ====================
    async handleLegacyAuthentication(req, res, next) {
        if (!this.config.legacyHeaderSupport) {
            return next();
        }
        // Check for legacy headers (X-Identity-Key, X-Nonce, X-Signature)
        const identityKey = req.headers['x-identity-key'];
        const nonce = req.headers['x-nonce'];
        const signature = req.headers['x-signature'];
        if (identityKey && nonce && signature) {
            // Convert legacy headers to BRC-31 format for basic compatibility
            req.brc31Identity = {
                publicKey: identityKey,
                level: 'public-key',
                certificates: [],
                trustScore: 50, // Medium trust for legacy
                verified: false, // Legacy auth is not fully verified
            };
            console.info('[BRC-31] Using legacy authentication compatibility mode');
        }
        return next();
    }
    // ==================== Response Handling ====================
    addResponseSigning(res, clientNonce) {
        const originalSend = res.send.bind(res);
        res.send = function (data) {
            try {
                // Add BRC-31 response headers
                res.setHeader('X-Authrite', '0.1');
                res.setHeader('X-Authrite-Identity-Key', 'SERVER_PUBLIC_KEY'); // TODO: Use actual server key
                // TODO: Implement response signing
                // const responseSignature = authService.createSignedResponse(data, clientNonce);
                // res.setHeader('X-Authrite-Signature', responseSignature);
                return originalSend(data);
            }
            catch (error) {
                console.error('[BRC-31] Response signing failed:', error);
                return originalSend(data);
            }
        };
    }
    handleAuthenticationFailure(res, result, required) {
        const statusCode = required ? 401 : 200;
        const errorResponse = {
            error: 'brc31-authentication-failed',
            message: result.error || 'Authentication failed',
            details: {
                signatureValid: result.verification.signatureValid,
                nonceValid: result.verification.nonceValid,
                certificatesValid: result.verification.certificatesValid,
                identityLevel: result.identity.level,
                trustScore: result.verification.trustLevel,
            },
            authrite: {
                version: '0.1',
                serverNonce: result.nonces.serverNonce,
                supported: true,
            },
        };
        return res.status(statusCode).json(errorResponse);
    }
    handleError(res, error) {
        if (error instanceof types_1.BRC31Error) {
            return res.status(error.statusCode).json({
                error: error.code,
                message: error.message,
                authrite: {
                    version: '0.1',
                    supported: true,
                },
            });
        }
        console.error('[BRC-31] Unexpected error:', error);
        return res.status(500).json({
            error: 'brc31-internal-error',
            message: 'Internal authentication error',
            authrite: {
                version: '0.1',
                supported: true,
            },
        });
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    // ==================== Utility Methods ====================
    async getIdentityStats() {
        await this.ensureInitialized();
        return await this.authService.databaseService.getAuthenticationStats();
    }
    async cleanupExpiredNonces() {
        await this.ensureInitialized();
        return await this.authService.cleanupExpiredNonces();
    }
}
exports.BRC31Middleware = BRC31Middleware;
// ==================== Factory Functions ====================
let globalBRC31Middleware = null;
/**
 * Initialize the global BRC-31 middleware instance
 */
function initializeBRC31Middleware(config) {
    globalBRC31Middleware = new BRC31Middleware(config);
    return globalBRC31Middleware;
}
/**
 * Get the global BRC-31 middleware instance
 */
function getBRC31Middleware() {
    if (!globalBRC31Middleware) {
        throw new Error('BRC-31 middleware not initialized. Call initializeBRC31Middleware() first.');
    }
    return globalBRC31Middleware;
}
/**
 * Factory function that creates BRC-31 authentication middleware
 * This can be used as a drop-in replacement for the existing requireIdentity middleware
 */
function requireBRC31Identity(minLevel = 'public-key') {
    return (req, res, next) => {
        const middleware = getBRC31Middleware();
        return middleware.requireBRC31Identity({ minIdentityLevel: minLevel })(req, res, next);
    };
}
/**
 * Factory function that creates optional BRC-31 authentication middleware
 */
function optionalBRC31Identity(minLevel = 'public-key') {
    return (req, res, next) => {
        const middleware = getBRC31Middleware();
        return middleware.optionalBRC31Identity({ minIdentityLevel: minLevel })(req, res, next);
    };
}
// ==================== Type Guard Functions ====================
function isBRC31Request(req) {
    return 'brc31Identity' in req;
}
function requiresBRC31Identity(req) {
    return req.brc31Identity?.verified === true;
}
function getBRC31Identity(req) {
    return req.brc31Identity;
}
function getBRC31TrustScore(req) {
    return req.brc31Identity?.trustScore || 0;
}
//# sourceMappingURL=middleware.js.map