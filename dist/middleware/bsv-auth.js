"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BSVAuthService = void 0;
exports.initializeBSVAuth = initializeBSVAuth;
exports.getBSVAuth = getBSVAuth;
const auth_express_middleware_1 = require("@bsv/auth-express-middleware");
const payment_express_middleware_1 = require("@bsv/payment-express-middleware");
class BSVAuthService {
    constructor(config) {
        this.wallet = config.wallet;
        this.enabled = config.enabled !== false; // Default to enabled
        this.monetize = config.monetize || false;
        this.calculateRequestPrice = config.calculateRequestPrice;
    }
    /**
     * Get BSV authentication middleware following CoolCert pattern
     */
    getAuthMiddleware() {
        if (!this.enabled) {
            // Return pass-through middleware if BSV auth is disabled
            return (req, res, next) => {
                next();
            };
        }
        return (0, auth_express_middleware_1.createAuthMiddleware)({
            wallet: this.wallet
        });
    }
    /**
     * Get BSV payment middleware if monetization is enabled
     */
    getPaymentMiddleware() {
        if (!this.enabled || !this.monetize) {
            // Return pass-through middleware if disabled
            return (req, res, next) => {
                next();
            };
        }
        return (0, payment_express_middleware_1.createPaymentMiddleware)({
            wallet: this.wallet,
            calculateRequestPrice: this.calculateRequestPrice || (() => 0)
        });
    }
    /**
     * Get wallet instance
     */
    getWallet() {
        return this.wallet;
    }
    /**
     * Check if authentication is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Validate certificate signing request arguments
     * Following CoolCert pattern
     */
    validateCertificateSigningRequest(args) {
        if (!args.clientNonce) {
            throw new Error('Missing client nonce!');
        }
        if (!args.type) {
            throw new Error('Missing certificate type!');
        }
        if (!args.fields) {
            throw new Error('Missing certificate fields to sign!');
        }
        if (!args.masterKeyring) {
            throw new Error('Missing masterKeyring to decrypt fields!');
        }
    }
}
exports.BSVAuthService = BSVAuthService;
// Export singleton instance for server-wide use
let bsvAuthService = null;
function initializeBSVAuth(config) {
    bsvAuthService = new BSVAuthService(config);
    return bsvAuthService;
}
function getBSVAuth() {
    return bsvAuthService;
}
//# sourceMappingURL=bsv-auth.js.map