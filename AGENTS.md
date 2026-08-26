# AGENTS.md — IronSynk

How humans and coding agents work in this repo.

## Read first

1. [`CLAUDE.md`](./CLAUDE.md) — product, schema, phases, Do Not Do  
2. [`.agents/README.md`](./.agents/README.md) — skills + agents kit  

## Source of truth for automation

| Path | Purpose |
|------|---------|
| `.agents/skills/*/SKILL.md` | Task playbooks (portable Agent Skills) |
| `.agents/agents/*.md` | Role agents (explorer, mobile-dev, api-dev, reviewer, shipper) |

Run after clone or after editing the kit:

```bash
npm run sync-agents
```

This mirrors into `.claude/` (Claude Code) and `.cursor/agents/` (Cursor).

## Who does what

| Role | Use for |
|------|---------|
| `explorer` | Find files / explain structure (read-only) |
| `mobile-dev` | Expo screens & components |
| `api-dev` | Fastify routes, Prisma, shared Zod |
| `reviewer` | Pre-merge review |
| `shipper` | Commits & PRs |

## Non-negotiables

- TypeScript strict, no `any`
- Business logic in API, not mobile
- Zod contracts in `packages/shared`
- API errors: `{ error: { code, message } }`
- No AI features / payments before the phases in `CLAUDE.md` allow them
- Every PR: sync with `main` first — see `.github/PULL_REQUEST_TEMPLATE.md`
