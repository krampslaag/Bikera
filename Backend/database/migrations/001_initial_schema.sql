-- User profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_index INTEGER UNIQUE NOT NULL,
  wallet_address TEXT,
  total_rewards BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movement data table (partitioned by day)
CREATE TABLE movement_data (
  id BIGSERIAL,
  user_id_index INTEGER NOT NULL,
  interval_id BIGINT NOT NULL,
  lat DECIMAL(10, 6),
  lon DECIMAL(10, 6),
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create partitions for the next 30 days
DO $$
BEGIN
  FOR i IN 0..30 LOOP
    EXECUTE format('
      CREATE TABLE movement_data_%s PARTITION OF movement_data
      FOR VALUES FROM (%L) TO (%L)',
      to_char(CURRENT_DATE + i, 'YYYY_MM_DD'),
      CURRENT_DATE + i,
      CURRENT_DATE + i + 1
    );
  END LOOP;
END $$;

-- Batch processing results
CREATE TABLE batch_results (
  batch_id TEXT PRIMARY KEY,
  interval_ids BIGINT[],
  validation_result JSONB,
  consensus_result JSONB,
  merkle_root TEXT,
  winners_count INTEGER,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Winners table
CREATE TABLE interval_winners (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT REFERENCES batch_results(batch_id),
  interval_id BIGINT NOT NULL,
  user_id_index INTEGER NOT NULL,
  cluster_center POINT,
  participants INTEGER,
  reward_amount BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_movement_data_user ON movement_data(user_id_index, timestamp);
CREATE INDEX idx_movement_data_interval ON movement_data(interval_id);
CREATE INDEX idx_winners_user ON interval_winners(user_id_index);
CREATE INDEX idx_batch_results_time ON batch_results(processed_at);