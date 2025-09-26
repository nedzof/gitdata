// Certificate Service for Gitdata
// Handles certificate issuance, validation, and management

import {
  Certificate,
  CertificateFieldNameUnder50Bytes,
  createNonce,
  MasterCertificate,
  Utils,
  VerifiableCertificate
} from '@bsv/sdk'
import {
  certificateType,
  certificateDefinition,
  validationRules,
  generateCertificateData
} from '../certificates/gitdataCert'
import { bsvWalletService } from '../bsv-wallet'

export interface GitdataCertificate {
  type: string
  subject: string
  serialNumber: string
  fields: Record<string, string>
  revocationOutpoint: string
  certifier: string
  signature: string
  issuedAt: string
  expiresAt?: string
}

export interface CertificateRequest {
  participantId: string
  profile: any
  clientNonce: string
  fields: Record<string, string>
  keyring: Record<string, string>
}

export class CertificateService {
  private certificates: Map<string, GitdataCertificate> = new Map()
  private bsvCertificates: Map<string, Certificate> = new Map() // Store original BSV Certificate objects

  constructor() {
    // Load existing certificates from localStorage
    this.loadCertificatesFromStorage()

    // Load certificates from wallet when available (don't await to avoid blocking)
    this.loadCertificatesFromWallet().catch(error => {
      console.warn('Failed to load certificates from wallet during initialization:', error)
    })
  }

