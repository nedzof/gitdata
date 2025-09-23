/**
 * Real-time Overlay Packet Streaming Service
 *
 * Handles real-time data packet streaming with BSV confirmation tracking,
 * webhook delivery, and WebSocket broadcasting.
 */

import * as crypto from 'crypto';

import { getHybridDatabase } from '../db/hybrid';

export interface RealtimePacket {
  id: string;
  version_id: string;
  packet_sequence: number;
  packet_timestamp: Date;
  txid: string;
  overlay_data: Buffer;
  data_hash: string;
  confirmation_status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  block_height?: number;
  confirmed_at?: Date;
  data_payload: any;
  data_size_bytes: number;
  producer_public_key: string;
  created_at: Date;
}

export interface StreamWebhook {
  id: string;
  version_id: string;
  webhook_url: string;
  webhook_secret?: string;
  subscriber_id: string;
  delivery_mode: 'confirmed' | 'immediate' | 'both';
  min_confirmations: number;
  batch_size: number;
  status: 'active' | 'paused' | 'failed';
  last_delivery?: Date;
  total_deliveries: number;
  failed_deliveries: number;
}

export interface StreamWebsocket {
  id: string;
  connection_id: string;
  version_id: string;
  subscriber_id?: string;
  delivery_mode: 'confirmed' | 'immediate' | 'both';
  last_packet_sent: number;
  connected_at: Date;
  last_ping: Date;
  packets_sent: number;
  status: 'active' | 'disconnected';
}

export class RealtimeStreamingService {
  private db = getHybridDatabase();

