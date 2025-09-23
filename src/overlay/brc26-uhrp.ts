// BRC-26: Universal Hash Resolution Protocol
// Implements content availability advertisement for file storage on overlay networks

import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';

import { walletService } from '../lib/wallet';

export interface UHRPAdvertisement {
  publicKey: string;
  address: string;
  contentHash: string;
  url: string;
  expiryTime: number;
  contentLength: number;
  signature: string;
  utxoId?: string; // txid:vout when submitted
  advertisedAt?: number;
  isActive?: boolean;
}

export interface UHRPContent {
  hash: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: number;
  expiresAt: number;
  downloadCount: number;
  localPath: string;
  isPublic: boolean;
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
    author?: string;
  };
}

export interface UHRPQuery {
  hash?: string;
  filename?: string;
  contentType?: string;
  tags?: string[];
  author?: string;
  includeExpired?: boolean;
  limit?: number;
}

export interface UHRPHost {
  publicKey: string;
  address: string;
  baseUrl: string;
  reputation: number;
  uptime: number;
  lastSeen: number;
  contentCount: number;
  isActive: boolean;
}

export interface DatabaseAdapter {
  query(sql: string, params?: any[]): Promise<any[]>;
  queryOne(sql: string, params?: any[]): Promise<any>;
  execute(sql: string, params?: any[]): Promise<void>;
}

class BRC26UHRPService extends EventEmitter {
  private database: DatabaseAdapter;
  private storageBasePath: string;
  private myPublicKey: string | null = null;
  private myAddress: string | null = null;
  private baseUrl: string;
  private advertisements = new Map<string, UHRPAdvertisement>();
  private hostedContent = new Map<string, UHRPContent>();

  constructor(database: DatabaseAdapter, storageBasePath: string, baseUrl: string) {
    super();
    this.database = database;
    this.storageBasePath = storageBasePath;
    this.baseUrl = baseUrl;

    this.initializeDatabase();
    this.initializeIdentity();
    this.loadExistingContent();
  }

