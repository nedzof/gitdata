"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.certificateRouter = certificateRouter;
/**
 * Certificate issuance routes for Gitdata platform
 * Based on CoolCert implementation pattern
 */
const express_1 = require("express");
const sdk_1 = require("@bsv/sdk");
const bsv_auth_1 = require("../middleware/bsv-auth");
const gitdata_participant_1 = require("../certificates/gitdata-participant");
const router = (0, express_1.Router)();
/**
 * Sign Certificate endpoint - follows CoolCert pattern exactly
 * POST /v1/certificate/signCertificate
 */
router.post('/signCertificate', async (req, res) => {
    try {
        const { clientNonce, type, fields, masterKeyring } = req.body;
        // Get BSV auth service
        const bsvAuth = (0, bsv_auth_1.getBSVAuth)();
        if (!bsvAuth) {
            return res.status(500).json({
                status: 'error',
                code: 'ERR_BSV_AUTH_NOT_INITIALIZED',
                description: 'BSV authentication service not initialized'
            });
        }
        // Validate certificate signing request parameters
        try {
            bsvAuth.validateCertificateSigningRequest(req.body);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Invalid parameters';
            return res.status(400).json({
                status: 'error',
                code: 'ERR_INVALID_PARAMS',
                description: message
            });
        }
        // Validate certificate type
        if (type !== gitdata_participant_1.certificateType) {
            return res.status(400).json({
                status: 'error',
                code: 'ERR_INVALID_CERTIFICATE_TYPE',
                description: `Invalid certificate type. Expected: ${gitdata_participant_1.certificateType}`
            });
        }
        // Verify the client actually created the provided nonce
        const wallet = bsvAuth.getWallet();
        const identityKey = req.auth?.identityKey;
        if (!identityKey) {
            return res.status(401).json({
                status: 'error',
                code: 'ERR_NOT_AUTHENTICATED',
                description: 'BSV authentication required'
            });
        }
        await (0, sdk_1.verifyNonce)(clientNonce, wallet, identityKey);
        // Server creates a random nonce that the client can verify
        const serverNonce = await (0, sdk_1.createNonce)(wallet, identityKey);
        // The server computes a serial number from the client and server nonces
        const { hmac } = await wallet.createHmac({
            data: sdk_1.Utils.toArray(clientNonce + serverNonce, 'base64'),
            protocolID: [2, 'certificate issuance'],
            keyID: serverNonce + clientNonce,
            counterparty: identityKey
        });
        const serialNumber = sdk_1.Utils.toBase64(hmac);
        // Decrypt certificate fields and verify them before signing
        const decryptedFields = await sdk_1.MasterCertificate.decryptFields(wallet, masterKeyring, fields, identityKey);
        console.log('🔍 Decrypted certificate fields:', decryptedFields);
        // Validate decrypted fields
        const validation = (0, gitdata_participant_1.validateCertificateFields)(decryptedFields);
        if (!validation.valid) {
            return res.status(400).json({
                status: 'error',
                code: 'ERR_FIELD_VALIDATION',
                description: `Certificate field validation failed: ${validation.errors.join(', ')}`
            });
        }
        // Prepare final fields for certificate (adds timestamps, defaults)
        const finalFields = (0, gitdata_participant_1.prepareCertificateFields)(decryptedFields);
        // Create a revocation outpoint (simplified for now)
        const revocationTxid = 'not supported';
        // Create the signed certificate
        const signedCertificate = new sdk_1.Certificate(type, serialNumber, identityKey, (await wallet.getPublicKey({ identityKey: true })).publicKey, `${revocationTxid}.0`, finalFields);
        await signedCertificate.sign(wallet);
        console.log('✅ Certificate signed successfully for:', finalFields.display_name);
        // Return signed certificate to the requester
        return res.status(200).json({
            certificate: signedCertificate,
            serverNonce,
            status: 'success',
            message: 'Certificate issued successfully'
        });
    }
    catch (error) {
        console.error('❌ Certificate signing error:', error);
        return res.status(500).json({
            status: 'error',
            code: 'ERR_INTERNAL',
            description: 'An internal error has occurred during certificate issuance'
        });
    }
});
/**
 * Get certificate type information
 * GET /v1/certificate/info
 */
router.get('/info', (req, res) => {
    try {
        const bsvAuth = (0, bsv_auth_1.getBSVAuth)();
        res.json({
            certificateType: gitdata_participant_1.certificateType,
            enabled: bsvAuth?.isEnabled() || false,
            name: 'Gitdata Participant Certificate',
            description: 'Verifies legitimate participation in the Gitdata overlay network',
            fields: {
                display_name: 'User display name',
                participant: 'Participation status',
                level: 'Participation level',
                verified_at: 'Verification timestamp'
            },
            status: 'available'
        });
    }
    catch (error) {
        console.error('Certificate info error:', error);
        res.status(500).json({
            status: 'error',
            description: 'Failed to get certificate information'
        });
    }
});
/**
 * Check if BSV authentication is available
 * GET /v1/certificate/status
 */
router.get('/status', (req, res) => {
    const bsvAuth = (0, bsv_auth_1.getBSVAuth)();
    res.json({
        bsvAuthEnabled: bsvAuth?.isEnabled() || false,
        certificateIssuanceAvailable: !!bsvAuth,
        certificateType: gitdata_participant_1.certificateType,
        status: 'ready'
    });
});
function certificateRouter() {
    return router;
}
//# sourceMappingURL=certificate.js.map