  /**
   * Ingest a new data packet from a producer
   */
  async ingestPacket(data: {
    version_id: string;
    packet_sequence: number;
    txid: string;
    overlay_data: Buffer;
    data_payload: any;
    producer_public_key: string;
  }): Promise<RealtimePacket> {
    const data_hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data.data_payload))
      .digest('hex');

    const data_size_bytes = Buffer.byteLength(JSON.stringify(data.data_payload), 'utf8');

    const result = await this.db.query(
      `
      INSERT INTO realtime_packets (
        version_id, packet_sequence, txid, overlay_data, data_hash,
        data_payload, data_size_bytes, producer_public_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [
        data.version_id,
        data.packet_sequence,
        data.txid,
        data.overlay_data,
        data_hash,
        JSON.stringify(data.data_payload),
        data_size_bytes,
        data.producer_public_key,
      ],
    );

    const packet = result.rows[0] as RealtimePacket;

    // Trigger immediate delivery for 'immediate' or 'both' mode subscribers
    await this.deliverPacket(packet, 'immediate');

    return packet;
  }

  /**
   * Update packet confirmation status
   */
  async updatePacketConfirmation(
    txid: string,
    confirmations: number,
    block_height?: number,
  ): Promise<void> {
    const confirmation_status = confirmations > 0 ? 'confirmed' : 'pending';
    const confirmed_at = confirmations > 0 ? new Date() : null;

    await this.db.query(
      `
      UPDATE realtime_packets
      SET confirmation_status = $1, confirmations = $2, block_height = $3, confirmed_at = $4
      WHERE txid = $5
    `,
      [confirmation_status, confirmations, block_height, confirmed_at, txid],
    );

    if (confirmations > 0) {
      // Get the updated packet
      const result = await this.db.query('SELECT * FROM realtime_packets WHERE txid = $1', [
        txid,
      ]);

      if (result.rows.length > 0) {
        const packet = result.rows[0] as RealtimePacket;
        // Trigger confirmed delivery
        await this.deliverPacket(packet, 'confirmed');
      }
    }
  }

  /**
   * Deliver packet to subscribers based on delivery mode
   */
  private async deliverPacket(
    packet: RealtimePacket,
    trigger: 'immediate' | 'confirmed',
  ): Promise<void> {
    // Get webhooks that should receive this packet
    const webhooks = await this.getWebhooksForDelivery(
      packet.version_id,
      trigger,
      packet.confirmations,
    );

    // Get WebSocket connections that should receive this packet
    const websockets = await this.getWebsocketsForDelivery(packet.version_id, trigger);

    // Deliver to webhooks
    for (const webhook of webhooks) {
      await this.deliverToWebhook(packet, webhook);
    }

    // Deliver to WebSocket connections
    for (const websocket of websockets) {
      await this.deliverToWebsocket(packet, websocket);
    }

    // Deliver to agent subscriptions
    await this.deliverToAgents(packet, trigger);
  }

  /**
   * Get webhooks that should receive this delivery
   */
  private async getWebhooksForDelivery(
    version_id: string,
    trigger: 'immediate' | 'confirmed',
    confirmations: number = 0,
  ): Promise<StreamWebhook[]> {
    let whereClause = 'version_id = $1 AND status = $2';
    const params: any[] = [version_id, 'active'];

    if (trigger === 'immediate') {
      whereClause += ' AND delivery_mode IN ($3, $4)';
      params.push('immediate', 'both');
    } else if (trigger === 'confirmed') {
      whereClause += ' AND delivery_mode IN ($3, $4) AND min_confirmations <= $5';
      params.push('confirmed', 'both', confirmations);
    }

    const result = await this.db.query(
      `
      SELECT * FROM stream_webhooks
      WHERE ${whereClause}
    `,
      params,
    );

    return result.rows as StreamWebhook[];
  }

  /**
   * Get WebSocket connections that should receive this delivery
   */
  private async getWebsocketsForDelivery(
    version_id: string,
    trigger: 'immediate' | 'confirmed',
  ): Promise<StreamWebsocket[]> {
    let whereClause = 'version_id = $1 AND status = $2';
    const params: any[] = [version_id, 'active'];

    if (trigger === 'immediate') {
      whereClause += ' AND delivery_mode IN ($3, $4)';
      params.push('immediate', 'both');
    } else if (trigger === 'confirmed') {
      whereClause += ' AND delivery_mode IN ($3, $4)';
      params.push('confirmed', 'both');
    }

    const result = await this.db.query(
      `
      SELECT * FROM stream_websockets
      WHERE ${whereClause}
    `,
      params,
    );

    return result.rows as StreamWebsocket[];
  }

  /**
   * Deliver packet to webhook using existing streaming delivery
   */
  private async deliverToWebhook(packet: RealtimePacket, webhook: StreamWebhook): Promise<void> {
    try {
      const { deliverContentToWebhook } = await import('./streaming-delivery');

      const subscription = {
        receiptId: `realtime-webhook-${packet.id}`,
        webhookUrl: webhook.webhook_url,
        agentId: webhook.subscriber_id,
        contentHash: packet.data_hash,
        deliveryConfig: {
          chunkSize: 1024,
          compressionEnabled: false,
          maxRetries: 3,
          retryDelayMs: 1000,
        },
      };

      const webhookPayload = JSON.stringify({
        type: 'realtime_packet',
        webhook_id: webhook.id,
        packet: {
          id: packet.id,
          version_id: packet.version_id,
          sequence: packet.packet_sequence,
          timestamp: packet.packet_timestamp.toISOString(),
          txid: packet.txid,
          confirmations: packet.confirmations,
          block_height: packet.block_height,
          data: packet.data_payload,
          size_bytes: packet.data_size_bytes,
          status: packet.confirmation_status,
        },
        delivery_timestamp: new Date().toISOString(),
      });

      await deliverContentToWebhook(subscription, webhookPayload);
    } catch (error) {
      console.error(`Failed to deliver packet ${packet.id} to webhook ${webhook.id}:`, error);
    }
  }

  /**
   * Deliver packet to WebSocket connection (placeholder for overlay-based WSS)
   */
  private async deliverToWebsocket(
    packet: RealtimePacket,
    websocket: StreamWebsocket,
  ): Promise<void> {
    try {
      // TODO: Implement overlay-based WebSocket delivery using SLAP protocol
      console.log(
        `📡 [PLACEHOLDER] Would deliver packet ${packet.id} to WSS connection ${websocket.connection_id}`,
      );
      console.log(`   Stream: ${packet.version_id}, Confirmations: ${packet.confirmations}`);

      // For now, just log the delivery - WebSocket functionality should be implemented
      // using the overlay library's SLAP infrastructure when available
    } catch (error) {
      console.error(`Failed to deliver packet ${packet.id} to WebSocket:`, error);
    }
  }

  /**
   * Deliver packet to agent subscriptions
   */
  private async deliverToAgents(
    packet: RealtimePacket,
    trigger: 'immediate' | 'confirmed',
  ): Promise<void> {
    const agentSubs = await this.db.query(
      `
      SELECT * FROM stream_agent_subscriptions
      WHERE version_id = $1 AND status = $2
    `,
      [packet.version_id, 'active'],
    );

    for (const sub of agentSubs.rows) {
      // Check if this packet should trigger agent processing
      if (this.shouldTriggerAgent(sub, packet, trigger)) {
        await this.notifyAgent(packet, sub);
      }
    }
  }

  /**
   * Check if packet should trigger agent processing
   */
  private shouldTriggerAgent(subscription: any, packet: RealtimePacket, trigger: string): boolean {
    // Simple logic - can be enhanced with trigger_conditions
    if (subscription.processing_mode === 'realtime') {
      return true;
    }

    // Check trigger conditions if they exist
    if (subscription.trigger_conditions) {
      // Implement custom trigger logic here
      return true;
    }

    return false;
  }

  /**
   * Notify agent of new packet using existing streaming delivery
   */
  private async notifyAgent(packet: RealtimePacket, subscription: any): Promise<void> {
    if (subscription.agent_webhook_url) {
      try {
        const { deliverContentToWebhook } = await import('./streaming-delivery');

        // Create streaming subscription for agent notification
        const agentSubscription = {
          receiptId: `realtime-agent-${packet.id}`,
          webhookUrl: subscription.agent_webhook_url,
          agentId: subscription.agent_id,
          contentHash: packet.data_hash,
          deliveryConfig: {
            chunkSize: 1024 * 1024,
            compressionEnabled: true,
            maxRetries: 3,
            retryDelayMs: 1000,
          },
        };

        // Create agent notification payload
        const agentPayload = JSON.stringify({
          type: 'realtime_packet_notification',
          agent_id: subscription.agent_id,
          stream_id: packet.version_id,
          packet: {
            id: packet.id,
            sequence: packet.packet_sequence,
            timestamp: packet.packet_timestamp.toISOString(),
            txid: packet.txid,
            confirmations: packet.confirmations,
            block_height: packet.block_height,
            data: packet.data_payload,
            size_bytes: packet.data_size_bytes,
            status: packet.confirmation_status,
          },
          notification_timestamp: new Date().toISOString(),
          processing_mode: subscription.processing_mode,
        });

        console.log(`🤖 Notifying agent ${subscription.agent_id} of packet ${packet.id}`);

        // Use existing streaming delivery with quota tracking
        await deliverContentToWebhook(agentSubscription, agentPayload);
      } catch (error) {
        console.error(
          `Failed to notify agent ${subscription.agent_id} of packet ${packet.id}:`,
          error,
        );
      }
    }

    // Update last processed packet
    await this.db.query(
      `
      UPDATE stream_agent_subscriptions
      SET last_processed_packet = $1
      WHERE id = $2
    `,
      [packet.packet_sequence, subscription.id],
    );
  }

  /**
   * Subscribe webhook to stream
   */
  async subscribeWebhook(data: {
    version_id: string;
    webhook_url: string;
    webhook_secret?: string;
    subscriber_id: string;
    delivery_mode?: 'confirmed' | 'immediate' | 'both';
    min_confirmations?: number;
    batch_size?: number;
  }): Promise<StreamWebhook> {
    const result = await this.db.query(
      `
      INSERT INTO stream_webhooks (
        version_id, webhook_url, webhook_secret, subscriber_id,
        delivery_mode, min_confirmations, batch_size
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [
        data.version_id,
        data.webhook_url,
        data.webhook_secret,
        data.subscriber_id,
        data.delivery_mode || 'confirmed',
        data.min_confirmations || 1,
        data.batch_size || 1,
      ],
    );

    return result.rows[0] as StreamWebhook;
  }

  /**
   * Register WebSocket connection
   */
  async registerWebsocket(data: {
    connection_id: string;
    version_id: string;
    subscriber_id?: string;
    delivery_mode?: 'confirmed' | 'immediate' | 'both';
  }): Promise<StreamWebsocket> {
    const result = await this.db.query(
      `
      INSERT INTO stream_websockets (
        connection_id, version_id, subscriber_id, delivery_mode
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
      [data.connection_id, data.version_id, data.subscriber_id, data.delivery_mode || 'confirmed'],
    );

    return result.rows[0] as StreamWebsocket;
  }

  /**
   * Subscribe agent to stream
   */
  async subscribeAgent(data: {
    version_id: string;
    agent_id: string;
    processing_mode?: 'realtime' | 'batch';
    trigger_conditions?: any;
    agent_webhook_url?: string;
  }): Promise<any> {
    const result = await this.db.query(
      `
      INSERT INTO stream_agent_subscriptions (
        version_id, agent_id, processing_mode, trigger_conditions, agent_webhook_url
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (version_id, agent_id)
      DO UPDATE SET
        processing_mode = EXCLUDED.processing_mode,
        trigger_conditions = EXCLUDED.trigger_conditions,
        agent_webhook_url = EXCLUDED.agent_webhook_url,
        status = 'active'
      RETURNING *
    `,
      [
        data.version_id,
        data.agent_id,
        data.processing_mode || 'realtime',
        data.trigger_conditions ? JSON.stringify(data.trigger_conditions) : null,
        data.agent_webhook_url,
      ],
    );

    return result.rows[0];
  }

  /**
   * Get stream statistics
   */
  async getStreamStats(version_id: string): Promise<any> {
    const result = await this.db.query(
      `
      SELECT
        COUNT(*) as total_packets,
        COUNT(*) FILTER (WHERE confirmation_status = 'confirmed') as confirmed_packets,
        COUNT(*) FILTER (WHERE confirmation_status = 'pending') as pending_packets,
        MAX(packet_sequence) as latest_sequence,
        AVG(data_size_bytes) as avg_packet_size
      FROM realtime_packets
      WHERE version_id = $1
    `,
      [version_id],
    );

    return result.rows[0];
  }

  /**
   * Get recent packets for a stream
   */
  async getRecentPackets(version_id: string, limit: number = 10): Promise<RealtimePacket[]> {
    const result = await this.db.query(
      `
      SELECT * FROM realtime_packets
      WHERE version_id = $1
      ORDER BY packet_sequence DESC
      LIMIT $2
    `,
      [version_id, limit],
    );

    return result.rows as RealtimePacket[];
  }
}

export const realtimeStreamingService = new RealtimeStreamingService();
