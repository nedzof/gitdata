"""
BRC-41 PacketPay HTTP Micropayments Client for Consumer
Handles micropayment processing, quotes, and payment sessions
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Any
import aiohttp
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class BRC41PaymentClient:
    """
    BRC-41 PacketPay HTTP Micropayments Client
    Manages micropayment sessions, quotes, and transaction processing for consumers
    """

    def __init__(self, overlay_url: str):
        self.overlay_url = overlay_url.rstrip('/')
        self.payment_endpoint = f"{self.overlay_url}/api/payments"
        self.session = None

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    async def create_quote(self, consumer_identity: str, producer_id: str,
                          resource_id: str, amount: int, currency: str = 'BSV') -> Dict[str, Any]:
        """
        Create payment quote for resource access
        """
        try:
            quote_request = {
                'consumer_identity': consumer_identity,
                'producer_id': producer_id,
                'resource_id': resource_id,
                'amount': amount,
                'currency': currency,
                'payment_type': 'micropayment',
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.payment_endpoint}/quote",
                json=quote_request,
                timeout=15
            ) as response:
                if response.status != 201:
                    error_text = await response.text()
                    raise Exception(f"Payment quote creation failed: {error_text}")

                quote_result = await response.json()
                logger.info(f"Created payment quote: {quote_result['quote_id']}")
                return quote_result

        except Exception as e:
            logger.error(f"Payment quote creation failed: {e}")
            raise

    async def submit_payment(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit micropayment for processing
        """
        try:
            # Add timestamp if not present
            if 'timestamp' not in payment_data:
                payment_data['timestamp'] = datetime.now().isoformat()

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.payment_endpoint}/submit",
                json=payment_data,
                timeout=30
            ) as response:
                if response.status not in [200, 201, 202]:
                    error_text = await response.text()
                    raise Exception(f"Payment submission failed: {error_text}")

                payment_result = await response.json()
                logger.info(f"Payment submitted: {payment_result.get('payment_id')}")
                return payment_result

        except Exception as e:
            logger.error(f"Payment submission failed: {e}")
            raise

    async def create_session(self, consumer_identity: str, producer_id: str,
                           max_amount: int, payment_method: str = 'http') -> Dict[str, Any]:
        """
        Create micropayment session for ongoing payments
        """
        try:
            session_request = {
                'consumer_identity': consumer_identity,
                'producer_id': producer_id,
                'max_amount': max_amount,
                'payment_method': payment_method,
                'session_duration': 3600,  # 1 hour default
                'auto_renew': False,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.payment_endpoint}/create-session",
                json=session_request,
                timeout=15
            ) as response:
                if response.status != 201:
                    error_text = await response.text()
                    raise Exception(f"Payment session creation failed: {error_text}")

                session_result = await response.json()
                logger.info(f"Created payment session: {session_result['session_id']}")
                return session_result

        except Exception as e:
            logger.error(f"Payment session creation failed: {e}")
            raise

    async def process_micropayment(self, session_id: str, amount: int,
                                 resource_accessed: str = None) -> Dict[str, Any]:
        """
        Process a micropayment within an existing session
        """
        try:
            micropayment_request = {
                'session_id': session_id,
                'amount': amount,
                'resource_accessed': resource_accessed,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.payment_endpoint}/micropayment",
                json=micropayment_request,
                timeout=10
            ) as response:
                if response.status not in [200, 201, 202]:
                    error_text = await response.text()
                    raise Exception(f"Micropayment processing failed: {error_text}")

                micropayment_result = await response.json()
                logger.debug(f"Processed micropayment: {amount} satoshis")
                return micropayment_result

        except Exception as e:
            logger.error(f"Micropayment processing failed: {e}")
            raise

    async def get_payment_status(self, payment_id: str) -> Dict[str, Any]:
        """
        Get status of a payment or payment session
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(
                f"{self.payment_endpoint}/{payment_id}/status",
                timeout=10
            ) as response:
                if response.status == 404:
                    raise Exception(f"Payment not found: {payment_id}")
                elif response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Payment status check failed: {error_text}")

                status_result = await response.json()
                logger.debug(f"Payment status: {status_result.get('status')}")
                return status_result

        except Exception as e:
            logger.error(f"Payment status check failed: {e}")
            raise

    async def get_payment_receipt(self, payment_id: str) -> Dict[str, Any]:
        """
        Get payment receipt with transaction details
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(
                f"{self.payment_endpoint}/{payment_id}/receipt",
                timeout=10
            ) as response:
                if response.status == 404:
                    raise Exception(f"Receipt not found for payment: {payment_id}")
                elif response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Receipt retrieval failed: {error_text}")

                receipt_result = await response.json()
                logger.info(f"Retrieved receipt for payment: {payment_id}")
                return receipt_result

        except Exception as e:
            logger.error(f"Receipt retrieval failed: {e}")
            raise

    async def cancel_payment_session(self, session_id: str, consumer_identity: str) -> bool:
        """
        Cancel an active payment session
        """
        try:
            cancel_request = {
                'session_id': session_id,
                'consumer_identity': consumer_identity,
                'reason': 'user_cancelled',
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.payment_endpoint}/cancel-session",
                json=cancel_request,
                timeout=10
            ) as response:
                success = response.status in [200, 204]
                if success:
                    logger.info(f"Cancelled payment session: {session_id}")
                else:
                    error_text = await response.text()
                    logger.warning(f"Session cancellation failed: {error_text}")

                return success

        except Exception as e:
            logger.error(f"Session cancellation failed: {e}")
            return False

    async def get_consumer_payment_history(self, consumer_identity: str,
                                         days: int = 30) -> List[Dict[str, Any]]:
        """
        Get payment history for consumer
        """
        try:
            start_date = (datetime.now() - timedelta(days=days)).isoformat()
            history_request = {
                'consumer_identity': consumer_identity,
                'start_date': start_date,
                'include_receipts': True,
                'include_status': True
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.payment_endpoint}/history",
                json=history_request,
                timeout=20
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Payment history retrieval failed: {error_text}")

                history_result = await response.json()
                payments = history_result.get('payments', [])
                logger.info(f"Retrieved {len(payments)} payment records")
                return payments

        except Exception as e:
            logger.error(f"Payment history retrieval failed: {e}")
            return []

    async def estimate_cost(self, resource_type: str, resource_size: int,
                          producer_id: str = None) -> Dict[str, Any]:
        """
        Estimate cost for accessing a resource
        """
        try:
            estimate_request = {
                'resource_type': resource_type,
                'resource_size': resource_size,
                'producer_id': producer_id,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.payment_endpoint}/estimate-cost",
                json=estimate_request,
                timeout=10
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    logger.warning(f"Cost estimation failed: {error_text}")
                    return {'estimated_cost': 0, 'currency': 'BSV'}

                estimate_result = await response.json()
                logger.debug(f"Cost estimate: {estimate_result.get('estimated_cost')} satoshis")
                return estimate_result

        except Exception as e:
            logger.warning(f"Cost estimation failed: {e}")
            return {'estimated_cost': 0, 'currency': 'BSV'}

    async def validate_payment_capability(self, consumer_identity: str,
                                        required_amount: int) -> Dict[str, Any]:
        """
        Validate consumer's ability to make payment
        """
        try:
            validation_request = {
                'consumer_identity': consumer_identity,
                'required_amount': required_amount,
                'currency': 'BSV'
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.payment_endpoint}/validate-capability",
                json=validation_request,
                timeout=10
            ) as response:
                if response.status != 200:
                    logger.warning("Payment capability validation failed")
                    return {'can_pay': False, 'reason': 'validation_failed'}

                validation_result = await response.json()
                logger.debug(f"Payment capability: {validation_result.get('can_pay')}")
                return validation_result

        except Exception as e:
            logger.warning(f"Payment capability validation failed: {e}")
            return {'can_pay': False, 'reason': 'validation_error'}

    async def create_streaming_payment_setup(self, consumer_identity: str, producer_id: str,
                                           stream_id: str, rate_per_minute: int) -> Dict[str, Any]:
        """
        Setup payment for streaming content with per-minute billing
        """
        try:
            streaming_setup = {
                'consumer_identity': consumer_identity,
                'producer_id': producer_id,
                'stream_id': stream_id,
                'payment_model': 'per_minute',
                'rate': rate_per_minute,
                'currency': 'BSV',
                'auto_billing': True,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.payment_endpoint}/streaming-setup",
                json=streaming_setup,
                timeout=15
            ) as response:
                if response.status != 201:
                    error_text = await response.text()
                    raise Exception(f"Streaming payment setup failed: {error_text}")

                setup_result = await response.json()
                logger.info(f"Setup streaming payment: {setup_result['payment_session_id']}")
                return setup_result

        except Exception as e:
            logger.error(f"Streaming payment setup failed: {e}")
            raise

    async def health_check(self) -> bool:
        """
        Check if BRC-41 payment service is healthy
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(
                f"{self.payment_endpoint}/health",
                timeout=5
            ) as response:
                return response.status == 200

        except Exception as e:
            logger.debug(f"BRC-41 health check failed: {e}")
            return False

    async def get_payment_methods(self, consumer_identity: str) -> List[Dict[str, Any]]:
        """
        Get available payment methods for consumer
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(
                f"{self.payment_endpoint}/methods/{consumer_identity}",
                timeout=10
            ) as response:
                if response.status != 200:
                    logger.warning("Failed to retrieve payment methods")
                    return [{'method': 'http', 'available': True}]

                result = await response.json()
                methods = result.get('methods', [])
                logger.info(f"Available payment methods: {len(methods)}")
                return methods

        except Exception as e:
            logger.warning(f"Payment methods retrieval failed: {e}")
            return [{'method': 'http', 'available': True}]

    async def close(self):
        """Close the HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None