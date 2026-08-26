# IronSynk — Agents & Skills

Shared playbooks for Cursor, Claude Code, and Antigravity.
**Source of truth:** this folder (`.agents/`). Commit it. Keep standards here, not in personal settings.

## Layout

```
.agents/
├── skills/     # how to do a task (Agent Skills standard)
└── agents/     # who does the task (specialized roles)
```

## Tool wiring

| Tool | Skills | Agents |
|------|--------|--------|
| Cursor | reads `.agents/skills/` natively | sync → `.cursor/agents/` |
| Antigravity | reads `.agents/skills/` natively | use skills + `CLAUDE.md` / `AGENTS.md` |
| Claude Code | sync → `.claude/skills/` | sync → `.claude/agents/` |

After cloning or editing skills/agents:

```bash
npm run sync-agents
```

## Quick map

**Skills:** `design-system` · `mobile-screen` · `mobile-component` · `api-endpoint` · `shared-schema` · `prisma-change` · `phase-gate` · `conventional-commit` · `pr-checklist` · `code-review`

**Agents:** `explorer` · `mobile-dev` · `api-dev` · `reviewer` · `shipper`

## Workflow

1. `explorer` — find where to change  
2. `mobile-dev` / `api-dev` — implement  
3. `reviewer` — check against IronSynk rules  
4. `shipper` — commit / PR  

Always read `CLAUDE.md` for product truth (phases, schema, Do Not Do).
