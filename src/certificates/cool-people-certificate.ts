/**
 * Cool People Certificate (CPC) Type Definition
 *
 * A certificate type that verifies someone is "cool" enough to participate
 * in special BSV applications and services. Based on the original CoolCert
 * implementation but integrated into the gitdata platform.
 *
 * Certificate Type Identifier: From CoolCert configuration
 * This identifier matches the one from the CoolCert .env file.
 */

import { Base64String, CertificateFieldNameUnder50Bytes } from '@bsv/sdk';

// Cool People Certificate type identifier (from CoolCert .env)
export const coolCertificateType: Base64String = 'AGfk/WrT1eBDXpz3mcw386Zww2HmqcIn3uY6x4Af1eo=';

// Certificate field definitions - simple "cool" field
export const coolCertificateDefinition: Record<CertificateFieldNameUnder50Bytes, string> = {
  // The only field: whether the person is cool
  cool: 'true'
};

// Extract field names for validation
export const coolCertificateFields: CertificateFieldNameUnder50Bytes[] = Object.keys(coolCertificateDefinition);

// Certificate metadata
export const coolCertificateMetadata = {
  name: 'Cool People Certificate',
  description: 'Verifies that the holder is a cool person in the BSV ecosystem',
  issuer: 'Gitdata Platform (CoolCert Authority)',
  version: '1.0.0',
  validityPeriod: 'indefinite',
};

// Validation rules for Cool People Certificate fields
export const coolFieldValidationRules = {
  cool: {
    required: true,
    allowedValues: ['true'],
    description: 'Must be "true" to qualify for a Cool People Certificate'
  }
};

/**
 * Validate Cool People Certificate field values before signing
 * The only validation is that the "cool" field equals "true"
 */
export function validateCoolCertificateFields(fields: Record<string, string>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // The "cool" validation - must be exactly "true"
  if (!fields.cool || fields.cool !== 'true') {
    errors.push('Sorry, you are not cool enough!');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Prepare Cool People Certificate fields for signing
 * Simply ensures the "cool" field is set to "true"
 */
export function prepareCoolCertificateFields(inputFields: Record<string, string>): Record<string, string> {
  const fields = { ...inputFields };

  // Ensure cool field is set
  if (!fields.cool) {
    fields.cool = 'true';
  }

  return fields;
}