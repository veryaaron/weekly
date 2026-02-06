-- Migration: Multi-Tenant Workspace Architecture
-- Run each statement separately in D1 Console

-- ============================================================================
-- WORKSPACE TABLES
-- ============================================================================

-- Workspaces - each manager gets their own workspace
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    manager_email TEXT UNIQUE NOT NULL,
    manager_name TEXT NOT NULL,
    allowed_domains TEXT NOT NULL DEFAULT '["kubapay.com","vixtechnology.com","voqa.com"]',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Workspace members - team members per workspace (same person can be in multiple workspaces)
CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    first_name TEXT,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, email)
);

-- Workspace submissions - submissions tied to specific workspaces
CREATE TABLE IF NOT EXISTS workspace_submissions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    workspace_member_id TEXT NOT NULL,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
    year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
    accomplishments TEXT,
    previous_week_progress TEXT,
    blockers TEXT,
    priorities TEXT,
    shoutouts TEXT,
    ai_summary TEXT,
    ai_question TEXT,
    ai_answer TEXT,
    submitted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_member_id) REFERENCES workspace_members(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, workspace_member_id, week_number, year)
);

-- Workspace reports - reports per workspace
CREATE TABLE IF NOT EXISTS workspace_reports (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
    year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
    content TEXT NOT NULL,
    format TEXT DEFAULT 'markdown' CHECK (format IN ('markdown', 'html', 'plain')),
    generated_at TEXT DEFAULT (datetime('now')),
    generated_by TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, week_number, year)
);

-- Workspace settings - per-workspace email schedule configuration
CREATE TABLE IF NOT EXISTS workspace_settings (
    workspace_id TEXT PRIMARY KEY,
    weekly_prompt_enabled INTEGER DEFAULT 1,
    weekly_reminder_enabled INTEGER DEFAULT 1,
    prompt_day TEXT DEFAULT 'wednesday',
    prompt_time TEXT DEFAULT '09:00',
    reminder_day TEXT DEFAULT 'thursday',
    reminder_time TEXT DEFAULT '17:00',
    email_from_name TEXT DEFAULT 'Weekly Feedback',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Workspace email logs - email tracking per workspace
CREATE TABLE IF NOT EXISTS workspace_email_logs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    email_type TEXT NOT NULL CHECK (email_type IN ('prompt', 'reminder', 'chase', 'bulk_chase', 'report')),
    subject TEXT NOT NULL,
    body_preview TEXT,
    sent_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced', 'delivered')),
    resend_id TEXT,
    error_message TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workspaces_manager_email ON workspaces(manager_email);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_email ON workspace_members(email);

CREATE INDEX IF NOT EXISTS idx_workspace_submissions_workspace ON workspace_submissions(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_submissions_member ON workspace_submissions(workspace_member_id);

CREATE INDEX IF NOT EXISTS idx_workspace_submissions_week_year ON workspace_submissions(week_number, year);

CREATE INDEX IF NOT EXISTS idx_workspace_reports_workspace ON workspace_reports(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_reports_week_year ON workspace_reports(week_number, year);

CREATE INDEX IF NOT EXISTS idx_workspace_email_logs_workspace ON workspace_email_logs(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_email_logs_sent_at ON workspace_email_logs(sent_at);
