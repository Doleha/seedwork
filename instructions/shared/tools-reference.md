# Tools Reference

You have access to six tools. This document describes each tool, when to use it, and what it expects.

---

## Organization Context

Your Organization Profile is automatically injected at the top of your system prompt. It contains your organization's name, mission, program details, cultural guidelines, key contacts, and routing thresholds. Read it before executing any task — all your outputs should reflect this context. If you need to reference it directly, it is at `/app/instructions/shared/org-profile.md`.

---

## query_database

**Purpose:** Read data from the organization database.
**When to use:** Before making any recommendation — always read current data first.
**Constraint:** SELECT statements only. Any attempt to use INSERT, UPDATE, DELETE, or other write operations will be rejected.

**Parameters:**
- `sql` (required): A SELECT statement
- `params` (optional): Array of values for parameterized queries ($1, $2, ...)

**Example uses:**
- Read pending founder applications before intake assessment
- Check compliance item deadlines before drafting a report
- Review recent agent performance scores before QA evaluation
- Count open grants before planning outreach

**Never use for:**
- Writing data — use write_decision, log_event, or other dedicated tools
- Running reports that already exist in events_log — read them there

---

## write_decision

**Purpose:** Write a recommendation to the decisions table for human staff review and approval.
**When to use:** Any time you have a recommendation that requires human judgment or approval.

**Parameters:**
- `entityType` (required): What this decision concerns (e.g., 'founder', 'hire', 'mentor_match', 'grant', 'compliance_update')
- `entityId` (optional): The UUID of the specific entity
- `department` (required): Your department (e.g., 'incubator', 'finance', 'marketing')
- `recommendation` (required): Specific, actionable recommendation
- `reasoning` (required): Entity-specific reasoning — not generic
- `data` (optional): Supporting data as an object

**Quality standard for reasoning:** The reasoning field must reference specific data — names, IDs, scores, dates. Generic reasoning ("the founder shows potential") will be flagged by the QA system. Acceptable: "Founder Amira Hassan scored 72/100 on readiness — problem clarity 16/20, solution viability 14/20, market understanding 15/20, team capability 14/20, commitment level 13/20. Score above 66 threshold; routing to accelerator path."

**Examples of when to use:**
- Recommending a founder for a specific cohort
- Proposing a mentor-founder match
- Recommending a grant application be submitted
- Flagging a compliance item as overdue requiring staff action
- Recommending a content piece be sent

---

## log_event

**Purpose:** Write to the events_log audit table. Used for reports, summaries, and audit records.
**When to use:** At the end of each heartbeat to log what you reviewed and what you found. Also used to store reports for staff to read in the Reports page.

**Parameters:**
- `type` (required): Event type. Use: 'report' for regular reports, 'quality_report' for QA findings, 'board_packet' for board materials, 'schedule_backoff' or 'schedule_reset' for system events
- `entityType` (optional): What this is about
- `entityId` (optional): Relevant entity UUID
- `payload` (optional): The report or event data as an object

**When to use for reports:** Write a report to events_log so staff can see what you reviewed even when no decisions were needed. Include: how many entities reviewed, what you found, what was healthy, what needed attention.

---

## request_hire

**Purpose:** Submit a hire request to the Board for approval via Paperclip.
**When to use:** When your team has a genuine capacity or capability gap that cannot be resolved by updating instructions.

**Parameters:**
- `name` (required): Proposed agent name (e.g., "Intake Coordinator")
- `role` (required): Role title
- `capabilities` (required): What this agent will do — describe the professional domain
- `instructionsPath` (required): Path to instructions file relative to `/app/instructions/` (e.g., `programs/intake-coordinator.md`)
- `heartbeatIntervalSec` (required): How often the agent runs in seconds
- `budgetMonthlyCents` (required): Estimated monthly cost (use 0 for local inference)
- `rationale` (required): Substantive business case — the Board will not approve vague requests

**Before requesting a hire:** Consult the Scaling Guide. Confirm you have observed capacity overload across at least 3 consecutive heartbeats. Confirm you have ruled out an instructions quality issue first.

---

## create_task

**Purpose:** Assign a task to another agent in the organization.
**When to use:** When you need another agent to take a specific action — following up with a founder, drafting content, reviewing a compliance item.

**Parameters:**
- `title` (required): Clear task title
- `description` (required): What needs to be done and why
- `assigneeAgentId` (optional): Paperclip ID of the agent to assign to
- `priority` (optional): 'urgent', 'high', 'medium', 'low' — default is 'medium'

**Use with specificity:** "Draft a personalized follow-up message for founder Khalid Osman (founder_id: abc123) re: missed milestone M4 due 2024-03-15" is better than "Follow up with a founder."

---

## create_goal

**Purpose:** Create a goal in Paperclip's goal hierarchy.
**When to use:** When establishing strategic objectives, department goals, or agent-level targets that should be tracked in Paperclip's goal system.

**Parameters:**
- `title` (required): Goal title
- `description` (optional): What achieving this goal looks like
- `level` (required): 'company', 'team', or 'agent'
- `parentId` (optional): ID of parent goal to create a hierarchy

**When to use:**
- Executive Director setting company-level strategic goals
- Directors setting department goals aligned to company goals
- Agents setting their own quarterly targets

---

## Tool Use Sequence (Typical Heartbeat)

1. **query_database** — read current state relevant to your responsibilities
2. Analyze what you found
3. **write_decision** for each recommendation requiring human approval
4. **create_task** for items you're delegating to other agents
5. **request_hire** if capacity justifies it (see Scaling Guide)
6. **log_event** with a summary report of the heartbeat — what you reviewed, what you found, what actions you took

Always complete step 6. Even if nothing needed a decision, log what you reviewed so the performance system has a record and staff can see activity.
