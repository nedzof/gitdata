/**
 * BRC-31 Database Service with Type-Safe SQL Queries
 *
 * This module provides database operations for BRC-31 identity tracking
 * using only TypeScript query builders, no raw SQL.
 */

import type { DatabaseAdapter } from '../overlay/brc26-uhrp';

import type {
  BRC31IdentityRecord,
  BRC31NonceRecord,
  BRC31Certificate,
  IdentityLevel,
  BRC31AuthenticationResult,
} from './types';

// ==================== Query Builder Helper ====================

interface TableColumn {
  name: string;
  type: string;
  constraints?: string[];
}

interface TableDefinition {
  name: string;
  columns: TableColumn[];
  constraints?: string[];
}

class QueryBuilder {
  static insert(
    table: string,
    data: Record<string, any>,
    onConflict?: string,
  ): { query: string; params: any[] } {
    const keys = Object.keys(data);
    const placeholders = keys.map((_, index) => `$${index + 1}`);
    const params = Object.values(data);

    let query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;

    if (onConflict) {
      query += ` ${onConflict}`;
    }

    return { query, params };
  }

  static update(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>,
  ): { query: string; params: any[] } {
    const setClause = Object.keys(data)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    const params = [...Object.values(data)];

    const whereClause = Object.keys(where)
      .map((key, index) => {
        params.push(where[key]);
        return `${key} = $${params.length}`;
      })
      .join(' AND ');

    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    return { query, params };
  }

