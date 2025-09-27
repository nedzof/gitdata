// GitData Certificate Type Definition
// Based on CoolCert approach but customized for GitData

import { Base64String, CertificateFieldNameUnder50Bytes } from "@bsv/sdk"

// GitData certificate type - customized for GitData users
export const certificateType: Base64String = 'AGfk/WrT1eBDXpz3mcw386Zww2HmqcIn3uY6x4Af1eo='
export const certificateDefinition: Record<CertificateFieldNameUnder50Bytes, string> = {
  cool: 'true'  // This validates that the user is "cool" (similar to CoolCert)
}
export const certificateFields: CertificateFieldNameUnder50Bytes[] = Object.keys(certificateDefinition)