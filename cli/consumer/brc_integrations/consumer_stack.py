"""
Consumer BRC Stack Integration
Comprehensive BRC stack integration for consumer operations
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
import aiohttp
from datetime import datetime

logger = logging.getLogger(__name__)

class ConsumerBRCStack:
    """
    Integrated BRC stack for consumer operations
    Orchestrates all BRC components for seamless consumer experience
    """

    def __init__(self, overlay_url: str, database=None):
        self.overlay_url = overlay_url.rstrip('/')
        self.database = database
        self.session = None

        # BRC endpoints
        self.endpoints = {
            'brc31_identity': f"{self.overlay_url}/api/identity",
            'brc24_lookup': f"{self.overlay_url}/api/lookup",
            'brc88_discovery': f"{self.overlay_url}/api/services",
            'brc41_payments': f"{self.overlay_url}/api/payments",
            'brc26_content': f"{self.overlay_url}/api/content",
            'brc22_transactions': f"{self.overlay_url}/api/transactions",
            'brc64_analytics': f"{self.overlay_url}/api/analytics",
            'd21_native': f"{self.overlay_url}/api/payments/native-bsv",
            'd22_storage': f"{self.overlay_url}/api/storage"
        }

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    async def authenticate_consumer(self, identity_key: str, private_key: str) -> Dict[str, Any]:
        """
        BRC-31: Create authenticated consumer identity and get access token
        """
        try:
            # Create authentication challenge request
            challenge_data = {
                'identity_key': identity_key,
                'role': 'consumer'
            }

            async with self.session.post(
                f"{self.endpoints['brc31_identity']}/challenge",
                json=challenge_data
            ) as response:
                if response.status != 200:
                    raise Exception(f"Challenge creation failed: {await response.text()}")

                challenge_result = await response.json()
                challenge = challenge_result['challenge']

            # Sign challenge (simplified - would use actual cryptographic signing)
            from .brc31_identity import BRC31Identity
            identity = BRC31Identity.from_private_key(private_key)
            signature = await identity.sign_data(challenge)

            # Submit signed challenge
            auth_data = {
                'identity_key': identity_key,
                'challenge': challenge,
                'signature': signature
            }

            async with self.session.post(
                f"{self.endpoints['brc31_identity']}/authenticate",
                json=auth_data
            ) as response:
                if response.status != 200:
                    raise Exception(f"Authentication failed: {await response.text()}")

                auth_result = await response.json()
                logger.info(f"Consumer authenticated: {identity_key}")
                return auth_result

        except Exception as e:
            logger.error(f"Consumer authentication failed: {e}")
            raise

    async def discover_producers(self, query: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        BRC-24 + BRC-88: Find producers by capability/region/price
        Combines lookup services with service discovery
        """
        try:
            # Step 1: Use BRC-88 for service discovery
            discovery_params = {
                'capability': query.get('capability'),
                'region': query.get('region'),
                'max_price': query.get('max_price'),
                'service_type': query.get('service_type')
            }

            # Remove None values
            discovery_params = {k: v for k, v in discovery_params.items() if v is not None}

            async with self.session.post(
                f"{self.endpoints['brc88_discovery']}/discover",
                json={'criteria': discovery_params}
            ) as response:
                if response.status != 200:
                    logger.warning(f"Service discovery failed: {await response.text()}")
                    discovered_services = []
                else:
                    result = await response.json()
                    discovered_services = result.get('services', [])

            # Step 2: Enhance with BRC-24 lookup data
            enhanced_services = []
            for service in discovered_services:
                try:
                    # Get detailed service information
                    lookup_params = {
                        'producer_id': service.get('producer_id'),
                        'service_id': service.get('service_id')
                    }

                    async with self.session.post(
                        f"{self.endpoints['brc24_lookup']}/search",
                        json={'query': lookup_params}
                    ) as lookup_response:
                        if lookup_response.status == 200:
                            lookup_result = await lookup_response.json()
                            # Merge lookup data with service data
                            if lookup_result.get('results'):
                                service.update(lookup_result['results'][0])

                    enhanced_services.append(service)

                except Exception as e:
                    logger.warning(f"Failed to enhance service {service.get('service_id')}: {e}")
                    enhanced_services.append(service)  # Add without enhancement

            logger.info(f"Discovered {len(enhanced_services)} producer services")
            return enhanced_services

        except Exception as e:
            logger.error(f"Producer discovery failed: {e}")
            raise

    async def create_payment_session(self, producer_id: str, consumer_identity: str,
                                   amount: int, payment_method: str = 'http') -> Dict[str, Any]:
        """
        BRC-41: Setup micropayment session for data access
        """
        try:
            if payment_method == 'http':
                # Create BRC-41 HTTP micropayment quote
                quote_data = {
                    'consumer_identity': consumer_identity,
                    'producer_id': producer_id,
                    'amount': amount,
                    'currency': 'BSV',
                    'payment_type': 'micropayment'
                }

                async with self.session.post(
                    f"{self.endpoints['brc41_payments']}/quote",
                    json=quote_data
                ) as response:
                    if response.status != 201:
                        raise Exception(f"Payment quote failed: {await response.text()}")

                    quote_result = await response.json()

                # Create payment session
                session_data = {
                    'quote_id': quote_result['quote_id'],
                    'consumer_identity': consumer_identity,
                    'producer_id': producer_id,
                    'max_amount': amount,
                    'payment_method': payment_method
                }

                return {
                    'session_id': quote_result['quote_id'],
                    'payment_address': quote_result.get('payment_address'),
                    'max_amount': amount,
                    'expires_at': quote_result.get('expires_at'),
                    'quote_data': quote_result
                }

            elif payment_method == 'd21-native':
                # Use D21 for native BSV payments
                return await self._create_d21_payment_session(
                    producer_id, consumer_identity, amount
                )

            else:
                raise Exception(f"Unsupported payment method: {payment_method}")

        except Exception as e:
            logger.error(f"Payment session creation failed: {e}")
            raise

    async def submit_payment_transaction(self, tx_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        BRC-22: Submit payment to overlay network
        """
        try:
            # Submit transaction via BRC-22
            async with self.session.post(
                f"{self.endpoints['brc22_transactions']}/submit",
                json=tx_data
            ) as response:
                if response.status not in [200, 201, 202]:
                    raise Exception(f"Transaction submission failed: {await response.text()}")

                result = await response.json()
                logger.info(f"Transaction submitted: {result.get('transaction_id')}")
                return result

        except Exception as e:
            logger.error(f"Transaction submission failed: {e}")
            raise

    async def access_content(self, uhrp_hash: str, consumer_identity: str,
                           payment_proof: str = None) -> Dict[str, Any]:
        """
        BRC-26: Access paid content with payment verification
        """
        try:
            access_data = {
                'uhrp_hash': uhrp_hash,
                'consumer_identity': consumer_identity,
                'access_token': payment_proof,
                'verify_integrity': True
            }

            async with self.session.post(
                f"{self.endpoints['brc26_content']}/retrieve",
                json=access_data
            ) as response:
                if response.status != 200:
                    raise Exception(f"Content access failed: {await response.text()}")

                content_result = await response.json()

                # Check if content is from D22 storage backend
                if content_result.get('storage_type') == 'd22':
                    # Handle multi-node content retrieval
                    content_result = await self._handle_d22_content_access(
                        content_result, consumer_identity
                    )

                logger.info(f"Content accessed: {uhrp_hash}")
                return content_result

        except Exception as e:
            logger.error(f"Content access failed: {e}")
            raise

    async def log_consumption(self, consumer_id: str, resource_id: str,
                            metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        BRC-64: Record consumption for analytics and compliance
        """
        try:
            analytics_data = {
                'consumer_id': consumer_id,
                'events': [{
                    'event_type': 'resource_consumption',
                    'resource_id': resource_id,
                    'timestamp': datetime.now().isoformat(),
                    'metadata': metadata
                }]
            }

            async with self.session.post(
                f"{self.endpoints['brc64_analytics']}/track",
                json=analytics_data
            ) as response:
                if response.status not in [200, 201]:
                    logger.warning(f"Analytics logging failed: {await response.text()}")
                    return {'status': 'failed'}

                result = await response.json()
                logger.debug(f"Consumption logged: {resource_id}")
                return result

        except Exception as e:
            logger.warning(f"Consumption logging failed: {e}")
            return {'status': 'error', 'error': str(e)}

    async def get_consumption_history(self, consumer_id: str,
                                    time_range: Dict[str, str]) -> Dict[str, Any]:
        """
        BRC-64: Get consumption history and analytics
        """
        try:
            history_query = {
                'consumer_id': consumer_id,
                'time_range': time_range,
                'include_metrics': True
            }

            async with self.session.post(
                f"{self.endpoints['brc64_analytics']}/history",
                json=history_query
            ) as response:
                if response.status != 200:
                    raise Exception(f"History retrieval failed: {await response.text()}")

                result = await response.json()
                logger.info(f"Retrieved {len(result.get('events', []))} consumption events")
                return result

        except Exception as e:
            logger.error(f"History retrieval failed: {e}")
            raise

    async def health_check(self) -> Dict[str, Any]:
        """Check health of all BRC components"""
        health_status = {
            'timestamp': datetime.now().isoformat(),
            'overall_status': 'healthy',
            'components': {}
        }

        # Check each BRC component
        for component, endpoint in self.endpoints.items():
            try:
                async with self.session.get(f"{endpoint.rsplit('/', 1)[0]}/health", timeout=5) as response:
                    if response.status == 200:
                        health_status['components'][component] = 'healthy'
                    else:
                        health_status['components'][component] = 'unhealthy'
                        health_status['overall_status'] = 'degraded'
            except Exception as e:
                health_status['components'][component] = 'error'
                health_status['overall_status'] = 'degraded'
                logger.warning(f"{component} health check failed: {e}")

        return health_status

    async def _create_d21_payment_session(self, producer_id: str, consumer_identity: str,
                                        amount: int) -> Dict[str, Any]:
        """Create D21 native BSV payment session"""
        template_data = {
            'consumer_identity': consumer_identity,
            'producer_id': producer_id,
            'amount': amount,
            'currency': 'BSV',
            'payment_type': 'native'
        }

        async with self.session.post(
            f"{self.endpoints['d21_native']}/create-template",
            json=template_data
        ) as response:
            if response.status != 201:
                raise Exception(f"D21 payment template creation failed: {await response.text()}")

            result = await response.json()
            return {
                'session_id': result['template_id'],
                'payment_template': result['template'],
                'max_amount': amount,
                'expires_at': result.get('expires_at')
            }

    async def _handle_d22_content_access(self, content_result: Dict[str, Any],
                                       consumer_identity: str) -> Dict[str, Any]:
        """Handle content access from D22 storage backend"""
        try:
            # Check content availability across storage nodes
            availability_data = {
                'consumer_identity': consumer_identity,
                'content_ids': [content_result['content_id']],
                'include_performance_metrics': True
            }

            async with self.session.post(
                f"{self.endpoints['d22_storage']}/availability",
                json=availability_data
            ) as response:
                if response.status == 200:
                    availability = await response.json()
                    # Select best storage node based on performance
                    best_node = self._select_best_storage_node(
                        availability.get('availability', [])
                    )
                    if best_node:
                        content_result['storage_node'] = best_node
                        content_result['retrieval_optimized'] = True

            return content_result

        except Exception as e:
            logger.warning(f"D22 storage optimization failed: {e}")
            return content_result

    def _select_best_storage_node(self, availability_data: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Select the best storage node based on availability and performance"""
        if not availability_data:
            return None

        # Sort by response time and availability
        available_nodes = [
            node for node in availability_data
            if node.get('available', False)
        ]

        if not available_nodes:
            return None

        # Select node with best response time
        best_node = min(available_nodes, key=lambda x: x.get('response_time', float('inf')))
        return best_node

    async def create_comprehensive_workflow(self, workflow_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a comprehensive consumer workflow using multiple BRC standards
        """
        workflow_id = f"workflow_{int(datetime.now().timestamp())}"
        workflow_result = {
            'workflow_id': workflow_id,
            'status': 'started',
            'steps': {},
            'errors': []
        }

        try:
            consumer_identity = workflow_config['consumer_identity']

            # Step 1: Service Discovery (BRC-88 + BRC-24)
            if 'discovery' in workflow_config:
                logger.info("Executing service discovery step")
                discovery_result = await self.discover_producers(workflow_config['discovery'])
                workflow_result['steps']['discovery'] = {
                    'status': 'completed',
                    'services_found': len(discovery_result),
                    'services': discovery_result
                }

            # Step 2: Payment Setup (BRC-41 or D21)
            if 'payment' in workflow_config and workflow_result['steps'].get('discovery'):
                logger.info("Executing payment setup step")
                services = workflow_result['steps']['discovery']['services']
                if services:
                    selected_service = services[0]  # Select first service for demo
                    payment_result = await self.create_payment_session(
                        producer_id=selected_service['producer_id'],
                        consumer_identity=consumer_identity,
                        amount=workflow_config['payment']['amount'],
                        payment_method=workflow_config['payment'].get('method', 'http')
                    )
                    workflow_result['steps']['payment'] = {
                        'status': 'completed',
                        'session_id': payment_result['session_id'],
                        'producer_id': selected_service['producer_id']
                    }

            # Step 3: Content Access (BRC-26)
            if 'content_access' in workflow_config and workflow_result['steps'].get('payment'):
                logger.info("Executing content access step")
                payment_info = workflow_result['steps']['payment']
                content_result = await self.access_content(
                    uhrp_hash=workflow_config['content_access']['uhrp_hash'],
                    consumer_identity=consumer_identity,
                    payment_proof=payment_info['session_id']
                )
                workflow_result['steps']['content_access'] = {
                    'status': 'completed',
                    'content_size': len(content_result.get('content', '')),
                    'content_type': content_result.get('content_type')
                }

            # Step 4: Analytics Logging (BRC-64)
            logger.info("Executing analytics logging step")
            analytics_metadata = {
                'workflow_id': workflow_id,
                'steps_completed': list(workflow_result['steps'].keys()),
                'total_cost': workflow_config.get('payment', {}).get('amount', 0)
            }

            await self.log_consumption(
                consumer_id=consumer_identity,
                resource_id=workflow_config.get('content_access', {}).get('uhrp_hash', workflow_id),
                metadata=analytics_metadata
            )

            workflow_result['status'] = 'completed'
            logger.info(f"Workflow {workflow_id} completed successfully")

        except Exception as e:
            workflow_result['status'] = 'failed'
            workflow_result['errors'].append(str(e))
            logger.error(f"Workflow {workflow_id} failed: {e}")

        return workflow_result