  static selectWithOptions(
    table: string,
    options: {
      columns?: string[];
      where?: Record<string, any>;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
      limit?: number;
      offset?: number;
    } = {},
  ): { query: string; params: any[] } {
    const columns = options.columns || ['*'];
    const cols = columns.join(', ');
    let query = `SELECT ${cols} FROM ${table}`;
    const params: any[] = [];

    if (options.where) {
      const conditions = Object.keys(options.where).map((key, index) => {
        params.push(options.where![key]);
        return `${key} = $${index + 1}`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
      if (options.orderDirection) {
        query += ` ${options.orderDirection}`;
      }
    }

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    return { query, params };
  }

  static selectWithCustomWhere(
    table: string,
    columns: string[],
    whereCondition: string,
    params: any[] = [],
    options: {
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
      limit?: number;
      offset?: number;
    } = {},
  ): { query: string; params: any[] } {
    const cols = columns.join(', ');
    let query = `SELECT ${cols} FROM ${table} WHERE ${whereCondition}`;

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`;
      if (options.orderDirection) {
        query += ` ${options.orderDirection}`;
      }
    }

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    return { query, params };
  }

  static deleteWithCondition(
    table: string,
    whereCondition: string,
    params: any[] = [],
  ): { query: string; params: any[] } {
    const query = `DELETE FROM ${table} WHERE ${whereCondition}`;
    return { query, params };
  }

  static count(table: string, where?: Record<string, any>): { query: string; params: any[] } {
    let query = `SELECT COUNT(*) as count FROM ${table}`;
    const params: any[] = [];

    if (where) {
      const conditions = Object.keys(where).map((key, index) => {
        params.push(where[key]);
        return `${key} = $${index + 1}`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    return { query, params };
  }

  static createTable(tableDef: TableDefinition): string {
    const columns = tableDef.columns.map((col) => {
      let columnDef = `${col.name} ${col.type}`;
      if (col.constraints && col.constraints.length > 0) {
        columnDef += ' ' + col.constraints.join(' ');
      }
      return columnDef;
    });

    let createStatement = `CREATE TABLE IF NOT EXISTS ${tableDef.name} (\\n  ${columns.join(',\\n  ')}`;

    if (tableDef.constraints && tableDef.constraints.length > 0) {
      createStatement += ',\\n  ' + tableDef.constraints.join(',\\n  ');
    }

    createStatement += '\\n)';
    return createStatement;
  }
}

// ==================== BRC-31 Database Service ====================

export class BRC31DatabaseService {
  constructor(private database: DatabaseAdapter) {}

  // ==================== Schema Management ====================

  async initializeSchema(): Promise<void> {
    // BRC-31 Identity tracking table
    const identitiesTable: TableDefinition = {
      name: 'brc31_identities',
      columns: [
        { name: 'identity_key', type: 'TEXT', constraints: ['PRIMARY KEY'] },
        { name: 'certificate_chain', type: 'JSONB', constraints: ['NOT NULL'] },
        { name: 'identity_level', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'first_seen', type: 'TIMESTAMP', constraints: ['DEFAULT CURRENT_TIMESTAMP'] },
        { name: 'last_seen', type: 'TIMESTAMP', constraints: ['DEFAULT CURRENT_TIMESTAMP'] },
        { name: 'request_count', type: 'INTEGER', constraints: ['DEFAULT 0'] },
        { name: 'reputation_score', type: 'DECIMAL(3,2)', constraints: ['DEFAULT 1.0'] },
        { name: 'trust_metrics', type: 'JSONB', constraints: ["DEFAULT '{}'"] },
      ],
    };

    // BRC-31 Nonce management table
    const noncesTable: TableDefinition = {
      name: 'brc31_nonces',
      columns: [
        { name: 'nonce', type: 'TEXT', constraints: ['PRIMARY KEY'] },
        { name: 'identity_key', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'created_at', type: 'TIMESTAMP', constraints: ['DEFAULT CURRENT_TIMESTAMP'] },
        { name: 'expires_at', type: 'TIMESTAMP', constraints: ['NOT NULL'] },
        { name: 'used', type: 'BOOLEAN', constraints: ['DEFAULT FALSE'] },
        { name: 'purpose', type: 'TEXT', constraints: ['NOT NULL'] },
      ],
      constraints: [
        'FOREIGN KEY (identity_key) REFERENCES brc31_identities(identity_key) ON DELETE CASCADE',
      ],
    };

    await this.database.execute(QueryBuilder.createTable(identitiesTable));
    await this.database.execute(QueryBuilder.createTable(noncesTable));

    // Create indexes for performance
    await this.database.execute(
      'CREATE INDEX IF NOT EXISTS idx_brc31_identities_level ON brc31_identities(identity_level)',
    );
    await this.database.execute(
      'CREATE INDEX IF NOT EXISTS idx_brc31_identities_reputation ON brc31_identities(reputation_score DESC)',
    );
    await this.database.execute(
      'CREATE INDEX IF NOT EXISTS idx_brc31_nonces_expires ON brc31_nonces(expires_at)',
    );
    await this.database.execute(
      'CREATE INDEX IF NOT EXISTS idx_brc31_nonces_identity ON brc31_nonces(identity_key, expires_at)',
    );
  }

  // ==================== Identity Management ====================

  async storeIdentity(identity: {
    publicKey: string;
    certificates: BRC31Certificate[];
    level: IdentityLevel;
    trustMetrics: any;
  }): Promise<void> {
    const identityData = {
      identity_key: identity.publicKey,
      certificate_chain: JSON.stringify(identity.certificates),
      identity_level: identity.level,
      first_seen: new Date(),
      last_seen: new Date(),
      request_count: 1,
      reputation_score: 1.0,
      trust_metrics: JSON.stringify(
        identity.trustMetrics || {
          successful_auths: 0,
          failed_auths: 0,
          certificate_validity_score: 1.0,
          behavioral_score: 1.0,
        },
      ),
    };

    const onConflict = `ON CONFLICT (identity_key) DO UPDATE SET
      certificate_chain = EXCLUDED.certificate_chain,
      identity_level = EXCLUDED.identity_level,
      last_seen = EXCLUDED.last_seen,
      request_count = brc31_identities.request_count + 1,
      trust_metrics = EXCLUDED.trust_metrics`;

    const { query, params } = QueryBuilder.insert('brc31_identities', identityData, onConflict);
    await this.database.execute(query, params);
  }

  async getIdentity(publicKey: string): Promise<BRC31IdentityRecord | null> {
    const { query, params } = QueryBuilder.selectWithOptions('brc31_identities', {
      where: { identity_key: publicKey },
    });

    const result = await this.database.queryOne(query, params);
    if (!result) return null;

    return {
      identity_key: result.identity_key,
      certificate_chain: JSON.parse(result.certificate_chain),
      identity_level: result.identity_level,
      first_seen: new Date(result.first_seen),
      last_seen: new Date(result.last_seen),
      request_count: result.request_count,
      reputation_score: parseFloat(result.reputation_score),
      trust_metrics: JSON.parse(result.trust_metrics),
    };
  }

  async updateIdentityReputation(publicKey: string, success: boolean): Promise<void> {
    // Get current metrics
    const identity = await this.getIdentity(publicKey);
    if (!identity) return;

    const metrics = identity.trust_metrics;
    if (success) {
      metrics.successful_auths = (metrics.successful_auths || 0) + 1;
    } else {
      metrics.failed_auths = (metrics.failed_auths || 0) + 1;
    }

    // Calculate new reputation score
    const totalAuths = metrics.successful_auths + metrics.failed_auths;
    const successRate = totalAuths > 0 ? metrics.successful_auths / totalAuths : 1.0;
    const reputationScore = Math.max(
      0.1,
      successRate * (metrics.certificate_validity_score || 1.0) * (metrics.behavioral_score || 1.0),
    );

    const updateData = {
      trust_metrics: JSON.stringify(metrics),
      reputation_score: reputationScore,
      last_seen: new Date(),
    };

    const { query, params } = QueryBuilder.update('brc31_identities', updateData, {
      identity_key: publicKey,
    });

    await this.database.execute(query, params);
  }

  async getIdentitiesByLevel(
    level: IdentityLevel,
    limit: number = 100,
  ): Promise<BRC31IdentityRecord[]> {
    const { query, params } = QueryBuilder.selectWithOptions('brc31_identities', {
      where: { identity_level: level },
      orderBy: 'reputation_score',
      orderDirection: 'DESC',
      limit,
    });

    const results = await this.database.query(query, params);
    return results.map((result: any) => ({
      identity_key: result.identity_key,
      certificate_chain: JSON.parse(result.certificate_chain),
      identity_level: result.identity_level,
      first_seen: new Date(result.first_seen),
      last_seen: new Date(result.last_seen),
      request_count: result.request_count,
      reputation_score: parseFloat(result.reputation_score),
      trust_metrics: JSON.parse(result.trust_metrics),
    }));
  }

  // ==================== Nonce Management ====================

  async storeNonce(
    nonce: string,
    identityKey: string,
    expiresAt: Date,
    purpose: 'client' | 'server',
  ): Promise<void> {
    const nonceData = {
      nonce,
      identity_key: identityKey,
      created_at: new Date(),
      expires_at: expiresAt,
      used: false,
      purpose,
    };

    const { query, params } = QueryBuilder.insert('brc31_nonces', nonceData);
    await this.database.execute(query, params);
  }

  async validateAndConsumeNonce(nonce: string, identityKey: string): Promise<boolean> {
    // Check if nonce exists and is valid
    const { query: selectQuery, params: selectParams } = QueryBuilder.selectWithCustomWhere(
      'brc31_nonces',
      ['*'],
      'nonce = $1 AND identity_key = $2 AND used = FALSE AND expires_at > NOW()',
      [nonce, identityKey],
    );

    const nonceRecord = await this.database.queryOne(selectQuery, selectParams);
    if (!nonceRecord) return false;

    // Mark nonce as used
    const updateData = { used: true };
    const { query: updateQuery, params: updateParams } = QueryBuilder.update(
      'brc31_nonces',
      updateData,
      {
        nonce,
        identity_key: identityKey,
      },
    );

    await this.database.execute(updateQuery, updateParams);
    return true;
  }

  async cleanupExpiredNonces(): Promise<number> {
    const { query, params } = QueryBuilder.deleteWithCondition(
      'brc31_nonces',
      'expires_at < NOW() OR used = TRUE',
    );

    const result = await this.database.execute(query, params);
    return result || 0;
  }

  async getNoncesByIdentity(identityKey: string, limit: number = 50): Promise<BRC31NonceRecord[]> {
    const { query, params } = QueryBuilder.selectWithOptions('brc31_nonces', {
      where: { identity_key: identityKey },
      orderBy: 'created_at',
      orderDirection: 'DESC',
      limit,
    });

    const results = await this.database.query(query, params);
    return results.map((result: any) => ({
      nonce: result.nonce,
      identity_key: result.identity_key,
      created_at: new Date(result.created_at),
      expires_at: new Date(result.expires_at),
      used: result.used,
      purpose: result.purpose as 'client' | 'server',
    }));
  }

  // ==================== Statistics and Analytics ====================

  async getAuthenticationStats(): Promise<{
    totalIdentities: number;
    identitiesByLevel: Record<IdentityLevel, number>;
    averageReputation: number;
    activeNonces: number;
    authenticationRate: number;
  }> {
    const [
      totalIdentitiesResult,
      anonymousCount,
      publicKeyCount,
      verifiedCount,
      certifiedCount,
      averageReputationResult,
      activeNoncesResult,
    ] = await Promise.all([
      // Total identities
      this.database.queryOne(...QueryBuilder.count('brc31_identities').query.split('').slice(0, 2)),

      // Identities by level
      this.database.queryOne(
        ...QueryBuilder.count('brc31_identities', { identity_level: 'anonymous' })
          .query.split('')
          .slice(0, 2),
      ),
      this.database.queryOne(
        ...QueryBuilder.count('brc31_identities', { identity_level: 'public-key' })
          .query.split('')
          .slice(0, 2),
      ),
      this.database.queryOne(
        ...QueryBuilder.count('brc31_identities', { identity_level: 'verified' })
          .query.split('')
          .slice(0, 2),
      ),
      this.database.queryOne(
        ...QueryBuilder.count('brc31_identities', { identity_level: 'certified' })
          .query.split('')
          .slice(0, 2),
      ),

      // Average reputation
      this.database.queryOne(
        'SELECT AVG(reputation_score) as avg_reputation FROM brc31_identities',
      ),

      // Active nonces
      this.database.queryOne(
        ...QueryBuilder.selectWithCustomWhere(
          'brc31_nonces',
          ['COUNT(*) as count'],
          'expires_at > NOW() AND used = FALSE',
        )
          .query.split('')
          .slice(0, 2),
      ),
    ]);

    const totalIdentities = totalIdentitiesResult?.count || 0;
    const authenticationRate =
      totalIdentities > 0
        ? (
            await this.database.queryOne(
              'SELECT SUM(request_count) as total_requests FROM brc31_identities',
            )
          )?.total_requests / totalIdentities
        : 0;

    return {
      totalIdentities,
      identitiesByLevel: {
        anonymous: anonymousCount?.count || 0,
        'public-key': publicKeyCount?.count || 0,
        verified: verifiedCount?.count || 0,
        certified: certifiedCount?.count || 0,
      },
      averageReputation: parseFloat(averageReputationResult?.avg_reputation || '0'),
      activeNonces: activeNoncesResult?.count || 0,
      authenticationRate,
    };
  }

  async recordAuthenticationAttempt(result: BRC31AuthenticationResult): Promise<void> {
    // Store the authentication event for analytics
    if (result.valid && result.identity) {
      await this.storeIdentity({
        publicKey: result.identity.publicKey,
        certificates: result.identity.certificates,
        level: result.identity.level,
        trustMetrics: {
          successful_auths: 1,
          failed_auths: 0,
          certificate_validity_score: result.verification.certificatesValid ? 1.0 : 0.5,
          behavioral_score: result.verification.trustLevel / 100,
        },
      });

      await this.updateIdentityReputation(result.identity.publicKey, true);
    }
  }
}
