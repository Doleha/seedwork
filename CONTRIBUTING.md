# Contributing

Thanks for contributing to Incubator/Accelerator OS.

This project combines several different contribution surfaces in one repository:
- agent instructions written as NLP role documents
- a TypeScript adapter and integration services
- a React staff dashboard
- SQL migrations and setup scripts

The fastest way to make a useful contribution is to stay within the existing patterns for the part of the system you are changing.

## Before You Start

- Read [README.md](README.md) for the product and deployment model.
- Check the shared agent references in [instructions/shared/database-reference.md](instructions/shared/database-reference.md), [instructions/shared/tools-reference.md](instructions/shared/tools-reference.md), and [instructions/shared/scaling-guide.md](instructions/shared/scaling-guide.md) before editing role instructions.
- Keep contributions focused. Avoid bundling unrelated cleanup with feature work.
- Do not introduce real personal data, private contacts, or organization-specific names into checked-in defaults, examples, or docs.

## Ways To Contribute

- Fix bugs in the adapter, webhook handler, n8n bridge, or staff UI.
- Improve setup and deployment tooling.
- Add or refine agent instructions files.
- Add new nonprofit department templates or role sets.
- Improve schema, migrations, or reporting flows.
- Improve documentation, onboarding, and operator guidance.

## Development Setup

1. Install Node.js 20+, pnpm, Python 3.8+, and the other prerequisites listed in [README.md](README.md).
2. Install workspace dependencies:

```bash
pnpm install
```

3. Create local configuration when needed:

```bash
python3 wizard.py
cp .env.example .env
```

4. For full-stack local setup, follow the installation flow in [README.md](README.md).

## Project Structure

- [adapter](adapter): custom `local_llm` Paperclip adapter
- [staff-ui](staff-ui): React/Vite operator dashboard
- [webhook-handler](webhook-handler): WhatsApp bridge
- [extensions/n8n-bridge](extensions/n8n-bridge): optional n8n bridge
- [instructions](instructions): agent role instructions and shared references
- [migrations](migrations): SQL schema by phase
- [scripts](scripts): install and activation helpers

## Contribution Workflow

1. Fork the repository and create a focused branch.
2. Make the smallest change that solves the issue at the root cause.
3. Validate only the surfaces you touched, then run broader checks if needed.
4. Update documentation when operator behavior, setup, or conventions change.
5. Open a pull request with a clear problem statement, change summary, and validation notes.

## Validation

Run the narrowest relevant checks first.

### Workspace-level

```bash
pnpm typecheck
pnpm build
```

### Package-level examples

```bash
pnpm --filter @incubator-os/adapter typecheck
pnpm --filter @incubator-os/staff-ui build
```

### Scripts and config

```bash
bash -n setup.sh
bash -n setup/init-company.sh
bash -n scripts/activate-phase.sh
bash -n scripts/download-model.sh
python3 -m py_compile wizard.py
python3 -m py_compile scripts/generate-org-profile.py
python3 -c "import json; json.load(open('org.config.json'))"
python3 scripts/generate-org-profile.py
```

### Compose and JSON validation

```bash
docker compose config
docker compose -f docker-compose.yml -f docker-compose.n8n.yml config
node -e "JSON.parse(require('fs').readFileSync('clipmart-template.json','utf8'))"
```

If your change touches UI behavior, include a brief manual smoke check summary in the pull request.

## Instructions File Guidelines

Instructions files are not code comments or shell scripts. They are professional NLP job descriptions that become system prompts.

- Write in a clear operational voice.
- Keep responsibilities concrete and role-specific.
- Do not include bash commands, curl commands, or Paperclip API syntax.
- Reference shared files instead of duplicating doctrine when possible.
- Preserve the role structure already used across the repo:
  `Who You Are`, `Your Mission`, `Your Domain Expertise`, `Your Responsibilities`, and related sections where applicable.

When adding a new role, make sure the reporting line, scope, and escalation path are explicit.

## Schema And Migration Guidelines

- Add new migrations instead of rewriting applied migration history.
- Keep migrations idempotent where practical with `IF NOT EXISTS` patterns consistent with the repo.
- Update shared references or operator docs when schema changes affect agent behavior or setup.
- Do not mix unrelated schema changes into one migration.

## Documentation Guidelines

- Keep examples privacy-safe and generic.
- When setup behavior changes, update both [README.md](README.md) and [CLAUDE.md](CLAUDE.md) if the spec or build brief changed.
- Prefer explicit operator instructions over implied knowledge.

## Pull Request Expectations

Include these in your PR description:

- what problem you are solving
- what changed
- how you validated it
- any follow-up work or known limitations

Good PRs in this repo are small, testable, and easy to review.

## Code Style

- Follow the existing style in the touched package.
- Prefer minimal, focused changes over broad refactors.
- Keep ASCII-only content unless the file already relies on non-ASCII text.
- Do not add dependencies unless they are clearly justified.

## Questions And Proposals

- Open an issue for bugs, regressions, or unclear behavior.
- Open a discussion or issue before large structural changes, new platform integrations, or major schema changes.
- For new department templates or large instruction sets, include a short rationale for how they fit the Paperclip operating model.