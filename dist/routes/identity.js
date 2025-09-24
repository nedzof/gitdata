"use strict";
/**
 * D19 Identity Routes: BRC-31 Producer Identity Registration with BRC-100 Wallet Connect
 *
 * Features:
 * - BRC-31 identity registration and verification
 * - BRC-100 compatible wallet connection
 * - Producer capability management
 * - Reputation scoring system
 * - Overlay network integration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.identityRouter = void 0;
exports.initializeIdentityRoutes = initializeIdentityRoutes;
const crypto_1 = __importDefault(require("crypto"));
const secp256k1_1 = require("@noble/curves/secp256k1");
const express_1 = require("express");
const identity_1 = require("../middleware/identity");
const router = (0, express_1.Router)();
// Environment configuration
const IDENTITY_REQUIRED = process.env.IDENTITY_REQUIRED === 'true';
const REPUTATION_THRESHOLD = parseInt(process.env.IDENTITY_REPUTATION_THRESHOLD || '50');
const SESSION_TTL_HOURS = parseInt(process.env.WALLET_SESSION_TTL_HOURS || '24');
// Database client (assumes PostgreSQL is initialized)
let db;
function initializeIdentityRoutes(database) {
    db = database;
    return router;
}
/**
 * POST /identity/register
 * Register a new BRC-31 identity with the overlay network
 */
