-- Complete Bikera Supabase Database Schema
-- Privacy-First: NO GPS COORDINATES STORED
-- Run this in your Supabase SQL editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- For scheduled tasks

-- ============= USERS TABLE =============
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    icp_principal VARCHAR(64),
    solana_wallet VARCHAR(44),
    telegram_id VARCHAR(50),
    device_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_icp_principal ON users(icp_principal);
CREATE INDEX idx_users_solana_wallet ON users(solana_wallet);

-- ============= MOVEMENT SESSIONS (NO GPS!) =============
CREATE TABLE movement_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(100),
    total_distance_meters DECIMAL(12,2) DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    average_speed_ms DECIMAL(5,2),
    max_speed_ms DECIMAL(5,2),
    checkpoint_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- active, completed, cancelled
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sessions_user_id ON movement_sessions(user_id);
CREATE INDEX idx_sessions_status ON movement_sessions(status);
CREATE INDEX idx_sessions_session_id ON movement_sessions(session_id);

-- ============= DISTANCE SUBMISSIONS (PRIVACY-FIRST) =============
CREATE TABLE distance_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) REFERENCES movement_sessions(session_id),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    distance_meters DECIMAL(10,2) NOT NULL, -- Distance only, no coordinates!
    cumulative_distance DECIMAL(12,2) DEFAULT 0,
    duration_seconds INTEGER NOT NULL,
    average_speed DECIMAL(5,2),
    max_speed DECIMAL(5,2),
    timestamp BIGINT NOT NULL,
    device_id VARCHAR(100),
    validated BOOLEAN DEFAULT false,
    validation_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_submissions_session_id ON distance_submissions(session_id);
CREATE INDEX idx_submissions_user_id ON distance_submissions(user_id);
CREATE INDEX idx_submissions_timestamp ON distance_submissions(timestamp);
CREATE INDEX idx_submissions_created_at ON distance_submissions(created_at);

-- ============= DAILY DISTANCE AGGREGATES (FOR XP) =============
CREATE TABLE daily_distance_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_distance_meters DECIMAL(12,2) DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    xp_distributed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, date)
);

CREATE INDEX idx_daily_aggregates_date ON daily_distance_aggregates(date);
CREATE INDEX idx_daily_aggregates_xp_distributed ON daily_distance_aggregates(xp_distributed);

-- ============= MINING INTERVALS (5-MINUTE COMPETITIONS) =============
CREATE TABLE mining_intervals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interval_id VARCHAR(50) UNIQUE NOT NULL,
    start_time BIGINT NOT NULL,
    end_time BIGINT NOT NULL,
    target_distance DECIMAL(10,2) NOT NULL, -- Random 0-5km target
    total_participants INTEGER DEFAULT 0,
    eligible_winners INTEGER DEFAULT 0, -- After anti-gaming filters
    participants JSONB, -- Array of {user_id, distance}
    winners JSONB, -- Array of {user_id, distance, reward, rank}
    total_reward DECIMAL(18,6) DEFAULT 500,
    anti_gaming_applied BOOLEAN DEFAULT false,
    processed BOOLEAN DEFAULT false,
    icp_block_number BIGINT,
    icp_transaction_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_intervals_interval_id ON mining_intervals(interval_id);
CREATE INDEX idx_intervals_start_time ON mining_intervals(start_time);
CREATE INDEX idx_intervals_processed ON mining_intervals(processed);

-- ============= USER XP TRACKING =============
CREATE TABLE user_xp_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    distance_km DECIMAL(10,3) NOT NULL,
    xp_minted DECIMAL(10,3) NOT NULL,
    icp_transaction_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending', -- pending, pending_icp, minted, failed
    minted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_xp_user_id ON user_xp_tracking(user_id);
CREATE INDEX idx_xp_status ON user_xp_tracking(status);
CREATE INDEX idx_xp_period ON user_xp_tracking(period_start, period_end);

