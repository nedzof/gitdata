import type { Router } from 'express';
/**
 * GET /v1/data?contentHash=&receiptId=[&redirect=true]
 * D22 modernized data delivery with storage backend integration.
 *
 * Modes:
 * - presigned (default): Returns presigned URL for direct CDN/S3 access
 * - stream: Streams content through the overlay (fallback mode)
 * - direct: Returns CDN URL directly (if available)
 *
 * With redirect=true: automatically redirects to presigned URL
 * Without redirect: returns JSON with presigned URL for client handling
 */
export declare function dataRouter(): Router;
