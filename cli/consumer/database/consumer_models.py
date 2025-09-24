"""
Consumer Database Models and Operations
Handles all database operations for the consumer CLI
"""

import asyncio
import json
import logging
import os
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import asyncpg
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class ConsumerIdentity:
    consumer_id: str
    identity_key: str
    display_name: str
    preferences: Dict[str, Any]
    payment_methods: List[str]
    budget_limits: Dict[str, Any]
    reputation_score: float
    created_at: datetime
    updated_at: datetime

@dataclass
class ConsumerSubscription:
    subscription_id: str
    consumer_id: str
    producer_id: str
    service_id: str
    stream_id: Optional[str]
    subscription_type: str
    payment_method: str
    rate_limit_per_minute: int
    max_cost_per_hour: Optional[int]
    status: str
    metadata: Dict[str, Any]
    created_at: datetime
    expires_at: Optional[datetime]

@dataclass
class ConsumerPayment:
    payment_id: str
    consumer_id: str
    producer_id: str
    payment_method: str
    amount_satoshis: int
    brc22_transaction_id: Optional[str]
    brc41_receipt_data: Optional[Dict[str, Any]]
    d21_template_id: Optional[str]
    payment_status: str
    resource_accessed: Optional[str]
    created_at: datetime
    confirmed_at: Optional[datetime]

@dataclass
class ConsumerContentAccess:
    access_id: str
    consumer_id: str
    uhrp_hash: str
    access_method: str
    bytes_transferred: int
    access_duration_ms: Optional[int]
    payment_id: Optional[str]
    brc64_lineage_data: Optional[Dict[str, Any]]
    metadata: Dict[str, Any]
    accessed_at: datetime

