import { Pool, PoolClient, PoolConfig } from 'pg';
import fs from 'fs';
import path from 'path';

export interface PostgreSQLConfig extends PoolConfig {
  url?: string;
  poolMin?: number;
  poolMax?: number;
}

export class PostgreSQLClient {
  private pool: Pool;
  private config: PostgreSQLConfig;

  constructor(config: PostgreSQLConfig = {}) {
    this.config = {
      min: config.poolMin || parseInt(process.env.PG_POOL_MIN || '2'),
      max: config.poolMax || parseInt(process.env.PG_POOL_MAX || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ...config
    };

    if (config.url || process.env.PG_URL) {
      this.pool = new Pool({
        connectionString: config.url || process.env.PG_URL,
        ...this.config
      });
    } else {
      this.pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432'),
        database: process.env.PG_DATABASE || 'overlay',
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD,
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
        ...this.config
      });
    }

    this.pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
    });

    this.pool.on('connect', () => {
      console.log('PostgreSQL client connected');
    });
  }

  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return { rows: result.rows, rowCount: result.rowCount || 0 };
    } finally {
      client.release();
    }
  }

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async initSchema(schemaFile = 'src/db/postgresql-schema.sql'): Promise<void> {
    const sql = fs.readFileSync(schemaFile, 'utf8');
    await this.query(sql);
    console.log('PostgreSQL schema initialized');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('PostgreSQL health check failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  getPool(): Pool {
    return this.pool;
  }
}

// PostgreSQL client singleton
let pgClient: PostgreSQLClient | null = null;

export function getPostgreSQLClient(): PostgreSQLClient {
  if (!pgClient) {
    pgClient = new PostgreSQLClient();
  }
  return pgClient;
}

export async function closePostgreSQLConnection(): Promise<void> {
  if (pgClient) {
    await pgClient.close();
    pgClient = null;
  }
}

// Utility functions for common database operations

export async function upsertRecord<T extends Record<string, any>>(
  client: PostgreSQLClient,
  table: string,
  record: T,
  conflictColumns: string[],
  updateColumns?: string[]
): Promise<void> {
  const columns = Object.keys(record);
  const values = Object.values(record);
  const placeholders = values.map((_, i) => `$${i + 1}`);

  const updateCols = updateColumns || columns.filter(col => !conflictColumns.includes(col));
  const updateSet = updateCols.map(col => `${col} = EXCLUDED.${col}`).join(', ');

  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (${conflictColumns.join(', ')})
    DO UPDATE SET ${updateSet}
  `;

  await client.query(sql, values);
}

export async function insertRecord<T extends Record<string, any>>(
  client: PostgreSQLClient,
  table: string,
  record: T
): Promise<void> {
  const columns = Object.keys(record);
  const values = Object.values(record);
  const placeholders = values.map((_, i) => `$${i + 1}`);

  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
  `;

  await client.query(sql, values);
}

export async function updateRecord<T extends Record<string, any>>(
  client: PostgreSQLClient,
  table: string,
  record: Partial<T>,
  whereClause: string,
  whereParams: any[]
): Promise<void> {
  const columns = Object.keys(record);
  const values = Object.values(record);
  const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

  const sql = `
    UPDATE ${table}
    SET ${setClause}
    WHERE ${whereClause}
  `;

  await client.query(sql, [...values, ...whereParams]);
}

export async function deleteRecord(
  client: PostgreSQLClient,
  table: string,
  whereClause: string,
  whereParams: any[]
): Promise<number> {
  const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
  const result = await client.query(sql, whereParams);
  return result.rowCount;
}

// Note: Migration helpers removed - this is a pure PostgreSQL/Redis implementation