  /**
   * Issue a new Gitdata Participant Certificate using BSV wallet
   */
  async issueCertificate(profile: any): Promise<GitdataCertificate> {
    try {
      // Check wallet connection
      if (!bsvWalletService.isWalletConnected()) {
        throw new Error('BSV wallet not connected. Please ensure MetaNet Desktop is running and connected.')
      }

      // Get wallet identity key
      const wallet = bsvWalletService.getWallet()
      const identityKey = await wallet.getPublicKey({ identityKey: true })

      // Generate certificate data from user profile
      const certificateData = generateCertificateData({
        ...profile,
        identityKey: identityKey.publicKey
      })

      // Validate certificate data
      const isValid = this.validateCertificateData(certificateData)
      if (!isValid) {
        throw new Error('Certificate data validation failed')
      }

      // Create nonces for certificate request
      const clientNonce = await createNonce(wallet, identityKey.publicKey)

      // Generate serial number using wallet HMAC
      const { hmac } = await wallet.createHmac({
        data: Utils.toArray(clientNonce + Date.now().toString(), 'utf8'),
        protocolID: [2, 'gitdata certificate'],
        keyID: 'gitdata_cert_' + Date.now(),
        counterparty: identityKey.publicKey
      })
      const serialNumber = Utils.toBase64(hmac)

      // Create certificate using BSV SDK
      const certificate = new Certificate(
        certificateType,
        serialNumber,
        identityKey.publicKey,
        identityKey.publicKey, // Self-signed for now
        '0000000000000000000000000000000000000000000000000000000000000000.0', // No revocation outpoint yet
        certificateData
      )

      // Sign the certificate with wallet
      await certificate.sign(wallet)

      // Convert to our GitdataCertificate format
      const gitdataCertificate: GitdataCertificate = {
        type: certificate.type,
        subject: certificate.subject,
        serialNumber: certificate.serialNumber,
        fields: certificate.fields,
        revocationOutpoint: certificate.revocationOutpoint,
        certifier: certificate.certifier,
        signature: certificate.signature || '',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }

      // Store both formats
      this.certificates.set(gitdataCertificate.subject, gitdataCertificate)
      this.bsvCertificates.set(gitdataCertificate.subject, certificate) // Store original BSV Certificate
      this.saveCertificatesToStorage()

      return gitdataCertificate
    } catch (error) {
      console.error('Certificate issuance failed:', error)
      throw new Error(`Failed to issue certificate: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get certificate for a participant
   */
  getCertificate(participantId: string): GitdataCertificate | null {
    return this.certificates.get(participantId) || null
  }

  /**
   * Get all certificates
   */
  getAllCertificates(): GitdataCertificate[] {
    return Array.from(this.certificates.values())
  }

  /**
   * Validate certificate data
   */
  private validateCertificateData(data: Record<string, string>): boolean {
    try {
      for (const [field, value] of Object.entries(data)) {
        const validator = validationRules[field as keyof typeof validationRules]
        if (validator && !validator(value)) {
          console.warn(`Validation failed for field ${field}:`, value)
          return false
        }
      }
      return true
    } catch (error) {
      console.error('Certificate validation error:', error)
      return false
    }
  }

  /**
   * Generate a unique serial number for the certificate
   */
  private generateSerialNumber(identityKey: string): string {
    const timestamp = Date.now().toString()
    const random = Math.random().toString(36).substring(2)
    const combined = `${identityKey}_${timestamp}_${random}`

    // Create a simple hash (in production, use proper cryptographic hash)
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }

    return Utils.toBase64(new Uint8Array([...combined].map(c => c.charCodeAt(0)).slice(0, 32)))
  }

  /**
   * Sign certificate data (simplified for demo)
   */
  private async signCertificate(data: Record<string, string>, serialNumber: string): Promise<string> {
    // In a real implementation, this would use BSV SDK signing
    // For demo purposes, we'll create a mock signature
    const dataString = JSON.stringify(data) + serialNumber
    let signature = ''

    // Simple signature generation (replace with actual BSV signing)
    for (let i = 0; i < dataString.length; i++) {
      signature += dataString.charCodeAt(i).toString(16)
    }

    return signature.substring(0, 64) // Truncate to reasonable length
  }

  /**
   * Verify certificate signature
   */
  verifyCertificate(certificate: GitdataCertificate): boolean {
    try {
      // In production, this would verify the actual cryptographic signature
      // For demo, we check basic certificate structure and expiry
      const now = new Date()
      const issuedAt = new Date(certificate.issuedAt)
      const expiresAt = certificate.expiresAt ? new Date(certificate.expiresAt) : null

      // Check if certificate is expired
      if (expiresAt && now > expiresAt) {
        return false
      }

      // Check if certificate was issued in the future (invalid)
      if (issuedAt > now) {
        return false
      }

      // Check required fields
      const requiredFields = ['participant', 'identity_key', 'display_name']
      for (const field of requiredFields) {
        if (!certificate.fields[field]) {
          return false
        }
      }

      return true
    } catch (error) {
      console.error('Certificate verification failed:', error)
      return false
    }
  }

  /**
   * Revoke a certificate
   */
  revokeCertificate(participantId: string): boolean {
    try {
      const certificate = this.certificates.get(participantId)
      if (!certificate) {
        return false
      }

      // Mark as revoked (in production, would use revocation outpoint)
      certificate.fields.revoked = 'true'
      certificate.fields.revoked_at = new Date().toISOString()

      this.certificates.set(participantId, certificate)
      this.saveCertificatesToStorage()

      return true
    } catch (error) {
      console.error('Certificate revocation failed:', error)
      return false
    }
  }

  /**
   * Load certificates from localStorage
   */
  private loadCertificatesFromStorage(): void {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('gitdata_certificates')
        if (stored) {
          const certificateArray = JSON.parse(stored)
          for (const cert of certificateArray) {
            this.certificates.set(cert.subject, cert)
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load certificates from storage:', error)
    }
  }

  /**
   * Save certificates to localStorage
   */
  private saveCertificatesToStorage(): void {
    try {
      if (typeof window !== 'undefined') {
        const certificateArray = Array.from(this.certificates.values())
        localStorage.setItem('gitdata_certificates', JSON.stringify(certificateArray))
      }
    } catch (error) {
      console.warn('Failed to save certificates to storage:', error)
    }
  }

  /**
   * Export certificate as downloadable JSON
   */
  exportCertificate(participantId: string): string {
    const certificate = this.getCertificate(participantId)
    if (!certificate) {
      throw new Error('Certificate not found')
    }

    return JSON.stringify(certificate, null, 2)
  }

  /**
   * Save certificate to BRC-100 MetaNet wallet
   */
  async saveCertificateToWallet(participantId: string): Promise<void> {
    // Try to get the original BSV Certificate object first
    const bsvCertificate = this.bsvCertificates.get(participantId)
    const certificate = this.getCertificate(participantId)

    if (!certificate) {
      throw new Error('Certificate not found')
    }

    if (!bsvWalletService.isWalletConnected()) {
      throw new Error('BSV wallet not connected. Please ensure MetaNet Desktop is running and connected.')
    }

    try {
      // Use the original BSV Certificate object if available, otherwise use the converted format
      const certificateToSave = bsvCertificate || certificate
      await bsvWalletService.saveCertificateToWallet(certificateToSave)
    } catch (error) {
      console.error('Failed to save certificate to wallet:', error)
      throw new Error(`Failed to save certificate to wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Load certificates from BRC-100 MetaNet wallet
   */
  async loadCertificatesFromWallet(): Promise<void> {
    if (!bsvWalletService.isWalletConnected()) {
      console.log('Wallet not connected, skipping wallet certificate load')
      return
    }

    try {
      const walletCertificates = await bsvWalletService.getCertificatesFromWallet()

      for (const cert of walletCertificates) {
        // Convert wallet certificate format to GitdataCertificate
        const gitdataCert: GitdataCertificate = {
          type: cert.type || 'gitdata-participant',
          subject: cert.subject,
          serialNumber: cert.serialNumber,
          fields: cert.fields || {},
          revocationOutpoint: cert.revocationOutpoint || '',
          certifier: cert.certifier,
          signature: cert.signature || '',
          issuedAt: cert.issuedAt,
          expiresAt: cert.expiresAt
        }

        this.certificates.set(cert.subject, gitdataCert)
      }

      this.saveCertificatesToStorage()
      console.log(`Loaded ${walletCertificates.length} certificates from MetaNet wallet`)

    } catch (error) {
      console.warn('Failed to load certificates from wallet:', error)
      // Don't throw - wallet loading is optional
    }
  }

  /**
   * Pull/fetch a certificate from an external certifier using BSV wallet
   */
  async pullCertificate(certifierUrl: string, participantId: string): Promise<GitdataCertificate> {
    try {
      console.log(`Attempting to pull certificate from ${certifierUrl} for participant ${participantId}`)

      // Check wallet connection
      if (!bsvWalletService.isWalletConnected()) {
        throw new Error('BSV wallet not connected. Please ensure MetaNet Desktop is running and connected.')
      }

      const wallet = bsvWalletService.getWallet()
      const identityKey = await wallet.getPublicKey({ identityKey: true })

      // Create client nonce using BSV SDK
      const clientNonce = await createNonce(wallet, identityKey.publicKey)

      // Create field data for certificate request
      const fields = {
        participant: 'verified',
        identity_key: identityKey.publicKey,
        display_name: 'Gitdata Participant',
        cool: 'true' // Required for coolcert compatibility
      }

      // Encrypt fields using MasterCertificate (for real implementation)
      const keyring = await this.createKeyringForFields(wallet, fields, identityKey.publicKey)

      // Create certificate request data
      const requestData = {
        type: certificateType,
        clientNonce,
        fields,
        keyring
      }

      // Make request to certifier
      const response = await fetch(`${certifierUrl}/signCertificate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${participantId}` // Simple auth for demo
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error(`Certifier responded with ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.certificate) {
        throw new Error('No certificate returned from certifier')
      }

      // Convert the received certificate to our format
      const certificate: GitdataCertificate = {
        type: result.certificate.type,
        subject: result.certificate.subject,
        serialNumber: result.certificate.serialNumber,
        fields: result.certificate.fields,
        revocationOutpoint: result.certificate.revocationOutpoint,
        certifier: result.certificate.certifier,
        signature: result.certificate.signature,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }

      // Store the pulled certificate
      this.certificates.set(certificate.subject, certificate)
      this.saveCertificatesToStorage()

      console.log('Certificate successfully pulled and stored:', certificate.serialNumber)
      return certificate

    } catch (error) {
      console.error('Certificate pull failed:', error)
      throw new Error(`Failed to pull certificate: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Import a certificate from JSON data
   */
  importCertificate(certificateJson: string): GitdataCertificate {
    try {
      const certificate = JSON.parse(certificateJson) as GitdataCertificate

      // Basic validation
      if (!certificate.type || !certificate.subject || !certificate.serialNumber) {
        throw new Error('Invalid certificate format')
      }

      // Store the imported certificate
      this.certificates.set(certificate.subject, certificate)
      this.saveCertificatesToStorage()

      return certificate
    } catch (error) {
      console.error('Certificate import failed:', error)
      throw new Error(`Failed to import certificate: ${error instanceof Error ? error.message : 'Invalid JSON format'}`)
    }
  }

  /**
   * Create encrypted keyring for certificate fields using BSV wallet
   */
  private async createKeyringForFields(wallet: any, fields: Record<string, string>, identityKey: string): Promise<Record<string, string>> {
    const keyring: Record<string, string> = {}

    try {
      // For each field, create an encrypted keyring entry
      for (const [fieldName, fieldValue] of Object.entries(fields)) {
        // In a production implementation, this would properly encrypt using MasterCertificate
        // For now, we'll use a simpler approach that's compatible with certifiers
        const symmetricKey = await wallet.createSymmetricKey({
          counterparty: identityKey,
          keyID: `cert_field_${fieldName}`,
          protocolID: [2, 'certificate field encryption']
        })

        // Mock encryption - in real implementation would use proper encryption
        keyring[fieldName] = Utils.toBase64(new TextEncoder().encode(fieldValue))
      }
    } catch (error) {
      console.warn('Using fallback keyring generation:', error)
      // Fallback to simpler keyring for compatibility
      for (const fieldName of Object.keys(fields)) {
        const mockData = new Uint8Array(32)
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          crypto.getRandomValues(mockData)
        }
        keyring[fieldName] = Utils.toBase64(mockData)
      }
    }

    return keyring
  }

  /**
   * Get certificate statistics
   */
  getCertificateStats() {
    const certificates = this.getAllCertificates()
    const total = certificates.length
    const active = certificates.filter(cert => !cert.fields.revoked).length
    const expired = certificates.filter(cert => {
      if (!cert.expiresAt) return false
      return new Date() > new Date(cert.expiresAt)
    }).length

    return {
      total,
      active,
      revoked: certificates.filter(cert => cert.fields.revoked).length,
      expired,
      valid: active - expired
    }
  }
}

// Export singleton instance
export const certificateService = new CertificateService()