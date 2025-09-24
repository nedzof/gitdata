"""
Comprehensive Test Suite for Consumer CLI
Tests all BRC integrations and CLI functionality
"""

import pytest
import asyncio
import json
import os
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

# Import the modules to test
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from overlay_consumer_cli import OverlayConsumerCLI
from brc_integrations.brc31_identity import BRC31Identity
from brc_integrations.brc24_lookup import BRC24LookupClient
from brc_integrations.brc26_content import BRC26ContentClient
from brc_integrations.brc41_payments import BRC41PaymentClient
from brc_integrations.brc64_analytics import BRC64HistoryTracker
from brc_integrations.brc88_discovery import BRC88ServiceDiscovery
from brc_integrations.d21_native_payments import D21NativePayments
from brc_integrations.consumer_stack import ConsumerBRCStack
from database.consumer_models import ConsumerDatabase

@pytest.fixture
def temp_config():
    """Create temporary configuration for testing"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        config = {
            'overlay_url': 'http://localhost:3000',
            'database_url': 'sqlite:///test.db',
            'identity_file': './test_identity.json',
            'debug': True
        }
        json.dump(config, f)
        yield f.name
    os.unlink(f.name)

@pytest.fixture
def mock_identity():
    """Mock BRC31 identity for testing"""
    identity = MagicMock(spec=BRC31Identity)
    identity.identity_key = 'test_consumer_identity_key'
    identity.private_key_hex = 'abcd1234'
    identity.public_key_hex = 'efgh5678'
    identity.sign_data = AsyncMock(return_value='mock_signature')
    identity.create_auth_headers = AsyncMock(return_value={
        'X-Consumer-Identity': 'test_consumer_identity_key',
        'X-Consumer-Timestamp': '1234567890',
        'X-Consumer-Signature': 'mock_signature'
    })
    return identity

@pytest.fixture
def cli_instance(temp_config):
    """Create CLI instance for testing"""
    return OverlayConsumerCLI(config_path=temp_config)

class TestBRC31Identity:
    """Test BRC-31 Identity functionality"""

    @pytest.mark.asyncio
    async def test_identity_generation(self):
        """Test new identity generation"""
        identity = await BRC31Identity.generate_new()

        assert identity.identity_key is not None
        assert len(identity.identity_key) == 64  # SHA-256 hex
        assert identity.private_key_hex is not None
        assert identity.public_key_hex is not None

    @pytest.mark.asyncio
    async def test_identity_signing(self):
        """Test data signing with identity"""
        identity = await BRC31Identity.generate_new()
        test_data = "test data to sign"

        signature = await identity.sign_data(test_data)

        assert signature is not None
        assert len(signature) == 64  # SHA-256 hex signature

        # Test signature verification
        is_valid = await identity.verify_signature(test_data, signature)
        assert is_valid is True

    @pytest.mark.asyncio
    async def test_auth_headers_creation(self):
        """Test authentication headers creation"""
        identity = await BRC31Identity.generate_new()

        headers = await identity.create_auth_headers()

        assert 'X-Consumer-Identity' in headers
        assert 'X-Consumer-Timestamp' in headers
        assert 'X-Consumer-Signature' in headers
        assert headers['X-Consumer-Identity'] == identity.identity_key

class TestBRC24LookupClient:
    """Test BRC-24 Lookup Services"""

    @pytest.fixture
    def lookup_client(self):
        return BRC24LookupClient('http://localhost:3000')

    @pytest.mark.asyncio
    async def test_content_search(self, lookup_client, mock_identity):
        """Test content search functionality"""
        with patch('aiohttp.ClientSession.post') as mock_post:
            # Mock successful search response
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                'results': [
                    {
                        'content_id': 'test_content_123',
                        'title': 'Test Content',
                        'producer_id': 'test_producer',
                        'price': 100,
                        'uhrp_url': 'uhrp://test-hash'
                    }
                ],
                'total_count': 1
            })
            mock_post.return_value.__aenter__.return_value = mock_response

            search_query = {
                'tags': ['test'],
                'content_type': 'application/json',
                'max_price': 500
            }

            async with lookup_client:
                result = await lookup_client.search_content(
                    query=search_query,
                    consumer_identity=mock_identity.identity_key
                )

            assert 'results' in result
            assert len(result['results']) == 1
            assert result['results'][0]['content_id'] == 'test_content_123'

    @pytest.mark.asyncio
    async def test_content_info_retrieval(self, lookup_client):
        """Test content information retrieval"""
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                'content_id': 'test_content_123',
                'title': 'Test Content',
                'size': 1024,
                'content_type': 'application/json',
                'producer_id': 'test_producer',
                'price': 100
            })
            mock_post.return_value.__aenter__.return_value = mock_response

            async with lookup_client:
                result = await lookup_client.get_content_info(
                    content_id='test_content_123',
                    consumer_identity='test_consumer'
                )

            assert result['content_id'] == 'test_content_123'
            assert result['price'] == 100

class TestBRC41PaymentClient:
    """Test BRC-41 PacketPay Payments"""

    @pytest.fixture
    def payment_client(self):
        return BRC41PaymentClient('http://localhost:3000')

    @pytest.mark.asyncio
    async def test_payment_quote_creation(self, payment_client, mock_identity):
        """Test payment quote creation"""
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 201
            mock_response.json = AsyncMock(return_value={
                'quote_id': 'quote_123',
                'amount': 100,
                'payment_address': 'test_address',
                'expires_at': (datetime.now() + timedelta(minutes=15)).isoformat()
            })
            mock_post.return_value.__aenter__.return_value = mock_response

            async with payment_client:
                quote = await payment_client.create_quote(
                    consumer_identity=mock_identity.identity_key,
                    producer_id='test_producer',
                    resource_id='test_resource',
                    amount=100
                )

            assert quote['quote_id'] == 'quote_123'
            assert quote['amount'] == 100
            assert 'payment_address' in quote

    @pytest.mark.asyncio
    async def test_payment_submission(self, payment_client):
        """Test payment submission"""
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 202
            mock_response.json = AsyncMock(return_value={
                'payment_id': 'payment_123',
                'status': 'submitted',
                'transaction_id': 'tx_123'
            })
            mock_post.return_value.__aenter__.return_value = mock_response

            payment_data = {
                'quote_id': 'quote_123',
                'consumer_identity': 'test_consumer',
                'producer_id': 'test_producer',
                'amount': 100,
                'signature': 'test_signature'
            }

            async with payment_client:
                result = await payment_client.submit_payment(payment_data)

            assert result['payment_id'] == 'payment_123'
            assert result['status'] == 'submitted'

class TestBRC26ContentClient:
    """Test BRC-26 Content Storage"""

    @pytest.fixture
    def content_client(self):
        return BRC26ContentClient('http://localhost:3000')

    @pytest.mark.asyncio
    async def test_content_retrieval(self, content_client, mock_identity):
        """Test content retrieval via UHRP"""
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                'content': 'dGVzdCBjb250ZW50',  # base64 encoded "test content"
                'content_type': 'application/json',
                'content_hash': 'test_hash',
                'size': 12
            })
            mock_post.return_value.__aenter__.return_value = mock_response

            async with content_client:
                result = await content_client.get_content(
                    uhrp_hash='test_hash',
                    consumer_identity=mock_identity.identity_key,
                    access_token='test_token'
                )

            assert 'content' in result
            assert result['content_type'] == 'application/json'

    @pytest.mark.asyncio
    async def test_content_metadata_retrieval(self, content_client):
        """Test content metadata retrieval"""
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                'content_id': 'test_content',
                'size': 1024,
                'content_type': 'application/json',
                'created_at': datetime.now().isoformat(),
                'producer_id': 'test_producer'
            })
            mock_post.return_value.__aenter__.return_value = mock_response

            async with content_client:
                metadata = await content_client.get_content_metadata(
                    uhrp_hash='test_hash',
                    consumer_identity='test_consumer'
                )

            assert metadata['size'] == 1024
            assert metadata['content_type'] == 'application/json'

class TestBRC88ServiceDiscovery:
    """Test BRC-88 Service Discovery"""

    @pytest.fixture
    def discovery_client(self):
        return BRC88ServiceDiscovery('http://localhost:3000')

    @pytest.mark.asyncio
    async def test_service_discovery(self, discovery_client, mock_identity):
        """Test service discovery functionality"""
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                'services': [
                    {
                        'producer_id': 'test_producer',
                        'service_id': 'test_service',
                        'capabilities': ['streaming', 'real-time'],
                        'pricing': {'base_price': 100, 'currency': 'BSV'},
                        'region': 'US',
                        'reputation_score': 0.95
                    }
                ]
            })
            mock_post.return_value.__aenter__.return_value = mock_response

            criteria = {
                'capability': 'streaming',
                'region': 'US',
                'max_price': 200
            }

            async with discovery_client:
                services = await discovery_client.find_services(
                    consumer_identity=mock_identity.identity_key,
                    criteria=criteria
                )

            assert len(services) == 1
            assert services[0]['producer_id'] == 'test_producer'
            assert 'streaming' in services[0]['capabilities']

    @pytest.mark.asyncio
    async def test_streaming_services_discovery(self, discovery_client, mock_identity):
        """Test streaming-specific service discovery"""
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                'services': [
                    {
                        'producer_id': 'streaming_producer',
                        'service_type': 'streaming',
                        'capabilities': {
                            'formats': ['mp4', 'webm'],
                            'max_bitrate': 5000,
                            'latency_ms': 100
                        }
                    }
                ]
            })
            mock_post.return_value.__aenter__.return_value = mock_response

            async with discovery_client:
                streaming_services = await discovery_client.find_streaming_services(
                    consumer_identity=mock_identity.identity_key,
                    stream_type='video'
                )

            assert len(streaming_services) == 1
            assert 'streaming_info' in streaming_services[0]

class TestBRC64HistoryTracker:
    """Test BRC-64 History Tracking"""

    @pytest.fixture
    def mock_database(self):
        db = MagicMock()
        db.log_consumption_event = AsyncMock()
        db.get_consumption_history = AsyncMock(return_value=[
            {
                'event_id': 'event_1',
                'event_type': 'content_access',
                'resource_id': 'resource_1',
                'timestamp': datetime.now().isoformat(),
                'metadata': {'producer_id': 'test_producer', 'cost': 100}
            }
        ])
        return db

    @pytest.fixture
    def history_tracker(self, mock_database):
        return BRC64HistoryTracker(database=mock_database)

    @pytest.mark.asyncio
    async def test_event_logging(self, history_tracker):
        """Test consumption event logging"""
        event_id = await history_tracker.log_event(
            consumer_id='test_consumer',
            event_type='content_access',
            resource_id='test_resource',
            metadata={'producer_id': 'test_producer', 'cost': 100}
        )

        assert event_id is not None
        assert event_id.startswith('event_')

    @pytest.mark.asyncio
    async def test_content_access_tracking(self, history_tracker):
        """Test content access tracking"""
        event_id = await history_tracker.track_content_access(
            consumer_id='test_consumer',
            uhrp_hash='test_hash',
            access_type='download',
            payment_amount=100,
            producer_id='test_producer'
        )

        assert event_id is not None

    @pytest.mark.asyncio
    async def test_analytics_generation(self, history_tracker, mock_database):
        """Test usage analytics generation"""
        analytics = await history_tracker.generate_usage_analytics(
            consumer_id='test_consumer',
            days=30
        )

        assert 'analytics' in analytics
        assert 'total_events' in analytics
        assert analytics['consumer_id'] == 'test_consumer'

class TestConsumerCLI:
    """Test main Consumer CLI functionality"""

    @pytest.mark.asyncio
    async def test_cli_initialization(self, cli_instance):
        """Test CLI initialization"""
        assert cli_instance.config['overlay_url'] == 'http://localhost:3000'
        assert cli_instance.brc_stack is not None

    @pytest.mark.asyncio
    async def test_identity_setup(self, cli_instance):
        """Test identity setup"""
        with patch.object(BRC31Identity, 'generate_new') as mock_generate:
            mock_identity = MagicMock()
            mock_identity.identity_key = 'test_identity_key'
            mock_identity.private_key_hex = 'private_key'
            mock_identity.public_key_hex = 'public_key'
            mock_generate.return_value = mock_identity

            with patch('aiohttp.ClientSession.post') as mock_post:
                mock_response = AsyncMock()
                mock_response.status = 201
                mock_response.json = AsyncMock(return_value={'status': 'registered'})
                mock_post.return_value.__aenter__.return_value = mock_response

                result = await cli_instance.setup_identity(
                    generate_new=True,
                    register_overlay=True
                )

            assert result['identity_key'] == 'test_identity_key'
            assert result['status'] == 'active'

    @pytest.mark.asyncio
    async def test_service_discovery(self, cli_instance, mock_identity):
        """Test service discovery through CLI"""
        cli_instance.identity = mock_identity

        with patch.object(cli_instance.service_discovery, 'find_services') as mock_find:
            mock_find.return_value = [
                {
                    'producer_id': 'test_producer',
                    'service_id': 'test_service',
                    'capabilities': ['streaming']
                }
            ]

            services = await cli_instance.discover_services(
                capability='streaming',
                region='US',
                max_price=1000
            )

            assert len(services) == 1
            assert services[0]['producer_id'] == 'test_producer'

    @pytest.mark.asyncio
    async def test_ready_check(self, cli_instance):
        """Test ready check functionality"""
        with patch('aiohttp.ClientSession.get') as mock_get:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={'status': 'ok'})
            mock_get.return_value.__aenter__.return_value = mock_response

            result = await cli_instance.check_ready(
                version_id='v1.0.0',
                policy={'min_confirmations': 3},
                validate_brc_stack=True
            )

            assert result['is_ready'] is True
            assert result['version_id'] == 'v1.0.0'
            assert 'checks' in result

class TestConsumerBRCStack:
    """Test integrated BRC stack functionality"""

    @pytest.fixture
    def brc_stack(self):
        return ConsumerBRCStack(
            overlay_url='http://localhost:3000',
            database=None
        )

    @pytest.mark.asyncio
    async def test_comprehensive_workflow(self, brc_stack):
        """Test comprehensive consumer workflow"""
        workflow_config = {
            'consumer_identity': 'test_consumer',
            'discovery': {
                'capability': 'streaming',
                'region': 'US',
                'max_price': 1000
            },
            'payment': {
                'amount': 500,
                'method': 'http'
            },
            'content_access': {
                'uhrp_hash': 'test_content_hash'
            }
        }

        with patch('aiohttp.ClientSession.post') as mock_post:
            # Mock all API calls
            responses = [
                # Discovery response
                {'services': [{'producer_id': 'test_producer', 'service_id': 'test_service'}]},
                # Payment response
                {'session_id': 'payment_session_123'},
                # Content access response
                {'content': 'test_content', 'content_type': 'application/json'},
                # Analytics response
                {'tracking_id': 'analytics_123'}
            ]

            mock_responses = []
            for response_data in responses:
                mock_response = AsyncMock()
                mock_response.status = 200 if 'session_id' not in response_data else 201
                mock_response.json = AsyncMock(return_value=response_data)
                mock_responses.append(mock_response)

            mock_post.return_value.__aenter__.side_effect = mock_responses

            async with brc_stack:
                result = await brc_stack.create_comprehensive_workflow(workflow_config)

            assert result['status'] == 'completed'
            assert 'discovery' in result['steps']
            assert 'payment' in result['steps']

if __name__ == '__main__':
    # Run the tests
    pytest.main([__file__, '-v'])