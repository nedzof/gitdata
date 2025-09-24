"use strict";
// BRC-100 Wallet Interface TypeScript Definitions
// Based on D01B-brc100.md specification
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletError = void 0;
// Wallet detection and access utilities
class WalletError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'WalletError';
    }
}
exports.WalletError = WalletError;
//# sourceMappingURL=brc100-types.js.map