-- Staging Seed Data
-- Populates the staging database with realistic test data.
-- All email addresses point to aaron@kubapay.com so test emails only go to Aaron.
-- Run AFTER all migrations (0001–0005) have been applied.

-- ============================================================================
-- TEAM MEMBERS (legacy table — all emails → Aaron)
-- ============================================================================

INSERT OR IGNORE INTO team_members (id, email, name, first_name, role, active) VALUES
    ('tm_vivian',    'aaron+vivian@kubapay.com',    'Vivian Nee',       'Vivian',   'member', 1),
    ('tm_david',     'aaron+david@kubapay.com',     'David Hope',       'David',    'member', 1),
    ('tm_tarik',     'aaron+tarik@kubapay.com',     'Tarik Dinane',     'Tarik',    'member', 1),
    ('tm_richard',   'aaron+richard@kubapay.com',   'Richard Cornish',  'Richard',  'member', 1),
    ('tm_becky',     'aaron+becky@kubapay.com',     'Rebecca Lalanne',  'Becky',    'member', 1),
    ('tm_giuseppe',  'aaron+giuseppe@kubapay.com',  'Giuseppe Russotti', 'Giuseppe', 'member', 1),
    ('tm_tom',       'aaron+tom@kubapay.com',       'Tom Buerbaum',     'Tom',      'member', 1),
    ('tm_aaron',     'aaron@kubapay.com',           'Aaron Ross',       'Aaron',    'admin',  1);

-- ============================================================================
-- WORKSPACE
-- ============================================================================

INSERT OR IGNORE INTO workspaces (id, manager_email, manager_name, allowed_domains, status)
VALUES (
    'ws_aaron',
    'aaron@kubapay.com',
    'Aaron Ross',
    '["kubapay.com","vixtechnology.com","voqa.com"]',
    'active'
);

INSERT OR IGNORE INTO workspace_settings (workspace_id, email_from_name)
VALUES ('ws_aaron', 'Weekly Feedback');

-- ============================================================================
-- WORKSPACE MEMBERS (all emails → Aaron via + alias)
-- ============================================================================

INSERT OR IGNORE INTO workspace_members (id, workspace_id, email, name, first_name, role, active) VALUES
    ('tm_vivian',    'ws_aaron', 'aaron+vivian@kubapay.com',    'Vivian Nee',       'Vivian',   'member', 1),
    ('tm_david',     'ws_aaron', 'aaron+david@kubapay.com',     'David Hope',       'David',    'member', 1),
    ('tm_tarik',     'ws_aaron', 'aaron+tarik@kubapay.com',     'Tarik Dinane',     'Tarik',    'member', 1),
    ('tm_richard',   'ws_aaron', 'aaron+richard@kubapay.com',   'Richard Cornish',  'Richard',  'member', 1),
    ('tm_becky',     'ws_aaron', 'aaron+becky@kubapay.com',     'Rebecca Lalanne',  'Becky',    'member', 1),
    ('tm_giuseppe',  'ws_aaron', 'aaron+giuseppe@kubapay.com',  'Giuseppe Russotti', 'Giuseppe', 'member', 1),
    ('tm_tom',       'ws_aaron', 'aaron+tom@kubapay.com',       'Tom Buerbaum',     'Tom',      'member', 1),
    ('tm_aaron',     'ws_aaron', 'aaron@kubapay.com',           'Aaron Ross',       'Aaron',    'admin',  1);

-- ============================================================================
-- SAMPLE SUBMISSIONS (current week — some submitted, some pending)
-- Use week 7 of 2026 as sample data
-- ============================================================================

INSERT OR IGNORE INTO submissions (id, team_member_id, week_number, year, accomplishments, blockers, priorities, ai_summary, ai_question, ai_answer) VALUES
    ('sub_stg_1', 'tm_vivian', 7, 2026,
     'Completed the Q1 compliance review and submitted to the regulator. Set up monitoring dashboards for transaction volumes.',
     'Waiting on legal sign-off for the new partner agreement.',
     'Finalize partner onboarding docs. Start Q2 compliance prep.',
     'Vivian made strong progress on compliance and monitoring this week.',
     'What specific metrics are you tracking on the new dashboards?',
     'Transaction volume, success rates, and average processing time by partner.'),
    ('sub_stg_2', 'tm_david', 7, 2026,
     'Shipped the new payment reconciliation feature. Fixed 3 bugs in the settlement engine.',
     'Need access to the staging payment gateway — still waiting on credentials.',
     'Integration testing for the new reconciliation flow. Start on batch processing.',
     'David delivered key payment infrastructure improvements.',
     'How are you planning to handle edge cases in batch processing?',
     'Building a dead-letter queue for failed transactions that need manual review.'),
    ('sub_stg_3', 'tm_tarik', 7, 2026,
     'Launched the mobile app update with biometric auth. User feedback has been positive so far.',
     'Android build times are getting slow — need to investigate CI pipeline.',
     'Address the top 5 user-reported issues from the app store reviews.',
     'Tarik successfully delivered biometric auth on mobile.',
     'What''s the adoption rate for biometric auth vs PIN?',
     'About 70% opted in during the first week, which is above our 50% target.');

INSERT OR IGNORE INTO workspace_submissions (id, workspace_id, workspace_member_id, week_number, year, accomplishments, blockers, priorities, ai_summary, ai_question, ai_answer) VALUES
    ('wsub_stg_1', 'ws_aaron', 'tm_vivian', 7, 2026,
     'Completed the Q1 compliance review and submitted to the regulator. Set up monitoring dashboards for transaction volumes.',
     'Waiting on legal sign-off for the new partner agreement.',
     'Finalize partner onboarding docs. Start Q2 compliance prep.',
     'Vivian made strong progress on compliance and monitoring this week.',
     'What specific metrics are you tracking on the new dashboards?',
     'Transaction volume, success rates, and average processing time by partner.'),
    ('wsub_stg_2', 'ws_aaron', 'tm_david', 7, 2026,
     'Shipped the new payment reconciliation feature. Fixed 3 bugs in the settlement engine.',
     'Need access to the staging payment gateway — still waiting on credentials.',
     'Integration testing for the new reconciliation flow. Start on batch processing.',
     'David delivered key payment infrastructure improvements.',
     'How are you planning to handle edge cases in batch processing?',
     'Building a dead-letter queue for failed transactions that need manual review.'),
    ('wsub_stg_3', 'ws_aaron', 'tm_tarik', 7, 2026,
     'Launched the mobile app update with biometric auth. User feedback has been positive so far.',
     'Android build times are getting slow — need to investigate CI pipeline.',
     'Address the top 5 user-reported issues from the app store reviews.',
     'Tarik successfully delivered biometric auth on mobile.',
     'What''s the adoption rate for biometric auth vs PIN?',
     'About 70% opted in during the first week, which is above our 50% target.');

-- ============================================================================
-- DEFAULT SETTINGS
-- ============================================================================

INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('weekly_prompt_enabled', 'true', 'Enable Wednesday morning weekly prompt emails'),
    ('weekly_reminder_enabled', 'true', 'Enable Thursday afternoon reminder emails'),
    ('prompt_time', '09:00', 'Time to send weekly prompt (HH:MM, UK time)'),
    ('reminder_time', '17:00', 'Time to send reminder (HH:MM, UK time)'),
    ('prompt_day', 'wednesday', 'Day to send weekly prompt'),
    ('reminder_day', 'thursday', 'Day to send reminder'),
    ('email_from_name', 'Weekly Feedback', 'Sender name for emails'),
    ('form_url', 'https://tools.kubagroup.com/weekly', 'URL to the feedback form');
