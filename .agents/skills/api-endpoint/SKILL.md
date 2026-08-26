---
name: api-endpoint
description: Implements Fastify API routes for IronSynk under apps/api with Zod validation, auth middleware, and standard error shape. Use when adding or changing REST endpoints, handlers, or API error responses.
---

# API endpoint

## Stack

- Fastify + TypeScript in `apps/api`
- Prisma via `apps/api/src/lib/prisma.ts`
- Auth: `authMiddleware` + Supabase JWT `Authorization: Bearer`
- Schemas: `@ironsynk/shared` (Zod)
- Routes versioned under `/api/v1/...`

## Error shape (required)

```ts
reply.status(4xx|5xx).send({
  error: { code: 'CODE_NAME', message: 'Human readable' },
})
```

Common codes: `NOT_FOUND`, `FORBIDDEN`, `UNAUTHORIZED`, `VALIDATION_ERROR`, domain codes like `SERVING_UNAVAILABLE`.

## Checklist

1. Add/update Zod schemas in `packages/shared` first (`shared-schema` skill)
2. Create or extend route module under `apps/api/src/routes/<domain>/`
3. Register plugin/routes in the API server bootstrap
4. Validate body/query/params with shared schemas
5. Enforce ownership (load resource → 404 / 403 helpers)
6. Keep handlers thin; put reusable domain logic in `apps/api/src/lib/`
7. No `any`; prefer typed Prisma results + mappers (`*View` helpers)

## Example ownership pattern

```ts
async function loadOwnedPlan(planId: string, userId: string, reply: FastifyReply) {
  const plan = await prisma.nutritionPlan.findUnique({ where: { id: planId } })
  if (!plan) { notFound(reply, 'Nutrition plan not found'); return null }
  if (plan.userId !== userId) { forbidden(reply); return null }
  return plan
}
```

## Anti-patterns

- Business logic only in the mobile app
- Ad-hoc response shapes that break `@ironsynk/shared` types
- Trusting client `userId` instead of auth context
