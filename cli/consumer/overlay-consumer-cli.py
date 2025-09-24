#!/usr/bin/env python3
"""
BSV Overlay Network Consumer CLI (D14)
Complete BRC Stack Integration for Consumer Operations

This CLI provides comprehensive consumer functionality leveraging the full BRC overlay network stack:
- BRC-31: Identity Authentication
- BRC-24: Service Discovery & Lookup
- BRC-88: Producer Service Discovery
- BRC-41: PacketPay HTTP Micropayments
- BRC-26: UHRP Content Storage Access
- BRC-22: Transaction Submission
- BRC-64: History Tracking & Analytics
- D21: BSV Native Payments
- D22: Storage Backend Access

Author: BSV Overlay Network Team
Version: 1.0.0
"""

import asyncio
import argparse
import json
import sys
import os
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
import aiohttp
import hashlib
import time
from datetime import datetime, timedelta
import csv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import BRC integration modules
from brc_integrations.consumer_stack import ConsumerBRCStack
from brc_integrations.brc31_identity import BRC31Identity
from brc_integrations.brc24_lookup import BRC24LookupClient
from brc_integrations.brc26_content import BRC26ContentClient
from brc_integrations.brc41_payments import BRC41PaymentClient
from brc_integrations.brc64_analytics import BRC64HistoryTracker
from brc_integrations.brc88_discovery import BRC88ServiceDiscovery
from brc_integrations.d21_native_payments import D21NativePayments
from database.consumer_models import ConsumerDatabase

