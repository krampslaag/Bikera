-- Anti-Gaming Monitoring Dashboard Queries
-- Use these in Supabase or your monitoring dashboard

-- ============= DAILY WIN DISTRIBUTION =============
-- Check how wins are distributed among users today
CREATE OR REPLACE VIEW daily_win_distribution AS
SELECT 
    u.username,
    us.user_id,
    us.daily_wins,
    us.total_wins,
    us.last_win_interval,
    CASE 
        WHEN us.daily_wins >= 38 THEN 'LIMIT_REACHED'
        WHEN us.daily_wins >= 30 THEN 'APPROACHING_LIMIT'
        WHEN us.daily_wins >= 20 THEN 'HIGH_ACTIVITY'
        WHEN us.daily_wins >= 10 THEN 'MODERATE_ACTIVITY'
        ELSE 'NORMAL'
    END as status,
    ROUND((us.daily_wins::DECIMAL / 288) * 100, 2) as daily_win_percentage -- 288 = max intervals per day
FROM user_stats us
JOIN users u ON u.id = us.user_id
WHERE us.daily_wins_date = CURRENT_DATE
  AND us.daily_wins > 0
ORDER BY us.daily_wins DESC;

-- ============= ANTI-GAMING EFFECTIVENESS =============
-- Track how often anti-gaming rules are triggered
CREATE OR REPLACE VIEW anti_gaming_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_intervals,
    SUM(CASE WHEN anti_gaming_applied THEN 1 ELSE 0 END) as intervals_with_filtering,
    SUM(total_participants) as total_participants,
    SUM(eligible_winners) as total_eligible_winners,
    SUM(total_participants - eligible_winners) as users_filtered_out,
    ROUND(AVG(eligible_winners), 2) as avg_winners_per_interval,
    ROUND(AVG(total_participants), 2) as avg_participants_per_interval
FROM mining_intervals
WHERE processed = true
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============= SUSPICIOUS ACTIVITY DETECTION =============
-- Identify potential gaming patterns
CREATE OR REPLACE VIEW suspicious_activity AS
WITH user_patterns AS (
    SELECT 
        user_id,
        COUNT(*) as submission_count,
        AVG(distance_meters) as avg_distance,
        STDDEV(distance_meters) as distance_stddev,
        MIN(distance_meters) as min_distance,
        MAX(distance_meters) as max_distance,
        COUNT(DISTINCT session_id) as unique_sessions
    FROM distance_submissions
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY user_id
)
SELECT 
    u.username,
    up.*,
    us.daily_wins,
    us.total_wins,
    CASE
        -- Flag users with suspiciously consistent distances
        WHEN up.distance_stddev < 10 AND up.submission_count > 50 THEN 'CONSISTENT_DISTANCE'
        -- Flag users always near target distance
        WHEN up.avg_distance BETWEEN 2400 AND 2600 AND up.submission_count > 30 THEN 'TARGET_GAMING'
        -- Flag users with too many submissions
        WHEN up.submission_count > 200 THEN 'EXCESSIVE_SUBMISSIONS'
        -- Flag users winning too efficiently
        WHEN us.daily_wins > 30 AND up.submission_count < 100 THEN 'HIGH_WIN_RATE'
        ELSE 'NORMAL'
    END as flag_reason
FROM user_patterns up
JOIN users u ON u.id = up.user_id
LEFT JOIN user_stats us ON us.user_id = up.user_id
WHERE 
    up.distance_stddev < 10 
    OR up.submission_count > 200
    OR (us.daily_wins > 30 AND up.submission_count < 100)
ORDER BY us.daily_wins DESC NULLS LAST;

-- ============= CONSECUTIVE WIN ATTEMPTS =============
-- Track users attempting to win consecutively
CREATE OR REPLACE VIEW consecutive_win_attempts AS
WITH interval_winners AS (
    SELECT 
        mi.interval_id,
        mi.start_time,
        jsonb_array_elements(mi.winners)->>'userId' as user_id,
        (jsonb_array_elements(mi.winners)->>'reward')::DECIMAL as reward
    FROM mining_intervals mi
    WHERE mi.processed = true
        AND mi.created_at >= NOW() - INTERVAL '24 hours'
),
consecutive_check AS (
    SELECT 
        iw1.user_id,
        iw1.interval_id as interval_1,
        iw2.interval_id as interval_2,
        ABS(iw1.start_time - iw2.start_time) as time_diff
    FROM interval_winners iw1
    JOIN interval_winners iw2 ON iw1.user_id = iw2.user_id
    WHERE ABS(iw1.start_time - iw2.start_time) = 300000 -- Exactly 5 minutes apart
        AND iw1.start_time < iw2.start_time
)
SELECT 
    u.username,
    cc.user_id,
    COUNT(*) as consecutive_attempts,
    array_agg(cc.interval_1 || ' -> ' || cc.interval_2) as interval_pairs
