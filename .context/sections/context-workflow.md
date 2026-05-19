# Context Workflow

## Session Start
- Start work by calling `task_start` for this workspace.
- Treat the returned context payload as the authoritative context for the session.

## During The Session
- Use `task_checkpoint` when the task direction changes materially or after significant edits.
- Use `upsert_context` to update active context, current task intent, open questions, constraints, or risks.
- Use `log_decision` when a meaningful design or implementation choice is made.
- Use `log_lesson` when a mistake, constraint, or proven pattern is discovered.

## Session End
- Use `task_end` before closing out a session to generate a handoff.

## Working Rules
- Keep active context concise and current.
- Prefer structured context updates over repeating the same reminders in chat.
- Treat progress as current execution state; use handoffs and lessons for historical continuity.
