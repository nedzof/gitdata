"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgreSQLClient = void 0;
exports.getPostgreSQLClient = getPostgreSQLClient;
exports.closePostgreSQLConnection = closePostgreSQLConnection;
exports.upsertRecord = upsertRecord;
exports.insertRecord = insertRecord;
exports.updateRecord = updateRecord;
exports.deleteRecord = deleteRecord;
const fs = __importStar(require("fs"));
const pg_1 = require("pg");
class PostgreSQLClient {
    constructor(config = {}) {
        this.config = {
            min: config.poolMin || parseInt(process.env.PG_POOL_MIN || '2'),
            max: config.poolMax || parseInt(process.env.PG_POOL_MAX || '20'),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            ...config,
        };
        if (config.url || process.env.PG_URL) {
            this.pool = new pg_1.Pool({
                connectionString: config.url || process.env.PG_URL,
                ...this.config,
            });
        }
        else {
            this.pool = new pg_1.Pool({
                host: process.env.PG_HOST || 'localhost',
                port: parseInt(process.env.PG_PORT || '5432'),
                database: process.env.PG_DATABASE || 'overlay',
                user: process.env.PG_USER || 'postgres',
                password: process.env.PG_PASSWORD,
                ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
                ...this.config,
            });
        }
        this.pool.on('error', (err) => {
            console.error('PostgreSQL pool error:', err);
        });
        this.pool.on('connect', () => {
            console.log('PostgreSQL client connected');
        });
    }
    async query(text, params) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return { rows: result.rows, rowCount: result.rowCount || 0 };
        }
        finally {
            client.release();
        }
    }
    async queryOne(text, params) {
        const result = await this.query(text, params);
        return result.rows[0] || null;
    }
    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async initSchema(schemaFile = 'src/db/postgresql-schema.sql') {
        const sql = fs.readFileSync(schemaFile, 'utf8');
        await this.query(sql);
        console.log('PostgreSQL schema initialized');
    }
    async healthCheck() {
        try {
            await this.query('SELECT 1');
            return true;
        }
        catch (error) {
            console.error('PostgreSQL health check failed:', error);
            return false;
        }
    }
    async close() {
        await this.pool.end();
    }
    getPool() {
        return this.pool;
    }
}
exports.PostgreSQLClient = PostgreSQLClient;
// PostgreSQL client singleton
let pgClient = null;
function getPostgreSQLClient() {
    if (!pgClient) {
        pgClient = new PostgreSQLClient();
    }
    return pgClient;
}
async function closePostgreSQLConnection() {
    if (pgClient) {
        await pgClient.close();
        pgClient = null;
    }
}
// Utility functions for common database operations
async function upsertRecord(client, table, record, conflictColumns, updateColumns) {
    const columns = Object.keys(record);
    const values = Object.values(record);
    const placeholders = values.map((_, i) => `$${i + 1}`);
    const updateCols = updateColumns || columns.filter((col) => !conflictColumns.includes(col));
    const updateSet = updateCols.map((col) => `${col} = EXCLUDED.${col}`).join(', ');
    const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (${conflictColumns.join(', ')})
    DO UPDATE SET ${updateSet}
  `;
    await client.query(sql, values);
}
async function insertRecord(client, table, record) {
    const columns = Object.keys(record);
    const values = Object.values(record);
    const placeholders = values.map((_, i) => `$${i + 1}`);
    const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
  `;
    await client.query(sql, values);
}
async function updateRecord(client, table, record, whereClause, whereParams) {
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
async function deleteRecord(client, table, whereClause, whereParams) {
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    const result = await client.query(sql, whereParams);
    return result.rowCount;
}
// Note: Migration helpers removed - this is a pure PostgreSQL/Redis implementation
//# sourceMappingURL=postgresql.js.map