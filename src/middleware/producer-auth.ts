/**
 * Producer authentication and authorization middleware
 */

import { Request, Response, NextFunction } from 'express';
import { BSV } from '@bsv/sdk';
import { getHybridDatabase } from '../db/hybrid';
import crypto from 'crypto';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      producer?: {
        privateKey: string;
        publicKey: string;
        producerId: string;
      };
    }
  }
}

/**
 * Authenticate producer using API key or signature
 */
export async function authenticateProducer(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required'
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
          error: 'Invalid API key'
        });
      }

      req.producer = producer;
      next();
    } else if (authHeader.startsWith('Signature ')) {
      // Signature-based authentication (production)
      const signature = authHeader.substring(10);
      const producer = await authenticateWithSignature(req, signature);

      if (!producer) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
      }

      req.producer = producer;
      next();
    } else {
      return res.status(401).json({
        success: false,
        error: 'Invalid authorization format'
      });
    }
  } catch (error) {
    console.error('Producer authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * Validate that producer has permissions for the stream
 */
export async function validateStreamPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const { streamId } = req.params;
    const producer = req.producer;

    if (!producer) {
      return res.status(401).json({
        success: false,
        error: 'Producer authentication required'
      });
    }

    const db = getHybridDatabase();
    const result = await db.pg.query(`
      SELECT producer_public_key FROM manifests
      WHERE version_id = $1 AND is_streaming = true
    `, [streamId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    const streamProducerKey = result.rows[0].producer_public_key;
    if (streamProducerKey !== producer.publicKey) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: not stream owner'
      });
    }

    next();
  } catch (error) {
    console.error('Stream permission validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Permission validation failed'
    });
  }
}

// Private helper functions

async function authenticateWithApiKey(apiKey: string) {
  const db = getHybridDatabase();

  // For development: decode base64 API key containing credentials
  try {
    const decoded = Buffer.from(apiKey, 'base64').toString('utf8');
    const credentials = JSON.parse(decoded);

    if (credentials.privateKey && credentials.publicKey && credentials.producerId) {
      // Validate the key pair
      const privateKey = BSV.PrivateKey.fromString(credentials.privateKey);
      const publicKey = privateKey.toPublicKey().toString();

      if (publicKey === credentials.publicKey) {
        // Check if producer exists in database
        const result = await db.pg.query(
          'SELECT id FROM producers WHERE public_key = $1 AND status = $2',
          [credentials.publicKey, 'active']
        );

        if (result.rows.length > 0) {
          return credentials;
        }
      }
    }
  } catch (error) {
    console.error('API key decode error:', error);
  }

  return null;
}

async function authenticateWithSignature(req: Request, signature: string) {
  try {
    // Extract public key and signature components
    const parts = signature.split(':');
    if (parts.length !== 2) {
      return null;
    }

    const [publicKeyHex, signatureHex] = parts;

    // Create message to verify (timestamp + method + path + body)
    const timestamp = req.headers['x-timestamp'] as string;
    const method = req.method;
    const path = req.path;
    const body = JSON.stringify(req.body || {});

    const message = `${timestamp}${method}${path}${body}`;
    const messageHash = crypto.createHash('sha256').update(message).digest();

    // Verify signature
    const publicKey = BSV.PublicKey.fromString(publicKeyHex);
    const sig = BSV.Signature.fromString(signatureHex);

    const isValid = BSV.verify(messageHash, sig, publicKey);

    if (isValid) {
      // Check timestamp (prevent replay attacks)
      const now = Date.now();
      const requestTime = parseInt(timestamp);

      if (Math.abs(now - requestTime) > 300000) { // 5 minutes
        console.error('Request timestamp too old');
        return null;
      }

      // Verify producer exists and is active
      const db = getHybridDatabase();
      const result = await db.pg.query(
        'SELECT producer_id FROM producers WHERE public_key = $1 AND status = $2',
        [publicKeyHex, 'active']
      );

      if (result.rows.length > 0) {
        return {
          privateKey: '', // Not needed for signature auth
          publicKey: publicKeyHex,
          producerId: result.rows[0].producer_id
        };
      }
    }
  } catch (error) {
    console.error('Signature verification error:', error);
  }

  return null;
}

/**
 * Generate API key for development
 */
export function generateApiKey(credentials: any): string {
  const credentialsJson = JSON.stringify(credentials);
  return Buffer.from(credentialsJson).toString('base64');
}

/**
 * Create signature for request (helper for client SDKs)
 */
export function createSignature(
  privateKey: string,
  timestamp: number,
  method: string,
  path: string,
  body: any
): string {
  const message = `${timestamp}${method}${path}${JSON.stringify(body || {})}`;
  const messageHash = crypto.createHash('sha256').update(message).digest();

  const key = BSV.PrivateKey.fromString(privateKey);
  const signature = BSV.sign(messageHash, key);

  return `${key.toPublicKey().toString()}:${signature.toString()}`;
}