class OverlayConsumerCLI:
    """
    Comprehensive consumer CLI leveraging full BRC overlay network stack
    """

    def __init__(self, config_path: Optional[str] = None):
        """Initialize consumer CLI with configuration"""
        self.config = self._load_config(config_path)
        self.identity = None
        self.brc_stack = None
        self.db = ConsumerDatabase(self.config.get('database_url'))

        # Initialize BRC components
        self._init_brc_components()

    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or environment"""
        default_config = {
            'overlay_url': os.getenv('OVERLAY_URL', 'http://localhost:3000'),
            'database_url': os.getenv('DATABASE_URL', 'postgresql://postgres:password@localhost/overlay'),
            'identity_file': os.getenv('CONSUMER_IDENTITY_FILE', './consumer_identity.json'),
            'payment_method': os.getenv('PAYMENT_METHOD', 'http'),
            'max_budget_per_hour': int(os.getenv('MAX_BUDGET_PER_HOUR', '10000')),  # satoshis
            'default_region': os.getenv('DEFAULT_REGION', 'global'),
            'debug': os.getenv('DEBUG', 'false').lower() == 'true'
        }

        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    file_config = json.load(f)
                default_config.update(file_config)
            except Exception as e:
                logger.warning(f"Failed to load config from {config_path}: {e}")

        return default_config

    def _init_brc_components(self):
        """Initialize BRC integration components"""
        self.brc_stack = ConsumerBRCStack(
            overlay_url=self.config['overlay_url'],
            database=self.db
        )

        # Initialize individual BRC clients
        self.lookup_client = BRC24LookupClient(self.config['overlay_url'])
        self.content_client = BRC26ContentClient(self.config['overlay_url'])
        self.payment_client = BRC41PaymentClient(self.config['overlay_url'])
        self.history_tracker = BRC64HistoryTracker(self.db)
        self.service_discovery = BRC88ServiceDiscovery(self.config['overlay_url'])
        self.native_payments = D21NativePayments(self.config['overlay_url'])

    async def setup_identity(self, generate_new: bool = False, register_overlay: bool = True) -> Dict[str, Any]:
        """Setup or load consumer identity (BRC-31)"""
        try:
            if generate_new or not os.path.exists(self.config['identity_file']):
                # Generate new identity
                self.identity = await BRC31Identity.generate_new()

                # Save identity to file
                identity_data = {
                    'identity_key': self.identity.identity_key,
                    'private_key': self.identity.private_key_hex,
                    'public_key': self.identity.public_key_hex,
                    'created_at': datetime.now().isoformat()
                }

                os.makedirs(os.path.dirname(self.config['identity_file']), exist_ok=True)
                with open(self.config['identity_file'], 'w') as f:
                    json.dump(identity_data, f, indent=2)

                logger.info(f"New identity generated: {self.identity.identity_key}")
            else:
                # Load existing identity
                with open(self.config['identity_file'], 'r') as f:
                    identity_data = json.load(f)

                self.identity = BRC31Identity.from_data(identity_data)
                logger.info(f"Identity loaded: {self.identity.identity_key}")

            # Register with overlay network if requested
            if register_overlay:
                await self._register_with_overlay()

            # Store in database
            await self.db.create_or_update_consumer_identity(
                consumer_id=self.identity.identity_key,
                identity_key=self.identity.identity_key,
                display_name=f"Consumer-{self.identity.identity_key[:8]}",
                preferences={'auto_pay': True, 'verify_content': True}
            )

            return {
                'identity_key': self.identity.identity_key,
                'status': 'active',
                'registered': register_overlay
            }

        except Exception as e:
            logger.error(f"Failed to setup identity: {e}")
            raise

    async def _register_with_overlay(self):
        """Register consumer identity with overlay network"""
        registration_data = {
            'identity_key': self.identity.identity_key,
            'public_key': self.identity.public_key_hex,
            'role': 'consumer',
            'metadata': {
                'name': f'Consumer CLI - {self.identity.identity_key[:8]}',
                'capabilities': [
                    'content-access',
                    'streaming-consumption',
                    'micropayments',
                    'analytics'
                ],
                'version': '1.0.0'
            }
        }

        # Sign registration data
        signature = await self.identity.sign_data(json.dumps(registration_data, sort_keys=True))
        registration_data['signature'] = signature

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.config['overlay_url']}/api/identity/register",
                json=registration_data
            ) as response:
                if response.status == 201:
                    logger.info("Successfully registered with overlay network")
                    return await response.json()
                else:
                    error = await response.text()
                    raise Exception(f"Registration failed: {error}")

    async def discover_services(self, capability: str = None, region: str = None,
                              max_price: int = None, service_type: str = None) -> List[Dict[str, Any]]:
        """Discover producer services (BRC-24 + BRC-88)"""
        try:
            # Build search criteria
            criteria = {}
            if capability:
                criteria['capability'] = capability
            if region:
                criteria['region'] = region
            if max_price:
                criteria['max_price'] = max_price
            if service_type:
                criteria['service_type'] = service_type

            # Search using BRC-88 service discovery
            services = await self.service_discovery.find_services(
                consumer_identity=self.identity.identity_key,
                criteria=criteria
            )

            # Enhance with BRC-24 lookup data
            enhanced_services = []
            for service in services:
                # Get additional metadata from BRC-24
                metadata = await self.lookup_client.get_service_metadata(service['producer_id'])
                service.update(metadata)
                enhanced_services.append(service)

            # Cache discovered services
            for service in enhanced_services:
                await self.db.cache_discovered_service(
                    producer_id=service['producer_id'],
                    capabilities=service.get('capabilities', []),
                    region=service.get('region', 'unknown'),
                    pricing_info=service.get('pricing', {}),
                    reputation_score=service.get('reputation', 0.0)
                )

            logger.info(f"Discovered {len(enhanced_services)} services matching criteria")
            return enhanced_services

        except Exception as e:
            logger.error(f"Service discovery failed: {e}")
            raise

    async def subscribe_to_stream(self, producer_id: str, stream_id: str,
                                payment_method: str = 'http', max_price_per_minute: int = 100,
                                duration: str = '1hour') -> Dict[str, Any]:
        """Subscribe to live data stream with micropayments"""
        try:
            # Parse duration
            duration_minutes = self._parse_duration(duration)

            # Create payment session
            payment_session = await self.payment_client.create_session(
                consumer_identity=self.identity.identity_key,
                producer_id=producer_id,
                max_amount=max_price_per_minute * duration_minutes,
                payment_method=payment_method
            )

            # Create subscription record
            subscription_id = f"sub_{int(time.time())}_{hash(stream_id) % 10000}"
            await self.db.create_subscription(
                subscription_id=subscription_id,
                consumer_id=self.identity.identity_key,
                producer_id=producer_id,
                service_id=stream_id,
                stream_id=stream_id,
                subscription_type='streaming',
                payment_method=payment_method,
                rate_limit_per_minute=60,
                max_cost_per_hour=max_price_per_minute * 60
            )

            # Establish stream connection
            stream_url = f"{self.config['overlay_url']}/api/streaming/subscribe"
            subscription_request = {
                'subscription_id': subscription_id,
                'stream_id': stream_id,
                'producer_id': producer_id,
                'consumer_identity': self.identity.identity_key,
                'payment_session_id': payment_session['session_id'],
                'duration_minutes': duration_minutes
            }

            # Sign request
            signature = await self.identity.sign_data(json.dumps(subscription_request, sort_keys=True))
            subscription_request['signature'] = signature

            async with aiohttp.ClientSession() as session:
                async with session.post(stream_url, json=subscription_request) as response:
                    if response.status == 201:
                        result = await response.json()

                        # Log subscription event
                        await self.history_tracker.log_event(
                            consumer_id=self.identity.identity_key,
                            event_type='stream_subscription',
                            resource_id=stream_id,
                            metadata={
                                'producer_id': producer_id,
                                'payment_method': payment_method,
                                'duration_minutes': duration_minutes,
                                'subscription_id': subscription_id
                            }
                        )

                        return {
                            'subscription_id': subscription_id,
                            'stream_url': result.get('stream_url'),
                            'websocket_url': result.get('websocket_url'),
                            'status': 'active',
                            'expires_at': (datetime.now() + timedelta(minutes=duration_minutes)).isoformat()
                        }
                    else:
                        error = await response.text()
                        raise Exception(f"Subscription failed: {error}")

        except Exception as e:
            logger.error(f"Stream subscription failed: {e}")
            raise

    async def purchase_dataset(self, dataset_id: str, payment_method: str = 'http',
                             amount: int = None, download_immediately: bool = True) -> Dict[str, Any]:
        """Purchase dataset access with BRC-41 or D21 payments"""
        try:
            # Get dataset metadata
            dataset_info = await self.lookup_client.get_content_info(dataset_id)
            if not dataset_info:
                raise Exception(f"Dataset {dataset_id} not found")

            # Determine payment amount
            if amount is None:
                amount = dataset_info.get('price', 1000)  # Default 1000 satoshis

            # Create payment based on method
            if payment_method == 'http':
                payment_result = await self._create_http_payment(
                    producer_id=dataset_info['producer_id'],
                    resource_id=dataset_id,
                    amount=amount
                )
            elif payment_method == 'd21-native':
                payment_result = await self._create_d21_payment(
                    producer_id=dataset_info['producer_id'],
                    resource_id=dataset_id,
                    amount=amount
                )
            else:
                raise Exception(f"Unsupported payment method: {payment_method}")

            # Record payment
            payment_id = f"pay_{int(time.time())}_{hash(dataset_id) % 10000}"
            await self.db.create_payment_record(
                payment_id=payment_id,
                consumer_id=self.identity.identity_key,
                producer_id=dataset_info['producer_id'],
                payment_method=payment_method,
                amount_satoshis=amount,
                resource_accessed=dataset_id,
                payment_status='confirmed',
                brc41_receipt_data=payment_result.get('receipt'),
                d21_template_id=payment_result.get('template_id')
            )

            result = {
                'payment_id': payment_id,
                'dataset_id': dataset_id,
                'amount_paid': amount,
                'payment_method': payment_method,
                'status': 'paid',
                'access_token': payment_result.get('access_token')
            }

            # Download immediately if requested
            if download_immediately:
                download_result = await self.download_content(
                    uhrp_hash=dataset_info['uhrp_hash'],
                    access_token=payment_result.get('access_token'),
                    output_path=f"./downloads/{dataset_id}.data"
                )
                result['download_path'] = download_result['file_path']

            # Log purchase event
            await self.history_tracker.log_event(
                consumer_id=self.identity.identity_key,
                event_type='dataset_purchase',
                resource_id=dataset_id,
                metadata={
                    'amount_paid': amount,
                    'payment_method': payment_method,
                    'producer_id': dataset_info['producer_id'],
                    'downloaded': download_immediately
                }
            )

            return result

        except Exception as e:
            logger.error(f"Dataset purchase failed: {e}")
            raise

    async def download_content(self, uhrp_hash: str, access_token: str = None,
                             output_path: str = None, verify_integrity: bool = True) -> Dict[str, Any]:
        """Download content via BRC-26 UHRP with integrity verification"""
        try:
            # Request content access
            content_response = await self.content_client.get_content(
                uhrp_hash=uhrp_hash,
                consumer_identity=self.identity.identity_key,
                access_token=access_token
            )

            # Determine output path
            if not output_path:
                output_path = f"./downloads/{uhrp_hash[:16]}.data"

            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            # Write content to file
            content_data = content_response['content']
            with open(output_path, 'wb') as f:
                if isinstance(content_data, str):
                    # Base64 decoded content
                    import base64
                    f.write(base64.b64decode(content_data))
                else:
                    f.write(content_data)

            # Verify integrity if requested
            integrity_verified = False
            if verify_integrity:
                with open(output_path, 'rb') as f:
                    file_hash = hashlib.sha256(f.read()).hexdigest()
                    expected_hash = content_response.get('content_hash', uhrp_hash)
                    integrity_verified = file_hash == expected_hash

                    if not integrity_verified:
                        logger.warning(f"Content integrity verification failed for {uhrp_hash}")

            # Record content access
            access_id = f"access_{int(time.time())}_{hash(uhrp_hash) % 10000}"
            await self.db.record_content_access(
                access_id=access_id,
                consumer_id=self.identity.identity_key,
                uhrp_hash=uhrp_hash,
                access_method='download',
                bytes_transferred=os.path.getsize(output_path),
                metadata={
                    'file_path': output_path,
                    'integrity_verified': integrity_verified,
                    'content_type': content_response.get('content_type', 'application/octet-stream')
                }
            )

            # Log download event
            await self.history_tracker.log_event(
                consumer_id=self.identity.identity_key,
                event_type='content_download',
                resource_id=uhrp_hash,
                metadata={
                    'file_path': output_path,
                    'file_size': os.path.getsize(output_path),
                    'integrity_verified': integrity_verified
                }
            )

            return {
                'uhrp_hash': uhrp_hash,
                'file_path': output_path,
                'file_size': os.path.getsize(output_path),
                'integrity_verified': integrity_verified,
                'content_type': content_response.get('content_type')
            }

        except Exception as e:
            logger.error(f"Content download failed: {e}")
            raise

    async def get_usage_history(self, days: int = 30, include_costs: bool = True,
                              export_format: str = None) -> Dict[str, Any]:
        """Get consumption history with cost analysis (BRC-64)"""
        try:
            # Get usage events from database
            start_date = datetime.now() - timedelta(days=days)
            history = await self.db.get_usage_history(
                consumer_id=self.identity.identity_key,
                start_date=start_date
            )

            # Calculate costs if requested
            total_cost = 0
            cost_breakdown = {}

            if include_costs:
                payments = await self.db.get_payment_history(
                    consumer_id=self.identity.identity_key,
                    start_date=start_date
                )

                for payment in payments:
                    total_cost += payment['amount_satoshis']
                    producer_id = payment['producer_id']
                    if producer_id not in cost_breakdown:
                        cost_breakdown[producer_id] = 0
                    cost_breakdown[producer_id] += payment['amount_satoshis']

            result = {
                'consumer_id': self.identity.identity_key,
                'period_days': days,
                'total_events': len(history),
                'total_cost_satoshis': total_cost,
                'cost_breakdown': cost_breakdown,
                'events': history
            }

            # Export if requested
            if export_format:
                export_path = await self._export_history(result, export_format)
                result['export_path'] = export_path

            return result

        except Exception as e:
            logger.error(f"Failed to get usage history: {e}")
            raise

    async def check_ready(self, version_id: str, policy: Dict[str, Any],
                         validate_brc_stack: bool = False,
                         exit_code_on_failure: bool = False,
                         policy_id: str = None) -> Dict[str, Any]:
        """D28 Policy-based content readiness validation (replaces CI/CD ready check)"""
        try:
            from brc_integrations.d28_policy_validator import (
                D28PolicyValidator, ContentMetadata, PolicyDecision
            )

            # Initialize policy validator
            validator = D28PolicyValidator()

            # If policy_id provided, use it; otherwise create temporary policy from policy dict
            if policy_id:
                # Use existing policy by ID
                temp_policy = validator.get_policy(policy_id)
                if not temp_policy:
                    return {
                        'version_id': version_id,
                        'decision': 'block',
                        'reasons': [f'POLICY.NOT_FOUND'],
                        'errors': [f'Policy not found: {policy_id}'],
                        'timestamp': datetime.now().isoformat()
                    }
            elif policy:
                # Create temporary policy from provided policy dict
                temp_policy = validator.create_policy(
                    name="Temporary Ready Check Policy",
                    description="Policy created from CLI arguments for ready check",
                    policy_constraints=policy
                )
                policy_id = temp_policy.policy_id
            else:
                # Use default permissive policy
                temp_policy = validator.create_policy(
                    name="Default Ready Check Policy",
                    description="Default permissive policy for ready check",
                    policy_constraints={
                        "min_confs": 1,
                        "allow_recalled": True,
                        "classification_allow_list": ["public", "commercial", "internal"],
                        "max_data_age_seconds": 86400 * 30  # 30 days
                    }
                )
                policy_id = temp_policy.policy_id

            # Fetch content metadata (in real implementation, this would come from overlay network)
            metadata = await self._fetch_content_metadata(version_id)

            # Evaluate content against policy
            evaluation = validator.evaluate_ready(version_id, policy_id, metadata)

            # Format response according to D28 specification
            ready_response = {
                'version_id': version_id,
                'policy_id': policy_id,
                'decision': evaluation.decision.value,
                'reasons': evaluation.reasons,
                'warnings': evaluation.warnings,
                'evidence': evaluation.evidence,
                'timestamp': datetime.now().isoformat()
            }

            # Add BRC stack validation if requested
            if validate_brc_stack:
                brc_checks = await self._validate_brc_stack()
                ready_response['brc_stack_validation'] = brc_checks
                if not brc_checks['all_passed']:
                    ready_response['decision'] = 'block'
                    ready_response['reasons'].extend(['BRC.STACK.VALIDATION_FAILED'])

            # Exit with code if requested and decision is block
            if exit_code_on_failure and evaluation.decision.value == 'block':
                logger.error("Ready check failed - exiting with code 1")
                sys.exit(1)

            return ready_response

        except Exception as e:
            logger.error(f"Ready check failed: {e}")
            if exit_code_on_failure:
                sys.exit(1)
            raise

    async def _fetch_content_metadata(self, version_id: str) -> 'ContentMetadata':
        """Fetch content metadata from overlay network for policy validation"""
        try:
            from brc_integrations.d28_policy_validator import ContentMetadata
            from datetime import datetime, timedelta
            import hashlib
            import random

            # In a real implementation, this would query the overlay network
            # For now, we'll create mock metadata that represents typical content
            mock_metadata = ContentMetadata(
                version_id=version_id,
                content_hash=hashlib.sha256(f"content_{version_id}".encode()).hexdigest()[:32],
                size=random.randint(1024, 1024*1024*10),  # 1KB to 10MB
                created=datetime.now() - timedelta(hours=random.randint(1, 72)),
                confirmations=random.randint(1, 100),
                classification=random.choice(["public", "commercial", "internal"]),
                recalled=False,
                lineage={
                    "producer_id": "prod_" + hashlib.sha256(f"producer_{version_id}".encode()).hexdigest()[:16],
                    "chain": [f"step_{i}" for i in range(random.randint(1, 5))]
                },
                quality_score=random.uniform(0.7, 1.0),
                custom_attributes={
                    "content_type": random.choice(["dataset", "stream", "document"]),
                    "industry": random.choice(["finance", "healthcare", "technology"]),
                    "region": random.choice(["global", "eu", "us", "asia"])
                }
            )

            logger.info(f"Fetched metadata for version {version_id}")
            return mock_metadata

        except Exception as e:
            logger.error(f"Failed to fetch content metadata: {e}")
            # Return minimal metadata if fetch fails
            from brc_integrations.d28_policy_validator import ContentMetadata
            return ContentMetadata(
                version_id=version_id,
                content_hash="unknown",
                size=0,
                created=datetime.now(),
                confirmations=0,
                classification="unknown",
                recalled=False,
                lineage={},
                quality_score=0.0,
                custom_attributes={}
            )

    async def _validate_brc_stack(self) -> Dict[str, Any]:
        """Validate all BRC components are functional"""
        checks = {}
        errors = []

        try:
            # BRC-31 Identity check
            if self.identity:
                checks['brc31_identity'] = 'pass'
            else:
                checks['brc31_identity'] = 'fail'
                errors.append('BRC-31: No consumer identity loaded')

            # BRC-24 Lookup service check
            try:
                test_query = await self.lookup_client.health_check()
                checks['brc24_lookup'] = 'pass' if test_query else 'fail'
            except Exception as e:
                checks['brc24_lookup'] = 'fail'
                errors.append(f'BRC-24: Lookup service error: {e}')

            # BRC-41 Payment service check
            try:
                payment_health = await self.payment_client.health_check()
                checks['brc41_payments'] = 'pass' if payment_health else 'fail'
            except Exception as e:
                checks['brc41_payments'] = 'fail'
                errors.append(f'BRC-41: Payment service error: {e}')

            # BRC-26 Content service check
            try:
                content_health = await self.content_client.health_check()
                checks['brc26_content'] = 'pass' if content_health else 'fail'
            except Exception as e:
                checks['brc26_content'] = 'fail'
                errors.append(f'BRC-26: Content service error: {e}')

            # Database connectivity check
            try:
                db_health = await self.db.health_check()
                checks['database'] = 'pass' if db_health else 'fail'
            except Exception as e:
                checks['database'] = 'fail'
                errors.append(f'Database error: {e}')

            all_passed = all(status == 'pass' for status in checks.values())

            return {
                'checks': checks,
                'errors': errors,
                'all_passed': all_passed
            }

        except Exception as e:
            errors.append(f'BRC validation error: {e}')
            return {
                'checks': checks,
                'errors': errors,
                'all_passed': False
            }

    async def _create_http_payment(self, producer_id: str, resource_id: str, amount: int) -> Dict[str, Any]:
        """Create BRC-41 HTTP micropayment"""
        # Create payment quote
        quote = await self.payment_client.create_quote(
            consumer_identity=self.identity.identity_key,
            producer_id=producer_id,
            resource_id=resource_id,
            amount=amount
        )

        # Submit payment
        payment_data = {
            'quote_id': quote['quote_id'],
            'consumer_identity': self.identity.identity_key,
            'producer_id': producer_id,
            'amount': amount
        }

        # Sign payment data
        signature = await self.identity.sign_data(json.dumps(payment_data, sort_keys=True))
        payment_data['signature'] = signature

        payment_result = await self.payment_client.submit_payment(payment_data)

        return payment_result

    async def _create_d21_payment(self, producer_id: str, resource_id: str, amount: int) -> Dict[str, Any]:
        """Create D21 native BSV payment"""
        template_data = {
            'consumer_identity': self.identity.identity_key,
            'producer_id': producer_id,
            'resource_id': resource_id,
            'amount': amount,
            'currency': 'BSV'
        }

        return await self.native_payments.create_payment_template(template_data)

    def _parse_duration(self, duration: str) -> int:
        """Parse duration string to minutes"""
        duration = duration.lower()
        if duration.endswith('min') or duration.endswith('minutes'):
            return int(duration.replace('min', '').replace('utes', ''))
        elif duration.endswith('hour') or duration.endswith('hours'):
            return int(duration.replace('hour', '').replace('s', '')) * 60
        elif duration.endswith('day') or duration.endswith('days'):
            return int(duration.replace('day', '').replace('s', '')) * 1440
        else:
            try:
                return int(duration)  # Assume minutes
            except ValueError:
                return 60  # Default 1 hour

    async def _export_history(self, history_data: Dict[str, Any], format: str) -> str:
        """Export history data to specified format"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        if format.lower() == 'csv':
            filename = f"consumption_history_{timestamp}.csv"
            with open(filename, 'w', newline='') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=[
                    'timestamp', 'event_type', 'resource_id', 'cost_satoshis', 'metadata'
                ])
                writer.writeheader()
                for event in history_data['events']:
                    writer.writerow({
                        'timestamp': event.get('timestamp'),
                        'event_type': event.get('event_type'),
                        'resource_id': event.get('resource_id'),
                        'cost_satoshis': event.get('cost_satoshis', 0),
                        'metadata': json.dumps(event.get('metadata', {}))
                    })
        elif format.lower() == 'json':
            filename = f"consumption_history_{timestamp}.json"
            with open(filename, 'w') as f:
                json.dump(history_data, f, indent=2)
        else:
            raise Exception(f"Unsupported export format: {format}")

        return filename


