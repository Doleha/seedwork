# System Patterns

## Repository Tree
- .env.example
- .gitignore
- adapter/
  - adapter/node_modules/
  - adapter/package.json
  - adapter/REGISTRY.md
  - adapter/src/
  - adapter/tsconfig.json
- CLAUDE.md
- clipmart-template.json
- CONTEXT.md
- docker-compose.n8n.yml
- docker-compose.yml
- docs/
  - docs/adr/
- extensions/
  - extensions/n8n-bridge/
- instructions/
  - instructions/executive-director.md
  - instructions/nonprofit/
  - instructions/programs/
  - instructions/shared/
  - instructions/standard/
- migrations/
  - migrations/phase1/
  - migrations/phase2/
  - migrations/phase3/
- package.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
- README.md
- scripts/
  - scripts/activate-phase.sh
- setup/
  - setup/init-company.sh
- setup.sh
- staff-ui/
  - staff-ui/dist/
  - staff-ui/Dockerfile
  - staff-ui/index.html
  - staff-ui/nginx.conf
  - staff-ui/node_modules/
  - staff-ui/package.json
  - staff-ui/postcss.config.js
  - staff-ui/src/
  - staff-ui/tailwind.config.js
  - staff-ui/tsconfig.json
  - staff-ui/vite.config.ts
- tsconfig.base.json
- webhook-handler/
  - webhook-handler/Dockerfile
  - webhook-handler/node_modules/
  - webhook-handler/package.json
  - webhook-handler/src/
  - webhook-handler/tsconfig.json

## Runtime And Tooling
- Package: incubator-os
- Package manager: pnpm
- Runtimes: node

## Key Subsystems
- adapter: REGISTRY.md, package.json, src, tsconfig.json
- extensions: n8n-bridge
- instructions: executive-director.md, nonprofit, programs, shared, standard
- migrations: phase1, phase2, phase3
- scripts: activate-phase.sh
- setup: init-company.sh
- staff-ui: Dockerfile, index.html, nginx.conf, package.json, postcss.config.js, src
- webhook-handler: Dockerfile, package.json, src, tsconfig.json

## Common File Clusters
- adapter
- extensions
- instructions
- migrations
- scripts
- setup
- staff-ui
- webhook-handler

## Change Hotspots
- .env.example (1 touches)
- .gitignore (1 touches)
- CLAUDE.md (1 touches)
- README.md (1 touches)
- adapter/REGISTRY.md (1 touches)
- adapter/package.json (1 touches)
- adapter/src/index.ts (1 touches)
- adapter/src/paperclip-client.ts (1 touches)
