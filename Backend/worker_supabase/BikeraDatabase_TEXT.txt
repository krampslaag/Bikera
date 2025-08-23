-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geographic queries
CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- For scheduled jobs

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id VARCHAR(255) UNIQUE,
    solana_address VARCHAR(255),
    principal_id VARCHAR(255) UNIQUE,
    username VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    trust_score DECIMAL(5,2) DEFAULT 50.00,
    referral_code VARCHAR(20) UNIQUE,
    referred_by UUID REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_principal_id ON users(principal_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_trust_score ON users(trust_score);

-- Device registry
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_model VARCHAR(100),
    platform VARCHAR(50),
    os_version VARCHAR(50),
    app_version VARCHAR(20),
    push_token TEXT,
    is_trusted BOOLEAN DEFAULT false,
    is_blacklisted BOOLEAN DEFAULT false,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_blacklisted ON devices(is_blacklisted) WHERE is_blacklisted = true;

-- Location submissions table (main data)
CREATE TABLE location_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_MakePoint(longitude, latitude)) STORED,
    accuracy DECIMAL(10, 2),
    altitude DECIMAL(10, 2),
    speed DECIMAL(10, 2),
    heading DECIMAL(5, 2),
    timestamp TIMESTAMPTZ NOT NULL,
    device_fingerprint VARCHAR(255),
    ip_address INET,
    validation_score DECIMAL(5, 2),
    status VARCHAR(20) DEFAULT 'pending', -- pending, processed, rejected
    interval_id BIGINT,
    processed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_submissions_user_id ON location_submissions(user_id);
CREATE INDEX idx_submissions_status ON location_submissions(status);
CREATE INDEX idx_submissions_timestamp ON location_submissions(timestamp);
CREATE INDEX idx_submissions_interval_id ON location_submissions(interval_id);
CREATE INDEX idx_submissions_location ON location_submissions USING GIST(location);
CREATE INDEX idx_submissions_pending ON location_submissions(status, timestamp) 
    WHERE status = 'pending';

-- Mining intervals table
CREATE TABLE mining_intervals (
    id BIGINT PRIMARY KEY, -- Timestamp of interval start
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    target_latitude DECIMAL(10, 8),
    target_longitude DECIMAL(11, 8),
    target_location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS 
        (ST_MakePoint(target_longitude, target_latitude)) STORED,
    total_submissions INTEGER DEFAULT 0,
    total_participants INTEGER DEFAULT 0,
    processed BOOLEAN DEFAULT false,
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    block_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intervals_processed ON mining_intervals(processed);
CREATE INDEX idx_intervals_time_range ON mining_intervals(start_time, end_time);

-- Mining rewards table
CREATE TABLE mining_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    interval_id BIGINT REFERENCES mining_intervals(id),
    reward_amount DECIMAL(20, 8) NOT NULL,
    reward_type VARCHAR(50) DEFAULT 'mining', -- mining, referral, bonus
    rank INTEGER,
    distance_from_target DECIMAL(10, 2),
    transaction_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- pending, distributed, failed
    distributed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rewards_user_id ON mining_rewards(user_id);
CREATE INDEX idx_rewards_interval_id ON mining_rewards(interval_id);
CREATE INDEX idx_rewards_status ON mining_rewards(status);
CREATE INDEX idx_rewards_created_at ON mining_rewards(created_at);

-- User mining stats (aggregated)
CREATE TABLE user_mining_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_submissions INTEGER DEFAULT 0,
    valid_submissions INTEGER DEFAULT 0,
    rejected_submissions INTEGER DEFAULT 0,
    total_rewards DECIMAL(20, 8) DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    best_rank INTEGER,
    average_accuracy DECIMAL(10, 2),
    average_distance DECIMAL(10, 2),
    last_submission_at TIMESTAMPTZ,
    last_reward_at TIMESTAMPTZ,
    streak_days INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suspicious activities log
CREATE TABLE suspicious_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50), -- spoofing, rapid_movement, impossible_location
    reason TEXT,
    location JSONB,
    device_info JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id)
);

