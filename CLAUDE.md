# CLAUDE.md — Nonprofit Incubator/Accelerator OS
## Autonomous Build Brief

---

## CRITICAL OPERATING INSTRUCTIONS

- **Never stop to ask questions.** Every decision is pre-answered here.
- **When uncertain**, make a reasonable choice, add a `# TODO:` comment, keep going.
- **Do not install unlisted packages.**
- Work through tasks in strict order. Do not skip.
- **You are building a directory of files.** The output is a complete folder that
  the owner will manually upload to a GitHub repository. Do not run `git init`,
  do not create a GitHub repository, do not push anything. Just build the files.
- After completing each numbered task, print a clear checkpoint message:
  `[TASK N COMPLETE] — brief description of what was built`
- Greenfield directory. Create everything from scratch in the current working directory.

---

## What This Is

An open source AI-powered operations platform for nonprofit incubator and
accelerator organizations, built natively on Paperclip.

**The relationship to Paperclip is identical to how Supabase sits on Postgres.**
Paperclip is the engine. We provide the domain layer on top: instructions files
that define what each role does, a domain database schema, a custom LLM adapter,
a staff-facing UI, and supporting infrastructure.

**What Paperclip provides (do not replicate):**
Org chart, heartbeat scheduling, governance and approval flows, budget enforcement,
audit logging, task routing, session state.

**What we provide:**
- Instructions files (NLP job descriptions for every agent)
- Custom `local_llm` adapter (wraps llama-server, handles tool calling)
- Domain Postgres schema (founders, ventures, cohorts, etc.)
- Performance capture and QA system
- Corrective action flow
- Staff-facing React UI (non-technical program staff)
- WhatsApp webhook bridge
- Optional n8n bridge
- Clipmart org template (Company + CEO only)
- Setup script

---

## How Paperclip Runs This Org

### The Organic Hiring Flow

The Clipmart template contains only the Company definition and the Executive
Director (CEO). Everything else is built through Paperclip's hiring flow:

```
You import Clipmart template → Company + CEO created
        ↓
CEO wakes → drafts strategy → Board approves
        ↓
CEO requests Director hires → Board approves each
        ↓
Each Director requests worker hires → Board approves each
        ↓
Workers run on heartbeat schedules and do their jobs
```

**Board = you, the human operator.** You approve every hire. You are the final
escalation point for everything. No agent acts without tracing back to Board
approval somewhere in the chain.

### Agent Instructions Files

Instructions files are pure NLP markdown documents. They are the system prompt
that defines what an agent is, what it owns, and how it thinks. They contain:

- Who the agent is and who they report to
- Their professional domain expertise
- Their responsibilities and quality standards
- When to request headcount expansion
- What to include in their output

**Instructions files do NOT contain:**
- Bash commands
- API syntax
- curl commands
- Explicit Paperclip command structures

The `$paperclip` bash skill is Claude Code-specific and not available in our
custom adapter. Agents express intent through natural language output. The
adapter translates that output into API calls via tool calling.

### Tool Calling Interface

Our custom adapter exposes these tools to every agent via Qwen3.6's native
function calling:

```json
[
  {
    "name": "request_hire",
    "description": "Request Board approval to hire a new team member"
  },
  {
    "name": "create_task",
    "description": "Assign a task to another agent in the org"
  },
  {
    "name": "write_decision",
    "description": "Write a recommendation to the decisions table for human approval"
  },
  {
    "name": "query_database",
    "description": "Query the organization database"
  },
  {
    "name": "log_event",
    "description": "Write to the events_log audit table"
  },
  {
    "name": "create_goal",
    "description": "Create a goal in Paperclip's goal hierarchy"
  }
]
```

The adapter receives the tool call, executes the corresponding Paperclip or
database API call, and returns the result to the agent.

---

## LLM Stack

### Model

**Model:** `qwen3.6:35b-a3b` via llama-server (llama.cpp)
**Quantization:** Unsloth `UD-Q4_K_XL` — best quality/VRAM tradeoff for 24GB
**Why llama.cpp over Ollama:** Single model deployment. llama.cpp gives direct
control over KV cache quantization, parallel slots, Flash Attention, and MTP
speculative decoding. No daemon overhead. Same OpenAI-compatible API.

### llama-server Configuration

```bash
llama-server \
  -m /models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf \
  --ctx-size 32768 \
  --n-gpu-layers 999 \
  --n-cpu-moe 17 \
  --flash-attn on \
  --cache-type-k q8_0 \
  --cache-type-v q8_0 \
  --batch-size 4096 \
  --ubatch-size 1024 \
  --parallel 2 \
  --queue-size 20 \
  --temp 0.7 \
  --top-p 0.8 \
  --top-k 20 \
  --presence-penalty 1.5 \
  --spec-type draft-mtp \
  --spec-draft-n-max 6 \
  --port 9874
```

**Why these flags:**
- `--parallel 2`: Two simultaneous inference slots for concurrent agent requests
- `--n-cpu-moe 17`: Offloads 17 MoE experts to CPU, freeing VRAM for 2 parallel slots
- `--cache-type-k q8_0`: KV cache quantization saves ~1-2GB VRAM
- `--flash-attn on`: Reduces VRAM during inference
- `--spec-type draft-mtp`: MTP speculative decoding — 1.4-2x speedup at no quality cost
- `--queue-size 20`: Requests queue rather than drop during bursts

### Concurrency Handling

With 24GB VRAM and 18+ agents on staggered schedules, concurrent requests are
inevitable. Three layers handle this:

**Layer 1 — llama-server:** `--parallel 2` processes two requests simultaneously.
`--queue-size 20` holds up to 20 waiting.

**Layer 2 — Custom adapter Semaphore:** The `local_llm` adapter implements a
`Semaphore(2)` — matching the parallel slots. Requests beyond 2 block at the
semaphore rather than flooding llama-server's internal queue. Timeout: 900s
(generous enough for queued agents to wait without failing).

**Layer 3 — Staggered heartbeats:** Agents on different schedules naturally
desynchronize. An initial random delay of 0-300s on first heartbeat prevents
agents initialized simultaneously from synchronizing permanently.

---

## Heartbeat Schedule

**Principle: More tactical = more frequent. More strategic = less frequent.**
Workers do the actual work and fire most often. Directors supervise and fire
less often. The ED sets direction and fires least often.

| Role | Interval | Seconds |
|---|---|---|
| Intake Coordinator | 6 hours | 21600 |
| Program Manager (both) | 12 hours | 43200 |
| Daily workers (most) | 24 hours | 86400 |
| Weekly workers (reports, board) | 7 days | 604800 |
| Directors (all) | 48-72 hours | 172800-259200 |
| Executive Director | 24h during Phase 1, 7 days steady-state | 86400 → 604800 |

**Initial delay:** Every agent gets a random 0-300s initial delay to prevent
synchronization across the org.

**Executive Director:** Starts at 24h heartbeat during Phase 1 org-building.
Once all Phase 1 directors are hired and confirmed active, ED reduces to weekly
(7d) or event-driven. The ED's instructions file governs this transition — when
it detects all Phase 1 directors are operating, it requests the schedule change.
Primarily event-driven in steady state: wakes on Board approval events,
director escalations, and budget alerts.

---

## Org Structure

This org mirrors a standard for-profit organization in its foundational
departments, with nonprofit-specific departments added above and beyond.

```
Board of Directors (Human — you, the operator)
└── Executive Director (CEO)
    │
    ├── STANDARD DEPARTMENTS
    │
    ├── Director of Finance (Ph1)
    │   ├── Staff Accountant
    │   ├── Accounts Payable Coordinator
    │   ├── Budget Analyst
    │   ├── Grants Financial Manager
    │   └── Payroll Administrator
    │
    ├── Director of Administration (Ph1)
    │   ├── Office Manager
    │   ├── Executive Assistant
    │   ├── Events & Logistics Coordinator
    │   ├── Speaker Relations Manager
    │   └── Operations Coordinator (Ph2)
    │
    ├── Director of Human Resources (Ph2)
    │   ├── HR Generalist
    │   ├── Recruiter
    │   └── Volunteer Manager
    │
    ├── Director of Marketing & Communications (Ph1)
    │   ├── Content Writer
    │   ├── Graphic Designer
    │   ├── Social Media Manager
    │   ├── Email Marketing Specialist
    │   ├── PR & Media Relations
    │   ├── Recruitment Marketer
    │   └── SEO & Digital Analyst (Ph2)
    │
    ├── Director of IT & Systems (Ph2)
    │   ├── Systems Administrator
    │   ├── IT Support Specialist
    │   └── Data & Systems Coordinator (Ph3)
    │
    ├── PROGRAM DEPARTMENTS
    │
    ├── Director of Incubator Programs — Program Lead (Ph1)
    │   ├── Intake Coordinator
    │   ├── Program Manager
    │   ├── Mentor Coordinator
    │   ├── Curriculum Developer
    │   ├── Workshop Facilitator (Ph2)
    │   └── Founder Success Coach (Ph2)
    │
    ├── Director of Accelerator Programs — Program Lead (Ph1)
    │   ├── Program Manager
    │   ├── Mentor Coordinator
    │   ├── Investor Relations Manager
    │   ├── Pitch Coach (Ph2)
    │   └── Demo Day Coordinator (Ph2)
    │
    ├── NONPROFIT-SPECIFIC DEPARTMENTS
    │
    ├── Director of Development / Fundraising (Ph2)
    │   ├── Grant Researcher
    │   ├── Grant Writer
    │   ├── Grant Reporter
    │   ├── Donor Outreach Coordinator
    │   ├── Gift Processing Specialist
    │   ├── Major Gifts Officer (Ph3)
    │   ├── Sponsorship Outreach Coordinator
    │   └── Sponsorship Fulfillment Coordinator
    │
    ├── Director of External Affairs (Ph2)
    │   ├── Alumni Relations Manager
    │   ├── Alumni Engagement Coordinator
    │   ├── Board Relations Manager
    │   ├── Partnerships Manager
    │   └── Partnership Dev. Coordinator (Ph3)
    │
    ├── Director of Community Engagement (Ph3)
    │   ├── Community Manager
    │   └── Outreach Coordinator
    │
    ├── Director of Compliance & Governance (Ph2)
    │   ├── Regulatory Compliance Manager
    │   ├── Contracts & Legal Coordinator
    │   └── Risk & Policy Manager (Ph3)
    │
    └── Director of Impact, Quality & Evaluation (Ph1)
        ├── Impact Reporter
        ├── Program Evaluator
        ├── Quality Assurance Manager
        ├── Performance Analyst
        ├── Data Analyst (Ph2)
        └── Survey & Feedback Coordinator (Ph2)
```

**Note on Impact, Quality & Evaluation:** This department is deliberately
independent. QA Manager and Performance Analyst report to this Director, who
reports directly to ED — not to any department director whose team is being
evaluated. This prevents conflict of interest in performance assessment.

---

## Performance Capture & QA System

### Layer 1 — Automated Scoring at the Adapter

Every time the `local_llm` adapter processes an agent's output, before returning
to Paperclip it runs automated structural checks and writes a record to
`agent_performance`:

- Did output include all required fields?
- Was structured output (JSON) valid and parseable?
- Was reasoning present per decision?
- How many entities were processed?
- What was the composite auto_score (0-100)?

This is cheap, immediate, and requires no LLM. Pure structural validation.

### Layer 2 — QA Manager (Semantic Evaluation)

Reads `agent_performance` daily. Evaluates substance of flagged outputs:
- Is reasoning generic or entity-specific?
- Are decisions traceable to actual data?
- Is the output actionable?

Writes findings to `quality_assessments` table.

### Layer 3 — Performance Analyst (Trend Detection & Diagnosis)

Runs weekly. Reads both `agent_performance` and `quality_assessments`.
Detects patterns across runs. Determines root cause. Recommends corrective
action. Writes to `corrective_actions` table.

---

## Corrective Action Flow

```
QA Manager flags issue → quality_assessments
              ↓
Performance Analyst diagnoses root cause:
  instructions_quality | capacity_overload |
  data_quality | scope_too_wide | model_ceiling
              ↓
Performance Analyst recommends corrective action
              ↓
        ┌─────┴──────────────────────────────────┐
        │                                        │
   DIRECTOR AUTONOMOUS               REQUIRES BOARD APPROVAL
   (no approval needed)              (Paperclip approval request)
        │                                        │
   - Update instructions file          - Hire new worker
   - Reduce scope per run              - Pause agent
   - Fix data quality                  - Terminate & re-hire
        │                              - Human escalation
        └──────────────┬───────────────────────────┘
                       ↓
              Action implemented
              Logged in corrective_actions
                       ↓
              QA Manager monitors next 3 runs
                       ↓
              ┌────────┴────────┐
              │                 │
           IMPROVED          NO CHANGE
              │                 │
          Close action    Escalate one level
          Log outcome           │
                         ┌──────┴──────┐
                         │             │
                   Dir → ED      ED → Board
                              (immediate notification)
```

**Escalation thresholds (explicit — agents do not use judgment here):**
- Escalate to Director: auto_score below 60 for 2 consecutive runs
- Escalate to ED: below 60 for 4 consecutive runs after corrective action
- Immediate Board notification: any run below 40, OR cycle_count reaches 3
  with no improvement, OR decisions being approved upstream from a degraded agent

**The Board is the final escalation point.** There is no unresolvable state.
Everything either gets fixed at the closest level or surfaces to you with full
context: what failed, what was tried, how many cycles, what is recommended.

### Scaling Guide (included in every director/manager instructions file)

Every director and manager instructions file contains a "Managing Your Team"
section in plain NLP describing:

- Signs of capacity overload to watch for (generic output, growing backlog,
  missing reasoning across consecutive heartbeats)
