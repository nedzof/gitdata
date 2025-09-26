// Gitdata Participant Certificate Type Definition
//
// This certificate is issued to verified participants in the Gitdata ecosystem
// to establish their identity and reputation as data producers/consumers.
//
// Certificate Type ID is generated as a unique identifier for Gitdata certificates

import { Base64String, CertificateFieldNameUnder50Bytes } from "../types/bsv-sdk-stubs"

// Unique identifier for Gitdata Participant Certificate
export const certificateType: Base64String = 'GDt4x8N3mQ7vF1cRyuPXc/C+hjQXL4gPS3PKFBZfqEw='

export const certificateDefinition: Record<CertificateFieldNameUnder50Bytes, string> = {
  participant: 'verified',
  identity_key: '', // BSV identity public key
  display_name: '', // User's chosen display name
  producer_status: '', // active, inactive, verified
  consumer_status: '', // active, inactive, verified
  reputation_score: '', // numerical score (0-100)
  join_date: '', // ISO date string
  overlay_network: '', // overlay network URL
  services_offered: '', // comma-separated list
  region: '', // geographic region
  verified_email: '', // verified email hash
  kyc_level: '' // none, basic, enhanced
}

export const certificateFields: CertificateFieldNameUnder50Bytes[] = Object.keys(certificateDefinition)

// Certificate validation rules
export const validationRules = {
  participant: (value: string) => value === 'verified',
  producer_status: (value: string) => ['active', 'inactive', 'verified'].includes(value),
  consumer_status: (value: string) => ['active', 'inactive', 'verified'].includes(value),
  reputation_score: (value: string) => {
    const score = parseInt(value, 10)
    return !isNaN(score) && score >= 0 && score <= 100
  },
  join_date: (value: string) => {
    const date = new Date(value)
    return !isNaN(date.getTime())
  },
  kyc_level: (value: string) => ['none', 'basic', 'enhanced'].includes(value)
}

// Generate certificate data from user profile
export function generateCertificateData(profile: any) {
  return {
    participant: 'verified',
    identity_key: profile.identityKey || '',
    display_name: profile.displayName || '',
    producer_status: profile.producerInitialized ? 'verified' : 'inactive',
    consumer_status: profile.consumerInitialized ? 'verified' : 'inactive',
    reputation_score: '85', // Default reputation score
    join_date: new Date().toISOString(),
    overlay_network: profile.overlayUrl || 'http://localhost:3000',
    services_offered: profile.capabilities ? profile.capabilities.join(',') : '',
    region: profile.region || 'global',
    verified_email: '', // Hash of verified email
    kyc_level: 'basic'
  }
}