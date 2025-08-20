-- Optimize database performance

-- Set up table partitioning for location_submissions (by month)
CREATE TABLE location_submissions_2024_01 PARTITION OF location_submissions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE location_submissions_2024_02 PARTITION OF location_submissions
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Auto-vacuum settings for high-traffic tables
ALTER TABLE location_submissions SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- Create composite indexes for common queries
CREATE INDEX idx_user_interval_status 
    ON location_submissions(user_id, interval_id, status);

CREATE INDEX idx_timestamp_status_user 
    ON location_submissions(timestamp, status, user_id);

-- Query performance views
CREATE VIEW recent_activity AS
SELECT 
    ls.user_id,
    u.username,
    COUNT(*) as submissions_today,
    MAX(ls.timestamp) as last_submission,
    AVG(ls.validation_score) as avg_validation_score
FROM location_submissions ls
JOIN users u ON ls.user_id = u.id
WHERE ls.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY ls.user_id, u.username;

-- Analytics view
CREATE VIEW mining_analytics AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) as total_submissions,
    AVG(validation_score) as avg_validation,
    COUNT(*) FILTER (WHERE status = 'processed') as processed,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected
FROM location_submissions
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;