- The decision framework: instructions problem vs capacity problem
- When to request a hire vs when to update instructions
- Clone vs specialist hire distinction
- That rationale must be substantive — Board will not approve vague requests

**No bash commands. No API syntax. Pure professional judgment expressed in NLP.**
The agent calls the `request_hire` tool with its reasoning. The adapter makes
the Paperclip API call.

---

## Folder Structure

```
/
├── CLAUDE.md
├── README.md
├── package.json                     ← pnpm workspace root
├── pnpm-workspace.yaml
├── .env.example
├── docker-compose.yml               ← core stack
├── docker-compose.n8n.yml           ← optional n8n bridge
├── clipmart-template.json           ← Company + CEO only
│
├── instructions/                    ← THE PRIMARY DELIVERABLE
│   │                                  Pure NLP job descriptions.
│   │                                  One file per agent role.
│   │
│   ├── executive-director.md        ← Includes full hiring plan for all phases
│   │
│   ├── standard/
│   │   ├── director-finance.md
│   │   ├── staff-accountant.md
│   │   ├── accounts-payable-coordinator.md
│   │   ├── budget-analyst.md
│   │   ├── grants-financial-manager.md
│   │   ├── payroll-administrator.md
│   │   ├── director-administration.md
│   │   ├── office-manager.md
│   │   ├── executive-assistant.md
│   │   ├── events-logistics-coordinator.md
│   │   ├── speaker-relations-manager.md
│   │   ├── operations-coordinator.md
│   │   ├── director-hr.md
│   │   ├── hr-generalist.md
│   │   ├── recruiter.md
│   │   ├── volunteer-manager.md
│   │   ├── director-marketing.md
│   │   ├── content-writer.md
│   │   ├── graphic-designer.md
│   │   ├── social-media-manager.md
│   │   ├── email-marketing-specialist.md
│   │   ├── pr-media-relations.md
│   │   ├── recruitment-marketer.md
│   │   ├── seo-digital-analyst.md
│   │   ├── director-it.md
│   │   ├── systems-administrator.md
│   │   ├── it-support-specialist.md
│   │   └── data-systems-coordinator.md
│   │
│   ├── programs/
│   │   ├── director-incubator.md
│   │   ├── intake-coordinator.md
│   │   ├── program-manager-incubator.md
│   │   ├── mentor-coordinator-incubator.md
│   │   ├── curriculum-developer.md
│   │   ├── workshop-facilitator.md
│   │   ├── founder-success-coach.md
│   │   ├── director-accelerator.md
│   │   ├── program-manager-accelerator.md
│   │   ├── mentor-coordinator-accelerator.md
│   │   ├── investor-relations-manager.md
│   │   ├── pitch-coach.md
│   │   └── demo-day-coordinator.md
│   │
│   ├── nonprofit/
│   │   ├── director-development.md
│   │   ├── grant-researcher.md
│   │   ├── grant-writer.md
│   │   ├── grant-reporter.md
│   │   ├── donor-outreach-coordinator.md
│   │   ├── gift-processing-specialist.md
│   │   ├── major-gifts-officer.md
│   │   ├── sponsorship-outreach-coordinator.md
│   │   ├── sponsorship-fulfillment-coordinator.md
│   │   ├── director-external-affairs.md
│   │   ├── alumni-relations-manager.md
│   │   ├── alumni-engagement-coordinator.md
│   │   ├── board-relations-manager.md
│   │   ├── partnerships-manager.md
│   │   ├── partnership-dev-coordinator.md
│   │   ├── director-community.md
│   │   ├── community-manager.md
│   │   ├── outreach-coordinator.md
│   │   ├── director-compliance.md
│   │   ├── regulatory-compliance-manager.md
│   │   ├── contracts-legal-coordinator.md
│   │   ├── risk-policy-manager.md
│   │   ├── director-impact-quality.md
│   │   ├── impact-reporter.md
│   │   ├── program-evaluator.md
│   │   ├── quality-assurance-manager.md
│   │   ├── performance-analyst.md
│   │   ├── data-analyst.md
│   │   └── survey-feedback-coordinator.md
│   │
│   └── shared/
│       ├── database-reference.md    ← All tables, columns, query patterns
│       ├── tools-reference.md       ← Available tools and when to use them
│       └── scaling-guide.md         ← When/why to request headcount expansion
│
├── adapter/                         ← Custom local_llm Paperclip adapter
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 ← ServerAdapterModule implementation
│       ├── semaphore.ts             ← Semaphore(2) concurrency control
│       ├── tools.ts                 ← Tool definitions and execution
│       ├── quality.ts               ← Automated output scoring → agent_performance
│       └── paperclip-client.ts      ← Paperclip API calls
│
├── migrations/
│   ├── phase1/
│   │   ├── 001_cohorts.sql
│   │   ├── 002_founders.sql
│   │   ├── 003_ventures.sql
│   │   ├── 004_milestones.sql
│   │   ├── 005_mentors.sql
│   │   ├── 006_matches.sql
│   │   ├── 007_sessions.sql
│   │   ├── 008_decisions.sql
│   │   ├── 009_events_log.sql
│   │   └── 010_agent_performance.sql
│   ├── phase2/
│   │   ├── 011_grants.sql
│   │   ├── 012_budget_items.sql
│   │   ├── 013_communications.sql
│   │   ├── 014_donors.sql
│   │   ├── 015_donor_gifts.sql
│   │   ├── 016_corporate_sponsors.sql
│   │   ├── 017_compliance_items.sql
│   │   ├── 018_alumni.sql
│   │   ├── 019_board_members.sql
│   │   ├── 020_board_meetings.sql
│   │   ├── 021_volunteers.sql
│   │   ├── 022_volunteer_assignments.sql
│   │   ├── 023_quality_assessments.sql
│   │   └── 024_corrective_actions.sql
│   └── phase3/
│       ├── 025_events.sql
│       ├── 026_partnerships.sql
│       ├── 027_investors.sql
│       ├── 028_investor_introductions.sql
│       ├── 029_application_leads.sql
│       └── 030_program_feedback.sql
│
├── setup.sh                         ← ONE-COMMAND INSTALLER (run this first)
├── wizard.py                        ← Lightweight terminal wizard for org.config.json
├── org.config.json                  ← FILL THIS IN FIRST — your org identity
│
├── scripts/
│   ├── activate-phase.sh            ← Activates Phase 2 or 3 when ready
│   ├── download-model.sh            ← Downloads LLM model before first run
│   └── generate-org-profile.py      ← Generates instructions/shared/org-profile.md from org.config.json
│
├── setup/
│   └── init-company.sh              ← Called by setup.sh — creates Company + CEO
│
├── staff-ui/                        ← React + Vite + Tailwind
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── Dockerfile
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── lib/supabase.ts
│       ├── components/
│       └── pages/
│           ├── DecisionQueue.tsx
│           ├── CohortDashboard.tsx
│           ├── Reports.tsx
│           ├── CorrectiveActions.tsx
│           ├── DataEntry.tsx
│           ├── GrantsPipeline.tsx
│           ├── DonorDashboard.tsx
│           ├── ComplianceDashboard.tsx
│           ├── AlumniNetwork.tsx
│           ├── BoardManagement.tsx
│           ├── VolunteerManagement.tsx
│           ├── InvestorPipeline.tsx
│           └── ApplicationPipeline.tsx
│
├── webhook-handler/                 ← WhatsApp ↔ Paperclip bridge
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── src/
│       ├── index.ts
│       ├── routes/whatsapp.ts
│       └── services/
│           ├── evolution.ts
│           └── paperclip.ts
│
└── extensions/
    └── n8n-bridge/                  ← Optional bidirectional n8n bridge
        ├── package.json
        ├── tsconfig.json
        ├── Dockerfile
        └── src/
            ├── index.ts
            └── routes/
                ├── outbound.ts
                └── inbound.ts
```

---

## Sequential Task List

Commit after each task. Never skip ahead.

### TASK 1 — Initialize directory structure

- Root `package.json` with pnpm workspaces: `adapter`, `staff-ui`,
  `webhook-handler`, `extensions/*`
- `pnpm-workspace.yaml`
- `tsconfig.base.json` (strict: true, target: ES2022, module: NodeNext)
- `package.json` + `tsconfig.json` per workspace
- `.env.example` (see Environment Variables)
- `.gitignore`
- `pnpm install`
- Print: `[TASK 1 COMPLETE] — directory structure and workspaces initialized`

### TASK 2 — Write all instructions files

Write every file listed under `instructions/` in the folder structure.
Full content guidance per file is in the INSTRUCTIONS CONTENT section below.

Write all shared reference files first:
1. `instructions/shared/database-reference.md` — every table and column
2. `instructions/shared/tools-reference.md` — all tools and when to use them
3. `instructions/shared/scaling-guide.md` — headcount expansion doctrine
4. `instructions/shared/org-profile.md` — **stub only** with this exact content:

```markdown
# Organization Profile

This file is generated automatically by setup.sh from org.config.json.
It will be populated with your organization's name, mission, programs,
cultural guidelines, and key contacts before agents first run.

If this file still contains this placeholder text, run:
  python3 scripts/generate-org-profile.py

All agents should read this file at the start of every heartbeat for
organization context. Never hardcode organization names, mission text,
or contact names in instructions files — always reference this file.
```

The real content of `org-profile.md` is generated at install time by
`scripts/generate-org-profile.py` reading `org.config.json`. The stub
ensures the file exists so instructions references don't break before
setup runs.

Then write every role instructions file. Every file follows this structure:

```markdown
# [Role Title]

## Who You Are
[Role, reporting line, who reports to you if any, phase]

## Your Mission
[What success looks like for this role in one paragraph]

## Your Domain Expertise
[Professional knowledge this agent brings — treat it as a credentialed professional]

## Your Responsibilities
[What you do on each heartbeat. Written as professional tasks, not scripts.]

## Managing Your Team
[Directors and managers only. Copied from scaling-guide.md with role-specific
quality thresholds. Workers do not have this section.]

## Hiring Plan
[CEO and Directors only. NLP description of what roles to request and why.
Include: role name, capabilities description, heartbeat interval, budget range,
rationale. No bash commands. Agent calls request_hire tool with this context.]

## Output Standards
[What good output looks like for this role. What fields decisions must contain.
What makes reasoning acceptable vs generic.]

## What Requires Human Approval
[What goes to decisions table vs what agent does autonomously]
```

- Print: `[TASK 2 COMPLETE] — all instructions files written`

### TASK 3 — Write all database migrations

Write every SQL file in `migrations/`. Full schema in DATABASE SCHEMA section.

Apply with `psql $DATABASE_URL -f migrations/phase1/001_cohorts.sql` etc.
No migration runner — standalone SQL files applied manually.

- Print: `[TASK 3 COMPLETE] — all database migrations written`

### TASK 4 — Write the custom local_llm adapter

`adapter/src/semaphore.ts` — Semaphore class:

```typescript
export class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.permits++;
    }
  }
}
```

`adapter/src/tools.ts` — Tool definitions AND execution:

