# Seedwork

**Open-source operating system for nonprofit incubators and accelerators — built on Paperclip, staffed by agents, governed by humans.**

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Built on Paperclip](https://img.shields.io/badge/Built%20on-Paperclip-orange.svg)
![Requires 24GB VRAM](https://img.shields.io/badge/GPU-24GB%20VRAM%20minimum-red.svg)

Quick Start · [Contributing](CONTRIBUTING.md) · [Roadmap](ROADMAP.md) · [Paperclip](https://github.com/paperclipai/paperclip)

---

Start with one Executive Director agent. It drafts strategy, requests director hires, builds departments, and runs ongoing operations on heartbeat schedules. Staff review decisions in a dedicated UI while Paperclip enforces approvals, budgets, and auditability.

This repository packages the domain layer for incubator and accelerator programs: instructions, schema, adapter logic, operator UI, setup flow, and communication bridges. Paperclip remains the control plane underneath.

---

## Architecture Snapshot

```text
Board approvals
   ↓
Paperclip control plane
   ↓
Seedwork domain layer
   ↓
local_llm adapter + Postgres schema + Staff UI + Messaging bridges
```

---

## At A Glance

| Area | What it gives you |
|---|---|
| Organization model | Executive Director, directors, workers, reporting lines, and phased hiring |
| Operating cadence | Scheduled heartbeats, task routing, escalation paths, and approval gates |
| Domain layer | Founder intake, cohorts, ventures, mentors, grants, donors, compliance, alumni, investors |
| Oversight | Decision queue, corrective action tracking, board-level escalation banner, audit logs |
| Local AI stack | `llama-server` + `qwen3.6:35b-a3b` + custom `local_llm` Paperclip adapter |
| Extensibility | Adaptable to other domains through [CLAUDE.md](CLAUDE.md), instructions, schema, and workflows |

---

## What This Is

Seedwork is an open source operations platform for nonprofit incubator and accelerator organizations. It is built natively on top of [Paperclip](https://github.com/paperclipai/paperclip), the same way Supabase is built on top of Postgres. Paperclip is the engine; this repository is the domain implementation.

Although this repository is packaged for a nonprofit incubator and accelerator use case, the same foundation can be adapted for commercial entities and other operating models by changing the domain layer: [CLAUDE.md](CLAUDE.md), agent instructions, shared references, skills, schema, and related workflow definitions.

You start with one agent: the Executive Director. On its first run, it drafts an organizational strategy and submits it for your approval. Once approved, it requests director hires for the initial departments. Each director then builds their own team. Workers run on scheduled heartbeats, process domain data, write recommendations to a decision queue, and escalate when human judgment is required. You are the Board.

The platform covers the full nonprofit operational surface: program delivery (incubator and accelerator tracks), finance, HR, marketing, compliance, fundraising, donor management, alumni relations, investor relations, community engagement, and a continuous quality and performance monitoring system.

---

## Is This Right For You?

- ✅ You want an AI-operated incubator or accelerator with persistent organizational structure.
- ✅ You need agents that run on schedules, escalate to humans, and work through approvals instead of ad hoc prompting.
- ✅ You want a domain layer on top of Paperclip rather than building one from scratch.
- ✅ You want a foundation that can be adapted to other operating models, including commercial entities.
- ❌ You only need a single chatbot or a basic prompt pack.
- ❌ You want a no-code workflow builder with no organizational model.

---

## Problems This Solves

- Founder intake, program routing, and operational follow-up scattered across inboxes and spreadsheets.
- Agent workflows with no org chart, no approval chain, and no persistent accountability.
- Program operations that depend on repeated manual coordination for reporting, matching, compliance, and escalation.
- AI automations that can produce output, but not operate inside a governed organization with roles, budgets, and review paths.

---

## What This Is Not

- Not a generic chatbot frontend.
- Not just a prompt library or agent role pack.
- Not a replacement for Paperclip itself.
- Not limited to nonprofit incubators forever; this repo is a domain implementation, not the underlying control plane.

---

## How It Works

```
You run setup.sh once
        ↓
Executive Director wakes → drafts strategy → you approve in Paperclip
        ↓
ED requests director hires → you approve each in Paperclip
        ↓
Directors request worker hires → you approve each
        ↓
Workers run on heartbeat schedules — doing their jobs
        ↓
All recommendations flow to Staff UI for your review
```

The Board (you) approves every hire. Every agent action traces back to Board approval somewhere in the chain. There is no autonomous action that bypasses you — agents recommend, you decide.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Board (Human — You)                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Approvals
┌──────────────────────────────▼──────────────────────────────────────┐
│                         Paperclip                                   │
│  Org chart · Heartbeat scheduling · Governance · Audit log          │
│  Task routing · Budget enforcement · Session state                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
        ┌──────────────────────┴─────────────────────────┐
        │                                                │
┌───────▼──────────┐                          ┌─────────▼────────────┐
│  local_llm       │                          │  Postgres            │
│  Adapter         │ ◄──── tool calls ──────► │  (domain schema)     │
│  (this project)  │                          │  30 tables, 3 phases │
└───────┬──────────┘                          └──────────────────────┘
        │
        │ HTTP
        ▼
┌───────────────┐     ┌──────────────┐     ┌─────────────────────────┐
│  llama-server │     │  Staff UI    │     │  WhatsApp Bridge        │
│  (qwen3.6     │     │  (React +    │     │  (Evolution API)        │
│   35B local)  │     │   Tailwind)  │     │  Founder → Intake task  │
└───────────────┘     └──────────────┘     └─────────────────────────┘

         Optional:
         ┌────────────────────────────┐
         │  n8n Bridge                │
         │  Paperclip ↔ n8n workflows │
         └────────────────────────────┘
```

---

## Org Structure

| Department | Phase | Roles |
|---|---|---|
| Executive Director | 1 | 1 |
| Finance | 1 | 5 |
| Administration | 1 | 4 (+1 Ph2) |
| Marketing & Communications | 1 | 6 (+1 Ph2) |
| Incubator Programs | 1 | 4 (+2 Ph2) |
| Accelerator Programs | 1 | 3 (+2 Ph2) |
| Impact, Quality & Evaluation | 1 | 4 (+2 Ph2) |
| Human Resources | 2 | 3 |
| IT & Systems | 2 | 2 (+1 Ph3) |
| Development / Fundraising | 2 | 7 (+1 Ph3) |
| External Affairs | 2 | 4 (+1 Ph3) |
| Compliance & Governance | 2 | 2 (+1 Ph3) |
| Community Engagement | 3 | 2 |

**Total: 55+ agent roles across 3 phases**

---

## Prerequisites

```
Hardware:
  - Server or workstation with NVIDIA GPU — 24GB VRAM minimum
    (RTX 3090/4090, A5000, A6000, or equivalent)
  - 32GB+ system RAM recommended
  - 100GB+ disk space for model weights (~28GB for qwen3.6:35b-a3b UD-Q4_K_XL)

Software:
  - Docker Engine 24.0+
    https://docs.docker.com/engine/install/
  - Docker Compose v2.20+ (included with Docker Desktop)
  - NVIDIA Container Toolkit
    https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
  - Python 3.8+ (for setup scripts)
    https://python.org
  - psql (PostgreSQL client)
    https://www.postgresql.org/download/
  - Node.js 20+ and pnpm
    https://nodejs.org + https://pnpm.io
```

**Verify GPU access before starting:**
```bash
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu20.04 nvidia-smi
```
This should display your GPU. If it fails, install or reinstall the NVIDIA Container Toolkit.

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/seedwork.git
cd seedwork

# 2. Run the organization setup wizard FIRST
python3 wizard.py

# 3. Fill in technical config
cp .env.example .env
nano .env   # PAPERCLIP_API_KEY, DATABASE_URL, and other infrastructure values

# 4. Make scripts executable
chmod +x setup.sh scripts/*.sh setup/*.sh

# 5. Download the model (one-time, ~20GB — takes 20-40 min on a typical connection)
bash scripts/download-model.sh

# 6. Run setup — this does everything else
./setup.sh
```

`setup.sh` will:
1. Validate `org.config.json` and generate `instructions/shared/org-profile.md` (every agent reads this)
2. Start all Docker services (Paperclip, llama-server, Staff UI, webhook handler)
3. Wait for Paperclip to be ready (health check, up to 60s)
4. Wait for llama-server to load the local model into VRAM (up to 120s)
5. Apply all Phase 1 database migrations
6. Create your Company and Executive Director in Paperclip using your org config
7. Print your dashboard URL and next steps

> **Note:** `python3 wizard.py` writes `org.config.json`, which is what makes this reusable across organizations.
> Run it before `./setup.sh` — it controls your org name, mission,
> program director contacts, and cultural communication style.
> The model file must also exist locally before running setup (step 5 handles this).

---

## After Setup — First Steps

```
1. Open Paperclip: http://localhost:3100
   → You will see an approval request for the Executive Director's organizational strategy
   → Review the strategy (it covers all 3 phases and the hiring plan)
   → Approve it to unlock the ED's execution

2. Watch for director hire requests (appears within 24h of ED activation)
   → Approve each of the 6 Phase 1 directors:
      Director of Finance
      Director of Administration
      Director of Marketing & Communications
      Director of Incubator Programs
      Director of Accelerator Programs
      Director of Impact, Quality & Evaluation
   → Each director will then request their own team hires (approve those too)

3. Open Staff UI: http://localhost:80
   → Navigate to Data Entry and add seed data your agents need:
      - Compliance items (IRS 990 deadline, state filing dates, insurance renewals)
      - Board members (current board composition and term dates)
      - Budget line items (current fiscal year budget)
      - Available mentors (name, expertise, availability)
      - Known grant opportunities
   → Agents cannot create this foundational data — you seed it once

4. Your org builds itself from here.
   Agents wake on their scheduled heartbeats, process data, write decisions.
   You review and act in the Staff UI and Paperclip.
```

---

## Seeding Initial Data

Agents work with data that exists in the database. Before agents have meaningful work to do, seed these via the Staff UI (Data Entry tab):

| Data Type | Why Agents Need It |
|---|---|
| Mentors | Mentor Coordinator cannot match founders without a roster |
| Compliance items | Compliance Manager monitors deadlines — needs them seeded first |
| Budget line items | Finance staff track actuals vs. budget — needs baseline |
| Board members | Board Relations Manager tracks terms and meeting attendance |
| Grant opportunities | Grant Researcher and Writer need a pipeline to work from |

Founder data enters automatically via WhatsApp (see below) or can be added manually via Data Entry.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PAPERCLIP_API_KEY` | Yes | API key for Paperclip authentication |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LLM_BASE_URL` | No | llama-server URL (default: `http://llm:9874`) |
| `SUPABASE_URL` | Yes | Supabase URL for Staff UI realtime |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key for Staff UI |
| `VITE_SUPABASE_URL` | Yes | Same as SUPABASE_URL (Vite build-time) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Same as SUPABASE_ANON_KEY (Vite build-time) |
| `ACTIVE_PHASE` | No | Staff UI phase display: `1`, `2`, or `3` (default: `1`) |
| `EVOLUTION_API_URL` | Optional | Evolution API URL for WhatsApp integration |
| `EVOLUTION_API_KEY` | Optional | Evolution API key |
| `EVOLUTION_INSTANCE_NAME` | Optional | WhatsApp instance name |
| `WEBHOOK_PORT` | No | Webhook handler port (default: `3200`) |
| `N8N_WEBHOOK_URL` | Optional | n8n webhook URL (only if using n8n bridge) |
| `N8N_BRIDGE_PORT` | No | n8n bridge port (default: `3300`) |

Copy `.env.example` to `.env` and fill in the values.

---

## WhatsApp Setup (optional but recommended)

WhatsApp is the primary intake channel for founders. To enable it:

1. Deploy an Evolution API instance (self-hosted):
   https://github.com/EvolutionAPI/evolution-api

2. Fill in `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` in `.env`

3. Point your WhatsApp webhook to:
   ```
   http://your-server:3200/webhook/whatsapp
   ```

4. When a founder messages your WhatsApp number, the webhook handler automatically creates a Paperclip task assigned to the Intake Coordinator.

Without WhatsApp, add founders manually via the Data Entry tab in the Staff UI.

---

## Activating Phase 2

Once Phase 1 is stable (all 6 Phase 1 directors are hired and have been operating for at least a few cycles):

```bash
bash scripts/activate-phase.sh 2
```

This applies the Phase 2 migrations (grants, donors, compliance, alumni, board, volunteers, quality assessments, corrective actions).

Then in Paperclip, send the Executive Director a task:
> "Phase 2 is ready. Please request Phase 2 director hires."

Phase 2 adds: HR, IT & Systems, Development/Fundraising, External Affairs, Compliance & Governance.

---

## Activating Phase 3

```bash
bash scripts/activate-phase.sh 3
```

This applies the Phase 3 migrations (events, partnerships, investors, investor introductions, application leads, program feedback).

Phase 3 adds: Community Engagement, expanded investor relations, and partnership development.

Update `ACTIVE_PHASE=3` in `.env` to show all Phase 3 pages in the Staff UI.

---

## Enabling the n8n Automation Bridge (optional)

For connecting external automations (Zapier-style workflows):

```bash
# Start with n8n bridge
docker compose -f docker-compose.yml -f docker-compose.n8n.yml up -d
```

Set `N8N_WEBHOOK_URL` in `.env` to your n8n webhook URL.

The bridge provides:
- **Outbound** (`POST /bridge/outbound`): Receives Paperclip events and forwards them to n8n
- **Inbound** (`POST /bridge/inbound`): Receives n8n results and updates Paperclip task status. If `trigger_next_agent: true` is included, fires the next agent in the chain.

---

## LLM Stack

**Model:** `qwen3.6:35b-a3b` — Qwen3.6 35B MoE via llama-server (llama.cpp)
**Quantization:** Unsloth `UD-Q4_K_XL` — best quality/VRAM tradeoff for 24GB
**Why llama.cpp, not Ollama:** Direct control over KV cache quantization, parallel inference slots, Flash Attention, and MTP speculative decoding. No daemon overhead.

**llama-server flags explained:**
- `--parallel 2`: Two simultaneous inference slots for concurrent agents
- `--n-cpu-moe 17`: Offloads 17 MoE experts to CPU, freeing VRAM for 2 parallel slots
- `--flash-attn on`: Reduces VRAM during inference
- `--cache-type-k/v q8_0`: KV cache quantization saves ~1-2GB VRAM
- `--spec-type draft-mtp`: MTP speculative decoding — 1.4-2x speedup at no quality cost
- `--queue-size 20`: Requests queue rather than drop during agent bursts

---

## Performance & QA System

The platform has a three-layer quality monitoring system that runs autonomously:

**Layer 1 — Automated Scoring (adapter):** After every agent run, the adapter scores the output structurally: JSON validity, reasoning presence, output length, generic phrase detection. Writes to `agent_performance` table.

**Layer 2 — QA Manager (semantic):** Runs daily. Reads flagged runs from `agent_performance`, evaluates the substance of reasoning (is it entity-specific? actionable?), writes findings to `quality_assessments`.

**Layer 3 — Performance Analyst (trends):** Runs weekly. Reads both tables. Diagnoses root cause (instructions quality, capacity overload, data quality, scope too wide, model ceiling). Recommends corrective action. Writes to `corrective_actions`.

**Escalation chain:**
- auto_score < 60 for 2 consecutive runs → escalate to Director
- < 60 for 4 runs after corrective action → escalate to Executive Director
- < 40 any run, OR cycle_count = 3 with no improvement, OR bad decisions approved upstream → immediate Board notification (shown in Staff UI critical alert banner)

The Board is the final escalation point. There is no unresolvable state.

---

## Corrective Action Flow

```
QA Manager flags issue → quality_assessments
              ↓
Performance Analyst diagnoses root cause
              ↓
    ┌─────────┴───────────────────────────┐
    │                                     │
 DIRECTOR AUTONOMOUS          REQUIRES BOARD APPROVAL
 (no approval needed)
    │
 - Update instructions        - Hire new worker
 - Reduce scope per run       - Pause agent
 - Fix data quality           - Terminate & re-hire
    │                         - Human escalation
    └──────────┬──────────────────────────┘
               ↓
       Action implemented, logged
               ↓
    QA Manager monitors next 3 runs
               ↓
        ┌──────┴──────┐
     IMPROVED      NO CHANGE
        │              │
    Close action   Escalate one level
                   Dir → ED → Board
```

---

## Stopping and Restarting

```bash
# Stop all services (data is preserved)
docker compose down

# Restart
docker compose up -d

# Full reset — WARNING: destroys all data
docker compose down -v
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `setup.sh` fails at llama-server | Check GPU: `docker compose logs llm`. Ensure NVIDIA Container Toolkit is installed. Model download on first run can take 10-20 min. |
| Paperclip not reachable | `docker compose logs paperclip` — check for startup errors |
| No strategy approval request appears | ED heartbeat is 24h. Wait or trigger manually in Paperclip. |
| Staff UI blank | `docker compose logs staff-ui`. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. |
| Database migration error | Check `psql "$DATABASE_URL"` is reachable. Migrations use `CREATE TABLE IF NOT EXISTS` — safe to re-run. |
| Agents slow / queue backing up | Normal under load. llama-server queues up to 20 requests. Check: `docker compose logs llm`. |
| Board alert banner in Staff UI | A corrective action has been escalated to the Board. Go to Corrective Actions tab and review. |

---

## FAQ

**Is this only for nonprofit incubators and accelerators?**

No. The current repo is packaged for that domain, but the same foundation can be adapted for commercial entities and other operating models by changing the domain layer in [CLAUDE.md](CLAUDE.md), the agent instructions, shared references, workflows, and schema.

**Do I need to edit JSON files manually to get started?**

No. Use `python3 wizard.py` to create or update `org.config.json`, then continue with `.env` setup and `./setup.sh`.

**Does the system run fully autonomously?**

No. Agents operate continuously, but Board-level approvals still flow through you. The system is designed to automate operations while keeping human oversight for hires, key decisions, and escalations.

**Can I contribute new integrations or communication channels?**

Yes. Additional bridges for Slack, Telegram, Discord, and other channels are good contribution targets.

---

## Roadmap

Short roadmap preview:

- ✅ Local `llama-server` adapter with tool-calling support
- ✅ Domain schema and phased SQL migrations
- ✅ Staff-facing React dashboard for decisions, reporting, and corrective actions
- ✅ WhatsApp intake bridge via webhook handler
- ⚪ Slack, Telegram, and Discord messaging bridges
- ⚪ Broader commercial-domain templates beyond incubator/accelerator operations
- ⚪ Authentication and access control hardening for the staff UI
- ⚪ Deployment and infrastructure guides for broader self-hosting scenarios

See the full roadmap in [ROADMAP.md](ROADMAP.md).

---

## Project Structure

```
seedwork/
├── ROADMAP.md          Product and project roadmap
├── instructions/        Agent instructions files (55+ NLP job descriptions)
├── migrations/          SQL migrations (30 files across 3 phases)
├── adapter/             Custom local_llm Paperclip adapter (TypeScript)
├── staff-ui/            Staff-facing React dashboard (13 screens)
├── webhook-handler/     WhatsApp ↔ Paperclip bridge (Fastify)
├── extensions/
│   └── n8n-bridge/     Optional bidirectional n8n automation bridge
├── setup/               Company + CEO initialization script
├── scripts/             Phase activation scripts
├── setup.sh             One-command installer
├── docker-compose.yml   Core stack
├── docker-compose.n8n.yml  Optional n8n extension
├── clipmart-template.json  Paperclip org template (Company + CEO)
└── .env.example         All environment variables with descriptions
```

---

## Development

For the most common development checks:

```bash
pnpm install
pnpm typecheck
pnpm build
python3 -m py_compile wizard.py
python3 -m py_compile scripts/generate-org-profile.py
bash -n setup.sh
```

For contributor workflow details, validation guidance, and project-specific conventions, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Community

- [GitHub Issues](https://github.com/Doleha/seedwork/issues) — bugs and feature requests
- [Pull Requests](https://github.com/Doleha/seedwork/pulls) — active contributions
- [Paperclip](https://github.com/paperclipai/paperclip) — underlying orchestration platform

---

## Contributing

Pull requests are welcome. Areas especially appreciated:

- **New instructions files** for additional agent roles or departments
- **Department templates** for other nonprofit types (food bank, housing org, advocacy)
- **Integration adapters** for other LLM providers
- **Messaging channel bridges** for Slack, Telegram, Discord, and other operator/founder communication surfaces
- **Bug reports** via GitHub Issues

Start with [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, validation commands, PR expectations, and project-specific conventions.

---

## Star History

<a href="https://www.star-history.com/?repos=Doleha%2Fseedwork&type=date&legend=top-left">
 <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Doleha/seedwork&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Doleha/seedwork&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Doleha/seedwork&type=date&legend=top-left" />
 </picture>
</a>

---

## License

MIT License. See [LICENSE](LICENSE).

Built on [Paperclip](https://github.com/paperclipai/paperclip) (MIT).
Model weights: Qwen3.6 35B A3B — Apache 2.0 license. See [Qwen3 license](https://huggingface.co/Qwen/Qwen3-235B-A22B/blob/main/LICENSE) for details.
