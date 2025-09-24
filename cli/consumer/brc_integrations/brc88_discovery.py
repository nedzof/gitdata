"""
BRC-88 Service Discovery Client for Consumer
Handles SHIP/SLAP service discovery and producer capability matching
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
import aiohttp
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class BRC88ServiceDiscovery:
    """
    BRC-88 Service Discovery Client
    Discovers producer services using SHIP/SLAP protocols
    """

    def __init__(self, overlay_url: str):
        self.overlay_url = overlay_url.rstrip('/')
        self.discovery_endpoint = f"{self.overlay_url}/api/services"
        self.session = None
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    async def find_services(self, consumer_identity: str, criteria: Dict[str, Any],
                          include_reputation: bool = True) -> List[Dict[str, Any]]:
        """
        Find services using BRC-88 SHIP/SLAP discovery
        """
        try:
            # Check cache first
            cache_key = self._generate_cache_key(criteria)
            cached_result = self._get_cached_result(cache_key)
            if cached_result:
                logger.debug("Returning cached service discovery results")
                return cached_result

            discovery_request = {
                'consumer_identity': consumer_identity,
                'criteria': criteria,
                'include_reputation': include_reputation,
                'include_capabilities': True,
                'include_pricing': True,
                'max_results': criteria.get('max_results', 100),
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.discovery_endpoint}/discover",
                json=discovery_request,
                timeout=30
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Service discovery failed: {error_text}")

                result = await response.json()
                services = result.get('services', [])

                # Cache the results
                self._cache_result(cache_key, services)

                logger.info(f"Discovered {len(services)} services matching criteria")
                return services

        except Exception as e:
            logger.error(f"Service discovery failed: {e}")
            raise

    async def find_services_by_capability(self, consumer_identity: str, capability: str,
                                        region: str = None, max_price: int = None) -> List[Dict[str, Any]]:
        """
        Find services by specific capability
        """
        try:
            criteria = {
                'capability': capability,
                'match_type': 'exact'
            }

            if region:
                criteria['region'] = region

            if max_price:
                criteria['max_price'] = max_price

            return await self.find_services(consumer_identity, criteria)

        except Exception as e:
            logger.error(f"Capability-based service discovery failed: {e}")
            return []

    async def find_streaming_services(self, consumer_identity: str, stream_type: str = None,
                                    quality_requirements: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Find services that provide streaming capabilities
        """
        try:
            criteria = {
                'service_type': 'streaming',
                'capabilities': ['real-time', 'streaming']
            }

            if stream_type:
                criteria['stream_type'] = stream_type

            if quality_requirements:
                criteria['quality_requirements'] = quality_requirements

            streaming_services = await self.find_services(consumer_identity, criteria)

            # Filter and enhance streaming-specific information
            enhanced_services = []
            for service in streaming_services:
                # Add streaming-specific metadata
                service['streaming_info'] = {
                    'supported_formats': service.get('capabilities', {}).get('formats', []),
                    'max_bitrate': service.get('capabilities', {}).get('max_bitrate'),
                    'latency_ms': service.get('capabilities', {}).get('latency_ms'),
                    'concurrent_streams': service.get('capabilities', {}).get('concurrent_streams', 1)
                }
                enhanced_services.append(service)

            logger.info(f"Found {len(enhanced_services)} streaming services")
            return enhanced_services

        except Exception as e:
            logger.error(f"Streaming service discovery failed: {e}")
            return []

    async def get_service_details(self, producer_id: str, service_id: str,
                                consumer_identity: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific service
        """
        try:
            detail_request = {
                'producer_id': producer_id,
                'service_id': service_id,
                'consumer_identity': consumer_identity,
                'include_full_details': True
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.discovery_endpoint}/service-details",
                json=detail_request,
                timeout=15
            ) as response:
                if response.status == 404:
                    logger.warning(f"Service not found: {producer_id}/{service_id}")
                    return None
                elif response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Service details retrieval failed: {error_text}")

                service_details = await response.json()
                logger.debug(f"Retrieved details for service: {service_id}")
                return service_details

        except Exception as e:
            logger.error(f"Service details retrieval failed: {e}")
            return None

    async def get_producer_services(self, producer_id: str, consumer_identity: str) -> List[Dict[str, Any]]:
        """
        Get all services from a specific producer
        """
        try:
            criteria = {
                'producer_id': producer_id,
                'include_all_services': True
            }

            return await self.find_services(consumer_identity, criteria)

        except Exception as e:
            logger.error(f"Producer services retrieval failed: {e}")
            return []

    async def search_services_by_tags(self, consumer_identity: str, tags: List[str],
                                    match_all: bool = False) -> List[Dict[str, Any]]:
        """
        Search services by tags
        """
        try:
            criteria = {
                'tags': tags,
                'tag_match_type': 'all' if match_all else 'any'
            }

            return await self.find_services(consumer_identity, criteria)

        except Exception as e:
            logger.error(f"Tag-based service search failed: {e}")
            return []

    async def get_trending_services(self, consumer_identity: str, category: str = None,
                                  time_period: str = '24h') -> List[Dict[str, Any]]:
        """
        Get trending/popular services
        """
        try:
            criteria = {
                'trending': True,
                'time_period': time_period,
                'sort_by': 'popularity'
            }

            if category:
                criteria['category'] = category

            trending_services = await self.find_services(consumer_identity, criteria)
            logger.info(f"Found {len(trending_services)} trending services")
            return trending_services

        except Exception as e:
            logger.error(f"Trending services discovery failed: {e}")
            return []

    async def get_recommended_services(self, consumer_identity: str,
                                     based_on_history: bool = True) -> List[Dict[str, Any]]:
        """
        Get personalized service recommendations
        """
        try:
            recommendation_request = {
                'consumer_identity': consumer_identity,
                'recommendation_type': 'personalized',
                'use_consumption_history': based_on_history,
                'max_recommendations': 20
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.discovery_endpoint}/recommendations",
                json=recommendation_request,
                timeout=20
            ) as response:
                if response.status != 200:
                    logger.warning("Service recommendations not available")
                    return []

                result = await response.json()
                recommendations = result.get('recommendations', [])
                logger.info(f"Generated {len(recommendations)} service recommendations")
                return recommendations

        except Exception as e:
            logger.warning(f"Service recommendations failed: {e}")
            return []

    async def check_service_availability(self, producer_id: str, service_id: str) -> Dict[str, Any]:
        """
        Check real-time availability of a service
        """
        try:
            availability_request = {
                'producer_id': producer_id,
                'service_id': service_id,
                'check_type': 'realtime'
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.discovery_endpoint}/availability",
                json=availability_request,
                timeout=10
            ) as response:
                if response.status != 200:
                    return {
                        'available': False,
                        'status': 'unknown',
                        'error': 'availability_check_failed'
                    }

                availability_result = await response.json()
                logger.debug(f"Service availability: {availability_result.get('available')}")
                return availability_result

        except Exception as e:
            logger.warning(f"Service availability check failed: {e}")
            return {
                'available': False,
                'status': 'error',
                'error': str(e)
            }

    async def compare_services(self, service_ids: List[str], comparison_criteria: List[str],
                             consumer_identity: str) -> Dict[str, Any]:
        """
        Compare multiple services based on specified criteria
        """
        try:
            comparison_request = {
                'service_ids': service_ids,
                'comparison_criteria': comparison_criteria,
                'consumer_identity': consumer_identity
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.discovery_endpoint}/compare",
                json=comparison_request,
                timeout=20
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Service comparison failed: {error_text}")

                comparison_result = await response.json()
                logger.info(f"Compared {len(service_ids)} services")
                return comparison_result

        except Exception as e:
            logger.error(f"Service comparison failed: {e}")
            return {'error': str(e)}

    async def subscribe_to_service_updates(self, consumer_identity: str, subscription_criteria: Dict[str, Any]) -> str:
        """
        Subscribe to service availability and pricing updates
        """
        try:
            subscription_request = {
                'consumer_identity': consumer_identity,
                'subscription_criteria': subscription_criteria,
                'notification_method': 'webhook',
                'update_frequency': 'realtime'
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.discovery_endpoint}/subscribe-updates",
                json=subscription_request,
                timeout=15
            ) as response:
                if response.status != 201:
                    error_text = await response.text()
                    raise Exception(f"Service update subscription failed: {error_text}")

                result = await response.json()
                subscription_id = result['subscription_id']
                logger.info(f"Subscribed to service updates: {subscription_id}")
                return subscription_id

        except Exception as e:
            logger.error(f"Service update subscription failed: {e}")
            raise

    async def health_check(self) -> bool:
        """
        Check if BRC-88 service discovery is healthy
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(
                f"{self.discovery_endpoint}/health",
                timeout=5
            ) as response:
                return response.status == 200

        except Exception as e:
            logger.debug(f"BRC-88 health check failed: {e}")
            return False

    def _generate_cache_key(self, criteria: Dict[str, Any]) -> str:
        """
        Generate cache key from search criteria
        """
        try:
            # Sort criteria for consistent cache keys
            sorted_criteria = json.dumps(criteria, sort_keys=True)
            import hashlib
            return hashlib.md5(sorted_criteria.encode()).hexdigest()
        except:
            return f"cache_{hash(str(criteria))}"

    def _get_cached_result(self, cache_key: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get cached discovery result if still valid
        """
        try:
            if cache_key in self.cache:
                cached_data, timestamp = self.cache[cache_key]
                if datetime.now().timestamp() - timestamp < self.cache_ttl:
                    return cached_data

            # Remove expired cache entry
            if cache_key in self.cache:
                del self.cache[cache_key]

            return None

        except Exception as e:
            logger.debug(f"Cache retrieval failed: {e}")
            return None

    def _cache_result(self, cache_key: str, result: List[Dict[str, Any]]):
        """
        Cache discovery result
        """
        try:
            self.cache[cache_key] = (result, datetime.now().timestamp())

            # Cleanup old cache entries if cache gets too large
            if len(self.cache) > 100:
                # Remove oldest entries
                sorted_cache = sorted(self.cache.items(), key=lambda x: x[1][1])
                for old_key, _ in sorted_cache[:50]:  # Remove half
                    del self.cache[old_key]

        except Exception as e:
            logger.debug(f"Cache storage failed: {e}")

    async def close(self):
        """Close the HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None