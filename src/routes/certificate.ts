/**
 * Certificate issuance routes for Gitdata platform
 * Based on CoolCert implementation pattern
 */
import { Request, Response, Router } from 'express';
import {
  Certificate,
  createNonce,
  verifyNonce,
  MasterCertificate,
  Utils
} from '@bsv/sdk';
import { getBSVAuth } from '../middleware/bsv-auth';
import {
  certificateType,
  validateCertificateFields,
  prepareCertificateFields
} from '../certificates/gitdata-participant';

const router = Router();

/**
 * Sign Certificate endpoint - follows CoolCert pattern exactly
 * POST /v1/certificate/signCertificate
 */
router.post('/signCertificate', async (req: Request, res: Response) => {
  try {
    const { clientNonce, type, fields, masterKeyring } = req.body;

    // Get BSV auth service
    const bsvAuth = getBSVAuth();
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid parameters';
      return res.status(400).json({
        status: 'error',
        code: 'ERR_INVALID_PARAMS',
        description: message
      });
    }

    // Validate certificate type
    if (type !== certificateType) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_INVALID_CERTIFICATE_TYPE',
        description: `Invalid certificate type. Expected: ${certificateType}`
      });
    }

    // Verify the client actually created the provided nonce
    const wallet = bsvAuth.getWallet();
    const identityKey = (req as any).auth?.identityKey;

    if (!identityKey) {
      return res.status(401).json({
        status: 'error',
        code: 'ERR_NOT_AUTHENTICATED',
        description: 'BSV authentication required'
      });
    }

    await verifyNonce(clientNonce, wallet, identityKey);

    // Server creates a random nonce that the client can verify
    const serverNonce = await createNonce(wallet, identityKey);

    // The server computes a serial number from the client and server nonces
    const { hmac } = await wallet.createHmac({
      data: Utils.toArray(clientNonce + serverNonce, 'base64'),
      protocolID: [2, 'certificate issuance'],
      keyID: serverNonce + clientNonce,
      counterparty: identityKey
    });
    const serialNumber = Utils.toBase64(hmac);

    // Decrypt certificate fields and verify them before signing
    const decryptedFields = await MasterCertificate.decryptFields(
      wallet,
      masterKeyring,
      fields,
      identityKey
    );

    console.log('🔍 Decrypted certificate fields:', decryptedFields);

    // Validate decrypted fields
    const validation = validateCertificateFields(decryptedFields);
    if (!validation.valid) {
      return res.status(400).json({
        status: 'error',
        code: 'ERR_FIELD_VALIDATION',
        description: `Certificate field validation failed: ${validation.errors.join(', ')}`
      });
    }

    // Prepare final fields for certificate (adds timestamps, defaults)
    const finalFields = prepareCertificateFields(decryptedFields);

    // Create a revocation outpoint (simplified for now)
    const revocationTxid = 'not supported';

    // Create the signed certificate
    const signedCertificate = new Certificate(
      type,
      serialNumber,
      identityKey,
      (await wallet.getPublicKey({ identityKey: true })).publicKey,
      `${revocationTxid}.0`,
      finalFields
    );

    await signedCertificate.sign(wallet);

    console.log('✅ Certificate signed successfully for:', finalFields.display_name);

    // Return signed certificate to the requester
    return res.status(200).json({
      certificate: signedCertificate,
      serverNonce,
      status: 'success',
      message: 'Certificate issued successfully'
    });

  } catch (error) {
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
router.get('/info', (req: Request, res: Response) => {
  try {
    const bsvAuth = getBSVAuth();

    res.json({
      certificateType,
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
  } catch (error) {
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
router.get('/status', (req: Request, res: Response) => {
  const bsvAuth = getBSVAuth();

  res.json({
    bsvAuthEnabled: bsvAuth?.isEnabled() || false,
    certificateIssuanceAvailable: !!bsvAuth,
    certificateType,
    status: 'ready'
  });
});

export function certificateRouter() {
  return router;
}