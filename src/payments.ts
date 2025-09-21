import { getPostgreSQLClient } from './db/postgresql';

export async function runPaymentsMigrations(): Promise<void> {
  const pgClient = getPostgreSQLClient();

  // Create payment_events table if it doesn't exist
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS payment_events (
      event_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      receipt_id TEXT NOT NULL,
      txid TEXT,
      details_json JSONB,
      created_at BIGINT NOT NULL
    )
  `);

  // Create index on receipt_id for efficient queries
  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS idx_payment_events_receipt
    ON payment_events(receipt_id)
  `);

  // Create index on type for efficient filtering
  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS idx_payment_events_type
    ON payment_events(type)
  `);

  console.log('Payment migrations completed');
}