-- ============= USER STATS (AGGREGATED) =============
CREATE TABLE user_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50),
    total_distance_meters DECIMAL(15,2) DEFAULT 0,
    total_duration_seconds BIGINT DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_rewards DECIMAL(18,6) DEFAULT 0,
    total_xp DECIMAL(12,3) DEFAULT 0,
    average_speed DECIMAL(5,2) DEFAULT 0,
    best_single_distance DECIMAL(10,2) DEFAULT 0,
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    -- Anti-gaming tracking
    daily_wins INTEGER DEFAULT 0,
    daily_wins_date DATE,
    last_win_interval VARCHAR(50),
    consecutive_win_attempts INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    -- Activity tracking
    last_activity TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stats_total_distance ON user_stats(total_distance_meters DESC);
CREATE INDEX idx_stats_total_xp ON user_stats(total_xp DESC);
CREATE INDEX idx_stats_last_activity ON user_stats(last_activity);
CREATE INDEX idx_stats_daily_wins ON user_stats(daily_wins_date, daily_wins);

-- ============= REWARDS HISTORY =============
CREATE TABLE rewards_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    interval_id VARCHAR(50),
    amount DECIMAL(18,6) NOT NULL,
    reward_type VARCHAR(20) NOT NULL, -- mining, competition, bonus
    rank INTEGER,
    distance_traveled DECIMAL(10,2),
    target_distance DECIMAL(10,2),
    icp_transaction_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending', -- pending, distributed, claimed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rewards_user_id ON rewards_history(user_id);
CREATE INDEX idx_rewards_interval_id ON rewards_history(interval_id);
CREATE INDEX idx_rewards_status ON rewards_history(status);

-- ============= LEADERBOARD CACHE =============
CREATE TABLE leaderboard_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period VARCHAR(20) NOT NULL, -- daily, weekly, monthly, all-time
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    distance_meters DECIMAL(12,2) NOT NULL,
    rewards DECIMAL(18,6) NOT NULL,
    xp DECIMAL(12,3) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leaderboard_period_rank ON leaderboard_cache(period, rank);
CREATE INDEX idx_leaderboard_user_id ON leaderboard_cache(user_id);