```typescript
import type { Pool } from 'pg';
import type { paperclipClient as PaperclipClient } from './paperclip-client';

// SQL SELECT-only enforcement — prevents agents from mutating data via query_database.
// Write operations go through dedicated tools (write_decision, log_event) only.
const SQL_READONLY_PATTERN = /^\s*SELECT\b/i;

function assertSelectOnly(sql: string): void {
  if (!SQL_READONLY_PATTERN.test(sql)) {
    throw new Error(
      `query_database only accepts SELECT statements. ` +
      `Received: "${sql.substring(0, 60)}...". ` +
      `Use write_decision or log_event for write operations.`
    );
  }
}

export const TOOL_DEFINITIONS = [
  {
    name: 'request_hire',
    description: 'Request Board approval to hire a new team member. Include the role, capabilities, heartbeat interval, budget, and a substantive rationale explaining why the hire is needed.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        role: { type: 'string' },
        capabilities: { type: 'string' },
        instructionsPath: { type: 'string' },
        heartbeatIntervalSec: { type: 'number' },
        budgetMonthlyCents: { type: 'number' },
        rationale: { type: 'string' },
      },
      required: ['name', 'role', 'capabilities', 'instructionsPath',
                 'heartbeatIntervalSec', 'budgetMonthlyCents', 'rationale'],
    },
  },
  {
    name: 'create_task',
    description: 'Assign a task to another agent in the organization.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        assigneeAgentId: { type: 'string' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'write_decision',
    description: 'Write a recommendation to the decisions table for human staff approval.',
    parameters: {
      type: 'object',
      properties: {
        entityType: { type: 'string' },
        entityId: { type: 'string' },
        department: { type: 'string' },
        recommendation: { type: 'string' },
        reasoning: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['entityType', 'department', 'recommendation', 'reasoning'],
    },
  },
  {
    name: 'query_database',
    description: 'Query the organization database with a SELECT statement. Returns rows as JSON. READ-ONLY — only SELECT statements are permitted.',
    parameters: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'Must be a SELECT statement.' },
        params: { type: 'array', description: 'Parameterized query values ($1, $2, ...)' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'log_event',
    description: 'Write to the events_log audit table.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        entityType: { type: 'string' },
        entityId: { type: 'string' },
        payload: { type: 'object' },
      },
      required: ['type'],
    },
  },
  {
    name: 'create_goal',
    description: 'Create a goal in Paperclip\'s goal hierarchy.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        level: { type: 'string', enum: ['company', 'team', 'agent'] },
        parentId: { type: 'string' },
      },
      required: ['title', 'level'],
    },
  },
];

// executeToolCall — called by adapter for every tool call the LLM makes.
// This is the execution layer. TOOL_DEFINITIONS describes the interface;
// this function performs the actual operations.
export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  db: Pool,
  paperclip: typeof PaperclipClient,
  companyId: string,
  agentId: string,
): Promise<unknown> {
  switch (toolName) {

    case 'query_database': {
      const sql = args.sql as string;
      const params = (args.params as unknown[]) ?? [];
      assertSelectOnly(sql); // Throws if not SELECT — blocks any write attempt
      const result = await db.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount };
    }

    case 'write_decision': {
      const result = await db.query(
        `INSERT INTO decisions
         (entity_type, entity_id, department, agent_role, recommendation, reasoning, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          args.entityType,
          args.entityId ?? null,
          args.department,
          agentId,
          args.recommendation,
          args.reasoning,
          args.data ? JSON.stringify(args.data) : null,
        ]
      );
      return { success: true, decisionId: result.rows[0].id };
    }

    case 'log_event': {
      await db.query(
        `INSERT INTO events_log (type, entity_type, entity_id, payload, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          args.type,
          args.entityType ?? null,
          args.entityId ?? null,
          args.payload ? JSON.stringify(args.payload) : null,
          agentId,
        ]
      );
      return { success: true };
    }

    case 'request_hire': {
      await paperclip.requestHire(companyId, agentId, {
        name: args.name,
        role: args.role,
        capabilities: args.capabilities,
        adapterType: 'local_llm',
        adapterConfig: {
          instructionsFilePath: args.instructionsPath,
          preflightCheck: null,          // Director sets this in hire config if needed
          dynamicSchedule: {
            baseIntervalSec: args.heartbeatIntervalSec,
            maxIntervalSec: (args.heartbeatIntervalSec as number) * 8,
            backoffMultiplier: 2,
            backoffAfterEmptyRuns: 3,
          },
        },
        runtimeConfig: {
          schedule: { enabled: true, intervalSec: args.heartbeatIntervalSec, maxConcurrentRuns: 1 },
          contextMode: 'fat',
        },
        budgetMonthlyCents: args.budgetMonthlyCents,
        rationale: args.rationale,
      });
      return { success: true, message: `Hire request submitted for ${args.name}. Awaiting Board approval.` };
    }

    case 'create_task': {
      const result = await paperclip.createTask(companyId, {
        title: args.title,
        description: args.description,
        assigneeId: args.assigneeAgentId ?? null,
        priority: args.priority ?? 'medium',
        requestedByAgentId: agentId,
      });
      return { success: true, taskId: result.data?.id };
    }

    case 'create_goal': {
      const result = await paperclip.createGoal(companyId, {
        title: args.title,
        description: args.description ?? null,
        level: args.level,
        parentId: args.parentId ?? null,
        ownedByAgentId: agentId,
      });
      return { success: true, goalId: result.data?.id };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
```

`adapter/src/quality.ts` — Automated output scoring:

```typescript
interface QualityScore {
  score: number;            // 0-100
  fieldsComplete: boolean;
  reasoningPresent: boolean;
  entitiesCount: number;
  flags: string[];
}

export function scoreOutput(output: string, agentRole: string): QualityScore {
  const flags: string[] = [];
  let score = 100;

  // Check JSON validity if output contains JSON
  if (output.includes('{') || output.includes('[')) {
    try {
      const jsonMatch = output.match(/```json\n?([\s\S]*?)\n?```|(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (jsonMatch) JSON.parse(jsonMatch[1] || jsonMatch[2]);
    } catch {
      flags.push('json_parse_error');
      score -= 30;
    }
  }

  // Check reasoning is present (not just conclusions)
  if (!output.includes('reason') && !output.includes('because') &&
      !output.includes('due to') && !output.includes('based on')) {
    flags.push('reasoning_absent');
    score -= 20;
  }

  // Check output is not suspiciously short
  if (output.length < 100) {
    flags.push('output_too_short');
    score -= 25;
  }

  // Check for generic filler phrases
  const genericPhrases = ['as mentioned', 'generally speaking', 'it depends',
                          'various factors', 'multiple considerations'];
  const genericCount = genericPhrases.filter(p =>
    output.toLowerCase().includes(p)).length;
  if (genericCount >= 2) {
    flags.push('generic_reasoning');
    score -= 15;
  }

  const entitiesCount = (output.match(/uuid|id":|"id":/gi) || []).length;

  return {
    score: Math.max(0, score),
    fieldsComplete: !flags.includes('json_parse_error'),
    reasoningPresent: !flags.includes('reasoning_absent'),
    entitiesCount,
    flags,
  };
}
```

`adapter/src/schema.ts` — JSON Schema validation for `write_decision` args.
Called inside `executeToolCall` before every `write_decision` INSERT. Prevents
malformed agent outputs (missing `reasoning`, empty `recommendation`, etc.) from
reaching the database. Fails to a quality flag rather than crashing the tool loop.

```typescript
// Required fields and minimum lengths for write_decision args.
// Any violation is returned as { error, flag: 'schema_validation_failed' }
// to the agent so it can self-correct in the next tool call.

interface DecisionArgs {
  entityType: string;
  entityId?: string;
  department: string;
  recommendation: string;
  reasoning: string;
  data?: object;
}

export class DecisionValidationError extends Error {
  constructor(public readonly fields: string[]) {
    super(`write_decision validation failed: ${fields.join('; ')}`);
    this.name = 'DecisionValidationError';
  }
}

export function validateDecisionArgs(args: Record<string, unknown>): DecisionArgs {
  const errors: string[] = [];

  if (typeof args.entityType !== 'string' || args.entityType.trim() === '') {
    errors.push('entityType: required non-empty string');
  }
  if (typeof args.department !== 'string' || args.department.trim() === '') {
    errors.push('department: required non-empty string');
  }
  if (typeof args.recommendation !== 'string' || args.recommendation.trim() === '') {
    errors.push('recommendation: required non-empty string');
  }
  if (typeof args.reasoning !== 'string' || args.reasoning.trim().length < 20) {
    errors.push('reasoning: required string, minimum 20 characters');
  }

  if (errors.length > 0) {
    throw new DecisionValidationError(errors);
  }

  return args as unknown as DecisionArgs;
}
```

In `tools.ts`, import `validateDecisionArgs` and `DecisionValidationError` from `./schema`.
Wrap the `write_decision` case: call `validateDecisionArgs(args)` first. If it throws,
catch `DecisionValidationError` and `return { error: err.message, flag: 'schema_validation_failed' }`
so the agent receives structured feedback rather than an unhandled crash.

`adapter/src/paperclip-client.ts` — Paperclip API calls:

```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: process.env.PAPERCLIP_API_URL ?? 'http://localhost:3100',
  headers: { Authorization: `Bearer ${process.env.PAPERCLIP_API_KEY}` },
  timeout: 30000,
});

export const paperclipClient = {
  async requestHire(companyId: string, agentId: string, payload: Record<string, unknown>) {
    return client.post(`/api/companies/${companyId}/approvals`, {
      type: 'hire_agent',
      requestedByAgentId: agentId,
      payload,
    });
  },
  async createTask(companyId: string, payload: Record<string, unknown>) {
    return client.post(`/api/companies/${companyId}/issues`, payload);
  },
  async createGoal(companyId: string, payload: Record<string, unknown>) {
    return client.post(`/api/companies/${companyId}/goals`, payload);
  },
  async callbackSuccess(runId: string, result: string,
    usage: { inputTokens: number; outputTokens: number }, costUsd: number) {
    return client.post(`/api/heartbeat-runs/${runId}/callback`, {
      status: 'succeeded', result, usage, costUsd,
      model: 'qwen3.6:35b-a3b', provider: 'local_llm',
    });
  },
  async callbackFailure(runId: string, errorMessage: string) {
    return client.post(`/api/heartbeat-runs/${runId}/callback`, {
      status: 'failed', result: errorMessage,
    });
  },
};
```

`adapter/src/index.ts` — Main adapter implementation:

```typescript
import type { ServerAdapterModule, AdapterExecutionContext,
              AdapterExecutionResult } from '@paperclipai/adapter-utils';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { Semaphore } from './semaphore';
import { TOOL_DEFINITIONS, executeToolCall } from './tools';
import { scoreOutput } from './quality';
import { paperclipClient } from './paperclip-client';

const semaphore = new Semaphore(2);
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// --- Dynamic Schedule State ---
// Tracks consecutive empty runs per agent for backoff calculation.
// Persisted in agent_performance table; loaded on each run.
async function getConsecutiveEmptyRuns(agentId: string): Promise<number> {
  const result = await db.query(
    `SELECT COUNT(*) as count FROM agent_performance
     WHERE agent_id = $1
       AND created_at > NOW() - INTERVAL '7 days'
       AND flags @> ARRAY['preflight_skipped']::text[]
     ORDER BY created_at DESC`,
    [agentId]
  );
  // Count consecutive from most recent — stop at first non-empty run
  // Simplified: count recent skips as proxy for consecutive empty
  return parseInt(result.rows[0]?.count ?? '0');
}

// --- Preflight Check ---
// Runs a cheap COUNT query before touching the LLM.
// Returns true if work exists, false if run should be skipped.
async function runPreflightCheck(
  sql: string | null,
  skipIfZero: boolean
): Promise<{ shouldRun: boolean }> {
  if (!sql || !skipIfZero) return { shouldRun: true };
  try {
    const result = await db.query(sql);
    const count = parseInt(result.rows[0]?.count ?? result.rows[0]?.['count(*)'] ?? '1');
    return { shouldRun: count > 0 };
  } catch {
    return { shouldRun: true }; // On preflight error, run anyway
  }
}

// --- Context Window Manager ---
// Trims oldest messages when approaching the context limit.
// Keeps system prompt + first user message + last N exchanges.
const MAX_MESSAGES_BEFORE_TRIM = 16;
const MESSAGES_TO_KEEP_AFTER_TRIM = 8;

function trimContextIfNeeded(
  messages: Array<{ role: string; content: string }>
): Array<{ role: string; content: string }> {
  if (messages.length <= MAX_MESSAGES_BEFORE_TRIM) return messages;
  // Always keep: first message (user context). Trim middle. Keep recent.
  const first = messages[0];
  const recent = messages.slice(-MESSAGES_TO_KEEP_AFTER_TRIM);
  return [
    first,
    { role: 'user', content: '[Earlier conversation trimmed to fit context window]' },
    ...recent,
  ];
}

// --- Retry with Exponential Backoff ---
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      // 5xx = retry. 4xx = don't retry (bad request won't improve).
      if (response.status < 500) throw new Error(`HTTP ${response.status}`);
      lastError = new Error(`llama-server error: ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < maxAttempts) {
      const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

export const localLlmAdapter: ServerAdapterModule = {
  type: 'local_llm',

  async execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
    const { runId, agent, context } = ctx;

    // --- Preflight Check (zero tokens if nothing to do) ---
    const preflightSql = (ctx.config.preflightCheck as { sql?: string; skipIfZero?: boolean } | null);
    if (preflightSql?.sql) {
      const { shouldRun } = await runPreflightCheck(preflightSql.sql, preflightSql.skipIfZero ?? true);
      if (!shouldRun) {
        // Log skip for dynamic schedule backoff tracking
        await db.query(
          `INSERT INTO agent_performance
           (agent_id, run_id, auto_score, fields_complete, reasoning_present,
            entities_count, flags, input_tokens, output_tokens)
           VALUES ($1, $2, 100, true, true, 0, ARRAY['preflight_skipped'], 0, 0)`,
          [agent.id, runId]
        ).catch(() => {});

        // Dynamic backoff: notify Paperclip of suggested next interval
        const dynamicCfg = ctx.config.dynamicSchedule as {
          baseIntervalSec: number; maxIntervalSec: number;
          backoffMultiplier: number; backoffAfterEmptyRuns: number;
        } | null;
        if (dynamicCfg) {
          const emptyRuns = await getConsecutiveEmptyRuns(agent.id);
          if (emptyRuns >= dynamicCfg.backoffAfterEmptyRuns) {
            const newInterval = Math.min(
              dynamicCfg.baseIntervalSec * Math.pow(dynamicCfg.backoffMultiplier,
                Math.floor(emptyRuns / dynamicCfg.backoffAfterEmptyRuns)),
              dynamicCfg.maxIntervalSec
            );
            // TODO: Paperclip API to update agent interval when endpoint is confirmed
            // await paperclipClient.updateAgentInterval(agent.id, newInterval);
            await db.query(
              `INSERT INTO events_log (type, entity_type, entity_id, payload, created_by)
               VALUES ('schedule_backoff', 'agent', $1, $2, 'local_llm_adapter')`,
              [agent.id, JSON.stringify({ newIntervalSec: newInterval, emptyRuns })]
            ).catch(() => {});
          }
        }

        return {
          exitCode: 0, signal: null, timedOut: false,
          summary: 'No pending work. Skipping run to conserve resources.',
          usage: { inputTokens: 0, outputTokens: 0 },
          costUsd: 0,
          model: 'qwen3.6:35b-a3b',
          provider: 'local_llm',
        };
      }
    }

    // --- Reset backoff on productive run (write reset flag after successful run) ---
    // Handled at end of execute via log_event with type='schedule_reset'

    // Load instructions file
    const instructionsPath = (ctx.config.instructionsFilePath as string) ?? '';
    let systemPrompt = '';
    try {
      systemPrompt = readFileSync(join('/app/instructions', instructionsPath), 'utf-8');
    } catch {
      return { exitCode: 1, signal: null, timedOut: false,
               errorMessage: `Instructions file not found: ${instructionsPath}` };
    }

    const userMessage = `Company ID: ${agent.companyId}
Agent ID: ${agent.id}
Agent Name: ${agent.name}
Wake Reason: ${context.wakeReason ?? 'heartbeat'}
Task ID: ${context.taskId ?? 'none'}
Run ID: ${runId}

Review your responsibilities and execute your role. Use the available tools
to query data, write decisions, create tasks, or request hires as needed.`;

    // Acquire semaphore — blocks if 2 requests already in-flight
    await semaphore.acquire();

    let output = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const baseUrl = process.env.LLM_BASE_URL ?? 'http://localhost:9874';

      // Agentic tool-use loop
      let messages: Array<{ role: string; content: string }> = [
        { role: 'user', content: userMessage }
      ];

      let iterationsLeft = 10;
      while (iterationsLeft-- > 0) {
        // Trim context window before each LLM call
        const trimmedMessages = trimContextIfNeeded(messages);

        const response = await fetchWithRetry(
          `${baseUrl}/v1/chat/completions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'qwen3.6:35b-a3b',
              messages: [{ role: 'system', content: systemPrompt }, ...trimmedMessages],
              tools: TOOL_DEFINITIONS,
              tool_choice: 'auto',
              temperature: 0.7,
              max_tokens: 4096,
            }),
            signal: AbortSignal.timeout(870000), // 870s — under the 900s adapter timeout
          }
        );

        const result = await response.json() as {
          choices: Array<{
            message: { role: string; content?: string; tool_calls?: Array<{
              id: string; function: { name: string; arguments: string }
            }> };
            finish_reason: string;
          }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        inputTokens += result.usage?.prompt_tokens ?? 0;
        outputTokens += result.usage?.completion_tokens ?? 0;

        const choice = result.choices[0];
        messages.push({ role: 'assistant', content: choice.message.content ?? '' });
        output += choice.message.content ?? '';

        // No tool calls — agent is done
        if (!choice.message.tool_calls?.length || choice.finish_reason === 'stop') {
          break;
        }

        // Execute tool calls
        for (const toolCall of choice.message.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          const toolResult = await executeToolCall(
            toolCall.function.name, args, db, paperclipClient, agent.companyId, agent.id
          );
          messages.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
          });
        }
      }

    } finally {
      semaphore.release();
    }

    // Automated quality scoring — writes to agent_performance
    const quality = scoreOutput(output, agent.name);

    // Cost: near-zero for local inference (electricity only).
    // Tracked as estimated cloud equivalent for capacity planning.
    // Label clearly so operators understand this is not a real API charge.
    const estimatedCloudEquivalentUsd =
      (inputTokens * 0.000003) + (outputTokens * 0.000015);

    try {
      await db.query(
        `INSERT INTO agent_performance
         (agent_id, run_id, auto_score, fields_complete, reasoning_present,
          entities_count, flags, input_tokens, output_tokens)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [agent.id, runId, quality.score, quality.fieldsComplete,
         quality.reasoningPresent, quality.entitiesCount,
         quality.flags, inputTokens, outputTokens]
      );
    } catch {
      // Don't fail the run if performance logging fails
    }

    // Reset dynamic backoff on productive run
    await db.query(
      `INSERT INTO events_log (type, entity_type, entity_id, payload, created_by)
       VALUES ('schedule_reset', 'agent', $1, $2, 'local_llm_adapter')`,
      [agent.id, JSON.stringify({ runId, resetAt: new Date().toISOString() })]
    ).catch(() => {});

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: output.substring(0, 500),
      usage: { inputTokens, outputTokens },
      costUsd: estimatedCloudEquivalentUsd, // Estimated cloud equivalent — local inference is near-zero actual cost
      model: 'qwen3.6:35b-a3b',
      provider: 'local_llm',
    };
  },

  async testEnvironment(ctx) {
    const checks = [];

    const baseUrl = process.env.LLM_BASE_URL ?? 'http://localhost:9874';
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
      checks.push({ code: 'llm_reachable', level: 'info' as const,
                    message: `llama-server reachable at ${baseUrl} (${res.status})` });
    } catch {
      // llama-server unreachable — notify Board via Paperclip
      checks.push({ code: 'llm_unreachable', level: 'error' as const,
                    message: `Cannot reach llama-server at ${baseUrl}. Board notification required.` });
      // TODO: fire Paperclip approval request of type 'system_alert' when endpoint is confirmed
    }

    if (!ctx.config.instructionsFilePath) {
      checks.push({ code: 'instructions_missing', level: 'error' as const,
                    message: 'instructionsFilePath not configured' });
    }

    return {
      adapterType: 'local_llm',
      status: checks.some(c => c.level === 'error') ? 'fail' : 'pass',
      checks,
      testedAt: new Date().toISOString(),
    };
  },

  models: [{ id: 'qwen3.6:35b-a3b', label: 'Qwen 3.6 35B A3B (local)' }],
  agentConfigurationDoc: `# local_llm adapter\n\nRuns agents via local llama-server.\n\nRequired: instructionsFilePath (path relative to /app/instructions/)\nOptional:\n  preflightCheck: { sql: string, skipIfZero: boolean } — skip LLM if no work\n  dynamicSchedule: { baseIntervalSec, maxIntervalSec, backoffMultiplier, backoffAfterEmptyRuns }`,
};
```

Register adapter in Paperclip's registry:
`server/src/adapters/registry.ts` — add `local_llm: localLlmAdapter`

- `tsc --noEmit` in adapter
- Print: `[TASK 4 COMPLETE] — custom local_llm adapter written`

### TASK 5 — Write setup scripts

Six setup assets. Together they are the complete installation and configuration flow.

---

**`wizard.py`** — Lightweight terminal setup wizard for `org.config.json`.
Users run `python3 wizard.py` to create or update organization identity values
without editing JSON manually. The wizard should:

- Load existing `org.config.json` when present and preserve values by default
- Prompt section-by-section for organization, program, culture, social, and budget fields
- Use privacy-safe generic placeholders, not hardcoded personal names
- Write valid JSON to `org.config.json`
- Exit cleanly on EOF or Ctrl+C

---

**`org.config.json`** — Organization identity file. Users create or update this
via `python3 wizard.py` before running anything. It drives Paperclip company
creation, agent context, and org-profile generation. Write it with these exact
top-level keys:

```json
{
  "org": {
    "name": "Your Organization Name",
    "tagline": "One-line description",
    "mission": "Full mission statement",
    "community_served": "Who you serve",
    "founded_year": "",
    "ein": "",
    "state_of_incorporation": "",
    "fiscal_year_end": "12-31",
    "website": "",
    "email": "",
    "phone": "",
    "address": ""
  },
  "programs": {
    "incubator": {
      "name": "Incubator Program",
      "director_name": "Program Director Name",
      "director_contact": "",
      "score_range": [41, 65],
      "description": "Early-stage founders needing foundational support",
      "cohort_size": "",
      "duration_weeks": "",
      "milestones": [
        "Business registration complete",
        "Business bank account opened",
        "Financial projections drafted",
        "First customer conversation completed",
        "MVP or pilot defined"
      ]
    },
    "accelerator": {
      "name": "Accelerator Program",
      "director_name": "Program Director Name",
      "director_contact": "",
      "score_range": [66, 100],
      "description": "Growth-stage founders ready to scale",
      "cohort_size": "",
      "duration_weeks": "",
      "milestones": [
        "Revenue model validated",
        "First 10 paying customers acquired",
        "Pitch deck finalized",
        "Investor intro calls scheduled",
        "Demo Day presentation ready"
      ]
    }
  },
  "readiness_scoring": {
    "dimensions": [
      { "name": "Problem clarity", "max": 20 },
      { "name": "Solution viability", "max": 20 },
      { "name": "Market understanding", "max": 20 },
      { "name": "Team capability", "max": 20 },
      { "name": "Commitment level", "max": 20 }
    ],
    "thresholds": {
      "reject": [0, 40],
      "incubator": [41, 65],
      "accelerator": [66, 100]
    }
  },
  "culture": {
    "language_primary": "English",
    "language_secondary": "",
    "greetings": {
      "achievement": "",
      "future_plans": "",
      "general_blessing": ""
    },
    "address_male": "",
    "address_female": "",
    "tone": "Warm, respectful, encouraging, and direct",
    "values": []
  },
  "leadership": {
    "founder": "",
    "founder_title": "Executive Director",
    "board": []
  },
  "intake": {
    "primary_channel": "WhatsApp",
    "secondary_channel": "Website application form",
    "language_support": ["English"]
  },
  "social": {
    "twitter": "",
    "instagram": "",
    "linkedin": "",
    "facebook": "",
    "youtube": "",
    "whatsapp_business": ""
  },
  "technology": {
    "platform": "Nonprofit Incubator/Accelerator OS",
    "powered_by": "Paperclip"
  },
  "budget": {
    "fiscal_year": 2025,
    "annual_budget_usd": 0
  },
  "compliance": {
    "nonprofit_type": "501(c)(3)",
    "state_registrations": [],
    "audit_required": false
  }
}
```

---

**`scripts/generate-org-profile.py`** — Reads `org.config.json` and writes
`instructions/shared/org-profile.md`. Called by `setup.sh` before Docker starts
so the file is ready when agents wake. Agents read this file for org context.

```python
#!/usr/bin/env python3
"""
generate-org-profile.py
Reads org.config.json and writes instructions/shared/org-profile.md
Called by setup.sh before docker compose up
"""
import json
import os
from pathlib import Path

