-- Weekly Feedback Tool - Initial Database Schema
-- Migration: 0001_initial_schema
-- Created: 2026-02-06

-- Team members table
-- Stores all team members who can submit weekly feedback
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    first_name TEXT,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    active INTEGER DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Submissions table
-- Stores weekly feedback submissions
CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    team_member_id TEXT NOT NULL,
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
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
    UNIQUE(team_member_id, week_number, year)
);

-- Reports table
-- Stores generated weekly reports
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
    year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
    content TEXT NOT NULL,
    format TEXT DEFAULT 'markdown' CHECK (format IN ('markdown', 'html', 'plain')),
    generated_at TEXT DEFAULT (datetime('now')),
    generated_by TEXT,
    UNIQUE(week_number, year)
);

-- Email logs table
-- Tracks all sent emails for auditing and debugging
CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    email_type TEXT NOT NULL CHECK (email_type IN ('prompt', 'reminder', 'chase', 'bulk_chase', 'report')),
    subject TEXT NOT NULL,
    body_preview TEXT,
    sent_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced', 'delivered')),
    resend_id TEXT,
    error_message TEXT
);

-- Settings table
-- Stores application configuration
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_week_year ON submissions(week_number, year);
CREATE INDEX IF NOT EXISTS idx_submissions_member ON submissions(team_member_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(active);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('weekly_prompt_enabled', 'true', 'Enable Wednesday morning weekly prompt emails'),
    ('weekly_reminder_enabled', 'true', 'Enable Thursday afternoon reminder emails'),
    ('prompt_time', '09:00', 'Time to send weekly prompt (HH:MM, UK time)'),
    ('reminder_time', '17:00', 'Time to send reminder (HH:MM, UK time)'),
    ('prompt_day', 'wednesday', 'Day to send weekly prompt'),
    ('reminder_day', 'thursday', 'Day to send reminder'),
    ('email_from_name', 'Weekly Feedback', 'Sender name for emails'),
    ('form_url', 'https://tools.kubagroup.com/weekly', 'URL to the feedback form');