FROM consecutive_check cc
JOIN users u ON u.id = cc.user_id::UUID
GROUP BY u.username, cc.user_id
ORDER BY consecutive_attempts DESC;

-- ============= REWARD DISTRIBUTION ANALYSIS =============
-- Analyze how rewards are distributed
CREATE OR REPLACE VIEW reward_distribution AS
WITH winner_stats AS (
    SELECT 
        jsonb_array_elements(winners)->>'userId' as user_id,
        COUNT(*) as wins_today,
        SUM((jsonb_array_elements(winners)->>'reward')::DECIMAL) as total_rewards_today,
        AVG((jsonb_array_elements(winners)->>'reward')::DECIMAL) as avg_reward_per_win
    FROM mining_intervals
    WHERE DATE(created_at) = CURRENT_DATE
        AND processed = true
    GROUP BY jsonb_array_elements(winners)->>'userId'
)
SELECT 
    u.username,
    ws.*,
    ROUND((ws.wins_today::DECIMAL / 288) * 100, 2) as win_rate_percentage,
    RANK() OVER (ORDER BY ws.total_rewards_today DESC) as reward_rank
FROM winner_stats ws
JOIN users u ON u.id = ws.user_id::UUID
ORDER BY total_rewards_today DESC;

-- ============= INTERVAL PARTICIPATION TRENDS =============
-- Track participation trends over time
CREATE OR REPLACE VIEW participation_trends AS
SELECT 
    DATE_TRUNC('hour', to_timestamp(start_time/1000)) as hour,
    COUNT(*) as intervals,
    AVG(total_participants) as avg_participants,
    AVG(eligible_winners) as avg_winners,
    SUM(total_participants) as total_participants,
    SUM(eligible_winners) as total_winners,
    ROUND(AVG(eligible_winners::DECIMAL / NULLIF(total_participants, 0)) * 100, 2) as avg_winner_percentage
FROM mining_intervals
WHERE processed = true
    AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', to_timestamp(start_time/1000))
ORDER BY hour DESC;

-- ============= USER WIN RATE ANALYSIS =============
-- Analyze win rates for fairness
CREATE OR REPLACE VIEW user_win_rates AS
WITH submission_counts AS (
    SELECT 
        user_id,
        COUNT(DISTINCT DATE_TRUNC('hour', to_timestamp(timestamp/1000))) as active_intervals
    FROM distance_submissions
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY user_id
),
win_counts AS (
    SELECT 
        jsonb_array_elements(winners)->>'userId' as user_id,
        COUNT(*) as total_wins
    FROM mining_intervals
    WHERE processed = true
        AND created_at >= NOW() - INTERVAL '7 days'
    GROUP BY jsonb_array_elements(winners)->>'userId'
)
SELECT 
    u.username,
    sc.user_id,
    sc.active_intervals,
    COALESCE(wc.total_wins, 0) as wins,
    ROUND(COALESCE(wc.total_wins, 0)::DECIMAL / NULLIF(sc.active_intervals, 0) * 100, 2) as win_rate,
    us.total_distance_meters,
    CASE 
        WHEN COALESCE(wc.total_wins, 0)::DECIMAL / NULLIF(sc.active_intervals, 0) > 0.5 THEN 'VERY_HIGH'
        WHEN COALESCE(wc.total_wins, 0)::DECIMAL / NULLIF(sc.active_intervals, 0) > 0.3 THEN 'HIGH'
        WHEN COALESCE(wc.total_wins, 0)::DECIMAL / NULLIF(sc.active_intervals, 0) > 0.1 THEN 'NORMAL'
        ELSE 'LOW'
    END as win_rate_category