def generate():
    config_path = Path('org.config.json')
    if not config_path.exists():
        print("ERROR: org.config.json not found. Run python3 wizard.py before running setup.")
        exit(1)

    with open(config_path) as f:
        c = json.load(f)

    org = c['org']
    programs = c['programs']
    culture = c['culture']
    leadership = c['leadership']
    intake = c['intake']

    incubator = programs['incubator']
    accelerator = programs['accelerator']

    greetings = culture.get('greetings', {})
    values = culture.get('values', [])

    md = f"""# Organization Profile
## Read this file before executing any task.
## All your outputs must reflect this organization's identity, mission, and culture.

---

## Who We Are

**Organization:** {org['name']}
**Tagline:** {org.get('tagline', '')}

**Mission:**
{org['mission']}

**Community Served:**
{org.get('community_served', '')}

**Founded:** {org.get('founded_year', 'Not specified')}
**Website:** {org.get('website', 'Not specified')}
**Email:** {org.get('email', 'Not specified')}

---

## Our Programs

### {incubator['name']}
**Director:** {incubator['director_name']}
**Contact:** {incubator.get('director_contact', 'Not specified')}
**Who it serves:** {incubator['description']}
**Readiness score range:** {incubator['score_range'][0]}–{incubator['score_range'][1]}

**Program milestones:**
{chr(10).join(f"- {m}" for m in incubator.get('milestones', []))}

### {accelerator['name']}
**Director:** {accelerator['director_name']}
**Contact:** {accelerator.get('director_contact', 'Not specified')}
**Who it serves:** {accelerator['description']}
**Readiness score range:** {accelerator['score_range'][0]}–{accelerator['score_range'][1]}

**Program milestones:**
{chr(10).join(f"- {m}" for m in accelerator.get('milestones', []))}

---

## Readiness Scoring

Score founders across these 5 dimensions (20 points each, 100 total):
{chr(10).join(f"- **{d['name']}** — up to {d['max']} points" for d in c['readiness_scoring']['dimensions'])}

Routing thresholds:
- Score 0–40: Reject (not ready — always provide constructive feedback and next steps)
- Score 41–65: {incubator['name']} → Contact {incubator['director_name']}
- Score 66–100: {accelerator['name']} → Contact {accelerator['director_name']}

---

## Leadership

**Founder:** {leadership.get('founder', 'Not specified')}
**Title:** {leadership.get('founder_title', 'Executive Director')}

---

## Communication Culture

**Primary language:** {culture['language_primary']}
{"**Secondary language:** " + culture['language_secondary'] if culture.get('language_secondary') else ""}

**Tone:** {culture.get('tone', 'Professional and warm')}

{"**Cultural greetings:**" if any(greetings.values()) else ""}
{f"- For achievement: {greetings['achievement']}" if greetings.get('achievement') else ""}
{f"- For future plans: {greetings['future_plans']}" if greetings.get('future_plans') else ""}
{f"- General blessing: {greetings['general_blessing']}" if greetings.get('general_blessing') else ""}

{"**Addressing people:**" if culture.get('address_male') or culture.get('address_female') else ""}
{f"- Male founders and staff: {culture['address_male']}" if culture.get('address_male') else ""}
{f"- Female founders and staff: {culture['address_female']}" if culture.get('address_female') else ""}

{"**Organizational values:**" if values else ""}
{chr(10).join(f"- {v}" for v in values)}

---

## Founder Intake

**Primary channel:** {intake.get('primary_channel', 'Website')}
**Secondary channel:** {intake.get('secondary_channel', 'Email')}
**Languages supported:** {', '.join(intake.get('language_support', ['English']))}

---

## How to Use This Profile

- Always refer to the organization by name: **{org['name']}**
- Use the correct program names when routing founders
- Apply the cultural tone and greetings in all founder communications
- Reference the correct director by name when routing or escalating
- Your work serves the mission stated above — keep it in mind always
"""

    output_path = Path('instructions/shared/org-profile.md')
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        f.write(md.strip())

    print(f"  ✓ Generated: {output_path}")
    print(f"  Organization: {org['name']}")

if __name__ == '__main__':
    generate()
```

---

**`scripts/download-model.sh`** — Downloads the LLM model before first run.
Must be run ONCE on a fresh machine before `./setup.sh`. The model is ~20GB
and must be present locally before Docker starts — the setup timeout is too
short to wait for a download.

```bash
#!/bin/bash
# scripts/download-model.sh
# Run ONCE on a fresh machine before ./setup.sh
# Downloads Qwen3.6-35B-A3B to ./models/

set -e
MODELS_DIR="./models"
MODEL_FILE="Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf"
HF_REPO="unsloth/Qwen3.6-35B-A3B-MTP-GGUF"