async def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description='BSV Overlay Network Consumer CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Setup identity
  %(prog)s identity setup --generate-key --register-overlay

  # Discover services
  %(prog)s discover --capability="market-data" --region="US" --max-price=1000

  # Subscribe to stream
  %(prog)s subscribe --producer-id="prod123" --stream-id="btc_stream" --payment-method="http"

  # Purchase dataset
  %(prog)s purchase --dataset-id="historical_data" --amount=5000 --download-immediately

  # Download content
  %(prog)s download --uhrp-hash="ba7816bf..." --verify-integrity --output="./downloads"

  # View history
  %(prog)s history --days=30 --show-costs --export-format="csv"

  # Ready check
  %(prog)s ready --version-id="v1.0.0" --validate-brc-stack --exit-code-on-failure
        """
    )

    parser.add_argument('--config', type=str, help='Configuration file path')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Identity commands
    identity_parser = subparsers.add_parser('identity', help='Identity management')
    identity_sub = identity_parser.add_subparsers(dest='identity_action')

    setup_parser = identity_sub.add_parser('setup', help='Setup consumer identity')
    setup_parser.add_argument('--generate-key', action='store_true', help='Generate new identity key')
    setup_parser.add_argument('--register-overlay', action='store_true', help='Register with overlay network')

    verify_parser = identity_sub.add_parser('verify', help='Verify identity')
    verify_parser.add_argument('--check-reputation', action='store_true', help='Check reputation score')

    # Service discovery commands
    discover_parser = subparsers.add_parser('discover', help='Discover producer services')
    discover_parser.add_argument('--capability', type=str, help='Required capability')
    discover_parser.add_argument('--region', type=str, help='Geographic region')
    discover_parser.add_argument('--max-price', type=int, help='Maximum price in satoshis')
    discover_parser.add_argument('--service-type', type=str, help='Type of service')
    discover_parser.add_argument('--show-capabilities', action='store_true', help='Show detailed capabilities')

    # Subscription commands
    subscribe_parser = subparsers.add_parser('subscribe', help='Subscribe to data stream')
    subscribe_parser.add_argument('--producer-id', type=str, required=True, help='Producer ID')
    subscribe_parser.add_argument('--stream-id', type=str, required=True, help='Stream ID')
    subscribe_parser.add_argument('--payment-method', type=str, default='http',
                                choices=['http', 'd21-native'], help='Payment method')
    subscribe_parser.add_argument('--max-price-per-minute', type=int, default=100,
                                help='Maximum price per minute')
    subscribe_parser.add_argument('--duration', type=str, default='1hour', help='Subscription duration')

    # Purchase commands
    purchase_parser = subparsers.add_parser('purchase', help='Purchase dataset access')
    purchase_parser.add_argument('--dataset-id', type=str, required=True, help='Dataset ID')
    purchase_parser.add_argument('--payment-method', type=str, default='http',
                               choices=['http', 'd21-native'], help='Payment method')
    purchase_parser.add_argument('--amount', type=int, help='Payment amount in satoshis')
    purchase_parser.add_argument('--download-immediately', action='store_true',
                               help='Download immediately after purchase')

    # Download commands
    download_parser = subparsers.add_parser('download', help='Download content via UHRP')
    download_parser.add_argument('--uhrp-hash', type=str, required=True, help='UHRP hash')
    download_parser.add_argument('--verify-integrity', action='store_true', help='Verify content integrity')
    download_parser.add_argument('--output', type=str, help='Output file path')
    download_parser.add_argument('--access-token', type=str, help='Access token from payment')

    # History commands
    history_parser = subparsers.add_parser('history', help='View consumption history')
    history_parser.add_argument('--days', type=int, default=30, help='Number of days to include')
    history_parser.add_argument('--show-costs', action='store_true', help='Include cost information')
    history_parser.add_argument('--export-format', type=str, choices=['csv', 'json'],
                              help='Export format')

    # Ready check commands
    ready_parser = subparsers.add_parser('ready', help='D28 Policy-based content readiness validation')
    ready_parser.add_argument('--version-id', type=str, required=True, help='Version ID to check')
    ready_parser.add_argument('--policy', type=str, help='Policy JSON string (alternative to --policy-id)')
    ready_parser.add_argument('--policy-id', type=str, help='Existing policy ID to use for validation')
    ready_parser.add_argument('--validate-brc-stack', action='store_true',
                            help='Validate all BRC components')
    ready_parser.add_argument('--exit-code-on-failure', action='store_true',
                            help='Exit with code 1 on failure')

    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    if not args.command:
        parser.print_help()
        return

    # Initialize CLI
    cli = OverlayConsumerCLI(config_path=args.config)

    try:
        if args.command == 'identity':
            if args.identity_action == 'setup':
                result = await cli.setup_identity(
                    generate_new=args.generate_key,
                    register_overlay=args.register_overlay
                )
                print(json.dumps(result, indent=2))
            elif args.identity_action == 'verify':
                if cli.identity:
                    result = {
                        'identity_key': cli.identity.identity_key,
                        'status': 'verified'
                    }
                    print(json.dumps(result, indent=2))
                else:
                    print(json.dumps({'error': 'No identity loaded'}, indent=2))
                    sys.exit(1)

        elif args.command == 'discover':
            # Load identity first
            await cli.setup_identity(register_overlay=False)

            services = await cli.discover_services(
                capability=args.capability,
                region=args.region,
                max_price=args.max_price,
                service_type=args.service_type
            )

            result = {
                'services_found': len(services),
                'services': services
            }
            print(json.dumps(result, indent=2))

        elif args.command == 'subscribe':
            await cli.setup_identity(register_overlay=False)

            result = await cli.subscribe_to_stream(
                producer_id=args.producer_id,
                stream_id=args.stream_id,
                payment_method=args.payment_method,
                max_price_per_minute=args.max_price_per_minute,
                duration=args.duration
            )
            print(json.dumps(result, indent=2))

        elif args.command == 'purchase':
            await cli.setup_identity(register_overlay=False)

            result = await cli.purchase_dataset(
                dataset_id=args.dataset_id,
                payment_method=args.payment_method,
                amount=args.amount,
                download_immediately=args.download_immediately
            )
            print(json.dumps(result, indent=2))

        elif args.command == 'download':
            await cli.setup_identity(register_overlay=False)

            result = await cli.download_content(
                uhrp_hash=args.uhrp_hash,
                access_token=args.access_token,
                output_path=args.output,
                verify_integrity=args.verify_integrity
            )
            print(json.dumps(result, indent=2))

        elif args.command == 'history':
            await cli.setup_identity(register_overlay=False)

            result = await cli.get_usage_history(
                days=args.days,
                include_costs=args.show_costs,
                export_format=args.export_format
            )
            print(json.dumps(result, indent=2))

        elif args.command == 'ready':
            # Load identity if available
            try:
                await cli.setup_identity(register_overlay=False)
            except:
                pass  # Identity not required for basic ready check

            policy = {}
            if args.policy:
                policy = json.loads(args.policy)

            result = await cli.check_ready(
                version_id=args.version_id,
                policy=policy,
                validate_brc_stack=args.validate_brc_stack,
                exit_code_on_failure=args.exit_code_on_failure,
                policy_id=args.policy_id
            )
            print(json.dumps(result, indent=2))

    except KeyboardInterrupt:
        logger.info("Operation cancelled by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Command failed: {e}")
        if args.debug:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())