  /**
   * Initialize database tables for UHRP
   */
  private async initializeDatabase(): Promise<void> {
    // UHRP advertisements table
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS uhrp_advertisements (
        id SERIAL PRIMARY KEY,
        public_key TEXT NOT NULL,
        address TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        url TEXT NOT NULL,
        expiry_time BIGINT NOT NULL,
        content_length BIGINT NOT NULL,
        signature TEXT NOT NULL,
        utxo_id TEXT UNIQUE,
        advertised_at BIGINT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(public_key, content_hash)
      )
    `);

    // UHRP content storage table
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS uhrp_content (
        id SERIAL PRIMARY KEY,
        content_hash TEXT UNIQUE NOT NULL,
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        uploaded_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL,
        download_count INTEGER DEFAULT 0,
        local_path TEXT NOT NULL,
        is_public BOOLEAN DEFAULT TRUE,
        metadata_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // UHRP hosts table (for tracking other hosts)
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS uhrp_hosts (
        id SERIAL PRIMARY KEY,
        public_key TEXT UNIQUE NOT NULL,
        address TEXT NOT NULL,
        base_url TEXT NOT NULL,
        reputation DECIMAL(3,2) DEFAULT 1.0,
        uptime DECIMAL(5,4) DEFAULT 1.0,
        last_seen BIGINT NOT NULL,
        content_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // UHRP download history
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS uhrp_downloads (
        id SERIAL PRIMARY KEY,
        content_hash TEXT NOT NULL,
        host_public_key TEXT,
        download_url TEXT,
        downloaded_at BIGINT NOT NULL,
        success BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        download_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes for performance
    await this.database.execute(`
      CREATE INDEX IF NOT EXISTS idx_uhrp_ads_content_hash ON uhrp_advertisements(content_hash);
      CREATE INDEX IF NOT EXISTS idx_uhrp_ads_active ON uhrp_advertisements(is_active);
      CREATE INDEX IF NOT EXISTS idx_uhrp_ads_expiry ON uhrp_advertisements(expiry_time);

      CREATE INDEX IF NOT EXISTS idx_uhrp_content_hash ON uhrp_content(content_hash);
      CREATE INDEX IF NOT EXISTS idx_uhrp_content_type ON uhrp_content(content_type);
      CREATE INDEX IF NOT EXISTS idx_uhrp_content_expires ON uhrp_content(expires_at);

      CREATE INDEX IF NOT EXISTS idx_uhrp_hosts_active ON uhrp_hosts(is_active);
      CREATE INDEX IF NOT EXISTS idx_uhrp_hosts_reputation ON uhrp_hosts(reputation DESC);

      CREATE INDEX IF NOT EXISTS idx_uhrp_downloads_hash ON uhrp_downloads(content_hash);
      CREATE INDEX IF NOT EXISTS idx_uhrp_downloads_time ON uhrp_downloads(downloaded_at);
    `);
  }

  /**
   * Initialize identity from wallet
   */
  private async initializeIdentity(): Promise<void> {
    try {
      if (walletService.isConnected()) {
        this.myPublicKey = walletService.getPublicKey();
        // In production, derive address from public key
        this.myAddress = this.deriveAddressFromPublicKey(this.myPublicKey || '');
        console.log(`[UHRP] Initialized with identity: ${this.myPublicKey?.substring(0, 16)}...`);
      }
    } catch (error) {
      console.warn('[UHRP] Failed to initialize identity:', error);
    }
  }

  /**
   * Load existing content from database
   */
  private async loadExistingContent(): Promise<void> {
    try {
      const content = await this.database.query(
        `
        SELECT * FROM uhrp_content WHERE expires_at > $1
      `,
        [Date.now()],
      );

      for (const item of content) {
        this.hostedContent.set(item.content_hash, {
          hash: item.content_hash,
          filename: item.filename,
          contentType: item.content_type,
          size: parseInt(item.size_bytes),
          uploadedAt: parseInt(item.uploaded_at),
          expiresAt: parseInt(item.expires_at),
          downloadCount: item.download_count,
          localPath: item.local_path,
          isPublic: item.is_public,
          metadata: item.metadata_json ? JSON.parse(item.metadata_json) : undefined,
        });
      }

      console.log(`[UHRP] Loaded ${content.length} existing content items`);
    } catch (error) {
      console.error('[UHRP] Failed to load existing content:', error);
    }
  }

  /**
   * Store a file and create UHRP advertisement
   */
  async storeFile(
    fileBuffer: Buffer,
    filename: string,
    contentType: string,
    options: {
      expiryHours?: number;
      isPublic?: boolean;
      metadata?: {
        title?: string;
        description?: string;
        tags?: string[];
        author?: string;
      };
    } = {},
  ): Promise<UHRPContent> {
    try {
      // Calculate content hash
      const contentHash = this.calculateContentHash(fileBuffer);

      // Check if content already exists
      if (this.hostedContent.has(contentHash)) {
        const existing = this.hostedContent.get(contentHash)!;
        console.log(`[UHRP] Content already exists: ${contentHash}`);
        return existing;
      }

      // Create local storage path
      const fileExt = path.extname(filename);
      const storagePath = path.join(this.storageBasePath, `${contentHash}${fileExt}`);

      // Ensure storage directory exists
      await fs.mkdir(path.dirname(storagePath), { recursive: true });

      // Write file to storage
      await fs.writeFile(storagePath, fileBuffer);

      // Create content record
      const expiryHours = options.expiryHours || 24 * 30; // Default 30 days
      const content: UHRPContent = {
        hash: contentHash,
        filename,
        contentType,
        size: fileBuffer.length,
        uploadedAt: Date.now(),
        expiresAt: Date.now() + expiryHours * 60 * 60 * 1000,
        downloadCount: 0,
        localPath: storagePath,
        isPublic: options.isPublic !== false,
        metadata: options.metadata,
      };

      // Store in database
      await this.database.execute(
        `
        INSERT INTO uhrp_content
        (content_hash, filename, content_type, size_bytes, uploaded_at, expires_at,
         download_count, local_path, is_public, metadata_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
        [
          content.hash,
          content.filename,
          content.contentType,
          content.size,
          content.uploadedAt,
          content.expiresAt,
          content.downloadCount,
          content.localPath,
          content.isPublic,
          content.metadata ? JSON.stringify(content.metadata) : null,
        ],
      );

      // Store in memory
      this.hostedContent.set(contentHash, content);

      // Create and submit UHRP advertisement if public
      if (content.isPublic && this.myPublicKey && this.myAddress) {
        await this.createAdvertisement(content);
      }

      this.emit('file-stored', content);
      console.log(`[UHRP] Stored file: ${filename} (${contentHash})`);

      return content;
    } catch (error) {
      console.error('[UHRP] Failed to store file:', error);
      throw new Error(`Failed to store file: ${(error as Error).message}`);
    }
  }

  /**
   * Create UHRP advertisement for content
   */
  async createAdvertisement(content: UHRPContent): Promise<UHRPAdvertisement> {
    if (!this.myPublicKey || !this.myAddress) {
      throw new Error('Identity not initialized - wallet must be connected');
    }

    try {
      const url = `${this.baseUrl}/uhrp/content/${content.hash}`;

      const advertisement: UHRPAdvertisement = {
        publicKey: this.myPublicKey,
        address: this.myAddress,
        contentHash: content.hash,
        url,
        expiryTime: content.expiresAt,
        contentLength: content.size,
        signature: '',
        advertisedAt: Date.now(),
        isActive: true,
      };

      // Create signature over advertisement fields
      const message = this.createAdvertisementMessage(advertisement);
      advertisement.signature = await walletService.signData(message, 'uhrp-advertisement');

      // Create and submit UTXO transaction
      const utxoId = await this.submitAdvertisementTransaction(advertisement);
      advertisement.utxoId = utxoId;

      // Store advertisement
      await this.storeAdvertisement(advertisement);
      this.advertisements.set(content.hash, advertisement);

      this.emit('advertisement-created', advertisement);
      console.log(`[UHRP] Created advertisement for ${content.hash}`);

      return advertisement;
    } catch (error) {
      throw new Error(`Failed to create advertisement: ${(error as Error).message}`);
    }
  }

  /**
   * Query content by hash or other criteria
   */
  async queryContent(query: UHRPQuery): Promise<UHRPContent[]> {
    try {
      let sql = `
        SELECT * FROM uhrp_content
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (query.hash) {
        sql += ` AND content_hash = $${paramIndex++}`;
        params.push(query.hash);
      }

      if (query.filename) {
        sql += ` AND filename ILIKE $${paramIndex++}`;
        params.push(`%${query.filename}%`);
      }

      if (query.contentType) {
        sql += ` AND content_type = $${paramIndex++}`;
        params.push(query.contentType);
      }

      if (query.author) {
        sql += ` AND metadata_json::jsonb ->> 'author' ILIKE $${paramIndex++}`;
        params.push(`%${query.author}%`);
      }

      if (query.tags && query.tags.length > 0) {
        sql += ` AND metadata_json::jsonb -> 'tags' ?| $${paramIndex++}`;
        params.push(query.tags);
      }

      if (!query.includeExpired) {
        sql += ` AND expires_at > $${paramIndex++}`;
        params.push(Date.now());
      }

      sql += ` ORDER BY uploaded_at DESC`;

      if (query.limit) {
        sql += ` LIMIT $${paramIndex++}`;
        params.push(query.limit);
      }

      const results = await this.database.query(sql, params);

      return results.map((row) => ({
        hash: row.content_hash,
        filename: row.filename,
        contentType: row.content_type,
        size: parseInt(row.size_bytes),
        uploadedAt: parseInt(row.uploaded_at),
        expiresAt: parseInt(row.expires_at),
        downloadCount: row.download_count,
        localPath: row.local_path,
        isPublic: row.is_public,
        metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      }));
    } catch (error) {
      console.error('[UHRP] Failed to query content:', error);
      return [];
    }
  }

  /**
   * Resolve content by hash from overlay network
   */
  async resolveContent(contentHash: string): Promise<{
    content?: UHRPContent;
    advertisements: UHRPAdvertisement[];
    availableHosts: UHRPHost[];
  }> {
    try {
      // Check if we have the content locally
      const localContent = this.hostedContent.get(contentHash);

      // Query advertisements from database (including from other hosts)
      const advertisements = await this.database.query(
        `
        SELECT * FROM uhrp_advertisements
        WHERE content_hash = $1 AND is_active = TRUE AND expiry_time > $2
        ORDER BY advertised_at DESC
      `,
        [contentHash, Date.now()],
      );

      const uhrlAdverts: UHRPAdvertisement[] = advertisements.map((row) => ({
        publicKey: row.public_key,
        address: row.address,
        contentHash: row.content_hash,
        url: row.url,
        expiryTime: parseInt(row.expiry_time),
        contentLength: parseInt(row.content_length),
        signature: row.signature,
        utxoId: row.utxo_id,
        advertisedAt: parseInt(row.advertised_at),
        isActive: row.is_active,
      }));

      // Get available hosts
      const hostPublicKeys = Array.from(new Set(uhrlAdverts.map((ad) => ad.publicKey)));
      const hosts = await this.getHostsByPublicKeys(hostPublicKeys);

      return {
        content: localContent,
        advertisements: uhrlAdverts,
        availableHosts: hosts,
      };
    } catch (error) {
      console.error('[UHRP] Failed to resolve content:', error);
      return { advertisements: [], availableHosts: [] };
    }
  }

  /**
   * Download content from remote host
   */
  async downloadContent(
    contentHash: string,
    hostUrl?: string,
  ): Promise<{
    success: boolean;
    content?: UHRPContent;
    buffer?: Buffer;
    error?: string;
  }> {
    try {
      const resolution = await this.resolveContent(contentHash);

      // If we have it locally, return it
      if (resolution.content) {
        const buffer = await fs.readFile(resolution.content.localPath);
        return { success: true, content: resolution.content, buffer };
      }

      // Try to download from available hosts
      const advertisements = resolution.advertisements;
      if (advertisements.length === 0) {
        return { success: false, error: 'No advertisements found for this content' };
      }

      // Sort by host reputation
      const sortedAds = advertisements.sort((a, b) => {
        const hostA = resolution.availableHosts.find((h) => h.publicKey === a.publicKey);
        const hostB = resolution.availableHosts.find((h) => h.publicKey === b.publicKey);
        return (hostB?.reputation || 0) - (hostA?.reputation || 0);
      });

      // Try downloading from each host
      for (const ad of sortedAds) {
        if (hostUrl && ad.url !== hostUrl) continue;

        try {
          const startTime = Date.now();
          const response = await fetch(ad.url);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          const downloadTime = Date.now() - startTime;

          // Verify content hash
          const actualHash = this.calculateContentHash(buffer);
          if (actualHash !== contentHash) {
            throw new Error('Content hash mismatch - possible corruption');
          }

          // Record successful download
          await this.recordDownload(contentHash, ad.publicKey, ad.url, true, downloadTime);

          // Optionally store locally for future use
          const filename = `downloaded_${contentHash}`;
          const content = await this.storeFile(buffer, filename, 'application/octet-stream', {
            isPublic: false,
            expiryHours: 24, // Cache for 24 hours
          });

          return { success: true, content, buffer };
        } catch (error) {
          console.warn(`[UHRP] Download failed from ${ad.url}:`, (error as Error).message);
          await this.recordDownload(contentHash, ad.publicKey, ad.url, false, 0, (error as Error).message);
        }
      }

      return { success: false, error: 'Failed to download from all available hosts' };
    } catch (error) {
      console.error('[UHRP] Download failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get file buffer for local content
   */
  async getFileBuffer(contentHash: string): Promise<Buffer | null> {
    try {
      const content = this.hostedContent.get(contentHash);
      if (!content) return null;

      // Increment download count
      await this.database.execute(
        `
        UPDATE uhrp_content
        SET download_count = download_count + 1
        WHERE content_hash = $1
      `,
        [contentHash],
      );

      return await fs.readFile(content.localPath);
    } catch (error) {
      console.error('[UHRP] Failed to get file buffer:', error);
      return null;
    }
  }

  /**
   * Get UHRP statistics
   */
  async getStats(): Promise<{
    localContent: { total: number; public: number; private: number; totalSize: number };
    advertisements: { own: number; total: number; active: number };
    hosts: { total: number; active: number; averageReputation: number };
    downloads: { total: number; successful: number; failed: number };
  }> {
    try {
      const [contentStats, adStats, hostStats, downloadStats] = await Promise.all([
        this.database.queryOne(
          `
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_public = TRUE) as public,
            COUNT(*) FILTER (WHERE is_public = FALSE) as private,
            SUM(size_bytes) as total_size
          FROM uhrp_content
          WHERE expires_at > $1
        `,
          [Date.now()],
        ),

        this.database.queryOne(
          `
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE public_key = $1) as own,
            COUNT(*) FILTER (WHERE is_active = TRUE AND expiry_time > $2) as active
          FROM uhrp_advertisements
        `,
          [this.myPublicKey || '', Date.now()],
        ),

        this.database.queryOne(`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_active = TRUE) as active,
            AVG(reputation) as avg_reputation
          FROM uhrp_hosts
        `),

        this.database.queryOne(`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE success = TRUE) as successful,
            COUNT(*) FILTER (WHERE success = FALSE) as failed
          FROM uhrp_downloads
        `),
      ]);

      return {
        localContent: {
          total: parseInt(contentStats?.total || '0'),
          public: parseInt(contentStats?.public || '0'),
          private: parseInt(contentStats?.private || '0'),
          totalSize: parseInt(contentStats?.total_size || '0'),
        },
        advertisements: {
          own: parseInt(adStats?.own || '0'),
          total: parseInt(adStats?.total || '0'),
          active: parseInt(adStats?.active || '0'),
        },
        hosts: {
          total: parseInt(hostStats?.total || '0'),
          active: parseInt(hostStats?.active || '0'),
          averageReputation: parseFloat(hostStats?.avg_reputation || '0'),
        },
        downloads: {
          total: parseInt(downloadStats?.total || '0'),
          successful: parseInt(downloadStats?.successful || '0'),
          failed: parseInt(downloadStats?.failed || '0'),
        },
      };
    } catch (error) {
      console.error('[UHRP] Failed to get stats:', error);
      return {
        localContent: { total: 0, public: 0, private: 0, totalSize: 0 },
        advertisements: { own: 0, total: 0, active: 0 },
        hosts: { total: 0, active: 0, averageReputation: 0 },
        downloads: { total: 0, successful: 0, failed: 0 },
      };
    }
  }

  // Helper methods

  private calculateContentHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private deriveAddressFromPublicKey(publicKey: string): string {
    // Simplified address derivation - in production use proper Bitcoin address derivation
    return createHash('sha256').update(publicKey).digest('base64').substring(0, 26);
  }

  private createAdvertisementMessage(ad: UHRPAdvertisement): string {
    return `1UHRPYnMHPuQ5Tgb3AF8JXqwKkmZVy5hG|${ad.address}|${ad.contentHash}|${ad.url}|${ad.expiryTime}|${ad.contentLength}`;
  }

  private async submitAdvertisementTransaction(ad: UHRPAdvertisement): Promise<string> {
    // In production, create actual UTXO transaction with UHRP token format
    // For now, return mock transaction ID
    return require('crypto').randomBytes(32).toString('hex') + ':0';
  }

  private async storeAdvertisement(ad: UHRPAdvertisement): Promise<void> {
    await this.database.execute(
      `
      INSERT INTO uhrp_advertisements
      (public_key, address, content_hash, url, expiry_time, content_length,
       signature, utxo_id, advertised_at, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (public_key, content_hash)
      DO UPDATE SET
        url = EXCLUDED.url,
        expiry_time = EXCLUDED.expiry_time,
        signature = EXCLUDED.signature,
        utxo_id = EXCLUDED.utxo_id,
        advertised_at = EXCLUDED.advertised_at,
        is_active = EXCLUDED.is_active
    `,
      [
        ad.publicKey,
        ad.address,
        ad.contentHash,
        ad.url,
        ad.expiryTime,
        ad.contentLength,
        ad.signature,
        ad.utxoId,
        ad.advertisedAt,
        ad.isActive,
      ],
    );
  }

  private async getHostsByPublicKeys(publicKeys: string[]): Promise<UHRPHost[]> {
    if (publicKeys.length === 0) return [];

    const placeholders = publicKeys.map((_, i) => `$${i + 1}`).join(',');
    const hosts = await this.database.query(
      `
      SELECT * FROM uhrp_hosts
      WHERE public_key IN (${placeholders}) AND is_active = TRUE
      ORDER BY reputation DESC
    `,
      publicKeys,
    );

    return hosts.map((row) => ({
      publicKey: row.public_key,
      address: row.address,
      baseUrl: row.base_url,
      reputation: parseFloat(row.reputation),
      uptime: parseFloat(row.uptime),
      lastSeen: parseInt(row.last_seen),
      contentCount: row.content_count,
      isActive: row.is_active,
    }));
  }

  private async recordDownload(
    contentHash: string,
    hostPublicKey: string,
    downloadUrl: string,
    success: boolean,
    downloadTimeMs: number = 0,
    errorMessage?: string,
  ): Promise<void> {
    await this.database.execute(
      `
      INSERT INTO uhrp_downloads
      (content_hash, host_public_key, download_url, downloaded_at, success, error_message, download_time_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
      [
        contentHash,
        hostPublicKey,
        downloadUrl,
        Date.now(),
        success,
        errorMessage || null,
        downloadTimeMs,
      ],
    );
  }

  /**
   * Clean up expired content and advertisements
   */
  async cleanup(): Promise<{ contentRemoved: number; advertisementsExpired: number }> {
    try {
      const now = Date.now();

      // Mark expired advertisements as inactive
      const adResult = await this.database.execute(
        `
        UPDATE uhrp_advertisements
        SET is_active = FALSE
        WHERE expiry_time < $1 AND is_active = TRUE
      `,
        [now],
      );

      // Remove expired content files
      const expiredContent = await this.database.query(
        `
        SELECT content_hash, local_path FROM uhrp_content
        WHERE expires_at < $1
      `,
        [now],
      );

      let contentRemoved = 0;
      for (const content of expiredContent) {
        try {
          await fs.unlink(content.local_path);
          this.hostedContent.delete(content.content_hash);
          contentRemoved++;
        } catch (error) {
          console.warn(`[UHRP] Failed to remove expired file ${content.local_path}:`, error);
        }
      }

      // Remove expired content records
      await this.database.execute(
        `
        DELETE FROM uhrp_content WHERE expires_at < $1
      `,
        [now],
      );

      return {
        contentRemoved,
        advertisementsExpired: 0, // Would need to track this in production
      };
    } catch (error) {
      console.error('[UHRP] Cleanup failed:', error);
      return { contentRemoved: 0, advertisementsExpired: 0 };
    }
  }
}

export { BRC26UHRPService };
