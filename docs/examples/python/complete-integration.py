"""
BSV Overlay Network - Complete Python Integration Example

This example demonstrates all major BSV overlay network features:
- BRC-22: Transaction submission
- BRC-24: Lookup services
- BRC-26: File storage (UHRP)
- BRC-31: Authentication
- BRC-41: Payment processing
- Advanced streaming and federation
"""

import requests
import hashlib
import secrets
import json
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from urllib.parse import urljoin

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@dataclass
class TransactionInput:
    """Transaction input structure"""
    txid: str
    vout: int
    script_sig: str


@dataclass
class FileMetadata:
    """File metadata structure"""
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    content_type: Optional[str] = None
    author: Optional[str] = None
    license: Optional[str] = None
    custom: Optional[Dict[str, Any]] = None


class BSVOverlayClient:
    """Complete BSV Overlay Network client for Python"""

    def __init__(self, base_url: str = 'http://localhost:8788', identity_key: str = None):
        self.base_url = base_url.rstrip('/')
        self.identity_key = identity_key
        self.jwt_token = None
        self.token_expiration = None

        # Setup session with default headers
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'BSV-Overlay-Python-Client/1.0'
        })

    def _add_auth_headers(self, headers: Dict[str, str] = None) -> Dict[str, str]:
        """Add authentication headers to request"""
        if headers is None:
            headers = {}

        if self.identity_key:
            headers['X-BSV-Identity'] = self.identity_key

        if self.jwt_token and self._is_token_valid():
            headers['Authorization'] = f'Bearer {self.jwt_token}'

        return headers

    def _is_token_valid(self) -> bool:
        """Check if JWT token is still valid"""
        if not self.token_expiration:
            return False
        return datetime.now() < self.token_expiration

    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        """Handle API response with error checking"""
        try:
            data = response.json()
        except ValueError:
            raise Exception(f"Invalid JSON response: {response.text}")

        if response.status_code >= 400:
            error_msg = data.get('message', f'HTTP {response.status_code} error')

            # Handle specific error cases
            if response.status_code == 401:
                logger.warning("Authentication failed - refreshing token")
                if hasattr(self, 'authenticate'):
                    self.authenticate()
            elif response.status_code == 402:
                logger.warning("Payment required for this service")
            elif response.status_code == 429:
                logger.warning("Rate limited - implementing backoff")
                time.sleep(1)
            elif response.status_code == 503:
                logger.warning("Overlay network unavailable")

            raise Exception(f"API Error ({response.status_code}): {error_msg}")

        return data

    def _sign_request(self, data: str) -> str:
        """Sign request for authentication (simplified)"""
        # In production, use proper BSV key signing
        return hashlib.sha256(f"{self.identity_key}{data}".encode()).hexdigest()

    # ====================
    # System Status & Health
    # ====================

    def get_status(self) -> Dict[str, Any]:
        """Check overlay network status"""
        logger.info('📊 Checking overlay network status...')
        response = self.session.get(f"{self.base_url}/overlay/status")
        return self._handle_response(response)

    def get_brc_stats(self) -> Dict[str, Any]:
        """Fetch BRC standards statistics"""
        logger.info('📈 Fetching BRC standards statistics...')
        headers = self._add_auth_headers()
        response = self.session.get(f"{self.base_url}/overlay/brc-stats", headers=headers)
        return self._handle_response(response)

    # ====================
    # BRC-31: Authentication
    # ====================

    def generate_nonce(self) -> str:
        """Generate cryptographically secure nonce"""
        return secrets.token_hex(16)

    def authenticate(self, requested_capabilities: List[str] = None) -> Dict[str, Any]:
        """Authenticate with BRC-31 Authrite"""
        logger.info('🔐 Authenticating with BRC-31...')

        if not self.identity_key:
            raise ValueError("Identity key required for authentication")

        if requested_capabilities is None:
            requested_capabilities = ['read', 'write']

        nonce = self.generate_nonce()
        auth_request = {
            'identityKey': self.identity_key,
            'nonce': nonce,
            'certificates': [],
            'requestedCapabilities': requested_capabilities
        }

        try:
            # Sign the request (simplified - use proper BSV signing in production)
            message = nonce + json.dumps(auth_request, separators=(',', ':'))
            signature = self._sign_request(message)

            headers = {
                'Content-Type': 'application/json',
                'X-Authrite': '1.0',
                'X-Authrite-Identity-Key': self.identity_key,
                'X-Authrite-Nonce': nonce,
                'X-Authrite-Signature': signature
            }

            response = self.session.post(
                f"{self.base_url}/overlay/brc31/authenticate",
                json=auth_request,
                headers=headers
            )

            result = self._handle_response(response)

            # Store token and expiration
            self.jwt_token = result.get('token')
            if result.get('expiresAt'):
                self.token_expiration = datetime.fromisoformat(
                    result['expiresAt'].replace('Z', '+00:00')
                )

            logger.info('✅ Authentication successful')
            return result

        except Exception as error:
            logger.error(f'❌ Authentication failed: {error}')
            raise

    # ====================
    # BRC-41: Payment Processing
    # ====================

    def request_payment(self, service: str, satoshis: int, description: str) -> Dict[str, Any]:
        """Request payment for service"""
        logger.info(f'💰 Requesting payment: {satoshis} sats for {service}')

        payment_request = {
            'service': service,
            'satoshis': satoshis,
            'description': description
        }

        headers = self._add_auth_headers()
        response = self.session.post(
            f"{self.base_url}/overlay/brc41/request-payment",
            json=payment_request,
            headers=headers
        )

        result = self._handle_response(response)
        logger.info(f'📋 Payment request created: {result.get("paymentId")}')
        return result

    def complete_payment(self, payment_id: str, raw_tx: str, merkle_proof: List[str] = None) -> Dict[str, Any]:
        """Complete payment with transaction proof"""
        logger.info(f'✅ Completing payment: {payment_id}')

        completion_data = {
            'rawTx': raw_tx,
            'merkleProof': merkle_proof or []
        }

        headers = self._add_auth_headers()
        response = self.session.post(
            f"{self.base_url}/overlay/brc41/payments/{payment_id}/complete",
            json=completion_data,
            headers=headers
        )

        result = self._handle_response(response)
        logger.info('💳 Payment completed successfully')
        return result

    # ====================
    # BRC-22: Transaction Submission
    # ====================

    def submit_transaction(
        self,
        raw_tx: str,
        inputs: List[TransactionInput],
        topics: List[str],
        mapi_responses: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Submit transaction to overlay network"""
        logger.info(f'📝 Submitting transaction to topics: {", ".join(topics)}')

        # Convert inputs to dict format
        input_dicts = []
        for inp in inputs:
            input_dicts.append({
                'txid': inp.txid,
                'vout': inp.vout,
                'scriptSig': inp.script_sig
            })

        transaction = {
            'rawTx': raw_tx,
            'inputs': input_dicts,
            'topics': topics,
            'mapiResponses': mapi_responses or []
        }

        headers = self._add_auth_headers()
        response = self.session.post(
            f"{self.base_url}/overlay/submit",
            json=transaction,
            headers=headers
        )

        result = self._handle_response(response)
        logger.info(f'✅ Transaction submitted: {result.get("result", {}).get("txid")}')
        return result

    # ====================
    # BRC-24: Lookup Services
    # ====================

    def lookup(self, provider: str, query: Dict[str, Any]) -> Dict[str, Any]:
        """Query lookup service provider"""
        logger.info(f'🔍 Querying {provider} with query parameters')

        lookup_request = {
            'provider': provider,
            'query': query
        }

        headers = self._add_auth_headers()
        response = self.session.post(
            f"{self.base_url}/overlay/lookup",
            json=lookup_request,
            headers=headers
        )

        result = self._handle_response(response)
        results_count = len(result.get('results', []))
        logger.info(f'📊 Found {results_count} results')
        return result

    def get_lookup_providers(self) -> Dict[str, Any]:
        """Get available lookup providers"""
        logger.info('📋 Fetching available lookup providers...')
        response = self.session.get(f"{self.base_url}/overlay/lookup/providers")
        result = self._handle_response(response)
        return result.get('providers', [])

    def find_utxos(self, topic: str, filters: Dict[str, Any] = None, limit: int = 20) -> Dict[str, Any]:
        """Find UTXOs by topic with optional filters"""
        query = {
            'topic': topic,
            'limit': limit
        }
        if filters:
            query['filters'] = filters

        return self.lookup('utxo-tracker', query)

    def search_transactions(
        self,
        topic: str = None,
        date_range: Dict[str, str] = None,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Search transaction history"""
        query = {'limit': limit}

        if topic:
            query['topic'] = topic
        if date_range:
            query['dateRange'] = date_range

        return self.lookup('transaction-index', query)

    # ====================
    # BRC-26: File Storage (UHRP)
    # ====================

    def calculate_content_hash(self, file_path: Union[str, Path]) -> str:
        """Calculate SHA-256 content hash for file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()

    def upload_file(self, file_path: Union[str, Path], metadata: FileMetadata = None) -> Dict[str, Any]:
        """Upload file to overlay network"""
        file_path = Path(file_path)
        logger.info(f'📤 Uploading file: {file_path}')

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Prepare file and metadata
        files = {'file': open(file_path, 'rb')}
        data = {}

        if metadata:
            metadata_dict = {}
            if metadata.description:
                metadata_dict['description'] = metadata.description
            if metadata.category:
                metadata_dict['category'] = metadata.category
            if metadata.tags:
                metadata_dict['tags'] = metadata.tags
            if metadata.content_type:
                metadata_dict['contentType'] = metadata.content_type
            if metadata.author:
                metadata_dict['author'] = metadata.author
            if metadata.license:
                metadata_dict['license'] = metadata.license
            if metadata.custom:
                metadata_dict['custom'] = metadata.custom

            data['metadata'] = json.dumps(metadata_dict)

        try:
            headers = self._add_auth_headers({})
            # Remove Content-Type for multipart upload
            headers.pop('Content-Type', None)

            response = self.session.post(
                f"{self.base_url}/overlay/files/upload",
                files=files,
                data=data,
                headers=headers
            )

            result = self._handle_response(response)
            logger.info(f'✅ File uploaded: {result.get("contentHash")}')
            return result

        finally:
            files['file'].close()

    def download_file(self, content_hash: str, output_path: Union[str, Path] = None) -> Union[bytes, str]:
        """Download file from overlay network"""
        logger.info(f'📥 Downloading file: {content_hash}')

        response = self.session.get(
            f"{self.base_url}/overlay/files/download/{content_hash}",
            stream=True
        )

        if response.status_code >= 400:
            self._handle_response(response)

        if output_path:
            output_path = Path(output_path)
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            logger.info(f'✅ File downloaded to: {output_path}')
            return str(output_path)

        return response.content

    def resolve_content(self, content_hash: str) -> Dict[str, Any]:
        """Resolve content metadata"""
        logger.info(f'🔍 Resolving content: {content_hash}')
        response = self.session.get(f"{self.base_url}/overlay/files/resolve/{content_hash}")
        return self._handle_response(response)

    # ====================
    # BRC-64: History Tracking
    # ====================

    def get_transaction_history(self, utxo_id: str) -> Dict[str, Any]:
        """Get transaction history for UTXO"""
        logger.info(f'📚 Fetching transaction history: {utxo_id}')
        response = self.session.get(f"{self.base_url}/overlay/history/{utxo_id}")
        return self._handle_response(response)

    def get_lineage(self, utxo_id: str) -> Dict[str, Any]:
        """Get lineage graph for UTXO"""
        logger.info(f'🌳 Fetching lineage graph: {utxo_id}')
        response = self.session.get(f"{self.base_url}/overlay/lineage/{utxo_id}")
        return self._handle_response(response)

    # ====================
    # BRC-88: Service Discovery
    # ====================

    def get_ship_advertisements(self) -> Dict[str, Any]:
        """Get SHIP service advertisements"""
        logger.info('🚢 Fetching SHIP service advertisements...')
        response = self.session.get(f"{self.base_url}/overlay/services/ship")
        return self._handle_response(response)

    def get_slap_services(self) -> Dict[str, Any]:
        """Get SLAP service lookup"""
        logger.info('🔍 Fetching SLAP service lookup...')
        response = self.session.get(f"{self.base_url}/overlay/services/slap")
        return self._handle_response(response)

    def advertise_service(self, service_info: Dict[str, Any]) -> Dict[str, Any]:
        """Advertise overlay service"""
        logger.info('📢 Advertising overlay service...')
        headers = self._add_auth_headers()
        response = self.session.post(
            f"{self.base_url}/overlay/services/ship/advertise",
            json=service_info,
            headers=headers
        )
        return self._handle_response(response)

    # ====================
    # Advanced Streaming
    # ====================

    def upload_streaming_content(
        self,
        file_path: Union[str, Path],
        transcode: bool = True,
        qualities: List[str] = None
    ) -> Dict[str, Any]:
        """Upload streaming content with transcoding"""
        file_path = Path(file_path)
        logger.info(f'🎬 Uploading streaming content: {file_path}')

        if qualities is None:
            qualities = ['720p', '1080p']

        files = {'file': open(file_path, 'rb')}
        data = {
            'transcode': str(transcode).lower(),
            'qualities': json.dumps(qualities)
        }

        try:
            headers = self._add_auth_headers({})
            headers.pop('Content-Type', None)

            response = self.session.post(
                f"{self.base_url}/overlay/streaming/upload",
                files=files,
                data=data,
                headers=headers
            )

            result = self._handle_response(response)
            logger.info(f'✅ Streaming content uploaded: {result.get("contentId")}')
            return result

        finally:
            files['file'].close()

    def create_live_stream(
        self,
        title: str,
        description: str,
        qualities: List[str] = None
    ) -> Dict[str, Any]:
        """Create live stream"""
        logger.info(f'🔴 Creating live stream: {title}')

        stream_request = {
            'title': title,
            'description': description,
            'qualities': qualities or []
        }

        headers = self._add_auth_headers()
        response = self.session.post(
            f"{self.base_url}/overlay/streaming/live/create",
            json=stream_request,
            headers=headers
        )

        result = self._handle_response(response)
        stream_id = result.get('stream', {}).get('streamId')
        logger.info(f'✅ Live stream created: {stream_id}')
        return result

    def start_live_stream(self, stream_id: str) -> Dict[str, Any]:
        """Start live stream"""
        logger.info(f'▶️ Starting live stream: {stream_id}')
        headers = self._add_auth_headers()
        response = self.session.post(
            f"{self.base_url}/overlay/streaming/live/{stream_id}/start",
            headers=headers
        )
        return self._handle_response(response)

    def stop_live_stream(self, stream_id: str) -> Dict[str, Any]:
        """Stop live stream"""
        logger.info(f'⏹️ Stopping live stream: {stream_id}')
        headers = self._add_auth_headers()
        response = self.session.post(
            f"{self.base_url}/overlay/streaming/live/{stream_id}/stop",
            headers=headers
        )
        return self._handle_response(response)

    def get_stream_analytics(self, stream_id: str, time_range: Dict[str, str] = None) -> Dict[str, Any]:
        """Get stream analytics"""
        logger.info(f'📊 Fetching stream analytics: {stream_id}')

        url = f"{self.base_url}/overlay/streaming/live/{stream_id}/analytics"
        if time_range:
            params = '&'.join([f"{k}={v}" for k, v in time_range.items()])
            url += f"?{params}"

        headers = self._add_auth_headers()
        response = self.session.get(url, headers=headers)
        return self._handle_response(response)

    # ====================
    # Federation Network
    # ====================

    def get_federation_status(self) -> Dict[str, Any]:
        """Get federation network status"""
        logger.info('🌐 Checking federation network status...')
        response = self.session.get(f"{self.base_url}/overlay/federation/status")
        return self._handle_response(response)

    def discover_nodes(self, region: str = None) -> Dict[str, Any]:
        """Discover federation nodes"""
        region_text = f' in {region}' if region else ''
        logger.info(f'🔍 Discovering federation nodes{region_text}...')

        url = f"{self.base_url}/overlay/federation/nodes"
        if region:
            url += f"?region={region}"

        response = self.session.get(url)
        return self._handle_response(response)

    def discover_global_content(self, content_hash: str) -> Dict[str, Any]:
        """Discover global content"""
        logger.info(f'🌍 Discovering global content: {content_hash}')
        response = self.session.get(f"{self.base_url}/overlay/federation/content/discover/{content_hash}")
        return self._handle_response(response)

    # ====================
    # CDN Integration
    # ====================

    def get_cdn_url(self, content_path: str, region: str = None) -> Dict[str, Any]:
        """Get CDN URL for content"""
        logger.info(f'🌐 Getting CDN URL for: {content_path}')

        url = f"{self.base_url}/overlay/cdn/url{content_path}"
        if region:
            url += f"?region={region}"

        response = self.session.get(url)
        return self._handle_response(response)

    def purge_cdn_cache(self, content_path: str) -> Dict[str, Any]:
        """Purge CDN cache for content"""
        logger.info(f'🗑️ Purging CDN cache for: {content_path}')

        headers = self._add_auth_headers()
        response = self.session.post(
            f"{self.base_url}/overlay/cdn/purge",
            json={'contentPath': content_path},
            headers=headers
        )
        return self._handle_response(response)


# ====================
# Usage Examples & Demo
# ====================

def demonstrate_overlay_network():
    """Comprehensive BSV Overlay Network demonstration"""
    print('🚀 BSV Overlay Network Python Integration Demo')
    print('=' * 50)

    # Initialize client
    identity_key = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
    client = BSVOverlayClient('http://localhost:8788', identity_key)

    try:
        # 1. Check system status
        print('\n1️⃣ System Status Check')
        status = client.get_status()
        print(f'Network connected: {status.get("connected")}')
        services = status.get('services', {})
        print(f'Available services: {", ".join(services.keys())}')

        # 2. Authenticate
        print('\n2️⃣ Authentication')
        auth_result = client.authenticate(['read', 'write', 'file-upload'])
        print(f'Authentication successful: {auth_result.get("success")}')
        print(f'Granted capabilities: {auth_result.get("capabilities")}')

        # 3. Upload a file
        print('\n3️⃣ File Upload (BRC-26)')
        test_file = Path('test-data.json')
        test_data = {'message': 'Hello BSV Overlay Network from Python!'}

        # Create test file
        with open(test_file, 'w') as f:
            json.dump(test_data, f, indent=2)

        metadata = FileMetadata(
            description='Demo file upload from Python',
            category='example',
            tags=['test', 'python', 'demo'],
            author='Python Client'
        )

        upload_result = client.upload_file(test_file, metadata)
        content_hash = upload_result.get('contentHash')
        print(f'Content hash: {content_hash}')

        # Verify hash
        calculated_hash = client.calculate_content_hash(test_file)
        print(f'Hash verified: {content_hash == calculated_hash}')

        # 4. Query with lookup service
        print('\n4️⃣ Lookup Service (BRC-24)')
        lookup_result = client.lookup('utxo-tracker', {
            'topic': 'gitdata.manifest',
            'limit': 5
        })
        results_count = len(lookup_result.get('results', []))
        print(f'Found {results_count} results')

        # 5. Download the uploaded file
        print('\n5️⃣ File Download')
        downloaded_file = Path('downloaded-test-data.json')
        client.download_file(content_hash, downloaded_file)

        # Verify content matches
        with open(downloaded_file, 'r') as f:
            downloaded_data = json.load(f)
        print(f'Content verified: {test_data == downloaded_data}')

        # 6. Resolve content metadata
        print('\n6️⃣ Content Resolution')
        metadata_result = client.resolve_content(content_hash)
        print(f'File exists: {metadata_result.get("exists")}')
        print(f'File size: {metadata_result.get("metadata", {}).get("size")} bytes')

        # 7. Get BRC statistics
        print('\n7️⃣ BRC Standards Statistics')
        stats = client.get_brc_stats()
        print('BRC standards compliance verified')

        # 8. Federation discovery
        print('\n8️⃣ Federation Network')
        federation_status = client.get_federation_status()
        federation_enabled = federation_status.get('federation', {}).get('enabled', False)
        print(f'Federation enabled: {federation_enabled}')

        # 9. Service discovery
        print('\n9️⃣ Service Discovery')
        ship_ads = client.get_ship_advertisements()
        print(f'SHIP services discovered: {len(ship_ads.get("services", []))}')

        print('\n✅ Demo completed successfully!')
        print('\n📚 Next steps:')
        print('- Integrate with your Bitcoin wallet library')
        print('- Set up production authentication with real BSV keys')
        print('- Configure payment processing with BRC-41')
        print('- Deploy to your overlay network')

    except Exception as error:
        print(f'❌ Demo failed: {error}')

        # Provide helpful debugging information
        if 'Connection refused' in str(error):
            print('\n💡 Troubleshooting:')
            print('1. Make sure the overlay network server is running')
            print('2. Check if port 8788 is available')
            print('3. Verify your network configuration')
            print('4. Run: curl http://localhost:8788/overlay/status')

    finally:
        # Cleanup test files
        for file_path in ['test-data.json', 'downloaded-test-data.json']:
            path = Path(file_path)
            if path.exists():
                path.unlink()


# Utility functions for common operations

def create_mock_transaction_inputs() -> List[TransactionInput]:
    """Create mock transaction inputs for testing"""
    return [
        TransactionInput(
            txid='a' * 64,  # Mock transaction ID
            vout=0,
            script_sig='47304402201234567890abcdef1234567890abcdef1234567890abcdef'
        )
    ]


def create_test_file(file_path: Union[str, Path], content: Dict[str, Any]) -> Path:
    """Create a test file with JSON content"""
    file_path = Path(file_path)
    with open(file_path, 'w') as f:
        json.dump(content, f, indent=2)
    return file_path


if __name__ == '__main__':
    # Run the demonstration
    demonstrate_overlay_network()