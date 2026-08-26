---
name: prisma-change
description: Changes the IronSynk Prisma schema and applies migrations safely. Use when adding models/fields, altering enums, or evolving the database in prisma/schema.prisma.
---

# Prisma change

## Source of truth

- Schema: `prisma/schema.prisma` (see also the model docs in `CLAUDE.md`)
- Do not invent parallel schemas in app code

## Process

1. Confirm the change fits the current product phase (`phase-gate`)
2. Edit `prisma/schema.prisma`
3. Create migration (`npx prisma migrate dev` in the usual project workflow)
4. Update `@ironsynk/shared` Zod schemas if the API contract changes
5. Update API mappers/routes and mobile consumers

## Rules

- Prefer additive, backward-compatible changes when possible
- Indexes / `@@unique` for real query paths (see existing Consultation, Follow, etc.)
- Warmup/feeder sets stay in schema but volume rules stay in API logic
- Never commit secrets; `DATABASE_URL` stays in `.env`

## Anti-patterns

- Editing the DB by hand in production without migrations
- Duplicating enum strings in mobile that disagree with Prisma enums
- Expanding scope into payments/AI (blocked until later phases)
