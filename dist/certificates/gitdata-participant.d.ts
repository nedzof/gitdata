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
import { Base64String, CertificateFieldNameUnder50Bytes } from '@bsv/sdk';
export declare const certificateType: Base64String;
export declare const certificateDefinition: Record<CertificateFieldNameUnder50Bytes, string>;
export declare const certificateFields: CertificateFieldNameUnder50Bytes[];
export declare const certificateMetadata: {
    name: string;
    description: string;
    issuer: string;
    version: string;
    validityPeriod: string;
};
export declare const fieldValidationRules: {
    display_name: {
        required: boolean;
        minLength: number;
        maxLength: number;
        pattern: RegExp;
        description: string;
    };
    participant: {
        required: boolean;
        allowedValues: string[];
        description: string;
    };
    level: {
        required: boolean;
        allowedValues: string[];
        default: string;
        description: string;
    };
    verified_at: {
        required: boolean;
        description: string;
    };
};
/**
 * Validate certificate field values before signing
 */
export declare function validateCertificateFields(fields: Record<string, string>): {
    valid: boolean;
    errors: string[];
};
/**
 * Prepare certificate fields for signing
 * This sets default values and current timestamp
 */
export declare function prepareCertificateFields(inputFields: Record<string, string>): Record<string, string>;
