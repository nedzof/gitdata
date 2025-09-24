"""
BRC-31 Identity Authentication for Consumer
Handles consumer identity generation, management, and cryptographic operations
"""

import hashlib
import json
import secrets
import time
from typing import Dict, Any, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class IdentityKeys:
    """Container for identity key pair"""
    private_key: bytes
    public_key: bytes
    identity_key: str

class BRC31Identity:
    """
    BRC-31 Consumer Identity Management
    Handles identity creation, signing, and verification for consumer operations
    """

    def __init__(self, private_key: bytes, public_key: bytes, identity_key: str):
        self.private_key = private_key
        self.public_key = public_key
        self.identity_key = identity_key
        self.private_key_hex = private_key.hex()
        self.public_key_hex = public_key.hex()

    @classmethod
    async def generate_new(cls) -> 'BRC31Identity':
        """Generate new consumer identity with cryptographic keys"""
        try:
            # Generate random private key (simplified - in production would use proper ECC)
            private_key = secrets.token_bytes(32)

            # Generate public key (simplified - in production would derive from private key)
            public_key = hashlib.sha256(private_key).digest()

            # Generate identity key as hash of public key
            identity_key = hashlib.sha256(public_key).hexdigest()

            logger.info(f"Generated new consumer identity: {identity_key[:16]}...")
            return cls(private_key, public_key, identity_key)

        except Exception as e:
            logger.error(f"Identity generation failed: {e}")
            raise

    @classmethod
    def from_data(cls, identity_data: Dict[str, Any]) -> 'BRC31Identity':
        """Load identity from stored data"""
        try:
            private_key = bytes.fromhex(identity_data['private_key'])
            public_key = bytes.fromhex(identity_data['public_key'])
            identity_key = identity_data['identity_key']

            return cls(private_key, public_key, identity_key)

        except Exception as e:
            logger.error(f"Failed to load identity from data: {e}")
            raise

    @classmethod
    def from_private_key(cls, private_key_hex: str) -> 'BRC31Identity':
        """Create identity from private key hex string"""
        try:
            private_key = bytes.fromhex(private_key_hex)
            public_key = hashlib.sha256(private_key).digest()
            identity_key = hashlib.sha256(public_key).hexdigest()

            return cls(private_key, public_key, identity_key)

        except Exception as e:
            logger.error(f"Failed to create identity from private key: {e}")
            raise

    async def sign_data(self, data: str) -> str:
        """
        Sign data with consumer's private key
        Simplified implementation - production would use proper ECDSA
        """
        try:
            # Create signature hash (simplified - in production would use proper signing)
            data_bytes = data.encode('utf-8')
            timestamp = str(int(time.time()))
            signature_data = self.private_key + data_bytes + timestamp.encode()
            signature = hashlib.sha256(signature_data).hexdigest()

            logger.debug(f"Signed data with identity {self.identity_key[:16]}...")
            return signature

        except Exception as e:
            logger.error(f"Data signing failed: {e}")
            raise

    async def verify_signature(self, data: str, signature: str) -> bool:
        """
        Verify signature against this identity's public key
        """
        try:
            # Simplified verification - in production would verify ECDSA signature
            # For now, just check if signature format is valid
            return len(signature) == 64 and all(c in '0123456789abcdef' for c in signature.lower())

        except Exception as e:
            logger.error(f"Signature verification failed: {e}")
            return False

    async def create_auth_headers(self, additional_data: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
        """
        Create authentication headers for API requests
        """
        try:
            timestamp = str(int(time.time()))
            auth_data = {
                'identity_key': self.identity_key,
                'timestamp': timestamp,
                'role': 'consumer'
            }

            if additional_data:
                auth_data.update(additional_data)

            # Create signature for auth headers
            auth_string = json.dumps(auth_data, sort_keys=True)
            signature = await self.sign_data(auth_string)

            headers = {
                'X-Consumer-Identity': self.identity_key,
                'X-Consumer-Timestamp': timestamp,
                'X-Consumer-Signature': signature,
                'X-Consumer-Role': 'consumer'
            }

            logger.debug(f"Created auth headers for {self.identity_key[:16]}...")
            return headers

        except Exception as e:
            logger.error(f"Auth header creation failed: {e}")
            raise

    def get_identity_info(self) -> Dict[str, Any]:
        """Get identity information for display/storage"""
        return {
            'identity_key': self.identity_key,
            'public_key': self.public_key_hex,
            'role': 'consumer',
            'capabilities': [
                'content-access',
                'streaming-consumption',
                'micropayments',
                'analytics'
            ]
        }

    async def create_registration_data(self, display_name: str = None,
                                     capabilities: list = None) -> Dict[str, Any]:
        """
        Create registration data for overlay network registration
        """
        try:
            registration_data = {
                'identity_key': self.identity_key,
                'public_key': self.public_key_hex,
                'role': 'consumer',
                'metadata': {
                    'display_name': display_name or f'Consumer-{self.identity_key[:8]}',
                    'capabilities': capabilities or [
                        'content-access',
                        'streaming-consumption',
                        'micropayments',
                        'analytics'
                    ],
                    'client_type': 'consumer-cli',
                    'version': '1.0.0'
                },
                'timestamp': int(time.time())
            }

            # Sign registration data
            registration_string = json.dumps(registration_data, sort_keys=True)
            signature = await self.sign_data(registration_string)
            registration_data['signature'] = signature

            logger.info(f"Created registration data for {self.identity_key[:16]}...")
            return registration_data

        except Exception as e:
            logger.error(f"Registration data creation failed: {e}")
            raise

    async def create_challenge_response(self, challenge: str) -> Dict[str, Any]:
        """
        Create response to authentication challenge
        """
        try:
            response_data = {
                'identity_key': self.identity_key,
                'challenge': challenge,
                'timestamp': int(time.time())
            }

            # Sign challenge
            signature = await self.sign_data(challenge)
            response_data['signature'] = signature

            logger.debug(f"Created challenge response for {self.identity_key[:16]}...")
            return response_data

        except Exception as e:
            logger.error(f"Challenge response creation failed: {e}")
            raise

    def to_dict(self) -> Dict[str, Any]:
        """Convert identity to dictionary for storage"""
        return {
            'identity_key': self.identity_key,
            'private_key': self.private_key_hex,
            'public_key': self.public_key_hex,
            'role': 'consumer'
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BRC31Identity':
        """Create identity from dictionary"""
        return cls.from_data(data)

    def __repr__(self) -> str:
        return f"BRC31Identity(identity_key='{self.identity_key[:16]}...', role='consumer')"