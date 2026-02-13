-- =============================================================================
-- Migration: ORCH ADMIN Tables
-- Description: Tables for the ORCH Admin contextual guide agent
-- Ecosystem: Single multi-functional agent for administrative system guidance
-- =============================================================================

-- =============================================================================
-- 1. Admin Sessions - User interactions with Orch Admin
-- =============================================================================

CREATE TABLE IF NOT EXISTS orch_admin_session (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    user_id UUID NOT NULL,

    -- Session context
    initial_page VARCHAR(500) NULL,
    pages_visited TEXT[] DEFAULT '{}',
    commands_used TEXT[] DEFAULT '{}',

    -- Session lifecycle
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metrics
    messages_count INTEGER DEFAULT 0,
    sentiment_score DECIMAL(3,2) NULL, -- -1 to 1

    -- Outcome
    resolution_status VARCHAR(20) DEFAULT 'open', -- open, resolved, escalated, abandoned

    -- Metadata
    user_agent TEXT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_admin_session_tenant FOREIGN KEY (tenant_id)
        REFERENCES company(id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_session_company FOREIGN KEY (company_id)
        REFERENCES company(id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_session_user FOREIGN KEY (user_id)
        REFERENCES "user"(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_session_tenant ON orch_admin_session(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_session_user ON orch_admin_session(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_session_company ON orch_admin_session(company_id);
CREATE INDEX IF NOT EXISTS idx_admin_session_started ON orch_admin_session(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_session_active ON orch_admin_session(user_id)
    WHERE ended_at IS NULL;

-- =============================================================================
-- 2. User Feedback - Collected feedback from admin users
-- =============================================================================

CREATE TABLE IF NOT EXISTS orch_admin_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    user_id UUID NOT NULL,
    session_id UUID NULL,

    -- Feedback classification
    feedback_type VARCHAR(20) NOT NULL, -- feature, bug, adjustment, ux, praise, complaint

    -- Context
    page_context VARCHAR(500) NULL,
    feature_context VARCHAR(255) NULL,

    -- Content
    content TEXT NOT NULL,
    user_verbatim TEXT NULL, -- exact user words

    -- Analysis
    sentiment VARCHAR(20) NULL, -- positive, neutral, negative, frustrated
    priority INTEGER DEFAULT 3, -- 1 (urgent) to 5 (low)

    -- Status
    status VARCHAR(20) DEFAULT 'new', -- new, reviewed, planned, done, wontfix

    -- Response
    response_given TEXT NULL,
    responded_at TIMESTAMPTZ NULL,
    responded_by UUID NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ NULL,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Foreign keys
    CONSTRAINT fk_admin_feedback_tenant FOREIGN KEY (tenant_id)
        REFERENCES company(id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_feedback_company FOREIGN KEY (company_id)
        REFERENCES company(id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_feedback_user FOREIGN KEY (user_id)
        REFERENCES "user"(id) ON DELETE CASCADE,
    CONSTRAINT fk_admin_feedback_session FOREIGN KEY (session_id)
        REFERENCES orch_admin_session(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT chk_admin_feedback_type CHECK (feedback_type IN (
        'feature', 'bug', 'adjustment', 'ux', 'praise', 'complaint', 'question'
    ))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_feedback_tenant ON orch_admin_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_feedback_type ON orch_admin_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_admin_feedback_status ON orch_admin_feedback(status);
CREATE INDEX IF NOT EXISTS idx_admin_feedback_priority ON orch_admin_feedback(priority)
    WHERE status IN ('new', 'reviewed');
CREATE INDEX IF NOT EXISTS idx_admin_feedback_created ON orch_admin_feedback(created_at DESC);

-- =============================================================================
-- 3. FAQ Bank - Auto-generated frequently asked questions
-- =============================================================================

CREATE TABLE IF NOT EXISTS orch_admin_faq (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,

    -- Question identification
    question_hash VARCHAR(64) NOT NULL, -- SHA256 of normalized question
    question_canonical TEXT NOT NULL, -- cleaned/normalized question
    question_variants JSONB DEFAULT '[]', -- other phrasings

    -- Answer
    answer TEXT NOT NULL,
    answer_source VARCHAR(50) DEFAULT 'auto', -- auto, manual, enriched

    -- Context
    page_context VARCHAR(500) NULL,
    module_context VARCHAR(100) NULL,
    tags TEXT[] DEFAULT '{}',

    -- Usage stats
    occurrence_count INTEGER DEFAULT 1,
    last_asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    helpful_votes INTEGER DEFAULT 0,
    unhelpful_votes INTEGER DEFAULT 0,

    -- Promotion
    promoted_to_docs BOOLEAN DEFAULT FALSE,
    promoted_at TIMESTAMPTZ NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_admin_faq_tenant FOREIGN KEY (tenant_id)
        REFERENCES company(id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_faq_company FOREIGN KEY (company_id)
        REFERENCES company(id) ON DELETE RESTRICT,

    -- Unique hash per company
    CONSTRAINT uq_admin_faq_hash UNIQUE (company_id, question_hash)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_faq_tenant ON orch_admin_faq(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_faq_page ON orch_admin_faq(page_context);
CREATE INDEX IF NOT EXISTS idx_admin_faq_count ON orch_admin_faq(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_admin_faq_recent ON orch_admin_faq(last_asked_at DESC);

-- =============================================================================
-- 4. Form Fill Log - Assisted form filling audit trail
-- =============================================================================

CREATE TABLE IF NOT EXISTS orch_admin_form_fill (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    user_id UUID NOT NULL,
    session_id UUID NULL,

    -- Form context
    page_url VARCHAR(500) NOT NULL,
    form_identifier VARCHAR(255) NULL,

    -- Fill details
    fields_filled JSONB NOT NULL, -- {field_name: value_hash, ...}
    fields_count INTEGER NOT NULL,

    -- Confirmation
    confirmed_by_user BOOLEAN NOT NULL,
    confirmation_timestamp TIMESTAMPTZ NULL,

    -- Errors
    error_fields TEXT[] DEFAULT '{}',
    error_messages JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_admin_fill_tenant FOREIGN KEY (tenant_id)
        REFERENCES company(id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_fill_company FOREIGN KEY (company_id)
        REFERENCES company(id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_fill_user FOREIGN KEY (user_id)
        REFERENCES "user"(id) ON DELETE CASCADE,
    CONSTRAINT fk_admin_fill_session FOREIGN KEY (session_id)
        REFERENCES orch_admin_session(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_fill_tenant ON orch_admin_form_fill(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_fill_user ON orch_admin_form_fill(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_fill_page ON orch_admin_form_fill(page_url);
CREATE INDEX IF NOT EXISTS idx_admin_fill_created ON orch_admin_form_fill(created_at DESC);

-- =============================================================================
-- 5. Proactive Alerts - Alerts sent to users
-- =============================================================================

CREATE TABLE IF NOT EXISTS orch_admin_alert (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,
    user_id UUID NOT NULL,

    -- Alert details
    alert_type VARCHAR(50) NOT NULL, -- student_risk, deadline, class_issue, system, admission
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical

    -- Content
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,

    -- Entity reference
    entity_type VARCHAR(50) NULL, -- student, class, admission, enrollment
    entity_id UUID NULL,

    -- Delivery
    delivery_method VARCHAR(30) DEFAULT 'session_start', -- session_start, inline, badge, push
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- User response
    read_at TIMESTAMPTZ NULL,
    action_taken VARCHAR(50) NULL, -- dismissed, clicked, resolved, snoozed
    action_at TIMESTAMPTZ NULL,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Foreign keys
    CONSTRAINT fk_admin_alert_tenant FOREIGN KEY (tenant_id)
        REFERENCES company(id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_alert_company FOREIGN KEY (company_id)
        REFERENCES company(id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_alert_user FOREIGN KEY (user_id)
        REFERENCES "user"(id) ON DELETE CASCADE,

    -- Constraints
    CONSTRAINT chk_admin_alert_severity CHECK (severity IN (
        'low', 'medium', 'high', 'critical'
    ))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_alert_tenant ON orch_admin_alert(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_alert_user ON orch_admin_alert(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_alert_type ON orch_admin_alert(alert_type);
CREATE INDEX IF NOT EXISTS idx_admin_alert_unread ON orch_admin_alert(user_id, severity DESC)
    WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_alert_delivered ON orch_admin_alert(delivered_at DESC);

-- =============================================================================
-- 6. Daily Metrics - Aggregated daily statistics
-- =============================================================================

CREATE TABLE IF NOT EXISTS orch_admin_metric (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    company_id UUID NOT NULL,

    -- Period
    metric_date DATE NOT NULL,

    -- Session metrics
    total_sessions INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    avg_session_duration_seconds INTEGER NULL,

    -- Resolution metrics
    sessions_resolved INTEGER DEFAULT 0,
    sessions_escalated INTEGER DEFAULT 0,
    resolution_rate DECIMAL(5,2) NULL,

    -- Sentiment
    avg_sentiment DECIMAL(3,2) NULL,
    positive_sessions INTEGER DEFAULT 0,
    negative_sessions INTEGER DEFAULT 0,

    -- Feedback
    feedbacks_collected INTEGER DEFAULT 0,
    features_requested INTEGER DEFAULT 0,
    bugs_reported INTEGER DEFAULT 0,

    -- Form fills
    forms_filled INTEGER DEFAULT 0,
    forms_confirmed INTEGER DEFAULT 0,

    -- Alerts
    alerts_sent INTEGER DEFAULT 0,
    alerts_actioned INTEGER DEFAULT 0,

    -- Top items (JSONB arrays)
    top_pages JSONB DEFAULT '[]', -- [{path: "/admissions", visits: 50}]
    top_commands JSONB DEFAULT '[]', -- [{command: "ajuda", count: 30}]
    top_questions JSONB DEFAULT '[]', -- [{question: "...", count: 15}]

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Foreign keys
    CONSTRAINT fk_admin_metric_tenant FOREIGN KEY (tenant_id)
        REFERENCES company(id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_metric_company FOREIGN KEY (company_id)
        REFERENCES company(id) ON DELETE RESTRICT,

    -- Unique per company per day
    CONSTRAINT uq_admin_metric_date UNIQUE (company_id, metric_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_metric_tenant ON orch_admin_metric(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_metric_company ON orch_admin_metric(company_id);
CREATE INDEX IF NOT EXISTS idx_admin_metric_date ON orch_admin_metric(metric_date DESC);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE orch_admin_session IS
    'User interaction sessions with the Orch Admin contextual guide';

COMMENT ON TABLE orch_admin_feedback IS
    'Feedback collected from admin users (features, bugs, UX issues)';

COMMENT ON TABLE orch_admin_faq IS
    'Auto-generated FAQ bank from recurring questions with deduplication';

COMMENT ON TABLE orch_admin_form_fill IS
    'Audit log of form fields filled by the assistant (hashed values for privacy)';

COMMENT ON TABLE orch_admin_alert IS
    'Proactive alerts sent to users about students, deadlines, and system issues';

COMMENT ON TABLE orch_admin_metric IS
    'Daily aggregated metrics for D7 reporting and analytics dashboards';

COMMENT ON COLUMN orch_admin_form_fill.fields_filled IS
    'JSONB with field names as keys and SHA256 hashes of values (privacy-preserving audit)';

COMMENT ON COLUMN orch_admin_faq.question_hash IS
    'SHA256 hash of normalized question for deduplication';
