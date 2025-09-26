"use strict";
/**
 * Gitdata Participant Certificate Type Definition
 *
 * A certificate type for gitdata platform participants.
 * This certificate verifies that a user is a legitimate participant
 * in the gitdata overlay network and BSV ecosystem.
 *
 * Certificate Type Identifier: Generated using Utils.toBase64(Random(32))
 * This identifier must be unique and should not be reused.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fieldValidationRules = exports.certificateMetadata = exports.certificateFields = exports.certificateDefinition = exports.certificateType = void 0;
exports.validateCertificateFields = validateCertificateFields;
exports.prepareCertificateFields = prepareCertificateFields;
// Unique certificate type identifier for gitdata participants
// Generated using Utils.toBase64(Random(32))
exports.certificateType = 'jVNgF8+rifnz00856b4TkThCAvfiUE4p+t/aHYl1u0c=';
// Certificate field definitions
exports.certificateDefinition = {
    // Display name for the participant
    display_name: '', // Will be filled by user input
    // Participant status - verified participant in gitdata network
    participant: 'verified',
    // Platform participation level
    level: 'standard', // or 'premium', 'developer', etc.
    // Verification timestamp (will be set during issuance)
    verified_at: '', // Will be set to current timestamp during signing
};
// Extract field names for validation
exports.certificateFields = Object.keys(exports.certificateDefinition);
// Certificate metadata
exports.certificateMetadata = {
    name: 'Gitdata Participant Certificate',
    description: 'Verifies legitimate participation in the Gitdata overlay network',
    issuer: 'Gitdata Platform',
    version: '1.0.0',
    validityPeriod: '365 days', // 1 year validity
};
// Validation rules for certificate fields
exports.fieldValidationRules = {
    display_name: {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9\s\-_.]+$/,
        description: 'Must be 2-50 characters, alphanumeric with spaces, hyphens, underscores, and periods'
    },
    participant: {
        required: true,
        allowedValues: ['verified', 'pending', 'suspended'],
        description: 'Participant status in the gitdata network'
    },
    level: {
        required: false,
        allowedValues: ['standard', 'premium', 'developer', 'enterprise'],
        default: 'standard',
        description: 'Participation level in the gitdata platform'
    },
    verified_at: {
        required: true,
        description: 'ISO timestamp when verification occurred'
    }
};
/**
 * Validate certificate field values before signing
 */
function validateCertificateFields(fields) {
    const errors = [];
    // Validate display_name
    if (!fields.display_name || fields.display_name.trim() === '') {
        errors.push('Display name is required');
    }
    else if (fields.display_name.length < 2 || fields.display_name.length > 50) {
        errors.push('Display name must be between 2 and 50 characters');
    }
    else if (!exports.fieldValidationRules.display_name.pattern.test(fields.display_name)) {
        errors.push('Display name contains invalid characters');
    }
    // Validate participant status
    if (!fields.participant || !exports.fieldValidationRules.participant.allowedValues.includes(fields.participant)) {
        errors.push('Invalid participant status');
    }
    // Validate level if provided
    if (fields.level && !exports.fieldValidationRules.level.allowedValues.includes(fields.level)) {
        errors.push('Invalid participation level');
    }
    return {
        valid: errors.length === 0,
        errors
    };
}
/**
 * Prepare certificate fields for signing
 * This sets default values and current timestamp
 */
function prepareCertificateFields(inputFields) {
    const fields = { ...inputFields };
    // Set default values
    if (!fields.participant) {
        fields.participant = 'verified';
    }
    if (!fields.level) {
        fields.level = 'standard';
    }
    // Set current timestamp
    fields.verified_at = new Date().toISOString();
    return fields;
}
//# sourceMappingURL=gitdata-participant.js.map