router.post('/register', (0, identity_1.requireIdentity)(true), async (req, res) => {
    try {
        const identityKey = req.identityKey;
        const registration = req.body;
        // Validate registration data
        if (!registration.producerCapabilities || !Array.isArray(registration.producerCapabilities)) {
            return res.status(400).json({
                error: 'invalid_registration',
                message: 'producerCapabilities array required',
            });
        }
        if (!registration.overlayTopics || !Array.isArray(registration.overlayTopics)) {
            return res.status(400).json({
                error: 'invalid_registration',
                message: 'overlayTopics array required',
            });
        }
        // Check if identity already exists
        const existingIdentity = await db.query('SELECT identity_key, verification_status FROM overlay_identities WHERE identity_key = $1', [identityKey]);
        let producerId;
        let verificationStatus = 'verified';
        if (existingIdentity.rows.length > 0) {
            // Update existing identity
            await db.query(`
        UPDATE overlay_identities
        SET overlay_topics = $2,
            last_verified_at = NOW(),
            last_activity_at = NOW(),
            metadata = $3,
            is_active = true
        WHERE identity_key = $1
      `, [
                identityKey,
                registration.overlayTopics,
                JSON.stringify({
                    geographicRegion: registration.geographicRegion,
                    serviceEndpoints: registration.serviceEndpoints,
                    walletType: registration.walletType,
                }),
            ]);
            // Get the producer ID
            const producerResult = await db.query('SELECT producer_id FROM overlay_identities WHERE identity_key = $1', [identityKey]);
            producerId = producerResult.rows[0]?.producer_id;
            verificationStatus = existingIdentity.rows[0].verification_status;
        }
        else {
            // Create new identity
            producerId = `prod_${crypto_1.default.randomBytes(16).toString('hex')}`;
            await db.query(`
        INSERT INTO overlay_identities (
          identity_key, producer_id, overlay_topics, verification_status,
          reputation_score, registered_at, last_verified_at, last_activity_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW(), $6)
      `, [
                identityKey,
                producerId,
                registration.overlayTopics,
                'verified',
                100, // Initial reputation score
                JSON.stringify({
                    geographicRegion: registration.geographicRegion,
                    serviceEndpoints: registration.serviceEndpoints,
                    walletType: registration.walletType,
                }),
            ]);
            // Add initial reputation entry
            await db.query(`
        INSERT INTO identity_reputation (
          identity_key, event_type, score_change, reason, recorded_by
        ) VALUES ($1, $2, $3, $4, $5)
      `, [identityKey, 'registration', 100, 'Initial registration bonus', 'system']);
        }
        // Register producer capabilities
        if (registration.producerCapabilities.length > 0) {
            // Clear existing capabilities
            await db.query('DELETE FROM producer_capabilities WHERE identity_key = $1', [identityKey]);
            // Add new capabilities
            for (const capability of registration.producerCapabilities) {
                const endpointUrl = registration.serviceEndpoints?.[capability];
                await db.query(`
          INSERT INTO producer_capabilities (identity_key, capability_type, endpoint_url)
          VALUES ($1, $2, $3)
        `, [identityKey, capability, endpointUrl]);
            }
        }
        // Generate SHIP advertisement ID (placeholder for BRC-88 integration)
        const shipAdvertisementId = `ship_${crypto_1.default.randomBytes(12).toString('hex')}`;
        // Update with SHIP advertisement ID
        await db.query('UPDATE overlay_identities SET ship_advertisement_id = $1 WHERE identity_key = $2', [shipAdvertisementId, identityKey]);
        // Get current reputation score
        const reputationResult = await db.query('SELECT reputation_score FROM overlay_identities WHERE identity_key = $1', [identityKey]);
        const reputationScore = reputationResult.rows[0]?.reputation_score || 100;
        res.json({
            identityKey,
            producerId,
            shipAdvertisementId,
            overlayTopics: registration.overlayTopics,
            verificationStatus,
            reputationScore,
            capabilities: registration.producerCapabilities,
            registeredAt: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('Identity registration error:', error);
        res.status(500).json({
            error: 'registration_failed',
            message: 'Failed to register identity',
        });
    }
});
/**
 * POST /identity/wallet/connect
 * Connect a BRC-100 compatible wallet
 */
router.post('/wallet/connect', async (req, res) => {
    try {
        const connectRequest = req.body;
        // Validate wallet connection request
        if (!connectRequest.walletType) {
            return res.status(400).json({
                error: 'invalid_request',
                message: 'walletType required',
            });
        }
        if (!connectRequest.capabilities || !Array.isArray(connectRequest.capabilities)) {
            return res.status(400).json({
                error: 'invalid_request',
                message: 'capabilities array required',
            });
        }
        // Generate session ID
        const sessionId = `wallet_${crypto_1.default.randomBytes(16).toString('hex')}`;
        // Create wallet session
        await db.query(`
      INSERT INTO wallet_sessions (
        session_id, wallet_type, connection_data, capabilities,
        is_connected, connected_at, last_activity_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW() + INTERVAL '${SESSION_TTL_HOURS} hours')
    `, [
            sessionId,
            connectRequest.walletType,
            JSON.stringify(connectRequest.connectionData || {}),
            connectRequest.capabilities,
            false, // Will be set to true after identity verification
        ]);
        res.json({
            sessionId,
            walletType: connectRequest.walletType,
            capabilities: connectRequest.capabilities,
            expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString(),
            status: 'pending_verification',
        });
    }
    catch (error) {
        console.error('Wallet connect error:', error);
        res.status(500).json({
            error: 'connection_failed',
            message: 'Failed to initiate wallet connection',
        });
    }
});
/**
 * POST /identity/wallet/verify
 * Verify wallet connection with BRC-31 signature
 */
router.post('/wallet/verify', async (req, res) => {
    try {
        const { sessionId, identityKey, signature, nonce } = req.body;
        if (!sessionId || !identityKey || !signature || !nonce) {
            return res.status(400).json({
                error: 'invalid_request',
                message: 'sessionId, identityKey, signature, and nonce required',
            });
        }
        // Get wallet session
        const sessionResult = await db.query('SELECT * FROM wallet_sessions WHERE session_id = $1 AND expires_at > NOW()', [sessionId]);
        if (sessionResult.rows.length === 0) {
            return res.status(404).json({
                error: 'session_not_found',
                message: 'Wallet session not found or expired',
            });
        }
        const session = sessionResult.rows[0];
        // For wallet verification, we expect a specific signed message format
        // The message signed should be: wallet_verification:sessionId
        const verificationMessage = `wallet_verification:${sessionId}`;
        // Reconstruct the full message that was signed: message + nonce
        const fullMessage = verificationMessage + nonce;
        const messageHash = crypto_1.default.createHash('sha256').update(fullMessage, 'utf8').digest();
        // Verify ECDSA signature
        const msg = messageHash;
        const pub = Buffer.from(identityKey, 'hex');
        const sig = Buffer.from(signature, 'hex');
        let isValidSignature = false;
        try {
            // Try DER first
            isValidSignature = secp256k1_1.secp256k1.verify(sig, msg, pub);
        }
        catch {
            // Try compact 64-byte r||s if DER fails
            try {
                if (sig.length === 64) {
                    isValidSignature = secp256k1_1.secp256k1.verify(sig, msg, pub);
                }
            }
            catch {
                // ignore
            }
        }
        if (!isValidSignature) {
            return res.status(401).json({
                error: 'invalid_signature',
                message: 'BRC-31 signature verification failed',
            });
        }
        // Update session with verified identity
        await db.query(`
      UPDATE wallet_sessions
      SET identity_key = $1, is_connected = true, connected_at = NOW(), last_activity_at = NOW()
      WHERE session_id = $2
    `, [identityKey, sessionId]);
        // Log signature verification
        await db.query(`
      INSERT INTO signature_verifications (
        identity_key, request_path, request_method, nonce, signature,
        verification_result, overlay_evidence, verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
            identityKey,
            '/identity/wallet/verify',
            'POST',
            nonce,
            signature,
            true,
            JSON.stringify({ sessionId, walletType: session.wallet_type }),
        ]);
        // Get or create identity record
        let identityRecord = await db.query('SELECT * FROM overlay_identities WHERE identity_key = $1', [identityKey]);
        if (identityRecord.rows.length === 0) {
            // Create minimal identity record for wallet users
            const producerId = `prod_${crypto_1.default.randomBytes(16).toString('hex')}`;
            await db.query(`
        INSERT INTO overlay_identities (
          identity_key, producer_id, verification_status, reputation_score,
          registered_at, last_verified_at, last_activity_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
      `, [identityKey, producerId, 'verified', 100]);
            identityRecord = await db.query('SELECT * FROM overlay_identities WHERE identity_key = $1', [
                identityKey,
            ]);
        }
        else {
            // Update activity timestamp
            await db.query('UPDATE overlay_identities SET last_activity_at = NOW() WHERE identity_key = $1', [identityKey]);
        }
        const identity = identityRecord.rows[0];
        res.json({
            sessionId,
            identityKey,
            walletType: session.wallet_type,
            capabilities: session.capabilities,
            identity: {
                producerId: identity.producer_id,
                verificationStatus: identity.verification_status,
                reputationScore: identity.reputation_score,
            },
            connectedAt: new Date().toISOString(),
            status: 'connected',
        });
    }
    catch (error) {
        console.error('Wallet verification error:', error);
        res.status(500).json({
            error: 'verification_failed',
            message: 'Failed to verify wallet connection',
        });
    }
});
/**
 * GET /identity/status/:identityKey
 * Get identity status and reputation
 */
router.get('/status/:identityKey', async (req, res) => {
    try {
        const { identityKey } = req.params;
        if (!/^[0-9a-fA-F]{66}$/.test(identityKey)) {
            return res.status(400).json({
                error: 'invalid_identity_key',
                message: 'Identity key must be 66-character hex string',
            });
        }
        // Get identity record
        const identityResult = await db.query(`
      SELECT oi.*, COUNT(pc.id) as capability_count
      FROM overlay_identities oi
      LEFT JOIN producer_capabilities pc ON oi.identity_key = pc.identity_key AND pc.is_active = true
      WHERE oi.identity_key = $1
      GROUP BY oi.identity_key
    `, [identityKey]);
        if (identityResult.rows.length === 0) {
            return res.status(404).json({
                error: 'identity_not_found',
                message: 'Identity not registered',
            });
        }
        const identity = identityResult.rows[0];
        // Get capabilities
        const capabilitiesResult = await db.query('SELECT capability_type, endpoint_url FROM producer_capabilities WHERE identity_key = $1 AND is_active = true', [identityKey]);
        // Get recent reputation changes
        const reputationResult = await db.query(`
      SELECT event_type, score_change, reason, recorded_at
      FROM identity_reputation
      WHERE identity_key = $1
      ORDER BY recorded_at DESC
      LIMIT 10
    `, [identityKey]);
        // Get wallet sessions
        const sessionsResult = await db.query('SELECT session_id, wallet_type, is_connected, connected_at, expires_at FROM wallet_sessions WHERE identity_key = $1 AND expires_at > NOW()', [identityKey]);
        res.json({
            identityKey,
            producerId: identity.producer_id,
            verificationStatus: identity.verification_status,
            reputationScore: identity.reputation_score,
            overlayTopics: identity.overlay_topics,
            registeredAt: identity.registered_at,
            lastVerifiedAt: identity.last_verified_at,
            lastActivityAt: identity.last_activity_at,
            isActive: identity.is_active,
            capabilities: capabilitiesResult.rows.map((cap) => ({
                type: cap.capability_type,
                endpoint: cap.endpoint_url,
            })),
            recentActivity: reputationResult.rows,
            walletSessions: sessionsResult.rows,
            metadata: identity.metadata,
        });
    }
    catch (error) {
        console.error('Identity status error:', error);
        res.status(500).json({
            error: 'status_failed',
            message: 'Failed to get identity status',
        });
    }
});
/**
 * POST /identity/reputation
 * Update identity reputation (internal use)
 */
router.post('/reputation', (0, identity_1.requireIdentity)(false), async (req, res) => {
    try {
        const { identityKey, eventType, scoreChange, reason } = req.body;
        if (!identityKey || !eventType || scoreChange === undefined) {
            return res.status(400).json({
                error: 'invalid_request',
                message: 'identityKey, eventType, and scoreChange required',
            });
        }
        // Verify identity exists
        const identityResult = await db.query('SELECT identity_key FROM overlay_identities WHERE identity_key = $1', [identityKey]);
        if (identityResult.rows.length === 0) {
            return res.status(404).json({
                error: 'identity_not_found',
                message: 'Identity not registered',
            });
        }
        // Add reputation record
        await db.query(`
      INSERT INTO identity_reputation (
        identity_key, event_type, score_change, reason, recorded_by
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
            identityKey,
            eventType,
            scoreChange,
            reason || `${eventType} event`,
            req.identityKey || 'system',
        ]);
        // Calculate new reputation score (trigger will handle this automatically)
        const newScoreResult = await db.query('SELECT reputation_score FROM overlay_identities WHERE identity_key = $1', [identityKey]);
        res.json({
            identityKey,
            eventType,
            scoreChange,
            newReputationScore: newScoreResult.rows[0]?.reputation_score,
            recordedAt: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('Reputation update error:', error);
        res.status(500).json({
            error: 'reputation_failed',
            message: 'Failed to update reputation',
        });
    }
});
/**
 * GET /identity/wallet/sessions
 * Get active wallet sessions for authenticated user
 */
router.get('/wallet/sessions', (0, identity_1.requireIdentity)(true), async (req, res) => {
    try {
        const identityKey = req.identityKey;
        const sessionsResult = await db.query(`
      SELECT session_id, wallet_type, capabilities, is_connected,
             connected_at, last_activity_at, expires_at
      FROM wallet_sessions
      WHERE identity_key = $1 AND expires_at > NOW()
      ORDER BY last_activity_at DESC
    `, [identityKey]);
        res.json({
            identityKey,
            sessions: sessionsResult.rows,
        });
    }
    catch (error) {
        console.error('Wallet sessions error:', error);
        res.status(500).json({
            error: 'sessions_failed',
            message: 'Failed to get wallet sessions',
        });
    }
});
/**
 * POST /identity/test-verify
 * Test endpoint for BRC-31 signature verification (development/testing only)
 */
router.post('/test-verify', (0, identity_1.requireIdentity)(true), async (req, res) => {
    try {
        // If we reach here, the signature was valid (middleware passed)
        res.json({
            verified: true,
            identityKey: req.identityKey,
            message: 'BRC-31 signature verification successful',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error('Test verify error:', error);
        res.status(500).json({
            error: 'test_verify_failed',
            message: 'Failed to verify test signature',
        });
    }
});
exports.default = router;
// Alias for server.ts compatibility
const identityRouter = () => router;
exports.identityRouter = identityRouter;
//# sourceMappingURL=identity.js.map