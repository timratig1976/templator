-- Enable required PostgreSQL extensions for Templator
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create optimized indexes for AI data (will be created after Prisma migration)
-- These are commented out as they'll be created by Prisma migrations
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_sessions_jsonb_gin 
-- ON ai_sessions USING GIN (ai_analysis);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_sessions_status_created 
-- ON ai_sessions (status, created_at);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_templates_search 
-- ON templates USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Create composite indexes for common queries
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_sessions_user_project_status 
-- ON ai_sessions (user_id, project_id, status);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_logs_session_timestamp 
-- ON processing_logs (session_id, timestamp DESC);
