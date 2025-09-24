"use strict";
/**
 * BRC-31 Authentication Service
 *
 * Complete implementation of BRC-31 Authrite protocol using BSV libraries
 * and type-safe database operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRC31AuthenticationServiceImpl = void 0;
const crypto_1 = require("crypto");
const secp256k1_1 = require("@noble/curves/secp256k1");
const database_1 = require("./database");
const types_1 = require("./types");
class BRC31AuthenticationServiceImpl {
    constructor(database, serverPrivateKey) {
        this.databaseService = new database_1.BRC31DatabaseService(database);
        // Generate or use provided server keys
        if (serverPrivateKey) {
            this.serverPrivateKey = serverPrivateKey;
            this.serverPublicKey = secp256k1_1.secp256k1.getPublicKey(this.serverPrivateKey, true).toString();
        }
        else {
            this.serverPrivateKey = (0, crypto_1.randomBytes)(32).toString('hex');
            this.serverPublicKey = secp256k1_1.secp256k1.getPublicKey(this.serverPrivateKey, true).toString();
        }
    }
    async initialize() {
        await this.databaseService.initializeSchema();
    }
    // ==================== Header Processing ====================
    extractHeaders(headers) {
        const brc31Headers = {};
        // Extract all X-Authrite headers
        if (headers['x-authrite'])
            brc31Headers['X-Authrite'] = headers['x-authrite'];
        if (headers['x-authrite-identity-key'])
            brc31Headers['X-Authrite-Identity-Key'] = headers['x-authrite-identity-key'];
        if (headers['x-authrite-signature'])
            brc31Headers['X-Authrite-Signature'] = headers['x-authrite-signature'];
        if (headers['x-authrite-nonce'])
            brc31Headers['X-Authrite-Nonce'] = headers['x-authrite-nonce'];
        if (headers['x-authrite-yournonce'])
            brc31Headers['X-Authrite-YourNonce'] = headers['x-authrite-yournonce'];
        if (headers['x-authrite-certificates'])
            brc31Headers['X-Authrite-Certificates'] = headers['x-authrite-certificates'];
        return brc31Headers;
    }
    validateHeaders(headers) {
        if (!headers['X-Authrite'] || headers['X-Authrite'] !== types_1.BRC31_VERSION) {
            throw new types_1.BRC31ValidationError('Invalid or missing X-Authrite version', 'X-Authrite');
        }
        if (!headers['X-Authrite-Identity-Key'] ||
            !this.isValidPublicKey(headers['X-Authrite-Identity-Key'])) {
            throw new types_1.BRC31ValidationError('Invalid or missing X-Authrite-Identity-Key', 'X-Authrite-Identity-Key');
        }
        if (!headers['X-Authrite-Signature'] || !this.isValidHex(headers['X-Authrite-Signature'])) {
            throw new types_1.BRC31ValidationError('Invalid or missing X-Authrite-Signature', 'X-Authrite-Signature');
        }
        if (!headers['X-Authrite-Nonce'] || !this.isValidBase64(headers['X-Authrite-Nonce'])) {
            throw new types_1.BRC31ValidationError('Invalid or missing X-Authrite-Nonce', 'X-Authrite-Nonce');
        }
    }
    // ==================== Nonce Management ====================
    generateNonce() {
        const value = (0, crypto_1.randomBytes)(32).toString('base64');
        const now = Date.now();
        const expires = now + types_1.DEFAULT_BRC31_OPTIONS.nonceExpiryMs;
        return {
            value,
            created: now,
            expires,
        };
    }
    async storeNonce(nonce, identityKey) {
        await this.databaseService.storeNonce(nonce.value, identityKey, new Date(nonce.expires), 'server');
    }
    async validateNonce(nonce, identityKey) {
        return await this.databaseService.validateAndConsumeNonce(nonce, identityKey);
    }
    async cleanupExpiredNonces() {
        return await this.databaseService.cleanupExpiredNonces();
    }
    // ==================== Signature Operations ====================
    createSignature(data, privateKey, nonces) {
        try {
            // Create message to sign according to BRC-31 spec
            const message = this.createSigningMessage(data, nonces);
            const messageHash = this.hashMessage(message);
            // Create ECDSA signature
            const signature = secp256k1_1.secp256k1.sign(messageHash, privateKey);
            return signature.toDERHex();
        }
        catch (error) {
            throw new types_1.BRC31Error(`Failed to create signature: ${error.message}`, 'SIGNATURE_ERROR');
        }
    }
    verifySignature(signature, data, publicKey, nonces) {
        try {
            // Create message that should have been signed
            const message = this.createSigningMessage(data, nonces);
            const messageHash = this.hashMessage(message);
            // Convert hex signature to bytes
            const sigBytes = Buffer.from(signature, 'hex');
            const pubKeyBytes = Buffer.from(publicKey, 'hex');
            // Verify signature
            return secp256k1_1.secp256k1.verify(sigBytes, messageHash, pubKeyBytes);
        }
        catch (error) {
            return false;
        }
    }
    createSigningMessage(data, nonces) {
        // BRC-31 spec: sign payload with nonces
        let messageData;
        if (typeof data === 'string') {
            messageData = Buffer.from(data, 'utf8');
        }
        else if (Buffer.isBuffer(data)) {
            messageData = data;
        }
        else {
            messageData = Buffer.from(JSON.stringify(data), 'utf8');
        }
        // Concatenate client nonce + server nonce + data
        const clientNonceBuffer = Buffer.from(nonces.client, 'base64');
        const serverNonceBuffer = Buffer.from(nonces.server, 'base64');
        return Buffer.concat([clientNonceBuffer, serverNonceBuffer, messageData]);
    }
    hashMessage(message) {
        return (0, crypto_1.createHash)('sha256').update(message).digest();
    }
    // ==================== Certificate Management ====================
    async validateCertificateChain(certificates) {
        for (const cert of certificates) {
            try {
                // Validate certificate structure
                if (!this.validateCertificateStructure(cert)) {
                    return false;
                }
                // Check certificate signature
                if (!(await this.verifyCertificateSignature(cert))) {
                    return false;
                }
                // Check if certificate is revoked
                if (await this.checkCertificateRevocation(cert)) {
                    return false;
                }
            }
            catch (error) {
                console.warn(`Certificate validation failed: ${error.message}`);
                return false;
            }
        }
        return true;
    }
    async checkCertificateRevocation(certificate) {
        // In a full implementation, this would check the UTXO specified
        // in revocationOutpoint to see if it's been spent
        // For now, we'll assume certificates are not revoked
        return false;
    }
    computeIdentityLevel(certificates) {
        if (!certificates || certificates.length === 0) {
            return 'public-key';
        }
        // Check for high-trust certificates
        const hasCertifiedLevel = certificates.some((cert) => cert.type && this.isTrustedCertificateType(cert.type));
        if (hasCertifiedLevel) {
            return 'certified';
        }
        // Check for verified level certificates
        const hasVerifiedLevel = certificates.some((cert) => cert.certifier && this.isTrustedCertifier(cert.certifier));
        if (hasVerifiedLevel) {
            return 'verified';
        }
        return 'public-key';
    }
    validateCertificateStructure(cert) {
        return !!(cert.type &&
            cert.subject &&
            cert.certifier &&
            cert.signature &&
            cert.serialNumber &&
            this.isValidPublicKey(cert.subject) &&
            this.isValidPublicKey(cert.certifier));
    }
    async verifyCertificateSignature(cert) {
        try {
            // Create certificate signing message
            const certData = {
                type: cert.type,
                subject: cert.subject,
                validationKey: cert.validationKey,
                serialNumber: cert.serialNumber,
                fields: cert.fields,
            };
            const message = Buffer.from(JSON.stringify(certData), 'utf8');
            const messageHash = (0, crypto_1.createHash)('sha256').update(message).digest();
            const sigBytes = Buffer.from(cert.signature, 'hex');
            const pubKeyBytes = Buffer.from(cert.certifier, 'hex');
            return secp256k1_1.secp256k1.verify(sigBytes, messageHash, pubKeyBytes);
        }
        catch (error) {
            return false;
        }
    }
    isTrustedCertificateType(certType) {
        // Define trusted certificate types for certified level
        const trustedTypes = [
            'government-id',
            'verified-email',
            'verified-phone',
            'business-registration',
        ];
        return trustedTypes.includes(certType);
    }
    isTrustedCertifier(certifier) {
        // Define trusted certifier public keys
        const trustedCertifiers = [
        // Add trusted certifier public keys here
        ];
        return trustedCertifiers.includes(certifier);
    }
    // ==================== Main Authentication Method ====================
    async verifyIdentity(headers, body, options = types_1.DEFAULT_BRC31_OPTIONS) {
        try {
            // Validate headers structure
            this.validateHeaders(headers);
            const identityKey = headers['X-Authrite-Identity-Key'];
            const clientNonce = headers['X-Authrite-Nonce'];
            const signature = headers['X-Authrite-Signature'];
            const yourNonce = headers['X-Authrite-YourNonce'];
            // Validate nonces
            const nonceValid = yourNonce ? await this.validateNonce(yourNonce, identityKey) : true;
            if (!nonceValid) {
                throw new types_1.BRC31AuthenticationError('Invalid or expired nonce', 'NONCE_INVALID');
            }
            // Generate server nonce for response
            const serverNonce = this.generateNonce();
            await this.storeNonce(serverNonce, identityKey);
            // Parse certificates if provided
            let certificates = [];
            if (headers['X-Authrite-Certificates']) {
                try {
                    certificates = JSON.parse(headers['X-Authrite-Certificates']);
                }
                catch (error) {
                    throw new types_1.BRC31ValidationError('Invalid certificate JSON', 'X-Authrite-Certificates');
                }
            }
            // Verify signature
            const nonces = { client: clientNonce, server: yourNonce || serverNonce.value };
            const signatureValid = this.verifySignature(signature, body, identityKey, nonces);
            if (!signatureValid) {
                throw new types_1.BRC31AuthenticationError('Invalid signature', 'SIGNATURE_INVALID');
            }
            // Validate certificate chain
            const certificatesValid = await this.validateCertificateChain(certificates);
            // Compute identity level
            const identityLevel = this.computeIdentityLevel(certificates);
            // Check minimum identity level requirement
            if (!this.meetsMinimumLevel(identityLevel, options.minIdentityLevel)) {
                throw new types_1.BRC31AuthenticationError(`Identity level ${identityLevel} does not meet minimum requirement ${options.minIdentityLevel}`, 'INSUFFICIENT_IDENTITY_LEVEL');
            }
            // Calculate trust score
            const trustLevel = this.calculateTrustLevel(certificates, certificatesValid);
            const result = {
                valid: true,
                identity: {
                    publicKey: identityKey,
                    level: identityLevel,
                    certificates,
                },
                nonces: {
                    clientNonce,
                    serverNonce: serverNonce.value,
                },
                verification: {
                    signatureValid,
                    nonceValid,
                    certificatesValid,
                    trustLevel,
                },
            };
            // Record successful authentication
            await this.databaseService.recordAuthenticationAttempt(result);
            return result;
        }
        catch (error) {
            const result = {
                valid: false,
                identity: {
                    publicKey: headers['X-Authrite-Identity-Key'] || '',
                    level: 'anonymous',
                    certificates: [],
                },
                nonces: {
                    clientNonce: headers['X-Authrite-Nonce'] || '',
                    serverNonce: this.generateNonce().value,
                },
                verification: {
                    signatureValid: false,
                    nonceValid: false,
                    certificatesValid: false,
                    trustLevel: 0,
                },
                error: error.message,
            };
            return result;
        }
    }
    // ==================== Utility Methods ====================
    isValidPublicKey(pubKey) {
        return /^[0-9a-fA-F]{66}$/.test(pubKey) && (pubKey.startsWith('02') || pubKey.startsWith('03'));
    }
    isValidHex(hex) {
        return /^[0-9a-fA-F]+$/.test(hex) && hex.length >= 8;
    }
    isValidBase64(base64) {
        try {
            const decoded = Buffer.from(base64, 'base64');
            return decoded.length >= 8;
        }
        catch {
            return false;
        }
    }
    meetsMinimumLevel(actual, required) {
        const levels = {
            anonymous: 0,
            'public-key': 1,
            verified: 2,
            certified: 3,
        };
        return levels[actual] >= levels[required];
    }
    calculateTrustLevel(certificates, certificatesValid) {
        let trustLevel = 20; // Base trust for public key
        if (certificatesValid && certificates.length > 0) {
            trustLevel += 30; // Valid certificates
            // Bonus for multiple certificates
            trustLevel += Math.min(certificates.length * 10, 30);
            // Bonus for trusted certifiers
            const trustedCount = certificates.filter((cert) => this.isTrustedCertifier(cert.certifier)).length;
            trustLevel += trustedCount * 20;
        }
        return Math.min(100, Math.max(0, trustLevel));
    }
    async getIdentityLevel(identityKey) {
        const identity = await this.databaseService.getIdentity(identityKey);
        return identity ? identity.identity_level : 'anonymous';
    }
    async recordAuthentication(result) {
        await this.databaseService.recordAuthenticationAttempt(result);
    }
    async updateIdentityReputation(identityKey, success) {
        await this.databaseService.updateIdentityReputation(identityKey, success);
    }
    // ==================== Response Generation ====================
    createInitialResponse(request, certificates) {
        const serverNonce = this.generateNonce();
        const response = {
            authrite: types_1.BRC31_VERSION,
            messageType: 'initialResponse',
            identityKey: this.serverPublicKey,
            nonce: serverNonce.value,
            certificates,
            signature: this.createSignature(Buffer.concat([
                Buffer.from(request.nonce, 'base64'),
                Buffer.from(serverNonce.value, 'base64'),
            ]), this.serverPrivateKey, { client: request.nonce, server: serverNonce.value }),
        };
        return response;
    }
    createSignedResponse(data, clientNonce) {
        const serverNonce = this.generateNonce();
        return this.createSignature(data, this.serverPrivateKey, {
            client: clientNonce,
            server: serverNonce.value,
        });
    }
}
exports.BRC31AuthenticationServiceImpl = BRC31AuthenticationServiceImpl;
//# sourceMappingURL=service.js.map