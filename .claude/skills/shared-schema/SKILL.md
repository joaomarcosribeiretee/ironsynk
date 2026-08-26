---
name: shared-schema
description: Adds or updates Zod schemas and shared types in packages/shared for IronSynk API and mobile contracts. Use when changing request/response shapes, enums, or any type shared across apps.
---

# Shared schema

## Location

- `packages/shared/src/index.ts` (and splits if the file grows)
- Import as `@ironsynk/shared` from API and mobile

## Pattern

```ts
export const ThingSchema = z.object({ /* ... */ })
export type Thing = z.infer<typeof ThingSchema>

export const CreateThingSchema = z.object({ /* input */ })
export type CreateThingInput = z.infer<typeof CreateThingSchema>
```

## Rules

- Zod is the source of truth for runtime validation + types
- Mirror domain language from Prisma / `CLAUDE.md` (enums, field names)
- Use `z.coerce.date()` when JSON dates are expected
- Keep API and mobile on the same schema versions — change shared first, then both consumers
- No `any`; export both schema and `z.infer` type

## Checklist

1. Add/update schema + type exports
2. Rebuild or ensure workspace resolves `@ironsynk/shared`
3. Update API validators and mobile `api.ts` types/usages
4. Do not silently diverge mobile DTOs from shared
