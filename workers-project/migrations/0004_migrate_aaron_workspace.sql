-- Migration: Create Aaron's initial workspace and migrate existing data
-- Run each statement separately in D1 Console AFTER running 0003_multi_tenant_schema.sql

-- ============================================================================
-- CREATE AARON'S WORKSPACE
-- ============================================================================

INSERT INTO workspaces (id, manager_email, manager_name, allowed_domains, status)
VALUES (
    'ws_aaron',
    'aaron@kubapay.com',
    'Aaron Ross',
    '["kubapay.com","vixtechnology.com","voqa.com"]',
    'active'
);

-- Create workspace settings for Aaron
INSERT INTO workspace_settings (workspace_id, email_from_name)
VALUES ('ws_aaron', 'Weekly Feedback');

-- ============================================================================
-- MIGRATE EXISTING TEAM MEMBERS TO WORKSPACE MEMBERS
-- ============================================================================

-- Note: Run this SELECT first to verify the data:
-- SELECT id, email, name, first_name, role, active, created_at FROM team_members;

-- Vivian Nee
INSERT INTO workspace_members (id, workspace_id, email, name, first_name, role, active, created_at)
SELECT id, 'ws_aaron', email, name, first_name, role, active, created_at
FROM team_members WHERE email = 'vivian.nee@vixtechnology.com';

-- David Hope
INSERT INTO workspace_members (id, workspace_id, email, name, first_name, role, active, created_at)
SELECT id, 'ws_aaron', email, name, first_name, role, active, created_at
FROM team_members WHERE email = 'david@kubapay.com';

-- Tarik Dinane
INSERT INTO workspace_members (id, workspace_id, email, name, first_name, role, active, created_at)
SELECT id, 'ws_aaron', email, name, first_name, role, active, created_at
FROM team_members WHERE email = 'tarik@kubapay.com';

-- Richard Cornish
INSERT INTO workspace_members (id, workspace_id, email, name, first_name, role, active, created_at)
SELECT id, 'ws_aaron', email, name, first_name, role, active, created_at
FROM team_members WHERE email = 'richard.cornish@vixtechnology.com';

-- Rebecca Lalanne
INSERT INTO workspace_members (id, workspace_id, email, name, first_name, role, active, created_at)
SELECT id, 'ws_aaron', email, name, first_name, role, active, created_at
FROM team_members WHERE email = 'becky@voqa.com';

-- Giuseppe Russotti
INSERT INTO workspace_members (id, workspace_id, email, name, first_name, role, active, created_at)
SELECT id, 'ws_aaron', email, name, first_name, role, active, created_at
FROM team_members WHERE email = 'giuseppe@kubapay.com';

-- Tom Buerbaum
INSERT INTO workspace_members (id, workspace_id, email, name, first_name, role, active, created_at)
SELECT id, 'ws_aaron', email, name, first_name, role, active, created_at
FROM team_members WHERE email = 'tom@kubapay.com';

-- Aaron Ross (manager - also a workspace member for self-submission if needed)
INSERT INTO workspace_members (id, workspace_id, email, name, first_name, role, active, created_at)
SELECT id, 'ws_aaron', email, name, first_name, 'admin', active, created_at
FROM team_members WHERE email = 'aaron@kubapay.com';

-- ============================================================================
-- MIGRATE EXISTING SUBMISSIONS TO WORKSPACE SUBMISSIONS
-- ============================================================================

-- Note: Run this SELECT first to verify:
-- SELECT s.id, s.team_member_id, s.week_number, s.year FROM submissions s;

-- Migrate all submissions to Aaron's workspace
INSERT INTO workspace_submissions (
    id, workspace_id, workspace_member_id, week_number, year,
    accomplishments, previous_week_progress, blockers, priorities, shoutouts,
    ai_summary, ai_question, ai_answer, submitted_at
)
SELECT
    s.id,
    'ws_aaron',
    s.team_member_id,
    s.week_number,
    s.year,
    s.accomplishments,
    s.previous_week_progress,
    s.blockers,
    s.priorities,
    s.shoutouts,
    s.ai_summary,
    s.ai_question,
    s.ai_answer,
    s.submitted_at
FROM submissions s;

-- ============================================================================
-- MIGRATE EXISTING REPORTS TO WORKSPACE REPORTS
-- ============================================================================

INSERT INTO workspace_reports (
    id, workspace_id, week_number, year, content, format, generated_at, generated_by
)
SELECT
    id,
    'ws_aaron',
    week_number,
    year,
    content,
    format,
    generated_at,
    generated_by
FROM reports;

-- ============================================================================
-- VERIFICATION QUERIES (run these to confirm migration)
-- ============================================================================

-- Check workspace created:
-- SELECT * FROM workspaces;

-- Check workspace members:
-- SELECT * FROM workspace_members WHERE workspace_id = 'ws_aaron';

-- Check workspace submissions:
-- SELECT ws.id, wm.email, ws.week_number, ws.year
-- FROM workspace_submissions ws
-- JOIN workspace_members wm ON ws.workspace_member_id = wm.id;

-- Check workspace settings:
-- SELECT * FROM workspace_settings;
