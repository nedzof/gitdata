"""
BRC-24 Lookup Services Client for Consumer
Handles content discovery, metadata queries, and service lookups
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
import aiohttp
from datetime import datetime

logger = logging.getLogger(__name__)

class BRC24LookupClient:
    """
    BRC-24 Lookup Services Client
    Provides content discovery and metadata query capabilities for consumers
    """

    def __init__(self, overlay_url: str):
        self.overlay_url = overlay_url.rstrip('/')
        self.lookup_endpoint = f"{self.overlay_url}/api/lookup"
        self.session = None

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    async def search_content(self, query: Dict[str, Any], consumer_identity: str,
                           pagination: Optional[Dict[str, int]] = None) -> Dict[str, Any]:
        """
        Search for content using BRC-24 lookup services
        """
        try:
            search_request = {
                'consumer_identity': consumer_identity,
                'query': query,
                'pagination': pagination or {'limit': 50, 'offset': 0},
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.lookup_endpoint}/search",
                json=search_request,
                timeout=30
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Content search failed: {error_text}")

                result = await response.json()
                logger.info(f"Found {len(result.get('results', []))} content items")
                return result

        except Exception as e:
            logger.error(f"Content search failed: {e}")
            raise

    async def get_content_info(self, content_id: str, consumer_identity: str = None) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about specific content
        """
        try:
            info_request = {
                'content_id': content_id,
                'consumer_identity': consumer_identity,
                'include_metadata': True,
                'include_pricing': True
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.lookup_endpoint}/info",
                json=info_request,
                timeout=15
            ) as response:
                if response.status == 404:
                    logger.warning(f"Content not found: {content_id}")
                    return None
                elif response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Content info retrieval failed: {error_text}")

                result = await response.json()
                logger.debug(f"Retrieved info for content: {content_id}")
                return result

        except Exception as e:
            logger.error(f"Content info retrieval failed: {e}")
            return None

    async def get_service_metadata(self, producer_id: str, service_id: str = None) -> Dict[str, Any]:
        """
        Get metadata about producer services
        """
        try:
            metadata_request = {
                'producer_id': producer_id,
                'service_id': service_id,
                'include_capabilities': True,
                'include_pricing': True,
                'include_reputation': True
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.lookup_endpoint}/service-metadata",
                json=metadata_request,
                timeout=15
            ) as response:
                if response.status != 200:
                    logger.warning(f"Service metadata not available for {producer_id}")
                    return {}

                result = await response.json()
                logger.debug(f"Retrieved service metadata for producer: {producer_id}")
                return result

        except Exception as e:
            logger.warning(f"Service metadata retrieval failed: {e}")
            return {}

    async def find_content_by_tags(self, tags: List[str], consumer_identity: str,
                                  additional_filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Find content by tags with optional additional filters
        """
        try:
            query = {
                'tags': tags,
                'match_all_tags': False  # OR matching by default
            }

            if additional_filters:
                query.update(additional_filters)

            result = await self.search_content(
                query=query,
                consumer_identity=consumer_identity,
                pagination={'limit': 100, 'offset': 0}
            )

            return result.get('results', [])

        except Exception as e:
            logger.error(f"Tag-based content search failed: {e}")
            return []

    async def find_content_by_producer(self, producer_id: str, consumer_identity: str,
                                     content_type: str = None, max_price: int = None) -> List[Dict[str, Any]]:
        """
        Find all content from a specific producer
        """
        try:
            query = {
                'producer_id': producer_id
            }

            if content_type:
                query['content_type'] = content_type

            if max_price:
                query['max_price'] = max_price

            result = await self.search_content(
                query=query,
                consumer_identity=consumer_identity,
                pagination={'limit': 100, 'offset': 0}
            )

            return result.get('results', [])

        except Exception as e:
            logger.error(f"Producer content search failed: {e}")
            return []

    async def get_trending_content(self, consumer_identity: str, category: str = None,
                                 time_period: str = '24h') -> List[Dict[str, Any]]:
        """
        Get trending/popular content based on access patterns
        """
        try:
            query = {
                'trending': True,
                'time_period': time_period
            }

            if category:
                query['category'] = category

            result = await self.search_content(
                query=query,
                consumer_identity=consumer_identity,
                pagination={'limit': 20, 'offset': 0}
            )

            trending_content = result.get('results', [])
            logger.info(f"Found {len(trending_content)} trending content items")
            return trending_content

        except Exception as e:
            logger.error(f"Trending content search failed: {e}")
            return []

    async def get_content_recommendations(self, consumer_identity: str,
                                        based_on_history: bool = True) -> List[Dict[str, Any]]:
        """
        Get personalized content recommendations for consumer
        """
        try:
            query = {
                'recommendations': True,
                'consumer_identity': consumer_identity,
                'use_history': based_on_history,
                'max_recommendations': 50
            }

            result = await self.search_content(
                query=query,
                consumer_identity=consumer_identity,
                pagination={'limit': 50, 'offset': 0}
            )

            recommendations = result.get('results', [])
            logger.info(f"Generated {len(recommendations)} content recommendations")
            return recommendations

        except Exception as e:
            logger.error(f"Content recommendations failed: {e}")
            return []

    async def search_by_price_range(self, min_price: int, max_price: int,
                                  consumer_identity: str, content_type: str = None) -> List[Dict[str, Any]]:
        """
        Search content within specific price range
        """
        try:
            query = {
                'min_price': min_price,
                'max_price': max_price
            }

            if content_type:
                query['content_type'] = content_type

            result = await self.search_content(
                query=query,
                consumer_identity=consumer_identity,
                pagination={'limit': 100, 'offset': 0}
            )

            return result.get('results', [])

        except Exception as e:
            logger.error(f"Price range search failed: {e}")
            return []

    async def get_content_categories(self) -> List[Dict[str, Any]]:
        """
        Get available content categories and their metadata
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(
                f"{self.lookup_endpoint}/categories",
                timeout=10
            ) as response:
                if response.status != 200:
                    logger.warning("Failed to retrieve content categories")
                    return []

                result = await response.json()
                categories = result.get('categories', [])
                logger.info(f"Retrieved {len(categories)} content categories")
                return categories

        except Exception as e:
            logger.error(f"Category retrieval failed: {e}")
            return []

    async def register_content_access(self, content_id: str, consumer_identity: str,
                                    access_type: str = 'view') -> bool:
        """
        Register content access for analytics and recommendations
        """
        try:
            access_data = {
                'content_id': content_id,
                'consumer_identity': consumer_identity,
                'access_type': access_type,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.lookup_endpoint}/register-access",
                json=access_data,
                timeout=10
            ) as response:
                success = response.status in [200, 201]
                if success:
                    logger.debug(f"Registered content access: {content_id}")
                else:
                    logger.warning(f"Failed to register content access: {content_id}")

                return success

        except Exception as e:
            logger.warning(f"Content access registration failed: {e}")
            return False

    async def get_producer_reputation(self, producer_id: str) -> Dict[str, Any]:
        """
        Get reputation information for a producer
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(
                f"{self.lookup_endpoint}/producer-reputation/{producer_id}",
                timeout=10
            ) as response:
                if response.status != 200:
                    logger.warning(f"Reputation data not available for producer: {producer_id}")
                    return {'reputation_score': 0.0, 'total_ratings': 0}

                result = await response.json()
                logger.debug(f"Retrieved reputation for producer: {producer_id}")
                return result

        except Exception as e:
            logger.warning(f"Producer reputation retrieval failed: {e}")
            return {'reputation_score': 0.0, 'total_ratings': 0}

    async def health_check(self) -> bool:
        """
        Check if BRC-24 lookup service is healthy
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(
                f"{self.lookup_endpoint}/health",
                timeout=5
            ) as response:
                return response.status == 200

        except Exception as e:
            logger.debug(f"BRC-24 health check failed: {e}")
            return False

    async def advanced_search(self, search_criteria: Dict[str, Any],
                            consumer_identity: str) -> Dict[str, Any]:
        """
        Advanced search with complex filtering and sorting
        """
        try:
            # Build advanced search request
            advanced_request = {
                'consumer_identity': consumer_identity,
                'advanced_query': search_criteria,
                'include_facets': True,
                'include_aggregations': True,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.lookup_endpoint}/advanced-search",
                json=advanced_request,
                timeout=30
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Advanced search failed: {error_text}")

                result = await response.json()
                logger.info(f"Advanced search returned {len(result.get('results', []))} items")
                return result

        except Exception as e:
            logger.error(f"Advanced search failed: {e}")
            raise

    async def close(self):
        """Close the HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None