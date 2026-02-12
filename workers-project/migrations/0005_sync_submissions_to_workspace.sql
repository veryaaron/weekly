-- Migration: Sync any submissions missing from workspace_submissions
-- This backfills submissions that were created through the legacy /api/submissions
-- endpoint (which only wrote to the `submissions` table) into `workspace_submissions`
-- for Aaron's workspace.
--
-- Safe to re-run: uses INSERT OR IGNORE with the UNIQUE constraint
-- (workspace_id, workspace_member_id, week_number, year)

-- Sync all submissions from the legacy table that aren't yet in workspace_submissions
INSERT OR IGNORE INTO workspace_submissions (
    id, workspace_id, workspace_member_id, week_number, year,
    accomplishments, previous_week_progress, blockers, priorities, shoutouts,
    ai_summary, ai_question, ai_answer, submitted_at
)
SELECT
    'wsub_sync_' || s.id,
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
FROM submissions s
WHERE s.team_member_id IN (
    SELECT id FROM workspace_members WHERE workspace_id = 'ws_aaron'
)
AND NOT EXISTS (
    SELECT 1 FROM workspace_submissions ws
    WHERE ws.workspace_id = 'ws_aaron'
    AND ws.workspace_member_id = s.team_member_id
    AND ws.week_number = s.week_number
    AND ws.year = s.year
);

-- Verification: check what was synced
-- SELECT ws.id, wm.email, wm.name, ws.week_number, ws.year, ws.submitted_at
-- FROM workspace_submissions ws
-- JOIN workspace_members wm ON ws.workspace_member_id = wm.id
-- WHERE ws.workspace_id = 'ws_aaron'
-- ORDER BY ws.year DESC, ws.week_number DESC, wm.name;
