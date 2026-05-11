-- Up Migration

-- Add task_pda column so the chain listener can map an on-chain PDA back to a
-- DB task row without re-fetching/recomputing for every active task.
ALTER TABLE tasks ADD COLUMN task_pda text;

-- Backfill: derive PDA for any existing rows (in fresh installs there are
-- usually none). Production migrations would need a backfill script, but for
-- this MVP we drop the table on db:reset between runs.
-- (No backfill SQL — task_pda is computed in code at insert time going forward.)

CREATE UNIQUE INDEX tasks_task_pda_uniq ON tasks (task_pda) WHERE task_pda IS NOT NULL;

-- Down Migration

DROP INDEX IF EXISTS tasks_task_pda_uniq;
ALTER TABLE tasks DROP COLUMN IF EXISTS task_pda;