FROM submission_counts sc
LEFT JOIN win_counts wc ON sc.user_id = wc.user_id::UUID
LEFT JOIN users u ON u.id = sc.user_id
LEFT JOIN user_stats us ON us.user_id = sc.user_id
ORDER BY win_rate DESC NULLS LAST;

-- ============= REAL-TIME MONITORING FUNCTION =============
-- Function to get current interval status
CREATE OR REPLACE FUNCTION get_current_interval_status()
RETURNS TABLE(
    current_interval_id VARCHAR,
    seconds_remaining INTEGER,
    current_participants INTEGER,
    projected_winners INTEGER,
    users_at_daily_limit INTEGER,
    last_interval_winners TEXT[]
) AS $$
DECLARE
    v_current_interval VARCHAR;
    v_interval_start BIGINT;
    v_now BIGINT;
BEGIN
    v_now := EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
    v_interval_start := (v_now / 300000) * 300000;
    v_current_interval := 'interval_' || v_interval_start;
    
    RETURN QUERY
    SELECT 
        v_current_interval,
        (300 - ((v_now - v_interval_start) / 1000))::INTEGER as seconds_remaining,
        COUNT(DISTINCT ds.user_id)::INTEGER as current_participants,
        LEAST(50, GREATEST(1, COUNT(DISTINCT ds.user_id) / 10))::INTEGER as projected_winners,
        COUNT(DISTINCT CASE WHEN us.daily_wins >= 38 THEN us.user_id END)::INTEGER as users_at_daily_limit,
        ARRAY(
            SELECT u.username 
            FROM mining_intervals mi, 
                 jsonb_array_elements(mi.winners) w,
                 users u
            WHERE mi.interval_id = (
                SELECT interval_id 
                FROM mining_intervals 
                WHERE processed = true 
                ORDER BY start_time DESC 
                LIMIT 1
            )
            AND u.id = (w->>'userId')::UUID
        ) as last_interval_winners
    FROM distance_submissions ds
    LEFT JOIN user_stats us ON us.user_id = ds.user_id
    WHERE ds.timestamp >= v_interval_start;
END;
$$ LANGUAGE plpgsql;

-- ============= DAILY SUMMARY REPORT =============
-- Generate daily summary for monitoring
CREATE OR REPLACE FUNCTION generate_daily_summary()
RETURNS TABLE(
    metric VARCHAR,
    value TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'Total Intervals'::VARCHAR, COUNT(*)::TEXT
    FROM mining_intervals
    WHERE DATE(created_at) = CURRENT_DATE
    UNION ALL
    SELECT 'Total Participants', SUM(total_participants)::TEXT
    FROM mining_intervals
    WHERE DATE(created_at) = CURRENT_DATE
    UNION ALL
    SELECT 'Total Winners', SUM(eligible_winners)::TEXT
    FROM mining_intervals
    WHERE DATE(created_at) = CURRENT_DATE
    UNION ALL
    SELECT 'Users Hit Daily Limit', COUNT(*)::TEXT
    FROM user_stats
    WHERE daily_wins_date = CURRENT_DATE AND daily_wins >= 38
    UNION ALL
    SELECT 'Anti-Gaming Triggered', SUM(CASE WHEN anti_gaming_applied THEN 1 ELSE 0 END)::TEXT
    FROM mining_intervals
    WHERE DATE(created_at) = CURRENT_DATE
    UNION ALL
    SELECT 'Total IMERA Distributed', (COUNT(*) * 500)::TEXT
    FROM mining_intervals
    WHERE DATE(created_at) = CURRENT_DATE AND processed = true
    UNION ALL
    SELECT 'Average Winners Per Interval', ROUND(AVG(eligible_winners), 2)::TEXT
    FROM mining_intervals
    WHERE DATE(created_at) = CURRENT_DATE AND processed = true
    UNION ALL
    SELECT 'Unique Active Users', COUNT(DISTINCT user_id)::TEXT
    FROM distance_submissions
    WHERE DATE(created_at) = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for views
GRANT SELECT ON daily_win_distribution TO authenticated;
GRANT SELECT ON anti_gaming_stats TO authenticated;
GRANT SELECT ON reward_distribution TO authenticated;
GRANT SELECT ON participation_trends TO authenticated;
GRANT SELECT ON user_win_rates TO authenticated;