-- Lux-Auto Database Initialization
-- Initializes PostgreSQL with required schemas and tables

-- Create extensions first
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== User Management =====

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'analyst', 'admin')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    email_verified BOOLEAN DEFAULT TRUE,
    INDEX users_email_idx (email),
    INDEX users_role_idx (role)
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP,
    INDEX user_sessions_user_id_active_idx (user_id, active),
    INDEX user_sessions_token_hash_idx (token_hash),
    INDEX user_sessions_expires_at_idx (expires_at)
);

-- ===== Audit Logging =====

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    old_values TEXT,
    new_values TEXT,
    status VARCHAR(20) DEFAULT 'success',
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX audit_logs_event_type_created_at_idx (event_type, created_at),
    INDEX audit_logs_user_id_created_at_idx (user_id, created_at),
    INDEX audit_logs_email_created_at_idx (email, created_at)
);

-- ===== Portal User Preferences =====

CREATE TABLE IF NOT EXISTS portal_user_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    dashboard_layout JSONB DEFAULT '{}',
    saved_filters JSONB DEFAULT '{}',
    saved_reports JSONB DEFAULT '{}',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT FALSE,
    auto_refresh_interval INTEGER DEFAULT 30 CHECK (auto_refresh_interval >= 10),
    items_per_page INTEGER DEFAULT 50 CHECK (items_per_page > 0 AND items_per_page <= 500),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== User Roles & Permissions =====

CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (
        role IN ('VIEWER', 'ANALYST', 'ADMIN', 'SUPER_ADMIN')
    ),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role),
    INDEX user_roles_user_id_idx (user_id),
    INDEX user_roles_role_idx (role),
    INDEX user_roles_expires_at_idx (expires_at)
);

-- ===== API Keys =====

CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(8) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read:deals', 'read:analytics'],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP,
    INDEX api_keys_key_hash_idx (key_hash),
    INDEX api_keys_user_id_idx (user_id),
    INDEX api_keys_is_active_idx (is_active),
    INDEX api_keys_prefix_idx (key_prefix)
);

-- ===== Portal Events (Real-time Updates) =====

CREATE TABLE IF NOT EXISTS portal_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '7 days',
    INDEX portal_events_created_at_idx (created_at DESC)
);

-- ===== Deals Management =====

CREATE TABLE IF NOT EXISTS deals (
    id VARCHAR(255) PRIMARY KEY,
    vin VARCHAR(17) UNIQUE NOT NULL,
    year INTEGER NOT NULL,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    trim VARCHAR(100),
    body_style VARCHAR(50),
    mileage INTEGER,
    transmission VARCHAR(50),
    color VARCHAR(50),
    interior_color VARCHAR(50),
    fuel_type VARCHAR(50),
    engine VARCHAR(100),
    photo_urls TEXT[],
    mmr_value DECIMAL(10, 2),
    estimated_margin DECIMAL(10, 2),
    score DECIMAL(5, 2),
    score_breakdown JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'scanning' CHECK (
        status IN ('scanning', 'scored', 'bidding', 'won', 'routed', 'closed')
    ),
    bid_count INTEGER DEFAULT 0,
    highest_bid DECIMAL(10, 2),
    condition_report JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX deals_status_idx (status),
    INDEX deals_created_at_idx (created_at),
    INDEX deals_make_model_idx (make, model),
    INDEX deals_vin_idx (vin)
);

-- ===== Buyers Management =====

CREATE TABLE IF NOT EXISTS buyers (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    location_state VARCHAR(2),
    location_city VARCHAR(100),
    location_zipcode VARCHAR(10),
    make_preferences TEXT[],
    model_preferences TEXT[],
    min_price DECIMAL(10, 2),
    max_price DECIMAL(10, 2),
    avg_response_time_minutes INTEGER,
    match_score DECIMAL(5, 2),
    last_contacted_at TIMESTAMP,
    contact_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX buyers_email_idx (email),
    INDEX buyers_match_score_idx (match_score),
    INDEX buyers_created_at_idx (created_at)
);

-- ===== System Configuration =====

CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Initialize with default admin user
INSERT INTO users (email, name, role) 
VALUES ('akushnir@bioenergystrategies.com', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Initialize system configuration
INSERT INTO system_config (key, value, description)
VALUES 
    ('enable_audit_logging', 'true', 'Enable audit logging for all actions'),
    ('enable_real_time_updates', 'true', 'Enable WebSocket real-time updates'),
    ('default_pagination_limit', '50', 'Default items per page for list endpoints'),
    ('max_pagination_limit', '500', 'Maximum items per page for list endpoints')
ON CONFLICT DO NOTHING;