mkdir -p "$MODELS_DIR"

if [ -f "$MODELS_DIR/$MODEL_FILE" ]; then
  echo "Model already present: $MODELS_DIR/$MODEL_FILE"
  echo "Skipping download."
  exit 0
fi

echo "Downloading $MODEL_FILE (~20GB). This will take a while."
echo "Do not interrupt this download."
echo ""

if command -v huggingface-cli &> /dev/null; then
  echo "Using huggingface-cli..."
  huggingface-cli download "$HF_REPO" "$MODEL_FILE" \
    --local-dir "$MODELS_DIR" \
    --local-dir-use-symlinks False
elif command -v wget &> /dev/null; then
  echo "Using wget..."
  wget -c --progress=bar \
    "https://huggingface.co/$HF_REPO/resolve/main/$MODEL_FILE" \
    -O "$MODELS_DIR/$MODEL_FILE"
elif command -v curl &> /dev/null; then
  echo "Using curl..."
  curl -L --progress-bar -C - \
    "https://huggingface.co/$HF_REPO/resolve/main/$MODEL_FILE" \
    -o "$MODELS_DIR/$MODEL_FILE"
else
  echo "ERROR: Install huggingface-cli, wget, or curl first."
  echo "  pip install huggingface_hub"
  exit 1
fi

echo ""
echo "Model downloaded: $MODELS_DIR/$MODEL_FILE"
echo "You can now run: ./setup.sh"
```

---

**`setup.sh`** — The single entry point. Users run this after configuring
organization identity with `python3 wizard.py` and filling in `.env`. Runs the
org profile generator, then starts
everything.

```bash
#!/bin/bash
# setup.sh
# Usage: ./setup.sh
# Prerequisites: .env filled in,
#                model downloaded via scripts/download-model.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Status subcommand: ./setup.sh status — inspect without running setup
if [ "$1" = "status" ]; then
  source .env 2>/dev/null || true
  echo "=== Incubator OS Setup Status ==="
  [ -f ./models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf ] \
    && echo "  ✓ Model file present" \
    || echo "  ✗ Model file missing — run: bash scripts/download-model.sh"
  TABLES=$(psql "$DATABASE_URL" -tAc \
    "SELECT tablename FROM pg_tables WHERE schemaname='public'" 2>/dev/null)
  for t in cohorts founders ventures milestones mentors matches sessions \
            decisions events_log agent_performance schema_migrations; do
    echo "$TABLES" | grep -q "^${t}$" \
      && echo "  ✓ Table: $t" \
      || echo "  ✗ Table missing: $t"
  done
  COMPANY_ID=$(grep COMPANY_ID .ids 2>/dev/null | cut -d= -f2 || echo "")
  [ -n "$COMPANY_ID" ] \
    && echo "  ✓ Company: $COMPANY_ID" \
    || echo "  ✗ Company not created — run: ./setup.sh"
  CEO_ID=$(grep CEO_ID .ids 2>/dev/null | cut -d= -f2 || echo "")
  [ -n "$CEO_ID" ] \
    && echo "  ✓ Executive Director: $CEO_ID" \
    || echo "  ✗ Executive Director not created"
  curl -sf http://localhost:3100/health > /dev/null 2>&1 \
    && echo "  ✓ Paperclip running" \
    || echo "  ✗ Paperclip not reachable"
  curl -sf http://localhost:9874/health > /dev/null 2>&1 \
    && echo "  ✓ llama-server running" \
    || echo "  ✗ llama-server not reachable"
  exit 0
fi

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║     Nonprofit Incubator/Accelerator OS — Setup       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ ! -f org.config.json ]; then
  echo -e "${YELLOW}org.config.json not found. Launching setup wizard...${NC}"
  python3 wizard.py
fi
python3 -c "import json; json.load(open('org.config.json'))" 2>/dev/null || {
  echo -e "${RED}Error: org.config.json is not valid JSON.${NC}"
  echo "Re-run: python3 wizard.py"
  exit 1
}

ORG_NAME=$(python3 -c "import json; print(json.load(open('org.config.json'))['org']['name'])")

# Check .env exists
if [ ! -f .env ]; then
  echo -e "${RED}Error: .env not found.${NC}"
  echo "Run: cp .env.example .env  then fill in your values."
  exit 1
fi

# shellcheck source=/dev/null
source .env

for var in PAPERCLIP_API_KEY DATABASE_URL; do
  if [ -z "${!var}" ]; then
    echo -e "${RED}Error: $var not set in .env${NC}"; exit 1
  fi
done

# Hardware pre-flight: verify GPU VRAM and CUDA compute capability
echo "  Checking GPU hardware requirements..."
if ! command -v nvidia-smi &> /dev/null; then
  echo -e "${RED}Error: nvidia-smi not found. Install NVIDIA drivers first.${NC}"
  echo "  https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
  exit 1
fi
VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n1 | tr -d ' ')
VRAM_GB=$(( VRAM_MB / 1024 ))
if [ "$VRAM_GB" -lt 24 ]; then
  echo -e "${RED}Error: GPU has ${VRAM_GB}GB VRAM. Minimum required is 24GB.${NC}"
  echo "  qwen3.6:35b-a3b UD-Q4_K_XL requires ~22GB VRAM with --n-cpu-moe 17."
  exit 1
fi
COMPUTE=$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader | head -n1 | tr -d ' ')
COMPUTE_MAJOR=$(echo "$COMPUTE" | cut -d'.' -f1)
if [ "$COMPUTE_MAJOR" -lt 8 ]; then
  echo -e "${YELLOW}Warning: GPU compute capability $COMPUTE detected. Flash Attention requires 8.0+.${NC}"
  echo "  Continuing — llama-server will run without Flash Attention."
fi
echo "  GPU: ${VRAM_GB}GB VRAM, compute $COMPUTE ✓"

# Check model is downloaded
MODEL_FILE="./models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf"
if [ ! -f "$MODEL_FILE" ]; then
  echo -e "${RED}Error: LLM model not found at $MODEL_FILE${NC}"
  echo "Run first: bash scripts/download-model.sh"
  exit 1
fi

echo "  Generating org profile for agents..."
python3 scripts/generate-org-profile.py

echo -e "${YELLOW}[1/5] Starting Docker services...${NC}"
docker compose up -d

echo -e "${YELLOW}[2/5] Waiting for services to be ready...${NC}"
for i in $(seq 1 30); do
  sleep 2
  if docker compose exec -T paperclip wget -qO- http://localhost:3100/health > /dev/null 2>&1; then
    echo "  Paperclip ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo -e "${RED}Timeout waiting for Paperclip. Check: docker compose logs paperclip${NC}"
    exit 1
  fi
  echo "  Waiting... ($((i*2))/60s)"
done

# Model file must already exist locally — run scripts/download-model.sh first.
if [ ! -f ./models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf ]; then
  echo -e "${RED}Error: ./models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf not found.${NC}"
  echo "Run: bash scripts/download-model.sh   (one-time, ~20GB download)"
  exit 1
fi
echo -e "${YELLOW}[3/5] Waiting for llama-server to load model into VRAM (~60-90s)...${NC}"
for i in $(seq 1 24); do
  sleep 5
  if curl -sf http://localhost:9874/health > /dev/null 2>&1; then
    echo "  llama-server ready."
    break
  fi
  if [ "$i" -eq 24 ]; then
    echo -e "${RED}Timeout waiting for llama-server. Check: docker compose logs llm${NC}"
    exit 1
  fi
  echo "  Loading model... ($((i*5))/120s)"
done

echo -e "${YELLOW}[4/5] Applying Phase 1 database migrations...${NC}"
python3 scripts/migrate.py 1

echo -e "${YELLOW}[5/5] Creating company and Executive Director...${NC}"
bash setup/init-company.sh

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║                Setup Complete! ✓                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Paperclip dashboard:  http://localhost:3100"
echo "  Staff UI:             http://localhost:80"
echo ""
echo "Next steps:"
echo "  1. Open Paperclip and approve the Executive Director strategy"
echo "  2. Approve director hire requests as they appear"
echo "  3. Open Staff UI → DataEntry to seed initial data (mentors, compliance items, etc.)"
echo "  4. Your org builds itself from here"
echo ""
echo "Phase 2 when ready:  bash scripts/activate-phase.sh 2"
echo "n8n bridge:          docker compose -f docker-compose.yml -f docker-compose.n8n.yml up -d"
```

---

**`setup/init-company.sh`** — Reads `org.config.json` to create the Paperclip
company with the correct name and mission. Called by `setup.sh`.

```bash
#!/bin/bash
set -e
PAPERCLIP_URL=${PAPERCLIP_API_URL:-http://localhost:3100}

# Read org identity from org.config.json
ORG_NAME=$(python3 -c "import json; print(json.load(open('org.config.json'))['org']['name'])")
ORG_TAGLINE=$(python3 -c "import json; print(json.load(open('org.config.json'))['org']['tagline'])")
ORG_MISSION=$(python3 -c "import json; print(json.load(open('org.config.json'))['org']['mission'])")
ORG_COMMUNITY=$(python3 -c "import json; print(json.load(open('org.config.json'))['org']['community_served'])")

echo "Creating company: $ORG_NAME"

COMPANY=$(curl -sf -X POST "$PAPERCLIP_URL/api/companies" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$ORG_NAME\",
    \"description\": \"$ORG_TAGLINE\",
    \"goal\": \"$ORG_MISSION Serving: $ORG_COMMUNITY\"
  }")
COMPANY_ID=$(echo $COMPANY | python3 -c "import sys,json;print(json.load(sys.stdin)[\"id\"])")
echo "Company ID: $COMPANY_ID"

CEO=$(curl -sf -X POST "$PAPERCLIP_URL/api/companies/$COMPANY_ID/agents" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Executive Director\",
    \"role\": \"ceo\",
    \"title\": \"Executive Director\",
    \"capabilities\": \"Strategic leadership of $ORG_NAME. Builds the organization through sequential director hires approved by the Board. Deep expertise in nonprofit operations, founder development, and community-centered programming.\",
    \"adapterType\": \"local_llm\",
    \"adapterConfig\": {
      \"instructionsFilePath\": \"executive-director.md\",
      \"initialDelaySeconds\": $(( RANDOM % 300 ))
    },
    \"runtimeConfig\": {
      \"schedule\": { \"enabled\": true, \"intervalSec\": 86400, \"maxConcurrentRuns\": 1 },
      \"contextMode\": \"fat\"
    },
    \"budgetMonthlyCents\": 0
  }")
CEO_ID=$(echo $CEO | python3 -c "import sys,json;print(json.load(sys.stdin)[\"id\"])")
echo "Executive Director: $CEO_ID"

echo "COMPANY_ID=$COMPANY_ID" > .ids
echo "CEO_ID=$CEO_ID" >> .ids
echo "ORG_NAME=$ORG_NAME" >> .ids
```

---

**`scripts/activate-phase.sh`** — Activates Phase 2 or Phase 3.

```bash
#!/bin/bash
# Usage: bash scripts/activate-phase.sh 2
PHASE=${1:-2}
source .env

echo "Applying Phase $PHASE migrations..."
python3 scripts/migrate.py "$PHASE"

