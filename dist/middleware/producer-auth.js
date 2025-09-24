"use strict";
/**
 * Producer authentication and authorization middleware
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateProducer = authenticateProducer;
exports.validateStreamPermissions = validateStreamPermissions;
exports.generateApiKey = generateApiKey;
exports.createSignature = createSignature;
const crypto_1 = __importDefault(require("crypto"));
const sdk_1 = require("@bsv/sdk");
const hybrid_1 = require("../db/hybrid");
/**
 * Authenticate producer using API key or signature
 */
async function authenticateProducer(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Authorization header required',
            });
        }
        // Support both API key and signature-based auth
        if (authHeader.startsWith('Bearer ')) {
            // API key authentication (for development)
            const apiKey = authHeader.substring(7);
            const producer = await authenticateWithApiKey(apiKey);
            if (!producer) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid API key',
                });
            }
            req.producer = producer;
            next();
        }
        else if (authHeader.startsWith('Signature ')) {
            // Signature-based authentication (production)
            const signature = authHeader.substring(10);
            const producer = await authenticateWithSignature(req, signature);
            if (!producer) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid signature',
                });
            }
            req.producer = producer;
            next();
        }
        else {
            return res.status(401).json({
                success: false,
                error: 'Invalid authorization format',
            });
        }
    }
    catch (error) {
        console.error('Producer authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed',
        });
    }
}
/**
 * Validate that producer has permissions for the stream
 */
async function validateStreamPermissions(req, res, next) {
    try {
        const { streamId } = req.params;
        const producer = req.producer;
        if (!producer) {
            return res.status(401).json({
                success: false,
                error: 'Producer authentication required',
            });
        }
        const db = (0, hybrid_1.getHybridDatabase)();
        const result = await db.pg.query(`
      SELECT producer_public_key FROM manifests
      WHERE version_id = $1 AND is_streaming = true
    `, [streamId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Stream not found',
            });
        }
        const streamProducerKey = result.rows[0].producer_public_key;
        if (streamProducerKey !== producer.publicKey) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: not stream owner',
            });
        }
        next();
    }
    catch (error) {
        console.error('Stream permission validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Permission validation failed',
        });
    }
}
// Private helper functions
async function authenticateWithApiKey(apiKey) {
    const db = (0, hybrid_1.getHybridDatabase)();
    // For development: decode base64 API key containing credentials
    try {
        const decoded = Buffer.from(apiKey, 'base64').toString('utf8');
        const credentials = JSON.parse(decoded);
        if (credentials.privateKey && credentials.publicKey && credentials.producerId) {
            // Validate the key pair
            const privateKey = sdk_1.BSV.PrivateKey.fromString(credentials.privateKey);
            const publicKey = privateKey.toPublicKey().toString();
            if (publicKey === credentials.publicKey) {
                // Check if producer exists in database
                const result = await db.pg.query('SELECT id FROM producers WHERE public_key = $1 AND status = $2', [credentials.publicKey, 'active']);
                if (result.rows.length > 0) {
                    return credentials;
                }
            }
        }
    }
    catch (error) {
        console.error('API key decode error:', error);
    }
    return null;
}
async function authenticateWithSignature(req, signature) {
    try {
        // Extract public key and signature components
        const parts = signature.split(':');
        if (parts.length !== 2) {
            return null;
        }
        const [publicKeyHex, signatureHex] = parts;
        // Create message to verify (timestamp + method + path + body)
        const timestamp = req.headers['x-timestamp'];
        const method = req.method;
        const path = req.path;
        const body = JSON.stringify(req.body || {});
        const message = `${timestamp}${method}${path}${body}`;
        const messageHash = crypto_1.default.createHash('sha256').update(message).digest();
        // Verify signature
        const publicKey = sdk_1.BSV.PublicKey.fromString(publicKeyHex);
        const sig = sdk_1.BSV.Signature.fromString(signatureHex);
        const isValid = sdk_1.BSV.verify(messageHash, sig, publicKey);
        if (isValid) {
            // Check timestamp (prevent replay attacks)
            const now = Date.now();
            const requestTime = parseInt(timestamp);
            if (Math.abs(now - requestTime) > 300000) {
                // 5 minutes
                console.error('Request timestamp too old');
                return null;
            }
            // Verify producer exists and is active
            const db = (0, hybrid_1.getHybridDatabase)();
            const result = await db.pg.query('SELECT producer_id FROM producers WHERE public_key = $1 AND status = $2', [publicKeyHex, 'active']);
            if (result.rows.length > 0) {
                return {
                    privateKey: '', // Not needed for signature auth
                    publicKey: publicKeyHex,
                    producerId: result.rows[0].producer_id,
                };
            }
        }
    }
    catch (error) {
        console.error('Signature verification error:', error);
    }
    return null;
}
/**
 * Generate API key for development
 */
function generateApiKey(credentials) {
    const credentialsJson = JSON.stringify(credentials);
    return Buffer.from(credentialsJson).toString('base64');
}
/**
 * Create signature for request (helper for client SDKs)
 */
function createSignature(privateKey, timestamp, method, path, body) {
    const message = `${timestamp}${method}${path}${JSON.stringify(body || {})}`;
    const messageHash = crypto_1.default.createHash('sha256').update(message).digest();
    const key = sdk_1.BSV.PrivateKey.fromString(privateKey);
    const signature = sdk_1.BSV.sign(messageHash, key);
    return `${key.toPublicKey().toString()}:${signature.toString()}`;
}
//# sourceMappingURL=producer-auth.js.map