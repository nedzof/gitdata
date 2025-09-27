// GitData Wallet Utilities
// Based on PeerPay wallet verification patterns (without React dependencies)

import { WalletClient } from '@bsv/sdk'

export interface WalletVerificationResult {
  isConnected: boolean
  identityKey?: string
  error?: string
}

export interface IdentityKeyValidation {
  isValid: boolean
  error?: string
}

// Initialize wallet client (copied from PeerPay pattern)
export const createWalletClient = (): WalletClient => {
  return new WalletClient()
}

// Wait for wallet authentication (copied from PeerPay pattern)
export const waitForWalletAuthentication = async (walletClient: WalletClient): Promise<WalletVerificationResult> => {
  try {
    await walletClient.waitForAuthentication()

    // Get identity key after authentication
    const identityKey = await walletClient.getPublicKey({ identityKey: true })

    return {
      isConnected: true,
      identityKey: identityKey.publicKey
    }
  } catch (error) {
    console.error('Wallet authentication failed:', error)
    return {
      isConnected: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    }
  }
}

// Validate if a string is a valid Bitcoin public key (copied from PeerPay qrUtils pattern)
export const isValidIdentityKey = (key: string): boolean => {
  const trimmed = key.trim()
  return /^[0-9a-fA-F]{66}$/.test(trimmed) && (trimmed.startsWith('02') || trimmed.startsWith('03'))
}

// Validate identity key with detailed error messages
export const validateIdentityKey = (key: string): IdentityKeyValidation => {
  if (!key || key.trim().length === 0) {
    return {
      isValid: false,
      error: 'Identity key cannot be empty'
    }
  }

  const trimmed = key.trim()

  if (trimmed.length !== 66) {
    return {
      isValid: false,
      error: `Identity key must be 66 characters long, got ${trimmed.length}`
    }
  }

  if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Identity key must contain only hexadecimal characters'
    }
  }

  if (!trimmed.startsWith('02') && !trimmed.startsWith('03')) {
    return {
      isValid: false,
      error: 'Identity key must start with 02 or 03'
    }
  }

  return {
    isValid: true
  }
}

// Format identity key for display (copied from PeerPay qrUtils pattern)
export const formatIdentityKey = (key: string, length: number = 8): string => {
  if (key.length <= length * 2) return key
  return `${key.substring(0, length)}...${key.substring(key.length - length)}`
}

// Parse potential identity key from various formats (copied from PeerPay qrUtils pattern)
export const parseIdentityKey = (data: string): string | null => {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(data)

    // Check for structured format
    if (parsed.type === 'identity' && parsed.identityKey) {
      return parsed.identityKey
    }

    // Check for common JSON formats
    if (parsed.publicKey && typeof parsed.publicKey === 'string') {
      return parsed.publicKey
    }

    if (parsed.identityKey && typeof parsed.identityKey === 'string') {
      return parsed.identityKey
    }

    if (parsed.key && typeof parsed.key === 'string') {
      return parsed.key
    }

    // If it's a JSON object but no recognizable key field, return null
    console.warn('JSON data found but no recognizable key field:', parsed)
    return null
  } catch {
    // Not JSON, treat as raw string
    const trimmed = data.trim()

    // Validate if it looks like a Bitcoin public key (66 hex characters)
    if (isValidIdentityKey(trimmed)) {
      return trimmed
    }

    // Check if it's a longer hex string that might contain a public key
    if (/^[0-9a-fA-F]{64,}$/.test(trimmed)) {
      // Try to extract 66-character segments
      for (let i = 0; i <= trimmed.length - 66; i++) {
        const segment = trimmed.substring(i, i + 66)
        if (segment.startsWith('02') || segment.startsWith('03')) {
          return segment
        }
      }
    }

    console.warn('Data does not appear to be a valid identity key:', data)
    return null
  }
}

// Check wallet connection status
export const checkWalletConnection = async (walletClient: WalletClient): Promise<WalletVerificationResult> => {
  try {
    // Try to get public key to test connection
    const identityKey = await walletClient.getPublicKey({ identityKey: true })

    return {
      isConnected: true,
      identityKey: identityKey.publicKey
    }
  } catch (error) {
    return {
      isConnected: false,
      error: error instanceof Error ? error.message : 'Wallet not connected'
    }
  }
}

// Enhanced logging with stack trace (copied from PeerPay pattern)
export const enhancedLog = (...args: any[]) => {
  const formattedArgs = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2)
      } catch (e) {
        return '[Unstringifiable object]'
      }
    }
    return arg
  })

  const stack = new Error().stack?.split('\n')[2]?.trim()
  console.log('[GITDATA]', ...formattedArgs, '\n→', stack)
}