echo ""
echo "Phase $PHASE migrations applied."
echo "In Paperclip, tell the Executive Director:"
echo "  'Phase $PHASE is ready. Please request Phase $PHASE director hires.'"
```

---

**`scripts/migrate.py`** — Lightweight migration manifest runner (~60 lines).
Replaces the raw `for f in migrations/*.sql; do psql ...` bash loops. Tracks
which migrations have been applied in a `schema_migrations` table so migrations
are never double-applied or silently skipped on re-run.

Called by `setup.sh` as `python3 scripts/migrate.py 1` and by
`scripts/activate-phase.sh` as `python3 scripts/migrate.py "$PHASE"`.

```python
#!/usr/bin/env python3
"""
scripts/migrate.py — Migration manifest runner
Usage: python3 scripts/migrate.py <phase>   (phase = 1, 2, or 3)

Tracks applied migrations in schema_migrations table.
Safe to re-run — already-applied migrations are skipped.
"""
import os
import sys
import glob
import psycopg2

def get_connection():
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL not set in environment.")
        sys.exit(1)
    return psycopg2.connect(url)

def ensure_schema_migrations_table(conn):
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
              id SERIAL PRIMARY KEY,
              filename TEXT NOT NULL UNIQUE,
              applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
    conn.commit()

def get_applied(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT filename FROM schema_migrations ORDER BY filename")
        return {row[0] for row in cur.fetchall()}

def apply_migration(conn, filepath, filename):
    with open(filepath, "r") as f:
        sql = f.read()
    with conn.cursor() as cur:
        cur.execute(sql)
        cur.execute(
            "INSERT INTO schema_migrations (filename) VALUES (%s)",
            (filename,)
        )
    conn.commit()
    print(f"  ✓ {filename}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/migrate.py <phase>")
        sys.exit(1)

    phase = sys.argv[1]
    migration_dir = f"migrations/phase{phase}"
    if not os.path.isdir(migration_dir):
        print(f"ERROR: Directory not found: {migration_dir}")
        sys.exit(1)

    files = sorted(glob.glob(f"{migration_dir}/*.sql"))
    if not files:
        print(f"No .sql files found in {migration_dir}")
        sys.exit(0)

    conn = get_connection()
    ensure_schema_migrations_table(conn)
    applied = get_applied(conn)

    skipped = 0
    for filepath in files:
        filename = os.path.basename(filepath)
        if filename in applied:
            skipped += 1
            continue
        try:
            apply_migration(conn, filepath, filename)
        except Exception as e:
            conn.rollback()
            print(f"  ✗ {filename}: {e}")
            conn.close()
            sys.exit(1)

    conn.close()
    if skipped:
        print(f"  ({skipped} already-applied migration(s) skipped)")
    print(f"Phase {phase} migrations complete.")

if __name__ == "__main__":
    main()
```

The `schema_migrations` table is created automatically on first run — no
separate bootstrap step needed. All 30 migration files remain standalone SQL;
migrate.py is purely a tracking wrapper.

---

- Print: `[TASK 5 COMPLETE] — all setup scripts written including org profile generator, model downloader, and migration manifest runner`

### TASK 6 — Write staff UI

React + Vite + Tailwind. Non-technical program staff never touch Paperclip's
dashboard. This is their interface.

`src/lib/supabase.ts` — Supabase client from env vars.

`src/App.tsx` — Tab navigation. All pages visible based on `VITE_ACTIVE_PHASE`.
Add a persistent critical alert banner at the top that reads from `corrective_actions`
where `escalation_level = 'board'` and `status != 'resolved'`. This always shows
regardless of which page is active.

**Pages to implement:**

`DecisionQueue.tsx` — Realtime subscribe `decisions` where `status='pending'`.
DecisionCard: department badge, entity type, recommendation, reasoning, timestamp.
Approve/Reject → update status, decided_by='staff', decided_at=NOW().
Empty state: "No pending decisions. Your agents are on it."

`CohortDashboard.tsx` — Founders joined ventures. Table: Name, Path badge,
Readiness Score (red<41, amber 41-65, green>65), Stage, At Risk flag.
Click row → inline MilestoneList expand. Filter: All | Incubator | Accelerator | At Risk.

`Reports.tsx` — `events_log` where type IN ('report','quality_report','board_packet')
ORDER BY created_at DESC. Click → modal with dangerouslySetInnerHTML.

`CorrectiveActions.tsx` — `corrective_actions` table. Show open actions grouped
by severity (critical first). Each action: agent name, root cause badge, recommended
action, cycle count, escalation level. "Apply Instructions Update" button for
action_type='update_instructions' — shows suggested_instructions_update in an
editable textarea, staff edits and confirms, system writes updated file.
Board-level escalations highlighted in red at top of page.

`DataEntry.tsx` — Seed forms for domain data that agents need to operate but
cannot create themselves. No agent populates these from scratch — staff does.
Tabs for: Compliance Items (type, due date, recurrence), Board Members (name,
role, term dates), Budget Line Items (fiscal year, category, budgeted amount),
Mentors (name, expertise, program type, availability), Grants (funder, title,
deadline, requirements). Simple forms with validation. Each tab shows existing
records in a read-only table below the form.

`GrantsPipeline.tsx` — grants table, status columns, deadline urgency coloring.

`DonorDashboard.tsx` — donors joined donor_gifts. Summary cards. DonorCard list
with giving tier badge. Filter: All | Active | Lapsed | Major Donors.

`ComplianceDashboard.tsx` — compliance_items ORDER BY due_date. Row color:
red ≤14d, amber ≤30d, green >30d. Mark complete button.

`AlumniNetwork.tsx` — alumni joined founders. Filter by status and success story.

`BoardManagement.tsx` — board_members (flag terms expiring ≤90d) + board_meetings
with action items.

`VolunteerManagement.tsx` — volunteers joined volunteer_assignments.

`InvestorPipeline.tsx` — investors joined investor_introductions. Click investor
→ expand connected founders and intro status.

`ApplicationPipeline.tsx` — application_leads funnel view. Pipeline health indicator.

`Dockerfile` — node:20-alpine build → nginx:alpine serve.

- `vite build`
- Print: `[TASK 6 COMPLETE] — staff UI written`

### TASK 7 — Write webhook handler

WhatsApp → Paperclip task bridge. When a founder messages via WhatsApp,
create a Paperclip task assigned to the Intake Coordinator.

`src/routes/whatsapp.ts`:
- `POST /webhook/whatsapp` — extract phone+message+messageId from Evolution
  payload, create Paperclip task via API, return 200 immediately
- `POST /webhook/whatsapp/reply` — receive `{phone, message}`, send via Evolution

`src/services/evolution.ts` — `sendMessage(phone, message)` via Evolution API
`src/services/paperclip.ts` — `createTask(payload)` via Paperclip API
`Dockerfile` — node:20-alpine

- `tsc --noEmit`
- Print: `[TASK 7 COMPLETE] — WhatsApp webhook handler written`

### TASK 8 — Write n8n bridge (optional extension)

`src/routes/outbound.ts` — `POST /bridge/outbound` receives Paperclip event,
forwards to `N8N_WEBHOOK_URL`.

`src/routes/inbound.ts` — `POST /bridge/inbound` receives n8n result:
`{task_id, status: 'completed'|'failed'|'needs_review', result, trigger_next_agent}`.
Updates Paperclip task status. If `trigger_next_agent=true`, fires next heartbeat.
This is the two-way bridge — Paperclip can act on automation results.

`Dockerfile`
- Print: `[TASK 8 COMPLETE] — n8n bridge written`

### TASK 9 — Write Docker Compose

**`docker-compose.yml`:**

```yaml
version: '3.8'
services:
  paperclip:
    image: paperclipai/paperclip:latest
    ports:
      - "3100:3100"
    volumes:
      - paperclip_data:/data
      - ./instructions:/app/instructions:ro
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - PAPERCLIP_API_KEY=${PAPERCLIP_API_KEY}

  llm:
    image: ghcr.io/ggerganov/llama.cpp:server
    ports:
      - "9874:9874"
    volumes:
      - ./models:/models
    command: >
      -m /models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf
      --ctx-size 32768
      --n-gpu-layers 999
      --n-cpu-moe 17
      --flash-attn on
      --cache-type-k q8_0
      --cache-type-v q8_0
      --batch-size 4096
      --ubatch-size 1024
      --parallel 2
      --queue-size 20
      --temp 0.7
      --top-p 0.8
      --top-k 20
      --presence-penalty 1.5
      --spec-type draft-mtp
      --spec-draft-n-max 6
      --port 9874
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  staff-ui:
    build: ./staff-ui
    ports:
      - "80:80"
    environment:
      - VITE_SUPABASE_URL=${SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - VITE_ACTIVE_PHASE=${ACTIVE_PHASE:-1}

  webhook-handler:
    build: ./webhook-handler
    ports:
      - "3200:3200"
    environment:
      - PAPERCLIP_API_URL=http://paperclip:3100
      - PAPERCLIP_API_KEY=${PAPERCLIP_API_KEY}
      - EVOLUTION_API_URL=${EVOLUTION_API_URL}
      - EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
    depends_on:
      - paperclip

volumes:
  paperclip_data:
```

**`docker-compose.n8n.yml`:**

```yaml
version: '3.8'
services:
  n8n-bridge:
    build: ./extensions/n8n-bridge
    ports:
      - "3300:3300"
    environment:
      - N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL}
      - PAPERCLIP_API_URL=http://paperclip:3100
      - PAPERCLIP_API_KEY=${PAPERCLIP_API_KEY}
```

Users run n8n: `docker compose -f docker-compose.yml -f docker-compose.n8n.yml up`

Validate: `docker compose config`
- Print: `[TASK 9 COMPLETE] — Docker Compose files written`

### TASK 10 — Write Clipmart template

`clipmart-template.json` — Company definition + CEO only.
All other agents grow through organic hiring. Phase 2/3 agents are NOT
pre-configured here — directors request those hires when ready.

```json
{
  "version": "1.0",
  "company": {
    "name": "Nonprofit Incubator & Accelerator",
    "description": "AI-powered operations platform for nonprofit incubator and accelerator programs serving founders from underserved communities.",
    "goal": "Run full-cycle Incubator and Accelerator programs — from founder intake through graduation and alumni success — serving underserved communities with expert mentorship, structured curriculum, funding access, and AI-assisted operations."
  },
  "agents": [
    {
      "name": "Executive Director",
      "role": "ceo",
      "title": "Executive Director",
      "reportsTo": null,
      "capabilities": "Strategic leadership of a nonprofit incubator and accelerator. Oversees all departments. Builds the organization through sequential director hires approved by the Board. Deep knowledge of nonprofit operations, founder development, fundraising, compliance, and community-centered programming.",
      "adapterType": "local_llm",
      "adapterConfig": {
        "instructionsFilePath": "executive-director.md"
      },
      "runtimeConfig": {
        "schedule": {
          "enabled": true,
          "intervalSec": 604800,
          "maxConcurrentRuns": 1
        },
        "contextMode": "fat"
      },
      "budgetMonthlyCents": 0
    }
  ],
  "notes": "After import: (1) Apply Phase 1 migrations, (2) Register local_llm adapter in Paperclip, (3) Start llama-server, (4) docker compose up, (5) Approve CEO strategy, (6) Approve director hire requests as they appear."
}
```

Validate: `node -e "JSON.parse(require('fs').readFileSync('clipmart-template.json','utf8'))"`
- Print: `[TASK 10 COMPLETE] — Clipmart template written`

### TASK 11 — Write README.md

Write a complete, professional README that serves two audiences:
(1) the operator deploying it for their own org, and (2) open source users
installing it on their own machines. Every step must be explicit enough
that a technically capable but non-expert user can follow it without help.

The README must contain these sections in this order:

---

**Header:**
- Project name and one-line description
- Badges: License (MIT), Built on Paperclip, Requires 24GB VRAM

---

**What This Is (2 paragraphs)**
A self-building AI organization that runs a nonprofit incubator and accelerator.
Built on Paperclip. You start with one agent (Executive Director). It hires its
own team. The org operates autonomously — agents run on schedules, make
recommendations, escalate to humans when needed. You are the Board.

---

**How It Works**
```
You run setup.sh once
    ↓
Executive Director wakes → drafts strategy → you approve
    ↓
ED requests director hires → you approve each in Paperclip
    ↓
Directors request worker hires → you approve each
    ↓
Workers run on heartbeat schedules
    ↓
All recommendations flow to Staff UI for your review
```

---

**Architecture Diagram (ASCII — use the diagram from this document)**

---

**Org Structure**
Brief table of all departments, phase they activate, number of roles.

---

**Prerequisites**

Exact versions and links required:

```
Hardware:
  - Server or workstation with NVIDIA GPU — 24GB VRAM minimum (RTX 3090/4090, A5000, etc.)
  - 32GB+ system RAM recommended
  - 100GB+ disk space for model weights

Software:
  - Docker Engine 24.0+ — https://docs.docker.com/engine/install/
  - Docker Compose v2.20+ — included with Docker Desktop
  - NVIDIA Container Toolkit — https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
  - Python 3.8+ (for setup scripts) — https://python.org
  - psql (PostgreSQL client) — https://www.postgresql.org/download/
  - Node.js 20+ and pnpm — https://nodejs.org + https://pnpm.io

Verify GPU access:
  docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu20.04 nvidia-smi
  (should show your GPU — if it fails, check NVIDIA Container Toolkit install)
```

---

**Quick Start — Complete Installation**

```bash
# 1. Clone the repository
git clone https://github.com/your-org/incubator-os.git
cd incubator-os

# 2. Create your organization identity (do this FIRST)
python3 wizard.py

# 3. Fill in technical configuration
cp .env.example .env
nano .env

# 4. Download the LLM model (~20GB — one-time, do before setup)
bash scripts/download-model.sh

# 5. Make scripts executable
chmod +x setup.sh scripts/*.sh setup/*.sh

# 6. Run setup — handles everything else automatically
./setup.sh
```

That's it. `setup.sh` will:
- Start all Docker services
- Wait for Paperclip and llama-server to be ready (model loading takes 3-5 min on first start)
- Apply Phase 1 database migrations
- Create your company and Executive Director in Paperclip
- Print your Paperclip dashboard URL and next steps

---

**After Setup — First Steps**

```
1. Open Paperclip: http://localhost:3100
   → You will see an approval request for the Executive Director's strategy
   → Review and approve it

2. Watch for director hire requests (appears within 24h)
   → You will see hire requests for:
      Director of Finance, Director of Administration,
      Director of Marketing, Director of Incubator Programs,
      Director of Accelerator Programs, Director of Impact & Evaluation
   → Approve each one

3. Open Staff UI: http://localhost:80
   → Use DataEntry to seed initial data your agents need:
      - Compliance items (IRS deadlines, state filings)
      - Board members
      - Budget line items
      - Available mentors
      - Any known grant opportunities

4. Your org builds itself from here.
   Agents wake, do their jobs, write recommendations.
   You review and approve in the Staff UI.
```

---

**Seeding Initial Data**

Agents can only work with data that exists in the database. Before your agents
have useful things to do, add seed data via the Staff UI (DataEntry tab):

| Data Type | Why Agents Need It |
|---|---|
| Mentors | Mentor Coordinator can't match without a roster |
| Compliance items | Compliance Manager monitors these for deadlines |
| Budget line items | Finance Monitor tracks actuals vs budgeted |
| Board members | Board Relations Manager tracks terms and meetings |
| Grant opportunities | Grants Manager monitors deadlines |

Founder data enters automatically via WhatsApp (see WhatsApp Setup below).

---

**Environment Variables Reference**

Full table of every variable in `.env.example` with description and whether
required or optional.

---

**WhatsApp Setup (optional but recommended)**

To enable founder intake via WhatsApp:
1. Set up an Evolution API instance (self-hosted: https://github.com/EvolutionAPI/evolution-api)
2. Fill in `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` in `.env`
3. Point your WhatsApp webhook to: `http://your-server:3200/webhook/whatsapp`
4. Founders message your WhatsApp number → automatically creates a Paperclip task
   for the Intake Coordinator

Without WhatsApp, add founders manually via the Staff UI DataEntry tab.

---

**Activating Phase 2**

Once Phase 1 is stable (all Phase 1 directors hired and operating):

```bash
bash scripts/activate-phase.sh 2
```

Then in Paperclip, tell the Executive Director:
> "Phase 2 is ready. Please request Phase 2 director hires."

Phase 2 adds: HR, IT, Development/Fundraising, External Affairs, Compliance.

---

**Activating Phase 3**

```bash
bash scripts/activate-phase.sh 3
```

Phase 3 adds: Community Engagement, expanded partnerships and investor relations.

---

**Enabling the n8n Automation Bridge (optional)**

For users who want to connect external automations:

```bash
# Start with n8n bridge enabled
docker compose -f docker-compose.yml -f docker-compose.n8n.yml up -d
```

Set `N8N_WEBHOOK_URL` in `.env` to your n8n instance.
The bridge enables: Paperclip → n8n (outbound events) and n8n → Paperclip
(inbound results). Build automation workflows in n8n that respond to org events.

---

**Stopping and Restarting**

```bash
# Stop all services (data preserved)
docker compose down

# Restart
docker compose up -d

# Stop and remove all data (full reset)
docker compose down -v
```

---

**Troubleshooting**

| Problem | Solution |
|---|---|
| `./setup.sh` fails at llama-server | Check GPU: `docker compose logs llm`. Ensure NVIDIA Container Toolkit is installed. |
| Paperclip not reachable | Check: `docker compose logs paperclip` |
| No strategy approval request appears | ED heartbeat is 24h. Wait or restart: `docker compose restart paperclip` |
| Staff UI blank | Check: `docker compose logs staff-ui`. Verify `VITE_SUPABASE_URL` in `.env` |
| Database migration error | Check `psql $DATABASE_URL` is reachable. Migrations are idempotent — safe to re-run. |
| Queue backup / slow agents | Check: `docker compose logs llm`. High load is normal — agents queue and wait. |

---

**Project Structure**
Brief tree of top-level directories with one-line descriptions.

---

**Contributing**
Standard open source contributing section. PRs welcome. Issues for bugs.
Especially welcome: new instructions files for new agent roles, additional
department templates for other nonprofit types.

---

**License**
MIT License. Built on Paperclip (MIT). Model weights are subject to their
own licenses (Qwen3.6 — Apache 2.0).

---

- Print: `[TASK 11 COMPLETE] — README written`

### TASK 12 — Final checks

- `tsc --noEmit` in every TypeScript workspace — fix all errors
- `docker compose config` on both compose files — must validate cleanly
- `node -e "JSON.parse(require('fs').readFileSync('clipmart-template.json','utf8'))"` — must pass
- `node -e "JSON.parse(require('fs').readFileSync('org.config.json','utf8'))"` — must pass
- `python3 -c "import json; json.load(open('org.config.json'))"` — must pass
- `bash -n setup.sh` — syntax check
- `bash -n setup/init-company.sh` — syntax check
- `bash -n scripts/activate-phase.sh` — syntax check
- `bash -n scripts/download-model.sh` — syntax check
- `python3 -m py_compile scripts/generate-org-profile.py` — syntax check
- Run `python3 scripts/generate-org-profile.py` with the template org.config.json
  to verify it generates `instructions/shared/org-profile.md` without errors
- Verify `instructions/shared/org-profile.md` was generated and is non-empty
- Every env var referenced anywhere in the codebase exists in `.env.example`
- Every `instructionsFilePath` in the codebase resolves to a file under `instructions/`
- `setup.sh` has `chmod +x` — is executable
- `scripts/download-model.sh` has `chmod +x` — is executable
- Check that `./instructions` is mounted read-only in `docker-compose.yml`
- Verify docker-compose.yml llm service uses `-m /models/Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf`
  NOT `-hf` (model must be pre-downloaded, not fetched on container start)
- Print a final directory summary:
  ```
  [TASK 12 COMPLETE] — Final checks passed

  Directory is ready to upload to GitHub.

  Contents:
    wizard.py            — terminal wizard for org.config.json
    org.config.json      — generated or updated by the wizard (organization identity)
    instructions/        — [N] agent instructions files
      shared/org-profile.md — generated from org.config.json at setup time
    migrations/          — 30 SQL migrations across 3 phases
    adapter/             — custom local_llm adapter
    staff-ui/            — React staff dashboard (13 screens)
    webhook-handler/     — WhatsApp bridge
    extensions/          — optional n8n bridge
    setup.sh             — one-command installer
    scripts/             — download-model.sh, generate-org-profile.py, activate-phase.sh
    docker-compose.yml + docker-compose.n8n.yml

  To install on any machine:
    git clone <repo>
    python3 wizard.py                 # create or update your org details
    cp .env.example .env && nano .env # fill in technical config
    bash scripts/download-model.sh   # download LLM (~20GB, one-time)
    chmod +x setup.sh
    ./setup.sh
  ```

---

## Instructions Content Guide

Every instructions file follows this professional job description pattern.
The agent is a credentialed professional. Write accordingly.

### executive-director.md

**Who:** CEO of the nonprofit incubator and accelerator. Root of the org chart.
Reports to Board. All Directors report to them.

**Mission:** Build and lead a world-class program empowering founders from
underserved and Muslim communities. Operate sustainably through strong teams,
fundraising, and program delivery.

**On first run:** Draft comprehensive organizational strategy and submit for
Board approval via the `create_goal` and Paperclip strategy approval flow.
Include phase structure, department priorities, and initial hiring plan.

**Phase 1 hiring plan (include in NLP):** Request Directors for: Finance,
Administration, Marketing & Communications, Incubator Programs, Accelerator
Programs, and Impact Quality & Evaluation. For each, describe capabilities,
suggested heartbeat interval, and rationale. No bash — describe this as a
professional would explain a hiring plan. Agent calls `request_hire` tool.

**Phase 2 hiring plan:** When Phase 1 is stable, request Directors for: HR,
IT & Systems, Development/Fundraising, External Affairs, and Compliance.

**Phase 3:** Director of Community Engagement plus scale workers as needed.

**Regular heartbeat:** Review org health summary via database. Check pending
Board approvals. Create tasks for Directors when strategic direction needed.
Escalate to Board when corrective action cycle_count reaches 3 with no resolution.

---

### director-incubator.md / director-accelerator.md

Both follow the same pattern. Director is the department head. They hire their
team. They monitor quality and request headcount when performance degrades.

**Director of Incubator (Program Lead):** Owns full incubator lifecycle. On first
run, request hires for: Intake Coordinator (6h heartbeat), Program Manager (12h),
Mentor Coordinator (24h), Curriculum Developer (24h). Phase 2: Workshop
Facilitator and Founder Success Coach.

**Director of Accelerator (Program Lead):** Owns full accelerator lifecycle. On
first run, request hires for: Program Manager (12h), Mentor Coordinator (24h),
Investor Relations Manager (24h). Phase 2: Pitch Coach and Demo Day Coordinator.

---

### intake-coordinator.md

**Domain expertise:** Venture readiness assessment, founder evaluation, program
path routing. Warm, culturally aware communication.

**Readiness scoring (0-100, 20 pts each):**
- Problem clarity
- Solution viability
- Market understanding
- Team capability
- Commitment level

Score 0-40 → reject with constructive feedback and next steps.
Score 41-65 → Incubator path (Incubator Program Director).
Score 66-100 → Accelerator path (Accelerator Program Director).

**Tone:** Warm, respectful. "Masha'Allah" for genuine achievement.
"Insha'Allah" for future plans. "Br."/"Sr." when name and gender are known.

**Never:** Approve without scoring all 5 dimensions. Route to Accelerator
below 66. Reject without constructive next steps and a path forward.

---

### quality-assurance-manager.md

**Independence:** You report to the Director of Impact, Quality & Evaluation —
not to any department director whose team you evaluate. This independence is
intentional and must be maintained.

**What you evaluate:** Semantic quality of agent outputs. Not just structure —
substance. Is reasoning entity-specific or generic? Is the recommendation
traceable to actual data? Is the output actionable by a human?

**Every heartbeat (daily):** Read `agent_performance` where auto_score < 70
from the last 24 hours. For each flagged run, read the full output from
`events_log`. Use your own reasoning (not string matching) to evaluate:
- Does the reasoning reference specific entities (founder names, IDs, amounts)?
- Is the recommendation different for different entities, or formulaic?
- Could a staff member act on this output, or is it too vague?
Write evaluation findings to `quality_assessments`.

**Role compliance check (weekly):** For each active agent in the org, read their
instructions file and their last 5 outputs from `events_log`. Verify:
- Is the agent operating within its stated role?
- Is it making recommendations outside its defined scope?
- Is it requesting hires that fall outside its reporting chain?
Flag any deviations to the Performance Analyst with specific evidence.

**What you do NOT do:** Make corrective action decisions. That is the
Performance Analyst's role. You flag and document. They diagnose and recommend.

---

### performance-analyst.md

**Role:** You are the diagnostician. You read QA assessments, detect patterns,
determine root causes, recommend corrective actions, and track whether actions
resolved the issue.

**Root cause diagnosis:**
- `instructions_quality` — same thing consistently missing across runs → instructions unclear
- `capacity_overload` — quality degrades as entity count increases → hire needed
- `data_quality` — agent reasoning based on incomplete records → fix upstream data
- `scope_too_wide` — one agent handling two distinct professional functions → split role
- `model_ceiling` — task genuinely exceeds local model capability → escalate to human

**Corrective action authority:**
- Director autonomous (no Board approval): update instructions, reduce scope per run, fix data
- Requires Board approval: hire, pause, terminate agent
- Immediate Board notification: any run below 40, OR cycle_count = 3 with no improvement,
  OR bad decisions being approved upstream

**Escalation chain:**
Worker issue → Director (2 cycles) → ED (2 more cycles) → Board (immediate, final stop)

The Board is the final escalation point. There is no unresolvable state.

---

### scaling-guide.md (shared reference)

Every director and manager instructions file references this guide. Write it as
a standalone professional doctrine document covering:

**Signs of capacity overload:**
Generic reasoning replacing entity-specific analysis. Growing task backlog across
consecutive heartbeats. Missing reasoning sections consistently. An agent producing
the same output regardless of which entities it reviewed.

**Signs of instructions quality issue:**
The same specific field or section consistently missing. Recommendations
consistently outside the defined scope. Quality improves when the task type
changes but degrades on one specific task type.

**Decision framework before requesting a hire:**
First ask: is this an instructions problem? If yes, update instructions and
observe 3 heartbeats before concluding capacity is the issue. If instructions
are clear and quality still degrades with volume, it is a capacity problem.

**Clone vs specialist:**
Clone (same instructions): agent is doing the job well but has too many entities.
Specialist (narrower scope): agent is doing two genuinely different professional
functions. Split the role.

**What not to do:** React after one bad run. Hire to compensate for unclear
instructions. Submit vague hire requests — the Board will not approve them.
Let degradation persist more than 3 heartbeats without action.

---

## Database Schema

### Phase 1

**001_cohorts.sql**
```sql
CREATE TABLE IF NOT EXISTS cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('incubator','accelerator')),
  start_date DATE, end_date DATE,
  status TEXT NOT NULL DEFAULT 'forming'
    CHECK (status IN ('forming','active','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**002_founders.sql**
```sql
CREATE TABLE IF NOT EXISTS founders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, phone TEXT,
  path TEXT CHECK (path IN ('incubator','accelerator')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','graduated','withdrawn','rejected')),
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  readiness_score INTEGER CHECK (readiness_score BETWEEN 0 AND 100),
  at_risk BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**003_ventures.sql**
```sql
CREATE TABLE IF NOT EXISTS ventures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  name TEXT NOT NULL, sector TEXT,
  stage TEXT CHECK (stage IN ('idea','validation','mvp','growth')),
  description TEXT,
  readiness_score INTEGER CHECK (readiness_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**004_milestones.sql**
```sql
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT, due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','overdue')),
  approved_by TEXT, approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**005_mentors.sql**
```sql
CREATE TABLE IF NOT EXISTS mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  expertise TEXT[] NOT NULL DEFAULT '{}',
  program_type TEXT CHECK (program_type IN ('incubator','accelerator','both')),
  bio TEXT,
  availability TEXT CHECK (availability IN ('high','medium','low')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**006_matches.sql**
```sql
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
  program_type TEXT CHECK (program_type IN ('incubator','accelerator')),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','active','completed','terminated')),
  session_count INTEGER NOT NULL DEFAULT 0,
  match_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**007_sessions.sql**
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  notes_ai TEXT, notes_human TEXT,
  outcome TEXT CHECK (outcome IN ('productive','needs_followup','missed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**008_decisions.sql**
```sql
-- Human approval queue. All agent recommendations requiring staff action.
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, entity_id UUID,
  department TEXT NOT NULL, agent_role TEXT NOT NULL,
  recommendation TEXT NOT NULL, reasoning TEXT, data JSONB,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  decided_by TEXT, decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS decisions_status_idx ON decisions(status);
CREATE INDEX IF NOT EXISTS decisions_dept_idx ON decisions(department);
```

**009_events_log.sql**
```sql
-- Append-only audit log and report store.
CREATE TABLE IF NOT EXISTS events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  entity_type TEXT, entity_id UUID,
  payload JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS events_log_type_idx ON events_log(type);
CREATE INDEX IF NOT EXISTS events_log_date_idx ON events_log(created_at DESC);
```

**010_agent_performance.sql**
```sql
-- Written by local_llm adapter after every agent run.
CREATE TABLE IF NOT EXISTS agent_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  auto_score INTEGER NOT NULL CHECK (auto_score BETWEEN 0 AND 100),
  fields_complete BOOLEAN NOT NULL,
  reasoning_present BOOLEAN NOT NULL,
  entities_count INTEGER NOT NULL DEFAULT 0,
  flags TEXT[] NOT NULL DEFAULT '{}',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS perf_agent_idx ON agent_performance(agent_id);
CREATE INDEX IF NOT EXISTS perf_date_idx ON agent_performance(created_at DESC);
CREATE INDEX IF NOT EXISTS perf_score_idx ON agent_performance(auto_score);
```

### Phase 2

**011_grants.sql**
```sql
CREATE TABLE IF NOT EXISTS grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funder TEXT NOT NULL, title TEXT NOT NULL,
  amount_usd INTEGER, deadline DATE, report_due_date DATE,
  status TEXT NOT NULL DEFAULT 'researching'
    CHECK (status IN ('researching','drafting','submitted','awarded','rejected','archived')),
  requirements TEXT, notes TEXT, source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**012_budget_items.sql**
```sql
CREATE TABLE IF NOT EXISTS budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INTEGER NOT NULL, quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
  category TEXT NOT NULL, line_item TEXT NOT NULL,
  budgeted_usd INTEGER NOT NULL DEFAULT 0,
  actual_usd INTEGER NOT NULL DEFAULT 0, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**013_communications.sql**
```sql
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'newsletter','social_post','announcement','donor_update','press_release','founder_message'
  )),
  title TEXT NOT NULL, content TEXT NOT NULL, target_audience TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','approved','rejected','sent')),
  approved_by TEXT, approved_at TIMESTAMPTZ, sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**014_donors.sql**
```sql
CREATE TABLE IF NOT EXISTS donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, phone TEXT,
  giving_tier TEXT CHECK (giving_tier IN ('friend','supporter','champion','major','board')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','lapsed','inactive')),
  first_gift_at DATE, last_gift_at DATE,
  total_given_usd INTEGER NOT NULL DEFAULT 0, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**015_donor_gifts.sql**
```sql
CREATE TABLE IF NOT EXISTS donor_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  amount_usd INTEGER NOT NULL, gift_date DATE NOT NULL,
  gift_type TEXT CHECK (gift_type IN ('one_time','recurring','major','in_kind')),
  campaign TEXT, acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**016_corporate_sponsors.sql**
```sql
CREATE TABLE IF NOT EXISTS corporate_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL, contact_name TEXT, contact_email TEXT,
  sponsorship_level TEXT CHECK (sponsorship_level IN ('bronze','silver','gold','platinum','title')),
  amount_usd INTEGER, benefits_agreed TEXT, benefits_delivered TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('prospecting','active','renewal','lapsed','inactive')),
  contract_start DATE, contract_end DATE, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**017_compliance_items.sql**
```sql
CREATE TABLE IF NOT EXISTS compliance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'irs_990','state_filing','grant_report','board_meeting',
    'policy_renewal','audit','insurance','other'
  )),
  due_date DATE NOT NULL, description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','overdue')),
  assigned_to TEXT, notes TEXT,
  recurrence TEXT CHECK (recurrence IN ('annual','quarterly','monthly','one_time')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS compliance_due_date_idx ON compliance_items(due_date ASC);
```

**018_alumni.sql**
```sql
CREATE TABLE IF NOT EXISTS alumni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  graduation_date DATE NOT NULL, cohort_id UUID REFERENCES cohorts(id),
  program_type TEXT CHECK (program_type IN ('incubator','accelerator')),
  current_status TEXT CHECK (current_status IN ('active','scaling','pivoted','closed','lost_touch')),
  venture_outcome TEXT, revenue_range TEXT, employees_count INTEGER,
  is_success_story BOOLEAN DEFAULT FALSE,
  last_contact_at TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**019_board_members.sql**
```sql
CREATE TABLE IF NOT EXISTS board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('chair','vice_chair','treasurer','secretary','member')),
  committee TEXT, term_start DATE, term_end DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','term_ending','inactive')),
  notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**020_board_meetings.sql**
```sql
CREATE TABLE IF NOT EXISTS board_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('regular','special','annual','committee')),
  quorum_met BOOLEAN, action_items JSONB DEFAULT '[]',
  minutes_url TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**021_volunteers.sql**
```sql
CREATE TABLE IF NOT EXISTS volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, phone TEXT,
  skills TEXT[] DEFAULT '{}',
  availability TEXT CHECK (availability IN ('weekdays','weekends','evenings','flexible')),
  hours_per_week INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','pending')),
  joined_at DATE, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**022_volunteer_assignments.sql**
```sql
CREATE TABLE IF NOT EXISTS volunteer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id UUID NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  role TEXT NOT NULL, department TEXT,
  start_date DATE, end_date DATE, hours_committed INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**023_quality_assessments.sql**
```sql
CREATE TABLE IF NOT EXISTS quality_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_id UUID NOT NULL REFERENCES agent_performance(id),
  agent_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  semantic_score INTEGER CHECK (semantic_score BETWEEN 0 AND 100),
  reasoning_specific BOOLEAN,
  output_actionable BOOLEAN,
  findings TEXT,
  reviewed_by TEXT NOT NULL DEFAULT 'quality-assurance-manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS qa_agent_idx ON quality_assessments(agent_id);
```

**024_corrective_actions.sql**
```sql
CREATE TABLE IF NOT EXISTS corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  quality_assessment_id UUID REFERENCES quality_assessments(id),
  root_cause TEXT NOT NULL CHECK (root_cause IN (
    'instructions_quality','capacity_overload','data_quality',
    'scope_too_wide','model_ceiling','unknown'
  )),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'update_instructions','hire_worker','reduce_scope',
    'fix_data','split_role','pause_agent','escalate_human'
  )),
  action_description TEXT NOT NULL,
  suggested_instructions_update TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('minor','moderate','critical')),
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_level TEXT NOT NULL DEFAULT 'director'
    CHECK (escalation_level IN ('director','executive_director','board')),
  implemented_by TEXT,
  implemented_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','implemented','verified','failed','escalated')),
  outcome TEXT CHECK (outcome IN ('improved','no_change','degraded')),
  verification_run_ids TEXT[],
  cycle_count INTEGER NOT NULL DEFAULT 0,
  instructions_update_count INTEGER NOT NULL DEFAULT 0,
  -- Auto-freeze: if instructions_update_count >= 3 AND instructions_last_updated_at
  -- > NOW() - INTERVAL '14 days', do NOT apply another update_instructions action.
  -- Performance Analyst must escalate to Board instead of attempting another update.
  instructions_last_updated_at TIMESTAMPTZ,
  board_notified_at TIMESTAMPTZ,
  board_notification_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ca_agent_idx ON corrective_actions(agent_id);
CREATE INDEX IF NOT EXISTS ca_status_idx ON corrective_actions(status);
CREATE INDEX IF NOT EXISTS ca_escalation_idx ON corrective_actions(escalation_level);
```

### Phase 3

**025_events.sql**
```sql
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'demo_day','workshop','networking','board_meeting',
    'cohort_kickoff','graduation','fundraiser','community','other'
  )),
  date TIMESTAMPTZ, location TEXT, virtual_link TEXT, description TEXT,
  rsvp_count INTEGER DEFAULT 0, capacity INTEGER,
  logistics_checklist JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning','confirmed','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**026_partnerships.sql**
```sql
CREATE TABLE IF NOT EXISTS partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'university','government','nonprofit','foundation','ecosystem_org','media','other'
  )),
  contact_name TEXT, contact_email TEXT, value_provided TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('prospecting','active','stale','inactive')),
  last_touchpoint_at TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**027_investors.sql**
```sql
CREATE TABLE IF NOT EXISTS investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, firm TEXT, title TEXT,
  focus_areas TEXT[] DEFAULT '{}', stage_preference TEXT[] DEFAULT '{}',
  check_size_min_usd INTEGER, check_size_max_usd INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  last_contact_at TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**028_investor_introductions.sql**
```sql
CREATE TABLE IF NOT EXISTS investor_introductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  founder_id UUID NOT NULL REFERENCES founders(id) ON DELETE CASCADE,
  introduced_at DATE,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','made','meeting_scheduled','passed','invested')),
  notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**029_application_leads.sql**
```sql
CREATE TABLE IF NOT EXISTS application_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT, last_name TEXT, email TEXT, phone TEXT,
  venture_name TEXT, sector TEXT, source TEXT,
  stage TEXT CHECK (stage IN ('identified','contacted','interested','applied')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**030_program_feedback.sql**
```sql
CREATE TABLE IF NOT EXISTS program_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID REFERENCES founders(id) ON DELETE SET NULL,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  program_type TEXT CHECK (program_type IN ('incubator','accelerator')),
  survey_type TEXT NOT NULL CHECK (survey_type IN ('mid_program','end_program','quarterly','exit')),
  nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
  strengths TEXT, improvements TEXT,
  mentor_rating INTEGER CHECK (mentor_rating BETWEEN 1 AND 5),
  program_rating INTEGER CHECK (program_rating BETWEEN 1 AND 5),
  would_recommend BOOLEAN,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Environment Variables

```env
# Paperclip
PAPERCLIP_API_URL=http://localhost:3100
PAPERCLIP_API_KEY=your_paperclip_api_key

# Database (shared — Paperclip and adapter both connect here)
DATABASE_URL=postgresql://user:password@localhost:5432/incubator_os

# LLM (llama-server)
LLM_BASE_URL=http://llm:9874

# Supabase (staff UI realtime subscriptions)
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Staff UI phase display (1, 2, or 3)
ACTIVE_PHASE=1

# WhatsApp (Evolution API)
EVOLUTION_API_URL=https://your-evolution-instance.com
EVOLUTION_API_KEY=your_evolution_api_key
EVOLUTION_INSTANCE_NAME=your_instance_name

# Webhook handler port
WEBHOOK_PORT=3200

# n8n Bridge (optional — only needed with docker-compose.n8n.yml)
N8N_WEBHOOK_URL=http://your-n8n-instance/webhook/paperclip
N8N_BRIDGE_PORT=3300
```

---

## npm Packages Per Workspace

**adapter:** `@paperclipai/adapter-utils`, `pg`, `axios`, `@types/pg` (dev),
`@types/node` (dev), `typescript` (dev)

**staff-ui:** `react`, `react-dom`, `@supabase/supabase-js`,
`@vitejs/plugin-react` (dev), `vite` (dev), `tailwindcss` (dev),
`autoprefixer` (dev), `postcss` (dev), `typescript` (dev),
`@types/react` (dev), `@types/react-dom` (dev)

**webhook-handler:** `fastify`, `@fastify/cors`, `axios`,
`typescript` (dev), `@types/node` (dev)

**extensions/n8n-bridge:** `fastify`, `@fastify/cors`, `axios`,
`typescript` (dev), `@types/node` (dev)

---

## Key Pre-Answered Decisions

| Decision | Answer |
|---|---|
| LLM | qwen3.6:35b-a3b via llama-server |
| Quantization | Unsloth UD-Q4_K_XL |
| LLM server | llama.cpp (llama-server) — NOT Ollama |
| LLM port | 9874 |
| Parallel slots | 2 (--parallel 2) |
| CPU MoE experts | 17 (--n-cpu-moe 17) |
| Context length | 32768 |
| Adapter concurrency | Semaphore(2) |
| Adapter timeout | 900s |
| Paperclip adapter type | local_llm (custom) |
| Instructions format | Pure NLP — no bash, no API syntax |
| Tool calling | Yes — Qwen3.6 native function calling |
| Heartbeat: Intake | 21600s (6h) |
| Heartbeat: Program Manager | 43200s (12h) |
| Heartbeat: daily workers | 86400s (24h) |
| Heartbeat: weekly workers | 604800s (7d) |
| Heartbeat: directors | 172800s (48h) |
| SQL security | SELECT-only via assertSelectOnly() |
| Retry logic | 3 attempts, 2s/4s/8s backoff |
| Context window | Trim at 16 messages, keep 8 recent |
| Preflight check | Per-agent SQL COUNT before LLM call |
| Dynamic backoff | 2x interval after 3 empty runs, up to 8x base |
| Cost tracking | Estimated cloud equivalent — local inference near-zero actual |
| Heartbeat: ED | 86400s Phase 1 → 604800s steady-state |
| Initial heartbeat delay | Random 0-300s per agent |
| Paperclip context mode | fat |
| QA independence | Reports to Director of Impact, not to evaluated departments |
| Escalation: director | auto_score < 60 for 2 consecutive runs |
| Escalation: ED | auto_score < 60 for 4 runs post-corrective-action |
| Board notification | auto_score < 40 any run OR cycle_count = 3 OR downstream damage |
| Board is | Final escalation point — no unresolvable state |
| Incubator contact | Incubator Program Director |
| Accelerator contact | Accelerator Program Director |
| Incubator score | 41-65 |
| Accelerator score | 66-100 |
| Reject score | 0-40 |
| Cultural tone | Masha'Allah, Insha'Allah, Br./Sr. when known |
| Staff UI framework | React + Vite + Tailwind v3 |
| Staff UI auth | None in v1 — TODO comment |
| Package manager | pnpm |
| Node version | 20 |
| Commit style | Conventional commits |
| License | MIT |
| setup status | `./setup.sh status` — checks tables, company, model, services without running full setup |
| Decision output validation | `validateDecisionArgs()` in `adapter/src/schema.ts`; called before every `write_decision` INSERT; fails to quality flag, not crash |
| Migration tracking | `schema_migrations` table + `scripts/migrate.py` manifest runner; replaces raw psql loops; safe to re-run |
| Hardware preflight | `nvidia-smi` VRAM ≥ 24GB + compute capability check in `setup.sh` before model load |
| Instructions freeze | `instructions_update_count` + `instructions_last_updated_at` on `corrective_actions`; auto-freeze at 3 updates/14 days; escalate to Board |
