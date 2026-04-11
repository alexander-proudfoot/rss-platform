-- RSS Platform Phase 2 — Initial Schema
-- Directive: D099
-- Date: 2026-04-11

-- Salesperson profiles (one per authenticated user)
CREATE TABLE salesperson_profiles (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_oid        NVARCHAR(255)    NOT NULL UNIQUE,  -- AAD Object ID from SWA auth
    display_name    NVARCHAR(255)    NOT NULL,
    email           NVARCHAR(255)    NOT NULL,
    current_focus_unit NVARCHAR(50)  NULL,              -- e.g. 'unit_3_building'
    created_at      DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    updated_at      DATETIME2        NOT NULL DEFAULT GETUTCDATE()
);

-- Coaching sessions (one per conversation with the agent)
CREATE TABLE coaching_sessions (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    salesperson_id  UNIQUEIDENTIFIER NOT NULL REFERENCES salesperson_profiles(id),
    mode            NVARCHAR(50)     NOT NULL,  -- 'pre-call' | 'post-call' | 'dev-review'
    agent_session_id NVARCHAR(255)   NULL,      -- Managed Agent session ID
    customer_name   NVARCHAR(255)    NULL,      -- Customer context (for pre-call/post-call)
    opportunity_name NVARCHAR(255)   NULL,      -- Deal context
    summary         NVARCHAR(MAX)    NULL,      -- AI-generated session summary
    started_at      DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    completed_at    DATETIME2        NULL
);

CREATE INDEX IX_coaching_sessions_salesperson ON coaching_sessions(salesperson_id, started_at DESC);

-- Coaching messages (conversation history within a session)
CREATE TABLE coaching_messages (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    session_id      UNIQUEIDENTIFIER NOT NULL REFERENCES coaching_sessions(id),
    role            NVARCHAR(20)     NOT NULL,  -- 'user' | 'assistant'
    content         NVARCHAR(MAX)    NOT NULL,
    created_at      DATETIME2        NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_coaching_messages_session ON coaching_messages(session_id, created_at);

-- Observation log (per-debrief skill observations, from Skill Tracker data model)
CREATE TABLE observation_log (
    id                  UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    salesperson_id      UNIQUEIDENTIFIER NOT NULL REFERENCES salesperson_profiles(id),
    session_id          UNIQUEIDENTIFIER NULL REFERENCES coaching_sessions(id),
    observation_date    DATE             NOT NULL,
    meeting_type        NVARCHAR(100)    NOT NULL,  -- 'first_meeting' | 'follow_up' | 'presentation' | 'discovery'
    unit_assessed       NVARCHAR(50)     NOT NULL,  -- 'unit_1_positioning' .. 'unit_5_resolving_concerns'
    score               INT              NOT NULL CHECK (score BETWEEN 1 AND 6),
    specific_behaviour  NVARCHAR(MAX)    NOT NULL,  -- Customer-response-anchored observation
    created_at          DATETIME2        NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_observation_log_salesperson ON observation_log(salesperson_id, observation_date DESC);
CREATE INDEX IX_observation_log_unit ON observation_log(salesperson_id, unit_assessed, observation_date DESC);

-- Situational Matrix position history (per customer/opportunity)
CREATE TABLE matrix_positions (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    salesperson_id  UNIQUEIDENTIFIER NOT NULL REFERENCES salesperson_profiles(id),
    session_id      UNIQUEIDENTIFIER NULL REFERENCES coaching_sessions(id),
    customer_name   NVARCHAR(255)    NOT NULL,
    opportunity_name NVARCHAR(255)   NULL,
    quadrant        NVARCHAR(10)     NOT NULL,  -- 'Q1' | 'Q2' | 'Q3' | 'Q4'
    evidence        NVARCHAR(MAX)    NOT NULL,  -- Why this quadrant was assessed
    assessed_at     DATETIME2        NOT NULL DEFAULT GETUTCDATE()
);

CREATE INDEX IX_matrix_positions_salesperson ON matrix_positions(salesperson_id, assessed_at DESC);
CREATE INDEX IX_matrix_positions_customer ON matrix_positions(salesperson_id, customer_name, assessed_at DESC);

-- Async job tracking (pattern from BVCA/Imerys)
CREATE TABLE ai_jobs (
    id              UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    session_id      UNIQUEIDENTIFIER NULL REFERENCES coaching_sessions(id),
    salesperson_id  UNIQUEIDENTIFIER NOT NULL REFERENCES salesperson_profiles(id),
    job_type        NVARCHAR(50)     NOT NULL,  -- 'coaching_message' | 'session_summary'
    status          NVARCHAR(20)     NOT NULL DEFAULT 'queued',  -- 'queued' | 'processing' | 'complete' | 'failed'
    request_json    NVARCHAR(MAX)    NULL,
    result_json     NVARCHAR(MAX)    NULL,
    error_message   NVARCHAR(MAX)    NULL,
    created_at      DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
    completed_at    DATETIME2        NULL
);

CREATE INDEX IX_ai_jobs_session ON ai_jobs(session_id);
CREATE INDEX IX_ai_jobs_status ON ai_jobs(status, created_at);