-- ============= SYSTEM CONFIG =============
CREATE TABLE system_config (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default config
INSERT INTO system_config (key, value) VALUES
    ('mining_interval', '{"duration_ms": 300000, "reward_pool": 500}'),
    ('xp_distribution', '{"frequency_days": 3, "xp_per_km": 1}'),
    ('validation_rules', '{"max_speed_ms": 13.89, "min_distance_m": 5}'),
    ('rate_limits', '{"user_window_ms": 150000, "ip_per_minute": 1000}');

-- ============= FUNCTIONS =============

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON movement_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stats_updated_at BEFORE UPDATE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment daily wins with reset
CREATE OR REPLACE FUNCTION increment_daily_wins(user_ids UUID[])
RETURNS void AS $
DECLARE
    current_date DATE := CURRENT_DATE;
    user_id UUID;
BEGIN
    FOREACH user_id IN ARRAY user_ids
    LOOP
        INSERT INTO user_stats (user_id, daily_wins, daily_wins_date, total_wins)
        VALUES (user_id, 1, current_date, 1)
        ON CONFLICT (user_id) DO UPDATE
        SET 
            -- Reset daily wins if it's a new day
            daily_wins = CASE 
                WHEN user_stats.daily_wins_date = current_date 
                THEN user_stats.daily_wins + 1
                ELSE 1
            END,
            daily_wins_date = current_date,
            total_wins = user_stats.total_wins + 1,
            last_win_interval = 'interval_' || EXTRACT(EPOCH FROM NOW())::BIGINT / 300,
            updated_at = NOW();
    END LOOP;
END;
$ LANGUAGE plpgsql;

-- Function to check if user can win (anti-gaming)
CREATE OR REPLACE FUNCTION can_user_win(
    p_user_id UUID,
    p_interval_id VARCHAR
) RETURNS BOOLEAN AS $
DECLARE
    v_daily_wins INTEGER;
    v_last_interval VARCHAR;
    v_current_date DATE := CURRENT_DATE;
BEGIN
    SELECT daily_wins, last_win_interval, daily_wins_date
    INTO v_daily_wins, v_last_interval
    FROM user_stats
    WHERE user_id = p_user_id;
    
    -- If no stats, user can win
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;
    
    -- Reset daily wins if it's a new day
    IF daily_wins_date != v_current_date THEN
        v_daily_wins := 0;
    END IF;
    
    -- Check daily limit (max 38 wins per day)
    IF v_daily_wins >= 38 THEN
        RETURN FALSE;
    END IF;
    
    -- Check consecutive win prevention
    -- Extract interval numbers and check if consecutive
    IF v_last_interval IS NOT NULL THEN
        DECLARE
            last_interval_num BIGINT;
            current_interval_num BIGINT;
        BEGIN
            last_interval_num := SUBSTRING(v_last_interval FROM 'interval_(\d+)')::BIGINT;
            current_interval_num := SUBSTRING(p_interval_id FROM 'interval_(\d+)')::BIGINT;
            
            -- If intervals are consecutive (within 300 seconds), prevent win
            IF ABS(current_interval_num - last_interval_num) < 300 THEN
                RETURN FALSE;
            END IF;
        END;
    END IF;
    
    RETURN TRUE;
END;
$ LANGUAGE plpgsql;

-- Function to get eligible winners with anti-gaming
CREATE OR REPLACE FUNCTION get_eligible_winners(
    p_interval_id VARCHAR,
    p_user_distances JSONB,
    p_max_winners INTEGER DEFAULT 50
) RETURNS TABLE(
    user_id UUID,
    distance DECIMAL,
    rank INTEGER,
    reward DECIMAL
) AS $
DECLARE
    v_total_reward DECIMAL := 500;
    v_winner_count INTEGER;
    v_reward_per_winner DECIMAL;
BEGIN
    -- Create temp table with scored users
    CREATE TEMP TABLE scored_users AS
    SELECT 
        (elem->>'user_id')::UUID as user_id,
        (elem->>'distance')::DECIMAL as distance,
        (elem->>'score')::DECIMAL as score
    FROM jsonb_array_elements(p_user_distances) elem
    ORDER BY score DESC;
    
    -- Get eligible winners (checking anti-gaming rules)
    CREATE TEMP TABLE eligible_winners AS
    SELECT 
        s.user_id,
        s.distance,
        ROW_NUMBER() OVER (ORDER BY s.score DESC) as rank
    FROM scored_users s
    WHERE can_user_win(s.user_id, p_interval_id)
    LIMIT p_max_winners;
    
    -- Calculate reward per winner
    SELECT COUNT(*) INTO v_winner_count FROM eligible_winners;
    IF v_winner_count > 0 THEN
        v_reward_per_winner := v_total_reward / v_winner_count;
    ELSE
        v_reward_per_winner := 0;
    END IF;
    
    -- Return results
    RETURN QUERY
    SELECT 
        e.user_id,
        e.distance,
        e.rank::INTEGER,
        v_reward_per_winner
    FROM eligible_winners e;
    
    -- Clean up temp tables
    DROP TABLE IF EXISTS scored_users;
    DROP TABLE IF EXISTS eligible_winners;
END;
$ LANGUAGE plpgsql;

-- Function to update user stats
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert user stats
    INSERT INTO user_stats (
        user_id,
        total_distance_meters,
        total_duration_seconds,
        total_sessions,
        last_activity
    )
    VALUES (
        NEW.user_id,
        NEW.total_distance_meters,
        NEW.total_duration_seconds,
        1,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        total_distance_meters = user_stats.total_distance_meters + 
            (NEW.total_distance_meters - COALESCE(OLD.total_distance_meters, 0)),
        total_duration_seconds = user_stats.total_duration_seconds + 
            (NEW.total_duration_seconds - COALESCE(OLD.total_duration_seconds, 0)),
        total_sessions = CASE 
            WHEN NEW.status = 'completed' AND OLD.status != 'completed' 
            THEN user_stats.total_sessions + 1 
            ELSE user_stats.total_sessions 
        END,
        last_activity = NOW(),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_stats_trigger
AFTER INSERT OR UPDATE ON movement_sessions
FOR EACH ROW EXECUTE FUNCTION update_user_stats();

-- Function to calculate leaderboard
CREATE OR REPLACE FUNCTION calculate_leaderboard(p_period VARCHAR)
RETURNS void AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Determine date range
    v_end_date := CURRENT_DATE;
    CASE p_period
        WHEN 'daily' THEN v_start_date := v_end_date - INTERVAL '1 day';
        WHEN 'weekly' THEN v_start_date := v_end_date - INTERVAL '7 days';
        WHEN 'monthly' THEN v_start_date := v_end_date - INTERVAL '30 days';
        ELSE v_start_date := '2024-01-01'::DATE; -- all-time
    END CASE;
    
    -- Clear old cache for this period
    DELETE FROM leaderboard_cache WHERE period = p_period;
    
    -- Insert new rankings
    INSERT INTO leaderboard_cache (period, user_id, rank, distance_meters, rewards, xp, period_start, period_end)
    SELECT 
        p_period,
        u.user_id,
        ROW_NUMBER() OVER (ORDER BY SUM(d.total_distance_meters) DESC),
        SUM(d.total_distance_meters),
        COALESCE(SUM(r.amount), 0),
        COALESCE(SUM(x.xp_minted), 0),
        v_start_date,
        v_end_date
    FROM users u
    LEFT JOIN daily_distance_aggregates d ON u.id = d.user_id 
        AND d.date BETWEEN v_start_date AND v_end_date
    LEFT JOIN rewards_history r ON u.id = r.user_id 
        AND r.created_at BETWEEN v_start_date AND v_end_date
    LEFT JOIN user_xp_tracking x ON u.id = x.user_id 
        AND x.period_start >= v_start_date
    GROUP BY u.id
    HAVING SUM(d.total_distance_meters) > 0
    ORDER BY SUM(d.total_distance_meters) DESC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- ============= SCHEDULED JOBS =============

-- Process mining intervals every 5 minutes
SELECT cron.schedule(
    'process-mining-intervals',
    '*/5 * * * *',
    $$
    UPDATE mining_intervals 
    SET processed = true 
    WHERE processed = false 
    AND end_time < EXTRACT(EPOCH FROM NOW()) * 1000;
    $$
);

-- Update leaderboards every hour
SELECT cron.schedule(
    'update-leaderboards',
    '0 * * * *',
    $$
    SELECT calculate_leaderboard('daily');
    SELECT calculate_leaderboard('weekly');
    SELECT calculate_leaderboard('monthly');
    SELECT calculate_leaderboard('all-time');
    $$
);

-- Clean old submissions (keep only aggregates after 14 days)
SELECT cron.schedule(
    'cleanup-old-submissions',
    '0 3 * * *', -- 3 AM daily
    $$
    DELETE FROM distance_submissions 
    WHERE created_at < NOW() - INTERVAL '14 days';
    $$
);

-- ============= ROW LEVEL SECURITY =============

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE distance_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_xp_tracking ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY users_policy ON users
    FOR ALL USING (auth.uid()::UUID = id);

CREATE POLICY sessions_policy ON movement_sessions
    FOR ALL USING (auth.uid()::UUID = user_id);

CREATE POLICY submissions_policy ON distance_submissions
    FOR ALL USING (auth.uid()::UUID = user_id);

CREATE POLICY rewards_policy ON rewards_history
    FOR ALL USING (auth.uid()::UUID = user_id);

CREATE POLICY xp_policy ON user_xp_tracking
    FOR ALL USING (auth.uid()::UUID = user_id);

-- Public read for leaderboards
CREATE POLICY leaderboard_public_read ON leaderboard_cache
    FOR SELECT USING (true);

CREATE POLICY stats_public_read ON user_stats
    FOR SELECT USING (true);

-- ============= INDEXES FOR PERFORMANCE =============

CREATE INDEX CONCURRENTLY idx_submissions_recent 
ON distance_submissions(timestamp DESC)
WHERE timestamp > EXTRACT(EPOCH FROM NOW() - INTERVAL '1 day') * 1000;

CREATE INDEX CONCURRENTLY idx_sessions_active 
ON movement_sessions(user_id, status)
WHERE status = 'active';

-- ============= GRANTS =============

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;