CREATE INDEX idx_suspicious_user_id ON suspicious_activities(user_id);
CREATE INDEX idx_suspicious_timestamp ON suspicious_activities(timestamp);
CREATE INDEX idx_suspicious_resolved ON suspicious_activities(resolved);

-- Blacklisted devices
CREATE TABLE blacklisted_devices (
    device_id VARCHAR(255) PRIMARY KEY,
    reason TEXT,
    added_by VARCHAR(255),
    added_at TIMESTAMPTZ DEFAULT NOW()
);

-- User purchases (for monetization)
CREATE TABLE user_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    product_type VARCHAR(50), -- booster, zone, nft, subscription
    product_id VARCHAR(255),
    amount_usd DECIMAL(10, 2),
    amount_icp DECIMAL(20, 8),
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchases_user_id ON user_purchases(user_id);
CREATE INDEX idx_purchases_status ON user_purchases(status);
CREATE INDEX idx_purchases_expires ON user_purchases(expires_at);

-- Active boosters
CREATE TABLE active_boosters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    booster_type VARCHAR(50),
    multiplier DECIMAL(5, 2),
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN GENERATED ALWAYS AS (expires_at > NOW()) STORED
);

CREATE INDEX idx_boosters_user_id ON active_boosters(user_id);
CREATE INDEX idx_boosters_active ON active_boosters(is_active, expires_at);

-- Custom mining zones
CREATE TABLE custom_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100),
    center_latitude DECIMAL(10, 8),
    center_longitude DECIMAL(11, 8),
    center_location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS 
        (ST_MakePoint(center_longitude, center_latitude)) STORED,
    radius_meters INTEGER,
    zone_polygon GEOGRAPHY(POLYGON, 4326),
    reward_multiplier DECIMAL(5, 2) DEFAULT 1.0,
    is_exclusive BOOLEAN DEFAULT false,
    max_participants INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN GENERATED ALWAYS AS (expires_at > NOW()) STORED
);

CREATE INDEX idx_zones_owner ON custom_zones(owner_id);
CREATE INDEX idx_zones_active ON custom_zones(is_active);
CREATE INDEX idx_zones_location ON custom_zones USING GIST(center_location);
CREATE INDEX idx_zones_polygon ON custom_zones USING GIST(zone_polygon);

-- Create materialized view for leaderboard
CREATE MATERIALIZED VIEW leaderboard AS
SELECT 
    u.id,
    u.username,
    u.principal_id,
    ums.total_rewards,
    ums.total_submissions,
    ums.total_wins,
    RANK() OVER (ORDER BY ums.total_rewards DESC) as global_rank,
    RANK() OVER (PARTITION BY DATE_TRUNC('week', NOW()) 
                 ORDER BY ums.total_rewards DESC) as weekly_rank
FROM users u
JOIN user_mining_stats ums ON u.id = ums.user_id
WHERE u.is_active = true
ORDER BY ums.total_rewards DESC;

CREATE INDEX idx_leaderboard_rank ON leaderboard(global_rank);
CREATE INDEX idx_leaderboard_user ON leaderboard(id);

-- Functions and triggers

-- Update user stats trigger
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stats when new submission is processed
    IF NEW.status = 'processed' AND OLD.status = 'pending' THEN
        INSERT INTO user_mining_stats (user_id, total_submissions, valid_submissions)
        VALUES (NEW.user_id, 1, 1)
        ON CONFLICT (user_id) DO UPDATE
        SET 
            total_submissions = user_mining_stats.total_submissions + 1,
            valid_submissions = user_mining_stats.valid_submissions + 1,
            last_submission_at = NEW.timestamp,
            updated_at = NOW();
    ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        INSERT INTO user_mining_stats (user_id, total_submissions, rejected_submissions)
        VALUES (NEW.user_id, 1, 1)
        ON CONFLICT (user_id) DO UPDATE
        SET 
            total_submissions = user_mining_stats.total_submissions + 1,
            rejected_submissions = user_mining_stats.rejected_submissions + 1,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats
AFTER UPDATE ON location_submissions
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_user_stats();

-- Function to check if location is in any active zone
CREATE OR REPLACE FUNCTION check_zone_bonus(
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_user_id UUID
) RETURNS TABLE (
    zone_id UUID,
    multiplier DECIMAL,
    is_exclusive BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cz.id,
        cz.reward_multiplier,
        cz.is_exclusive
    FROM custom_zones cz
    WHERE 
        cz.is_active = true
        AND ST_DWithin(
            cz.center_location,
            ST_MakePoint(p_longitude, p_latitude)::geography,
            cz.radius_meters
        )
        AND (
            NOT cz.is_exclusive 
            OR cz.owner_id = p_user_id
        )
    ORDER BY cz.reward_multiplier DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate mining rewards with boosters
CREATE OR REPLACE FUNCTION calculate_user_reward(
    p_user_id UUID,
    p_base_reward DECIMAL,
    p_latitude DECIMAL,
    p_longitude DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    v_final_reward DECIMAL;
    v_booster_multiplier DECIMAL;
    v_zone_multiplier DECIMAL;
BEGIN
    -- Get active booster multiplier
    SELECT COALESCE(MAX(multiplier), 1.0) INTO v_booster_multiplier
    FROM active_boosters
    WHERE user_id = p_user_id AND is_active = true;
    
    -- Get zone multiplier
    SELECT COALESCE(MAX(multiplier), 1.0) INTO v_zone_multiplier
    FROM check_zone_bonus(p_latitude, p_longitude, p_user_id);
    
    -- Calculate final reward
    v_final_reward := p_base_reward * v_booster_multiplier * v_zone_multiplier;
    
    RETURN v_final_reward;
END;
$$ LANGUAGE plpgsql;

-- Scheduled job to process intervals (using pg_cron)
SELECT cron.schedule(
    'process-mining-intervals',
    '*/10 * * * *', -- Every 10 minutes
    $$
    INSERT INTO mining_intervals (id, start_time, end_time)
    VALUES (
        EXTRACT(EPOCH FROM DATE_TRUNC('minute', NOW() - INTERVAL '10 minutes'))::BIGINT * 1000,
        DATE_TRUNC('minute', NOW() - INTERVAL '10 minutes'),
        DATE_TRUNC('minute', NOW())
    )
    ON CONFLICT (id) DO NOTHING;
    $$
);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mining_rewards ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY users_select ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY submissions_select ON location_submissions
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY rewards_select ON mining_rewards
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Create indexes for common queries
CREATE INDEX idx_submissions_recent ON location_submissions(user_id, timestamp DESC);
CREATE INDEX idx_rewards_recent ON mining_rewards(user_id, created_at DESC);
CREATE INDEX idx_intervals_current ON mining_intervals(end_time) 
    WHERE processed = false;

-- Partial indexes for performance
CREATE INDEX idx_active_users ON users(id) WHERE is_active = true;
CREATE INDEX idx_pending_rewards ON mining_rewards(user_id) WHERE status = 'pending';

-- Add comments for documentation
COMMENT ON TABLE users IS 'Main users table storing account information';
COMMENT ON TABLE location_submissions IS 'Raw location data submitted by users';
COMMENT ON TABLE mining_intervals IS 'Mining intervals and their targets';
COMMENT ON TABLE mining_rewards IS 'Rewards earned by users';
COMMENT ON COLUMN location_submissions.validation_score IS 'Anti-spoofing validation score (0-100)';
COMMENT ON COLUMN users.trust_score IS 'User trust score based on historical behavior';