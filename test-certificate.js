// Test GitData Certificate Authority Integration
// Following CoolCert patterns exactly as requested

const { WalletClient, createNonce, MasterCertificate, Utils } = require('@bsv/sdk')

async function testCertificateFlow() {
  console.log('🧪 Testing GitData Certificate Authority...\n')

  try {
    // 1. Initialize wallet client (following PeerPay pattern)
    console.log('1️⃣ Initializing wallet client...')
    const walletClient = new WalletClient()

    // 2. Wait for authentication (following PeerPay pattern)
    console.log('2️⃣ Waiting for wallet authentication...')
    await walletClient.waitForAuthentication()

    // 3. Get identity key (following PeerPay pattern)
    console.log('3️⃣ Getting identity key...')
    const identityKey = await walletClient.getPublicKey({ identityKey: true })
    console.log('Identity key:', identityKey.publicKey)

    // 4. Create client nonce (following CoolCert pattern exactly)
    console.log('4️⃣ Creating client nonce...')
    const clientNonce = await createNonce(walletClient, identityKey.publicKey)
    console.log('Client nonce:', clientNonce)

    // 5. Prepare certificate fields (following CoolCert pattern exactly)
    console.log('5️⃣ Preparing certificate fields...')
    const certificateType = 'AGfk/WrT1eBDXpz3mcw386Zww2HmqcIn3uY6x4Af1eo=' // GitData certificate type
    const fields = { cool: 'true' } // Must be "true" to pass validation

    // 6. Encrypt certificate fields (following CoolCert pattern exactly)
    console.log('6️⃣ Encrypting certificate fields...')
    const { encryptedFields, masterKeyring } = await MasterCertificate.encryptFields(
      walletClient,
      fields,
      identityKey.publicKey // counterparty is self for testing
    )

    console.log('Encrypted fields:', encryptedFields)
    console.log('Master keyring keys:', Object.keys(masterKeyring))

    // 7. Create CSR payload (following CoolCert pattern exactly)
    const csrPayload = {
      type: certificateType,
      clientNonce,
      fields: encryptedFields,
      masterKeyring
    }

    console.log('7️⃣ Certificate signing request prepared!')
    console.log('CSR payload structure:')
    console.log('- type:', csrPayload.type)
    console.log('- clientNonce length:', csrPayload.clientNonce.length)
    console.log('- fields keys:', Object.keys(csrPayload.fields))
    console.log('- keyring keys:', Object.keys(csrPayload.masterKeyring))

    // 8. Test with GitData certificate server
    console.log('8️⃣ Sending CSR to GitData certificate server...')

    // Create auth headers (following BSV auth middleware pattern)
    const authHeaders = await walletClient.createAuthHeaders({
      url: 'http://localhost:3000/signCertificate',
      method: 'POST',
      body: JSON.stringify(csrPayload),
      identityKey: true
    })

    const response = await fetch('http://localhost:3000/signCertificate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(csrPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Certificate signed successfully!')
    console.log('Server response:')
    console.log('- certificate type:', result.certificate.type)
    console.log('- subject:', result.certificate.subject)
    console.log('- certifier:', result.certificate.certifier)
    console.log('- serial number:', result.certificate.serialNumber)
    console.log('- server nonce:', result.serverNonce)
    console.log('- certificate fields:', result.certificate.fields)

    console.log('\n🎉 GitData Certificate Authority integration test completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error.message)

    // Enhanced error logging (following PeerPay pattern)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }

    process.exit(1)
  }
}

// Run the test
testCertificateFlow().catch(console.error)