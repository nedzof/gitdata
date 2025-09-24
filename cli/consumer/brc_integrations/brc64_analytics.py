"""
BRC-64 History Tracking & Analytics for Consumer
Handles usage tracking, consumption analytics, and compliance logging
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import hashlib

logger = logging.getLogger(__name__)

class BRC64HistoryTracker:
    """
    BRC-64 History Tracking & Analytics
    Tracks consumer usage, consumption patterns, and generates analytics
    """

    def __init__(self, database=None):
        self.database = database
        self.pending_events = []
        self.batch_size = 100
        self.flush_interval = 300  # 5 minutes

    async def log_event(self, consumer_id: str, event_type: str, resource_id: str,
                       metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Log a consumption event with metadata
        """
        try:
            event_id = f"event_{int(datetime.now().timestamp())}_{hash(resource_id) % 10000}"

            event_data = {
                'event_id': event_id,
                'consumer_id': consumer_id,
                'event_type': event_type,
                'resource_id': resource_id,
                'timestamp': datetime.now().isoformat(),
                'metadata': metadata or {},
                'session_id': self._generate_session_id(consumer_id)
            }

            # Add to pending events for batch processing
            self.pending_events.append(event_data)

            # Store in database if available
            if self.database:
                await self.database.log_consumption_event(
                    event_id=event_id,
                    consumer_id=consumer_id,
                    event_type=event_type,
                    resource_id=resource_id,
                    metadata=metadata or {}
                )

            # Flush if batch is full
            if len(self.pending_events) >= self.batch_size:
                await self._flush_events()

            logger.debug(f"Logged event: {event_type} for resource {resource_id}")
            return event_id

        except Exception as e:
            logger.error(f"Event logging failed: {e}")
            return ""

    async def track_content_access(self, consumer_id: str, uhrp_hash: str,
                                 access_type: str, payment_amount: int = 0,
                                 producer_id: str = None, metadata: Dict[str, Any] = None) -> str:
        """
        Track content access with detailed metadata
        """
        try:
            access_metadata = {
                'access_type': access_type,
                'payment_amount': payment_amount,
                'producer_id': producer_id,
                'content_hash': uhrp_hash,
                'access_timestamp': datetime.now().isoformat()
            }

            if metadata:
                access_metadata.update(metadata)

            event_id = await self.log_event(
                consumer_id=consumer_id,
                event_type='content_access',
                resource_id=uhrp_hash,
                metadata=access_metadata
            )

            logger.info(f"Tracked content access: {uhrp_hash}")
            return event_id

        except Exception as e:
            logger.error(f"Content access tracking failed: {e}")
            return ""

    async def track_stream_consumption(self, consumer_id: str, stream_id: str,
                                     duration_seconds: int, data_bytes: int,
                                     payment_amount: int, producer_id: str = None) -> str:
        """
        Track streaming content consumption
        """
        try:
            stream_metadata = {
                'duration_seconds': duration_seconds,
                'data_bytes_consumed': data_bytes,
                'payment_amount': payment_amount,
                'producer_id': producer_id,
                'consumption_rate': data_bytes / max(duration_seconds, 1),
                'cost_per_byte': payment_amount / max(data_bytes, 1) if data_bytes > 0 else 0
            }

            event_id = await self.log_event(
                consumer_id=consumer_id,
                event_type='stream_consumption',
                resource_id=stream_id,
                metadata=stream_metadata
            )

            logger.info(f"Tracked stream consumption: {stream_id} ({duration_seconds}s)")
            return event_id

        except Exception as e:
            logger.error(f"Stream consumption tracking failed: {e}")
            return ""

    async def track_payment_event(self, consumer_id: str, payment_id: str,
                                amount: int, currency: str, producer_id: str,
                                resource_id: str = None, payment_method: str = None) -> str:
        """
        Track payment events for cost analysis
        """
        try:
            payment_metadata = {
                'payment_id': payment_id,
                'amount': amount,
                'currency': currency,
                'producer_id': producer_id,
                'resource_id': resource_id,
                'payment_method': payment_method,
                'payment_timestamp': datetime.now().isoformat()
            }

            event_id = await self.log_event(
                consumer_id=consumer_id,
                event_type='payment',
                resource_id=payment_id,
                metadata=payment_metadata
            )

            logger.debug(f"Tracked payment: {payment_id} ({amount} {currency})")
            return event_id

        except Exception as e:
            logger.error(f"Payment tracking failed: {e}")
            return ""

    async def get_usage_history(self, consumer_id: str, start_date: datetime,
                              end_date: Optional[datetime] = None,
                              event_types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Get usage history for specified time period
        """
        try:
            if not end_date:
                end_date = datetime.now()

            # Get from database if available
            if self.database:
                history = await self.database.get_consumption_history(
                    consumer_id=consumer_id,
                    start_date=start_date,
                    end_date=end_date,
                    event_types=event_types
                )
            else:
                # Filter from pending events
                history = [
                    event for event in self.pending_events
                    if (event['consumer_id'] == consumer_id and
                        start_date.isoformat() <= event['timestamp'] <= end_date.isoformat() and
                        (not event_types or event['event_type'] in event_types))
                ]

            logger.info(f"Retrieved {len(history)} usage events for consumer {consumer_id[:16]}...")
            return history

        except Exception as e:
            logger.error(f"Usage history retrieval failed: {e}")
            return []

    async def generate_usage_analytics(self, consumer_id: str, days: int = 30) -> Dict[str, Any]:
        """
        Generate comprehensive usage analytics
        """
        try:
            start_date = datetime.now() - timedelta(days=days)
            history = await self.get_usage_history(consumer_id, start_date)

            if not history:
                return {
                    'consumer_id': consumer_id,
                    'period_days': days,
                    'total_events': 0,
                    'analytics': {}
                }

            # Calculate analytics
            analytics = {
                'total_events': len(history),
                'event_breakdown': {},
                'temporal_patterns': {},
                'cost_analysis': {},
                'content_analysis': {},
                'producer_analysis': {}
            }

            # Event type breakdown
            for event in history:
                event_type = event['event_type']
                analytics['event_breakdown'][event_type] = analytics['event_breakdown'].get(event_type, 0) + 1

            # Cost analysis
            total_cost = 0
            payment_events = [e for e in history if e['event_type'] == 'payment']
            for payment in payment_events:
                amount = payment.get('metadata', {}).get('amount', 0)
                total_cost += amount

            analytics['cost_analysis'] = {
                'total_spent': total_cost,
                'total_payments': len(payment_events),
                'average_payment': total_cost / max(len(payment_events), 1),
                'cost_per_day': total_cost / days
            }

            # Content analysis
            content_events = [e for e in history if e['event_type'] in ['content_access', 'stream_consumption']]
            unique_resources = set(e['resource_id'] for e in content_events)
            analytics['content_analysis'] = {
                'unique_resources_accessed': len(unique_resources),
                'total_content_accesses': len(content_events),
                'average_accesses_per_day': len(content_events) / days
            }

            # Producer analysis
            producer_usage = {}
            for event in history:
                producer_id = event.get('metadata', {}).get('producer_id')
                if producer_id:
                    if producer_id not in producer_usage:
                        producer_usage[producer_id] = {'events': 0, 'cost': 0}
                    producer_usage[producer_id]['events'] += 1
                    if event['event_type'] == 'payment':
                        producer_usage[producer_id]['cost'] += event.get('metadata', {}).get('amount', 0)

            analytics['producer_analysis'] = producer_usage

            # Temporal patterns (hourly distribution)
            hourly_distribution = {}
            for event in history:
                try:
                    timestamp = datetime.fromisoformat(event['timestamp'])
                    hour = timestamp.hour
                    hourly_distribution[hour] = hourly_distribution.get(hour, 0) + 1
                except:
                    pass

            analytics['temporal_patterns'] = {
                'hourly_distribution': hourly_distribution,
                'most_active_hour': max(hourly_distribution, key=hourly_distribution.get) if hourly_distribution else None
            }

            result = {
                'consumer_id': consumer_id,
                'period_days': days,
                'analytics_generated_at': datetime.now().isoformat(),
                'analytics': analytics
            }

            logger.info(f"Generated analytics for consumer {consumer_id[:16]}... ({days} days)")
            return result

        except Exception as e:
            logger.error(f"Analytics generation failed: {e}")
            return {'error': str(e)}

    async def get_content_lineage(self, consumer_id: str, resource_id: str,
                                include_provenance: bool = True) -> Dict[str, Any]:
        """
        Get content lineage and provenance information
        """
        try:
            # Get all events related to this resource
            all_history = await self.get_usage_history(
                consumer_id=consumer_id,
                start_date=datetime.now() - timedelta(days=365)  # Last year
            )

            resource_events = [
                event for event in all_history
                if event['resource_id'] == resource_id
            ]

            if not resource_events:
                return {
                    'resource_id': resource_id,
                    'consumer_id': consumer_id,
                    'lineage': [],
                    'provenance': {}
                }

            # Sort events chronologically
            resource_events.sort(key=lambda x: x['timestamp'])

            lineage = []
            for event in resource_events:
                lineage_entry = {
                    'event_id': event['event_id'],
                    'timestamp': event['timestamp'],
                    'event_type': event['event_type'],
                    'metadata': event.get('metadata', {})
                }
                lineage.append(lineage_entry)

            # Generate provenance information
            provenance = {}
            if include_provenance:
                first_access = resource_events[0] if resource_events else None
                last_access = resource_events[-1] if resource_events else None

                provenance = {
                    'first_access': first_access['timestamp'] if first_access else None,
                    'last_access': last_access['timestamp'] if last_access else None,
                    'total_accesses': len(resource_events),
                    'producer_id': first_access.get('metadata', {}).get('producer_id') if first_access else None,
                    'access_methods': list(set(event.get('metadata', {}).get('access_type', 'unknown')
                                             for event in resource_events)),
                    'total_cost': sum(event.get('metadata', {}).get('payment_amount', 0)
                                    for event in resource_events if event['event_type'] == 'payment')
                }

            result = {
                'resource_id': resource_id,
                'consumer_id': consumer_id,
                'lineage': lineage,
                'provenance': provenance,
                'lineage_generated_at': datetime.now().isoformat()
            }

            logger.info(f"Generated lineage for resource {resource_id} ({len(lineage)} events)")
            return result

        except Exception as e:
            logger.error(f"Content lineage generation failed: {e}")
            return {'error': str(e)}

    async def export_compliance_report(self, consumer_id: str, start_date: datetime,
                                     end_date: datetime, format: str = 'json') -> Dict[str, Any]:
        """
        Export compliance report for regulatory requirements
        """
        try:
            history = await self.get_usage_history(consumer_id, start_date, end_date)
            analytics = await self.generate_usage_analytics(consumer_id, (end_date - start_date).days)

            compliance_report = {
                'report_id': f"compliance_{consumer_id}_{int(datetime.now().timestamp())}",
                'consumer_id': consumer_id,
                'reporting_period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'generated_at': datetime.now().isoformat(),
                'total_events': len(history),
                'event_summary': analytics.get('analytics', {}).get('event_breakdown', {}),
                'financial_summary': analytics.get('analytics', {}).get('cost_analysis', {}),
                'data_access_summary': {
                    'unique_resources': len(set(e['resource_id'] for e in history)),
                    'content_accesses': len([e for e in history if e['event_type'] == 'content_access']),
                    'stream_consumptions': len([e for e in history if e['event_type'] == 'stream_consumption'])
                },
                'detailed_events': history if format == 'detailed' else []
            }

            logger.info(f"Generated compliance report for consumer {consumer_id[:16]}...")
            return compliance_report

        except Exception as e:
            logger.error(f"Compliance report generation failed: {e}")
            return {'error': str(e)}

    async def _flush_events(self):
        """
        Flush pending events to persistent storage
        """
        try:
            if not self.pending_events:
                return

            if self.database:
                # Batch insert events
                await self.database.batch_insert_events(self.pending_events)

            logger.debug(f"Flushed {len(self.pending_events)} events to storage")
            self.pending_events.clear()

        except Exception as e:
            logger.error(f"Event flush failed: {e}")

    def _generate_session_id(self, consumer_id: str) -> str:
        """
        Generate session ID for grouping related events
        """
        try:
            # Simple session ID based on hour and consumer
            current_hour = datetime.now().strftime('%Y%m%d%H')
            session_data = f"{consumer_id}_{current_hour}"
            return hashlib.md5(session_data.encode()).hexdigest()[:16]
        except:
            return f"session_{int(datetime.now().timestamp())}"

    async def cleanup_old_events(self, retention_days: int = 365):
        """
        Clean up old tracking events based on retention policy
        """
        try:
            cutoff_date = datetime.now() - timedelta(days=retention_days)

            if self.database:
                deleted_count = await self.database.cleanup_old_events(cutoff_date)
                logger.info(f"Cleaned up {deleted_count} old tracking events")
            else:
                # Clean from pending events
                original_count = len(self.pending_events)
                self.pending_events = [
                    event for event in self.pending_events
                    if datetime.fromisoformat(event['timestamp']) > cutoff_date
                ]
                deleted_count = original_count - len(self.pending_events)
                logger.info(f"Cleaned up {deleted_count} pending events")

        except Exception as e:
            logger.error(f"Event cleanup failed: {e}")

    async def close(self):
        """
        Close the analytics tracker and flush pending events
        """
        try:
            if self.pending_events:
                await self._flush_events()
            logger.info("BRC-64 analytics tracker closed")
        except Exception as e:
            logger.error(f"Analytics tracker close failed: {e}")