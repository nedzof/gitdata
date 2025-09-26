// BSV SDK Type Stubs for Gitdata Certificate System
// These are placeholder types until BSV SDK is properly integrated

export type Base64String = string
export type CertificateFieldNameUnder50Bytes = string

// Mock BSV SDK classes and functions for development
export class Certificate {
  constructor(
    public type: string,
    public serialNumber: string,
    public subject: string,
    public certifier: string,
    public revocationOutpoint: string,
    public fields: Record<string, string>
  ) {}

  async sign(wallet: any): Promise<void> {
    // Mock signing implementation
    console.log('Certificate signed (mock)')
  }
}

export class MasterCertificate {
  static async decryptFields(
    wallet: any,
    keyring: Record<string, string>,
    fields: Record<string, string>,
    identityKey: string
  ): Promise<Record<string, string>> {
    // Mock decryption - in development, just return the fields as-is
    return fields
  }
}

export class VerifiableCertificate {
  constructor(public certificate: Certificate) {}

  async verify(): Promise<boolean> {
    return true // Mock verification
  }
}

export const Utils = {
  toBase64: (data: Uint8Array | number[]): string => {
    if (typeof btoa !== 'undefined') {
      return btoa(String.fromCharCode(...data))
    }
    // Fallback for Node.js environment
    return Buffer.from(data).toString('base64')
  },

  fromBase64: (base64: string): Uint8Array => {
    if (typeof atob !== 'undefined') {
      const binaryString = atob(base64)
      return new Uint8Array([...binaryString].map(char => char.charCodeAt(0)))
    }
    // Fallback for Node.js environment
    return new Uint8Array(Buffer.from(base64, 'base64'))
  },

  toArray: (data: string, encoding: 'base64' | 'hex' = 'base64'): Uint8Array => {
    if (encoding === 'base64') {
      return Utils.fromBase64(data)
    }
    // Handle hex encoding
    const matches = data.match(/.{1,2}/g)
    if (!matches) throw new Error('Invalid hex string')
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)))
  }
}

export async function createNonce(wallet: any, identityKey: string): Promise<string> {
  // Mock nonce creation
  const randomBytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes)
  } else {
    // Fallback random generation
    for (let i = 0; i < 32; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Utils.toBase64(randomBytes)
}

export async function verifyNonce(nonce: string, wallet: any, identityKey: string): Promise<boolean> {
  // Mock nonce verification
  return true
}