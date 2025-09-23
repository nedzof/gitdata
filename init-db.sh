#!/bin/bash
set -e

echo "🗄️ Initializing database with all schemas..."

# Run all schema files in order
echo "📋 Creating main schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/schema.sql

echo "📊 Creating OpenLineage schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/openlineage-schema.sql

echo "💳 Creating payments schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/schema-d06-payments.sql

echo "📈 Creating streaming quotas schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/schema-d07-streaming-quotas.sql

echo "🔄 Creating realtime packets schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/schema-d08-realtime-packets.sql

echo "💾 Creating overlay storage schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/schema-d22-overlay-storage.sql

echo "🆔 Creating identity schema..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/identity-schema.sql

echo "🔧 Creating additional storage tables..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" << EOF
CREATE TABLE IF NOT EXISTS storage_performance_metrics (
  id SERIAL PRIMARY KEY,
  router_id VARCHAR(255),
  metric_type VARCHAR(100),
  value NUMERIC,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storage_cache_stats (
  id SERIAL PRIMARY KEY,
  cache_id VARCHAR(255),
  hit_rate NUMERIC,
  miss_rate NUMERIC,
  total_requests INTEGER,
  memory_usage BIGINT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storage_replications (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) UNIQUE,
  source_location VARCHAR(500),
  target_location VARCHAR(500),
  status VARCHAR(50),
  priority INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF

echo "✅ Database initialization complete!"