class ConsumerDatabase:
    """
    Consumer Database Operations
    Handles all database interactions for the consumer CLI
    """

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool = None

    async def connect(self):
        """Establish database connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                dsn=self.database_url,
                min_size=1,
                max_size=10,
                command_timeout=30
            )

            # Create tables if they don't exist
            await self._create_tables()
            logger.info("Consumer database connected successfully")

        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise

    async def close(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Consumer database connection closed")

    async def _create_tables(self):
        """Create consumer database tables if they don't exist"""
        try:
            async with self.pool.acquire() as conn:
                # Consumer identities table
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS consumer_identities (
                        consumer_id TEXT PRIMARY KEY,
                        identity_key TEXT NOT NULL UNIQUE,
                        display_name TEXT,
                        preferences JSONB DEFAULT '{}',
                        payment_methods TEXT[] DEFAULT ARRAY['http'],
                        budget_limits JSONB DEFAULT '{}',
                        reputation_score DECIMAL(3,2) DEFAULT 0.0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')

                # Consumer subscriptions table
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS consumer_subscriptions (
                        subscription_id TEXT PRIMARY KEY,
                        consumer_id TEXT NOT NULL,
                        producer_id TEXT NOT NULL,
                        service_id TEXT NOT NULL,
                        stream_id TEXT,
                        subscription_type TEXT NOT NULL,
                        payment_method TEXT NOT NULL,
                        rate_limit_per_minute INTEGER DEFAULT 60,
                        max_cost_per_hour INTEGER,
                        status TEXT DEFAULT 'active',
                        metadata JSONB DEFAULT '{}',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP,
                        FOREIGN KEY (consumer_id) REFERENCES consumer_identities(consumer_id)
                    )
                ''')

                # Consumer payments table
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS consumer_payments (
                        payment_id TEXT PRIMARY KEY,
                        consumer_id TEXT NOT NULL,
                        producer_id TEXT NOT NULL,
                        payment_method TEXT NOT NULL,
                        amount_satoshis INTEGER NOT NULL,
                        brc22_transaction_id TEXT,
                        brc41_receipt_data JSONB,
                        d21_template_id TEXT,
                        payment_status TEXT DEFAULT 'pending',
                        resource_accessed TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        confirmed_at TIMESTAMP,
                        FOREIGN KEY (consumer_id) REFERENCES consumer_identities(consumer_id)
                    )
                ''')

                # Consumer content access table
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS consumer_content_access (
                        access_id TEXT PRIMARY KEY,
                        consumer_id TEXT NOT NULL,
                        uhrp_hash TEXT NOT NULL,
                        access_method TEXT NOT NULL,
                        bytes_transferred BIGINT DEFAULT 0,
                        access_duration_ms INTEGER,
                        payment_id TEXT,
                        brc64_lineage_data JSONB,
                        metadata JSONB DEFAULT '{}',
                        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (consumer_id) REFERENCES consumer_identities(consumer_id),
                        FOREIGN KEY (payment_id) REFERENCES consumer_payments(payment_id)
                    )
                ''')

                # Discovered services cache table
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS discovered_services (
                        discovery_id TEXT PRIMARY KEY,
                        producer_id TEXT NOT NULL,
                        service_capabilities TEXT[] NOT NULL,
                        geographic_region TEXT,
                        pricing_info JSONB NOT NULL,
                        reputation_score DECIMAL(3,2),
                        availability_status TEXT DEFAULT 'unknown',
                        last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')

                # Usage events table for analytics
                await conn.execute('''
                    CREATE TABLE IF NOT EXISTS consumer_usage_events (
                        event_id TEXT PRIMARY KEY,
                        consumer_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        resource_id TEXT NOT NULL,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        metadata JSONB DEFAULT '{}',
                        session_id TEXT,
                        FOREIGN KEY (consumer_id) REFERENCES consumer_identities(consumer_id)
                    )
                ''')

                # Create indexes for performance
                await conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_consumer_subscriptions_consumer
                    ON consumer_subscriptions(consumer_id, status)
                ''')

                await conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_consumer_payments_consumer_date
                    ON consumer_payments(consumer_id, created_at DESC)
                ''')

                await conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_consumer_content_access_consumer_date
                    ON consumer_content_access(consumer_id, accessed_at DESC)
                ''')

                await conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_discovered_services_capability
                    ON discovered_services USING GIN(service_capabilities)
                ''')

                await conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_discovered_services_region
                    ON discovered_services(geographic_region, reputation_score DESC)
                ''')

                await conn.execute('''
                    CREATE INDEX IF NOT EXISTS idx_usage_events_consumer_type_date
                    ON consumer_usage_events(consumer_id, event_type, timestamp DESC)
                ''')

        except Exception as e:
            logger.error(f"Table creation failed: {e}")
            raise

    async def create_or_update_consumer_identity(self, consumer_id: str, identity_key: str,
                                               display_name: str = None, preferences: Dict[str, Any] = None,
                                               payment_methods: List[str] = None,
                                               budget_limits: Dict[str, Any] = None) -> ConsumerIdentity:
        """Create or update consumer identity"""
        try:
            async with self.pool.acquire() as conn:
                # Check if consumer exists
                existing = await conn.fetchrow(
                    "SELECT * FROM consumer_identities WHERE consumer_id = $1",
                    consumer_id
                )

                if existing:
                    # Update existing consumer
                    await conn.execute('''
                        UPDATE consumer_identities
                        SET identity_key = $2, display_name = $3, preferences = $4,
                            payment_methods = $5, budget_limits = $6, updated_at = CURRENT_TIMESTAMP
                        WHERE consumer_id = $1
                    ''', consumer_id, identity_key, display_name or existing['display_name'],
                         json.dumps(preferences or existing['preferences']),
                         payment_methods or existing['payment_methods'],
                         json.dumps(budget_limits or existing['budget_limits']))
                else:
                    # Create new consumer
                    await conn.execute('''
                        INSERT INTO consumer_identities
                        (consumer_id, identity_key, display_name, preferences, payment_methods, budget_limits)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    ''', consumer_id, identity_key, display_name or f"Consumer-{consumer_id[:8]}",
                         json.dumps(preferences or {}),
                         payment_methods or ['http'],
                         json.dumps(budget_limits or {}))

                # Fetch updated record
                record = await conn.fetchrow(
                    "SELECT * FROM consumer_identities WHERE consumer_id = $1",
                    consumer_id
                )

                return ConsumerIdentity(
                    consumer_id=record['consumer_id'],
                    identity_key=record['identity_key'],
                    display_name=record['display_name'],
                    preferences=record['preferences'],
                    payment_methods=record['payment_methods'],
                    budget_limits=record['budget_limits'],
                    reputation_score=float(record['reputation_score']),
                    created_at=record['created_at'],
                    updated_at=record['updated_at']
                )

        except Exception as e:
            logger.error(f"Consumer identity operation failed: {e}")
            raise

    async def create_subscription(self, subscription_id: str, consumer_id: str, producer_id: str,
                                service_id: str, stream_id: str = None, subscription_type: str = 'streaming',
                                payment_method: str = 'http', rate_limit_per_minute: int = 60,
                                max_cost_per_hour: int = None, metadata: Dict[str, Any] = None,
                                expires_at: datetime = None) -> ConsumerSubscription:
        """Create a new subscription"""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute('''
                    INSERT INTO consumer_subscriptions
                    (subscription_id, consumer_id, producer_id, service_id, stream_id,
                     subscription_type, payment_method, rate_limit_per_minute, max_cost_per_hour,
                     metadata, expires_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ''', subscription_id, consumer_id, producer_id, service_id, stream_id,
                     subscription_type, payment_method, rate_limit_per_minute, max_cost_per_hour,
                     json.dumps(metadata or {}), expires_at)

                # Fetch created record
                record = await conn.fetchrow(
                    "SELECT * FROM consumer_subscriptions WHERE subscription_id = $1",
                    subscription_id
                )

                return ConsumerSubscription(
                    subscription_id=record['subscription_id'],
                    consumer_id=record['consumer_id'],
                    producer_id=record['producer_id'],
                    service_id=record['service_id'],
                    stream_id=record['stream_id'],
                    subscription_type=record['subscription_type'],
                    payment_method=record['payment_method'],
                    rate_limit_per_minute=record['rate_limit_per_minute'],
                    max_cost_per_hour=record['max_cost_per_hour'],
                    status=record['status'],
                    metadata=record['metadata'],
                    created_at=record['created_at'],
                    expires_at=record['expires_at']
                )

        except Exception as e:
            logger.error(f"Subscription creation failed: {e}")
            raise

    async def create_payment_record(self, payment_id: str, consumer_id: str, producer_id: str,
                                  payment_method: str, amount_satoshis: int, resource_accessed: str = None,
                                  payment_status: str = 'pending', brc22_transaction_id: str = None,
                                  brc41_receipt_data: Dict[str, Any] = None,
                                  d21_template_id: str = None) -> ConsumerPayment:
        """Create a payment record"""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute('''
                    INSERT INTO consumer_payments
                    (payment_id, consumer_id, producer_id, payment_method, amount_satoshis,
                     resource_accessed, payment_status, brc22_transaction_id, brc41_receipt_data,
                     d21_template_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ''', payment_id, consumer_id, producer_id, payment_method, amount_satoshis,
                     resource_accessed, payment_status, brc22_transaction_id,
                     json.dumps(brc41_receipt_data) if brc41_receipt_data else None,
                     d21_template_id)

                # Fetch created record
                record = await conn.fetchrow(
                    "SELECT * FROM consumer_payments WHERE payment_id = $1",
                    payment_id
                )

                return ConsumerPayment(
                    payment_id=record['payment_id'],
                    consumer_id=record['consumer_id'],
                    producer_id=record['producer_id'],
                    payment_method=record['payment_method'],
                    amount_satoshis=record['amount_satoshis'],
                    brc22_transaction_id=record['brc22_transaction_id'],
                    brc41_receipt_data=record['brc41_receipt_data'],
                    d21_template_id=record['d21_template_id'],
                    payment_status=record['payment_status'],
                    resource_accessed=record['resource_accessed'],
                    created_at=record['created_at'],
                    confirmed_at=record['confirmed_at']
                )

        except Exception as e:
            logger.error(f"Payment record creation failed: {e}")
            raise

    async def record_content_access(self, access_id: str, consumer_id: str, uhrp_hash: str,
                                  access_method: str, bytes_transferred: int = 0,
                                  access_duration_ms: int = None, payment_id: str = None,
                                  brc64_lineage_data: Dict[str, Any] = None,
                                  metadata: Dict[str, Any] = None) -> ConsumerContentAccess:
        """Record content access"""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute('''
                    INSERT INTO consumer_content_access
                    (access_id, consumer_id, uhrp_hash, access_method, bytes_transferred,
                     access_duration_ms, payment_id, brc64_lineage_data, metadata)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ''', access_id, consumer_id, uhrp_hash, access_method, bytes_transferred,
                     access_duration_ms, payment_id,
                     json.dumps(brc64_lineage_data) if brc64_lineage_data else None,
                     json.dumps(metadata or {}))

                # Fetch created record
                record = await conn.fetchrow(
                    "SELECT * FROM consumer_content_access WHERE access_id = $1",
                    access_id
                )

                return ConsumerContentAccess(
                    access_id=record['access_id'],
                    consumer_id=record['consumer_id'],
                    uhrp_hash=record['uhrp_hash'],
                    access_method=record['access_method'],
                    bytes_transferred=record['bytes_transferred'],
                    access_duration_ms=record['access_duration_ms'],
                    payment_id=record['payment_id'],
                    brc64_lineage_data=record['brc64_lineage_data'],
                    metadata=record['metadata'],
                    accessed_at=record['accessed_at']
                )

        except Exception as e:
            logger.error(f"Content access recording failed: {e}")
            raise

    async def cache_discovered_service(self, producer_id: str, capabilities: List[str],
                                     region: str, pricing_info: Dict[str, Any],
                                     reputation_score: float = 0.0) -> str:
        """Cache discovered service information"""
        try:
            async with self.pool.acquire() as conn:
                discovery_id = f"discovery_{producer_id}_{int(datetime.now().timestamp())}"

                # Insert or update cached service
                await conn.execute('''
                    INSERT INTO discovered_services
                    (discovery_id, producer_id, service_capabilities, geographic_region,
                     pricing_info, reputation_score)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (producer_id)
                    DO UPDATE SET
                        service_capabilities = $3,
                        geographic_region = $4,
                        pricing_info = $5,
                        reputation_score = $6,
                        last_checked_at = CURRENT_TIMESTAMP
                ''', discovery_id, producer_id, capabilities, region,
                     json.dumps(pricing_info), reputation_score)

                return discovery_id

        except Exception as e:
            logger.warning(f"Service caching failed: {e}")
            return ""

    async def log_consumption_event(self, event_id: str, consumer_id: str, event_type: str,
                                  resource_id: str, metadata: Dict[str, Any] = None,
                                  session_id: str = None):
        """Log a consumption event for analytics"""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute('''
                    INSERT INTO consumer_usage_events
                    (event_id, consumer_id, event_type, resource_id, metadata, session_id)
                    VALUES ($1, $2, $3, $4, $5, $6)
                ''', event_id, consumer_id, event_type, resource_id,
                     json.dumps(metadata or {}), session_id)

        except Exception as e:
            logger.error(f"Usage event logging failed: {e}")

    async def get_usage_history(self, consumer_id: str, start_date: datetime,
                              end_date: datetime = None) -> List[Dict[str, Any]]:
        """Get usage history for consumer"""
        try:
            async with self.pool.acquire() as conn:
                if end_date is None:
                    end_date = datetime.now()

                rows = await conn.fetch('''
                    SELECT event_id, event_type, resource_id, timestamp, metadata, session_id
                    FROM consumer_usage_events
                    WHERE consumer_id = $1 AND timestamp >= $2 AND timestamp <= $3
                    ORDER BY timestamp DESC
                ''', consumer_id, start_date, end_date)

                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Usage history retrieval failed: {e}")
            return []

    async def get_payment_history(self, consumer_id: str, start_date: datetime,
                                end_date: datetime = None) -> List[Dict[str, Any]]:
        """Get payment history for consumer"""
        try:
            async with self.pool.acquire() as conn:
                if end_date is None:
                    end_date = datetime.now()

                rows = await conn.fetch('''
                    SELECT payment_id, producer_id, payment_method, amount_satoshis,
                           payment_status, resource_accessed, created_at, confirmed_at
                    FROM consumer_payments
                    WHERE consumer_id = $1 AND created_at >= $2 AND created_at <= $3
                    ORDER BY created_at DESC
                ''', consumer_id, start_date, end_date)

                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Payment history retrieval failed: {e}")
            return []

    async def get_consumption_history(self, consumer_id: str, start_date: datetime,
                                    end_date: datetime = None,
                                    event_types: List[str] = None) -> List[Dict[str, Any]]:
        """Get consumption history with optional filtering"""
        try:
            async with self.pool.acquire() as conn:
                if end_date is None:
                    end_date = datetime.now()

                query = '''
                    SELECT event_id, event_type, resource_id, timestamp, metadata
                    FROM consumer_usage_events
                    WHERE consumer_id = $1 AND timestamp >= $2 AND timestamp <= $3
                '''
                params = [consumer_id, start_date, end_date]

                if event_types:
                    query += ' AND event_type = ANY($4)'
                    params.append(event_types)

                query += ' ORDER BY timestamp DESC'

                rows = await conn.fetch(query, *params)
                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Consumption history retrieval failed: {e}")
            return []

    async def batch_insert_events(self, events: List[Dict[str, Any]]):
        """Batch insert usage events for performance"""
        try:
            async with self.pool.acquire() as conn:
                await conn.executemany('''
                    INSERT INTO consumer_usage_events
                    (event_id, consumer_id, event_type, resource_id, timestamp, metadata, session_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (event_id) DO NOTHING
                ''', [
                    (event['event_id'], event['consumer_id'], event['event_type'],
                     event['resource_id'], event['timestamp'],
                     json.dumps(event['metadata']), event.get('session_id'))
                    for event in events
                ])

        except Exception as e:
            logger.error(f"Batch event insertion failed: {e}")

    async def cleanup_old_events(self, cutoff_date: datetime) -> int:
        """Clean up old usage events"""
        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute('''
                    DELETE FROM consumer_usage_events
                    WHERE timestamp < $1
                ''', cutoff_date)

                # Parse the result to get deleted count
                deleted_count = int(result.split()[-1]) if result else 0
                return deleted_count

        except Exception as e:
            logger.error(f"Event cleanup failed: {e}")
            return 0

    async def health_check(self) -> bool:
        """Check database connectivity"""
        try:
            if not self.pool:
                return False

            async with self.pool.acquire() as conn:
                result = await conn.fetchval("SELECT 1")
                return result == 1

        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    async def get_consumer_stats(self, consumer_id: str) -> Dict[str, Any]:
        """Get consumer statistics"""
        try:
            async with self.pool.acquire() as conn:
                # Get basic stats
                stats = {}

                # Active subscriptions
                stats['active_subscriptions'] = await conn.fetchval('''
                    SELECT COUNT(*) FROM consumer_subscriptions
                    WHERE consumer_id = $1 AND status = 'active'
                ''', consumer_id)

                # Total payments
                payment_stats = await conn.fetchrow('''
                    SELECT COUNT(*) as payment_count, COALESCE(SUM(amount_satoshis), 0) as total_spent
                    FROM consumer_payments
                    WHERE consumer_id = $1 AND payment_status = 'confirmed'
                ''', consumer_id)

                stats['total_payments'] = payment_stats['payment_count']
                stats['total_spent_satoshis'] = int(payment_stats['total_spent'])

                # Content accesses
                stats['total_content_accesses'] = await conn.fetchval('''
                    SELECT COUNT(*) FROM consumer_content_access
                    WHERE consumer_id = $1
                ''', consumer_id)

                # Recent activity (last 30 days)
                thirty_days_ago = datetime.now() - timedelta(days=30)
                stats['recent_events'] = await conn.fetchval('''
                    SELECT COUNT(*) FROM consumer_usage_events
                    WHERE consumer_id = $1 AND timestamp >= $2
                ''', consumer_id, thirty_days_ago)

                return stats

        except Exception as e:
            logger.error(f"Consumer stats retrieval failed: {e}")
            return {}

    def __del__(self):
        """Cleanup on object destruction"""
        if hasattr(self, 'pool') and self.pool:
            # Note: In a real application, you should properly close the pool
            # This is just for cleanup in case close() wasn't called
            pass