-- D19 Identity Schema: BRC-31 Producer Identity Registration with Overlay Network Integration
-- This schema extends the existing PostgreSQL database with identity management tables

-- Enhanced producer identity tracking
CREATE TABLE IF NOT EXISTS overlay_identities (
    identity_key TEXT PRIMARY KEY,
    producer_id TEXT NOT NULL,
    ship_advertisement_id TEXT,
    overlay_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
    verification_status TEXT DEFAULT 'pending',
    reputation_score INTEGER DEFAULT 100,
    registered_at TIMESTAMP DEFAULT NOW(),
    last_verified_at TIMESTAMP,
    last_activity_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE
);

-- Signature verification audit trail
CREATE TABLE IF NOT EXISTS signature_verifications (
    id SERIAL PRIMARY KEY,
    identity_key TEXT NOT NULL,
    request_path TEXT NOT NULL,
    request_method TEXT NOT NULL,
    nonce TEXT NOT NULL,
    signature TEXT NOT NULL,
    verification_result BOOLEAN NOT NULL,
    overlay_evidence JSONB,
    client_ip TEXT,
    user_agent TEXT,
    verified_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- BRC-100 wallet connection sessions
CREATE TABLE IF NOT EXISTS wallet_sessions (
    session_id TEXT PRIMARY KEY,
    identity_key TEXT,
    wallet_type TEXT, -- 'metamask', 'handcash', 'centbee', etc.
    connection_data JSONB DEFAULT '{}'::jsonb,
    capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_connected BOOLEAN DEFAULT FALSE,
    connected_at TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Producer capabilities and service endpoints
CREATE TABLE IF NOT EXISTS producer_capabilities (
    id SERIAL PRIMARY KEY,
    identity_key TEXT REFERENCES overlay_identities(identity_key),
    capability_type TEXT NOT NULL, -- 'data-publishing', 'model-training', 'analysis'
    endpoint_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Identity reputation tracking
CREATE TABLE IF NOT EXISTS identity_reputation (
    id SERIAL PRIMARY KEY,
    identity_key TEXT REFERENCES overlay_identities(identity_key),
    event_type TEXT NOT NULL, -- 'submission', 'verification', 'penalty', 'bonus'
    score_change INTEGER NOT NULL,
    reason TEXT,
    evidence JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP DEFAULT NOW(),
    recorded_by TEXT -- who/what recorded this reputation change
);

-- Nonce tracking for replay protection (extends in-memory solution)
CREATE TABLE IF NOT EXISTS nonce_tracking (
    nonce TEXT PRIMARY KEY,
    identity_key TEXT NOT NULL,
    used_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    request_path TEXT,
    request_method TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_overlay_identities_producer_id ON overlay_identities(producer_id);
CREATE INDEX IF NOT EXISTS idx_overlay_identities_status ON overlay_identities(verification_status);
CREATE INDEX IF NOT EXISTS idx_overlay_identities_active ON overlay_identities(is_active);
CREATE INDEX IF NOT EXISTS idx_signature_verifications_identity ON signature_verifications(identity_key, verified_at);
CREATE INDEX IF NOT EXISTS idx_signature_verifications_nonce ON signature_verifications(nonce, verified_at);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_identity ON wallet_sessions(identity_key);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_active ON wallet_sessions(is_connected, expires_at);
CREATE INDEX IF NOT EXISTS idx_producer_capabilities_identity ON producer_capabilities(identity_key);
CREATE INDEX IF NOT EXISTS idx_identity_reputation_key ON identity_reputation(identity_key, recorded_at);
CREATE INDEX IF NOT EXISTS idx_nonce_tracking_identity ON nonce_tracking(identity_key, used_at);
CREATE INDEX IF NOT EXISTS idx_nonce_tracking_expires ON nonce_tracking(expires_at);

-- Cleanup function for expired nonces
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM nonce_tracking WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate reputation score
CREATE OR REPLACE FUNCTION calculate_reputation_score(identity_key_param TEXT)
RETURNS INTEGER AS $$
DECLARE
    current_score INTEGER;
BEGIN
    SELECT COALESCE(SUM(score_change), 100) INTO current_score
    FROM identity_reputation
    WHERE identity_key = identity_key_param;

    -- Ensure score stays within bounds
    current_score := GREATEST(0, LEAST(1000, current_score));

    -- Update the identity record
    UPDATE overlay_identities
    SET reputation_score = current_score,
        last_activity_at = NOW()
    WHERE identity_key = identity_key_param;

    RETURN current_score;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update reputation score automatically
CREATE OR REPLACE FUNCTION update_reputation_trigger()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM calculate_reputation_score(NEW.identity_key);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reputation_update_trigger
    AFTER INSERT ON identity_reputation
    FOR EACH ROW
    EXECUTE FUNCTION update_reputation_trigger();

-- Initial data and constraints
ALTER TABLE overlay_identities
ADD CONSTRAINT chk_reputation_score CHECK (reputation_score >= 0 AND reputation_score <= 1000);

ALTER TABLE overlay_identities
ADD CONSTRAINT chk_verification_status CHECK (verification_status IN ('pending', 'verified', 'suspended', 'revoked'));

-- Comments for documentation
COMMENT ON TABLE overlay_identities IS 'BRC-31 identity keys registered with the overlay network';
COMMENT ON TABLE signature_verifications IS 'Audit trail of all BRC-31 signature verification attempts';
COMMENT ON TABLE wallet_sessions IS 'BRC-100 compatible wallet connection sessions';
COMMENT ON TABLE producer_capabilities IS 'Producer service capabilities and endpoints';
COMMENT ON TABLE identity_reputation IS 'Reputation scoring system for identity keys';
COMMENT ON TABLE nonce_tracking IS 'Nonce replay protection with persistence';