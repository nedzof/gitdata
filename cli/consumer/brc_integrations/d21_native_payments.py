"""
D21 BSV Native Payments Client for Consumer
Handles native BSV payments with ARC integration and multi-party settlements
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
import aiohttp
from datetime import datetime

logger = logging.getLogger(__name__)

class D21NativePayments:
    """
    D21 BSV Native Payments Client
    Handles native BSV payments, ARC integration, and premium content access
    """

    def __init__(self, overlay_url: str):
        self.overlay_url = overlay_url.rstrip('/')
        self.native_payments_endpoint = f"{self.overlay_url}/api/payments/native-bsv"
        self.session = None

    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()

    async def create_payment_template(self, template_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create BSV native payment template for consumer
        """
        try:
            payment_template_request = {
                'consumer_identity': template_data['consumer_identity'],
                'producer_id': template_data['producer_id'],
                'resource_id': template_data.get('resource_id'),
                'amount': template_data['amount'],
                'currency': template_data.get('currency', 'BSV'),
                'payment_type': 'native_bsv',
                'arc_provider': template_data.get('arc_provider', 'taal'),
                'priority_fee': template_data.get('priority_fee', 1),  # satoshis per byte
                'multi_party_split': template_data.get('multi_party_split'),
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.native_payments_endpoint}/create-template",
                json=payment_template_request,
                timeout=30
            ) as response:
                if response.status != 201:
                    error_text = await response.text()
                    raise Exception(f"Payment template creation failed: {error_text}")

                template_result = await response.json()
                logger.info(f"Created payment template: {template_result['template_id']}")
                return template_result

        except Exception as e:
            logger.error(f"Payment template creation failed: {e}")
            raise

    async def submit_native_payment(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit native BSV payment using created template
        """
        try:
            payment_submission = {
                'template_id': payment_data['template_id'],
                'consumer_identity': payment_data['consumer_identity'],
                'producer_id': payment_data['producer_id'],
                'transaction_hex': payment_data.get('transaction_hex'),
                'inputs': payment_data.get('inputs', []),
                'outputs': payment_data.get('outputs', []),
                'arc_callback': payment_data.get('arc_callback'),
                'broadcast_immediately': payment_data.get('broadcast_immediately', True),
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.native_payments_endpoint}/submit",
                json=payment_submission,
                timeout=60
            ) as response:
                if response.status not in [200, 201, 202]:
                    error_text = await response.text()
                    raise Exception(f"Native payment submission failed: {error_text}")

                payment_result = await response.json()
                logger.info(f"Submitted native payment: {payment_result.get('payment_id')}")
                return payment_result

        except Exception as e:
            logger.error(f"Native payment submission failed: {e}")
            raise

    async def create_multi_party_payment(self, consumer_identity: str, payment_splits: Dict[str, Any],
                                       total_amount: int, resource_id: str = None) -> Dict[str, Any]:
        """
        Create multi-party payment with automatic splitting
        """
        try:
            multi_party_request = {
                'consumer_identity': consumer_identity,
                'total_amount': total_amount,
                'payment_splits': payment_splits,
                'resource_id': resource_id,
                'settlement_method': 'immediate',
                'currency': 'BSV',
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.native_payments_endpoint}/multi-party",
                json=multi_party_request,
                timeout=30
            ) as response:
                if response.status != 201:
                    error_text = await response.text()
                    raise Exception(f"Multi-party payment creation failed: {error_text}")

                multi_party_result = await response.json()
                logger.info(f"Created multi-party payment: {multi_party_result['payment_id']}")
                return multi_party_result

        except Exception as e:
            logger.error(f"Multi-party payment creation failed: {e}")
            raise

    async def get_arc_transaction_status(self, transaction_id: str, arc_provider: str = 'taal') -> Dict[str, Any]:
        """
        Get transaction status from ARC provider
        """
        try:
            status_request = {
                'transaction_id': transaction_id,
                'arc_provider': arc_provider
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.native_payments_endpoint}/arc-status",
                json=status_request,
                timeout=15
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"ARC status check failed: {error_text}")

                status_result = await response.json()
                logger.debug(f"ARC transaction status: {status_result.get('status')}")
                return status_result

        except Exception as e:
            logger.error(f"ARC transaction status check failed: {e}")
            raise

    async def estimate_native_payment_cost(self, amount: int, arc_provider: str = 'taal',
                                         priority_fee: int = 1) -> Dict[str, Any]:
        """
        Estimate total cost including network fees for native BSV payment
        """
        try:
            estimation_request = {
                'amount': amount,
                'arc_provider': arc_provider,
                'priority_fee': priority_fee,
                'include_network_fees': True
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.native_payments_endpoint}/estimate-cost",
                json=estimation_request,
                timeout=10
            ) as response:
                if response.status != 200:
                    logger.warning("Cost estimation failed, using defaults")
                    return {
                        'base_amount': amount,
                        'network_fee': amount * 0.001,  # 0.1% estimate
                        'total_cost': amount * 1.001,
                        'currency': 'BSV'
                    }

                estimation_result = await response.json()
                logger.debug(f"Estimated payment cost: {estimation_result.get('total_cost')} satoshis")
                return estimation_result

        except Exception as e:
            logger.warning(f"Payment cost estimation failed: {e}")
            return {
                'base_amount': amount,
                'network_fee': amount * 0.001,
                'total_cost': amount * 1.001,
                'currency': 'BSV'
            }

    async def create_premium_content_payment(self, consumer_identity: str, producer_id: str,
                                           premium_content_id: str, amount: int,
                                           access_duration: int = 86400) -> Dict[str, Any]:
        """
        Create payment for premium content with extended access
        """
        try:
            premium_payment_request = {
                'consumer_identity': consumer_identity,
                'producer_id': producer_id,
                'premium_content_id': premium_content_id,
                'amount': amount,
                'access_duration_seconds': access_duration,
                'payment_type': 'premium_content',
                'include_streaming_rights': True,
                'include_download_rights': True,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.native_payments_endpoint}/premium-content",
                json=premium_payment_request,
                timeout=30
            ) as response:
                if response.status != 201:
                    error_text = await response.text()
                    raise Exception(f"Premium content payment creation failed: {error_text}")

                premium_result = await response.json()
                logger.info(f"Created premium content payment: {premium_result['payment_id']}")
                return premium_result

        except Exception as e:
            logger.error(f"Premium content payment creation failed: {e}")
            raise

    async def get_native_payment_history(self, consumer_identity: str, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get native BSV payment history for consumer
        """
        try:
            history_request = {
                'consumer_identity': consumer_identity,
                'days': days,
                'payment_type': 'native_bsv',
                'include_transaction_details': True,
                'include_arc_status': True
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.native_payments_endpoint}/history",
                json=history_request,
                timeout=20
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"Payment history retrieval failed: {error_text}")

                history_result = await response.json()
                payments = history_result.get('payments', [])
                logger.info(f"Retrieved {len(payments)} native payment records")
                return payments

        except Exception as e:
            logger.error(f"Native payment history retrieval failed: {e}")
            return []

    async def validate_wallet_capability(self, consumer_identity: str, required_amount: int) -> Dict[str, Any]:
        """
        Validate consumer's wallet capability for native BSV payments
        """
        try:
            validation_request = {
                'consumer_identity': consumer_identity,
                'required_amount': required_amount,
                'currency': 'BSV',
                'check_utxos': True,
                'check_balance': True
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.native_payments_endpoint}/validate-wallet",
                json=validation_request,
                timeout=15
            ) as response:
                if response.status != 200:
                    logger.warning("Wallet validation failed")
                    return {
                        'can_pay': False,
                        'reason': 'validation_failed',
                        'available_balance': 0
                    }

                validation_result = await response.json()
                logger.debug(f"Wallet capability: {validation_result.get('can_pay')}")
                return validation_result

        except Exception as e:
            logger.warning(f"Wallet validation failed: {e}")
            return {
                'can_pay': False,
                'reason': 'validation_error',
                'available_balance': 0
            }

    async def setup_recurring_payment(self, consumer_identity: str, producer_id: str,
                                    amount: int, interval_seconds: int, max_payments: int = None) -> Dict[str, Any]:
        """
        Setup recurring native BSV payments (e.g., for subscriptions)
        """
        try:
            recurring_request = {
                'consumer_identity': consumer_identity,
                'producer_id': producer_id,
                'amount_per_payment': amount,
                'interval_seconds': interval_seconds,
                'max_payments': max_payments,
                'auto_renew': False,
                'payment_type': 'recurring_native',
                'start_immediately': False,
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.native_payments_endpoint}/recurring-setup",
                json=recurring_request,
                timeout=20
            ) as response:
                if response.status != 201:
                    error_text = await response.text()
                    raise Exception(f"Recurring payment setup failed: {error_text}")

                recurring_result = await response.json()
                logger.info(f"Setup recurring payment: {recurring_result['recurring_id']}")
                return recurring_result

        except Exception as e:
            logger.error(f"Recurring payment setup failed: {e}")
            raise

    async def cancel_recurring_payment(self, recurring_id: str, consumer_identity: str) -> bool:
        """
        Cancel a recurring payment setup
        """
        try:
            cancellation_request = {
                'recurring_id': recurring_id,
                'consumer_identity': consumer_identity,
                'cancellation_reason': 'user_requested',
                'timestamp': datetime.now().isoformat()
            }

            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.post(
                f"{self.native_payments_endpoint}/cancel-recurring",
                json=cancellation_request,
                timeout=15
            ) as response:
                success = response.status in [200, 204]
                if success:
                    logger.info(f"Cancelled recurring payment: {recurring_id}")
                else:
                    error_text = await response.text()
                    logger.warning(f"Recurring payment cancellation failed: {error_text}")

                return success

        except Exception as e:
            logger.error(f"Recurring payment cancellation failed: {e}")
            return False

    async def get_supported_arc_providers(self) -> List[Dict[str, Any]]:
        """
        Get list of supported ARC providers and their capabilities
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(
                f"{self.native_payments_endpoint}/arc-providers",
                timeout=10
            ) as response:
                if response.status != 200:
                    logger.warning("Failed to retrieve ARC providers")
                    return [
                        {
                            'provider': 'taal',
                            'name': 'TAAL Distributed Information Technologies',
                            'supported': True,
                            'fee_rate': 'standard'
                        }
                    ]

                result = await response.json()
                providers = result.get('providers', [])
                logger.info(f"Retrieved {len(providers)} ARC providers")
                return providers

        except Exception as e:
            logger.warning(f"ARC providers retrieval failed: {e}")
            return []

    async def health_check(self) -> bool:
        """
        Check if D21 native payments service is healthy
        """
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()

            async with self.session.get(
                f"{self.native_payments_endpoint}/health",
                timeout=5
            ) as response:
                return response.status == 200

        except Exception as e:
            logger.debug(f"D21 health check failed: {e}")
            return False

    async def close(self):
        """Close the HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None