"""
BRC-26 UHRP Content Storage Client for Consumer
Handles content retrieval, integrity verification, and streaming access
"""

import asyncio
import hashlib
import json
import logging
import os
from typing import Dict, List, Optional, Any, AsyncGenerator
import aiohttp
from datetime import datetime
import aiofiles

logger = logging.getLogger(__name__)

class BRC26ContentClient:
    """
    BRC-26 UHRP Content Storage Client
    Provides content retrieval and streaming capabilities for consumers
    """

    def __init__(self, overlay_url: str):
        self.overlay_url = overlay_url.rstrip('/')
        self.content_endpoint = f"{self.overlay_url}/api/content"
        self.session = None

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    async def get_content(self, uhrp_hash: str, consumer_identity: str,
                         access_token: str = None, verify_integrity: bool = True) -> Dict[str, Any]:
        """
        Retrieve content via UHRP hash with optional payment verification
        """
        try:
            content_request = {
                'uhrp_hash': uhrp_hash,
                'consumer_identity': consumer_identity,
                'access_token': access_token,
                'verify_integrity': verify_integrity,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.content_endpoint}/retrieve",
                json=content_request,
                timeout=60
            ) as response:
                if response.status == 401:
                    raise Exception("Access denied - payment required or invalid access token")
                elif response.status == 404:
                    raise Exception(f"Content not found: {uhrp_hash}")
                elif response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Content retrieval failed: {error_text}")

                content_result = await response.json()

                # Verify content integrity if requested
                if verify_integrity and content_result.get('content_hash'):
                    await self._verify_content_integrity(content_result)

                logger.info(f"Retrieved content: {uhrp_hash}")
                return content_result

        except Exception as e:
            logger.error(f"Content retrieval failed: {e}")
            raise

    async def download_content_to_file(self, uhrp_hash: str, consumer_identity: str,
                                     output_path: str, access_token: str = None,
                                     verify_integrity: bool = True) -> Dict[str, Any]:
        """
        Download content directly to file with progress tracking
        """
        try:
            # Get content metadata first
            metadata = await self.get_content_metadata(uhrp_hash, consumer_identity)

            download_request = {
                'uhrp_hash': uhrp_hash,
                'consumer_identity': consumer_identity,
                'access_token': access_token,
                'stream_download': True,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            # Create output directory if needed
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            total_size = metadata.get('size', 0)
            downloaded_size = 0
            content_hash = hashlib.sha256()

            async with self.session.post(
                f"{self.content_endpoint}/download",
                json=download_request,
                timeout=None  # No timeout for large downloads
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Content download failed: {error_text}")

                async with aiofiles.open(output_path, 'wb') as file:
                    async for chunk in response.content.iter_chunked(8192):
                        await file.write(chunk)
                        downloaded_size += len(chunk)
                        content_hash.update(chunk)

                        # Log progress for large files
                        if total_size > 0 and downloaded_size % (1024 * 1024) == 0:  # Every MB
                            progress = (downloaded_size / total_size) * 100
                            logger.info(f"Download progress: {progress:.1f}%")

            # Verify integrity if requested
            integrity_verified = True
            if verify_integrity and metadata.get('content_hash'):
                calculated_hash = content_hash.hexdigest()
                expected_hash = metadata['content_hash']
                integrity_verified = calculated_hash == expected_hash

                if not integrity_verified:
                    logger.error(f"Content integrity verification failed for {uhrp_hash}")

            result = {
                'uhrp_hash': uhrp_hash,
                'file_path': output_path,
                'file_size': downloaded_size,
                'integrity_verified': integrity_verified,
                'content_type': metadata.get('content_type', 'application/octet-stream'),
                'metadata': metadata
            }

            logger.info(f"Downloaded content to: {output_path}")
            return result

        except Exception as e:
            logger.error(f"Content download failed: {e}")
            raise

    async def stream_content(self, uhrp_hash: str, consumer_identity: str,
                           access_token: str = None) -> AsyncGenerator[bytes, None]:
        """
        Stream content in chunks for real-time consumption
        """
        try:
            stream_request = {
                'uhrp_hash': uhrp_hash,
                'consumer_identity': consumer_identity,
                'access_token': access_token,
                'streaming': True,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.content_endpoint}/stream",
                json=stream_request,
                timeout=None
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Content streaming failed: {error_text}")

                logger.info(f"Started streaming content: {uhrp_hash}")

                async for chunk in response.content.iter_chunked(8192):
                    if chunk:
                        yield chunk

        except Exception as e:
            logger.error(f"Content streaming failed: {e}")
            raise

    async def get_content_metadata(self, uhrp_hash: str, consumer_identity: str) -> Dict[str, Any]:
        """
        Get metadata about content without retrieving the content itself
        """
        try:
            metadata_request = {
                'uhrp_hash': uhrp_hash,
                'consumer_identity': consumer_identity,
                'metadata_only': True
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.content_endpoint}/metadata",
                json=metadata_request,
                timeout=10
            ) as response:
                if response.status == 404:
                    raise Exception(f"Content metadata not found: {uhrp_hash}")
                elif response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Metadata retrieval failed: {error_text}")

                metadata_result = await response.json()
                logger.debug(f"Retrieved metadata for: {uhrp_hash}")
                return metadata_result

        except Exception as e:
            logger.error(f"Metadata retrieval failed: {e}")
            raise

    async def check_content_availability(self, uhrp_hashes: List[str],
                                       consumer_identity: str) -> Dict[str, Dict[str, Any]]:
        """
        Check availability of multiple content items
        """
        try:
            availability_request = {
                'uhrp_hashes': uhrp_hashes,
                'consumer_identity': consumer_identity,
                'include_metadata': True,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.content_endpoint}/availability",
                json=availability_request,
                timeout=20
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Availability check failed: {error_text}")

                availability_result = await response.json()
                logger.info(f"Checked availability for {len(uhrp_hashes)} content items")
                return availability_result.get('availability', {})

        except Exception as e:
            logger.error(f"Availability check failed: {e}")
            return {}

    async def get_content_access_history(self, consumer_identity: str,
                                       days: int = 30) -> List[Dict[str, Any]]:
        """
        Get content access history for consumer
        """
        try:
            history_request = {
                'consumer_identity': consumer_identity,
                'days': days,
                'include_metadata': True
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.content_endpoint}/access-history",
                json=history_request,
                timeout=15
            ) as response:
                if response.status != 200:
                    logger.warning("Access history retrieval failed")
                    return []

                history_result = await response.json()
                access_history = history_result.get('history', [])
                logger.info(f"Retrieved {len(access_history)} access records")
                return access_history

        except Exception as e:
            logger.warning(f"Access history retrieval failed: {e}")
            return []

    async def cache_content_locally(self, uhrp_hash: str, consumer_identity: str,
                                  cache_dir: str = './cache', access_token: str = None) -> Dict[str, Any]:
        """
        Cache content locally for offline access
        """
        try:
            # Create cache directory
            os.makedirs(cache_dir, exist_ok=True)

            # Generate cache filename
            cache_filename = f"{uhrp_hash}.cache"
            cache_path = os.path.join(cache_dir, cache_filename)

            # Check if already cached
            if os.path.exists(cache_path):
                # Verify cache integrity
                with open(cache_path, 'rb') as f:
                    cached_hash = hashlib.sha256(f.read()).hexdigest()

                if cached_hash == uhrp_hash or await self._verify_cached_content(cache_path, uhrp_hash):
                    logger.info(f"Content already cached: {cache_path}")
                    return {
                        'cached': True,
                        'cache_path': cache_path,
                        'cache_hit': True
                    }

            # Download and cache content
            download_result = await self.download_content_to_file(
                uhrp_hash=uhrp_hash,
                consumer_identity=consumer_identity,
                output_path=cache_path,
                access_token=access_token,
                verify_integrity=True
            )

            # Create cache metadata
            cache_metadata = {
                'uhrp_hash': uhrp_hash,
                'cached_at': datetime.now().isoformat(),
                'file_size': download_result['file_size'],
                'content_type': download_result.get('content_type'),
                'integrity_verified': download_result.get('integrity_verified', False)
            }

            metadata_path = cache_path + '.meta'
            with open(metadata_path, 'w') as f:
                json.dump(cache_metadata, f, indent=2)

            return {
                'cached': True,
                'cache_path': cache_path,
                'cache_hit': False,
                'metadata': cache_metadata
            }

        except Exception as e:
            logger.error(f"Content caching failed: {e}")
            raise

    async def verify_content_integrity(self, uhrp_hash: str, file_path: str) -> bool:
        """
        Verify integrity of locally stored content
        """
        try:
            if not os.path.exists(file_path):
                return False

            # Calculate file hash
            file_hash = hashlib.sha256()
            async with aiofiles.open(file_path, 'rb') as f:
                while chunk := await f.read(8192):
                    file_hash.update(chunk)

            calculated_hash = file_hash.hexdigest()

            # Compare with expected hash
            if calculated_hash == uhrp_hash:
                return True

            # If direct hash doesn't match, check with content metadata
            try:
                metadata = await self.get_content_metadata(uhrp_hash, "integrity_check")
                expected_hash = metadata.get('content_hash', uhrp_hash)
                return calculated_hash == expected_hash
            except:
                return False

        except Exception as e:
            logger.error(f"Integrity verification failed: {e}")
            return False

    async def health_check(self) -> bool:
        """
        Check if BRC-26 content service is healthy
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(
                f"{self.content_endpoint}/health",
                timeout=5
            ) as response:
                return response.status == 200

        except Exception as e:
            logger.debug(f"BRC-26 health check failed: {e}")
            return False

    async def _verify_content_integrity(self, content_result: Dict[str, Any]) -> bool:
        """
        Internal method to verify content integrity
        """
        try:
            content_data = content_result.get('content')
            expected_hash = content_result.get('content_hash')

            if not content_data or not expected_hash:
                return True  # Skip verification if data not available

            # Handle different content encodings
            if isinstance(content_data, str):
                # Assume base64 encoded
                import base64
                content_bytes = base64.b64decode(content_data)
            else:
                content_bytes = content_data

            # Calculate hash
            calculated_hash = hashlib.sha256(content_bytes).hexdigest()
            verified = calculated_hash == expected_hash

            if not verified:
                logger.warning(f"Content integrity verification failed")
                logger.debug(f"Expected: {expected_hash}")
                logger.debug(f"Calculated: {calculated_hash}")

            return verified

        except Exception as e:
            logger.warning(f"Content integrity verification error: {e}")
            return False

    async def _verify_cached_content(self, cache_path: str, expected_hash: str) -> bool:
        """
        Verify integrity of cached content
        """
        try:
            return await self.verify_content_integrity(expected_hash, cache_path)
        except Exception as e:
            logger.debug(f"Cache verification failed: {e}")
            return False

    async def close(self):
        """Close the HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None