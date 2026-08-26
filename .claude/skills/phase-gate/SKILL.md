---
name: phase-gate
description: Checks IronSynk development phase and Do Not Do rules before building features. Use before large features, new domains, AI, payments, or when unsure if work is in scope.
---

# Phase gate

Read `CLAUDE.md` → **Development Phases** and **Do Not Do** before implementing.

## Phases

| Phase | Focus |
|-------|--------|
| 0 | Foundation |
| 1 | Auth & Profile |
| 2 | Workouts Core |
| 3 | Nutrition Core |
| 4 | Consultancy |
| 5 | Social |
| 6A / 6B | Gamification |
| 7 | Launch polish |

`CLAUDE.md` may say "Current phase" — treat product reality in the repo as stronger if they disagree, but still respect hard blocks below.

## Hard blocks (Do Not Do)

- No AI features before Phase 7 is complete
- No payments before MVP is validated
- No business logic in the mobile app (belongs in API)
- No skipping TypeScript types
- No overcrowded UI

## Agent behavior

1. State which phase the requested work belongs to
2. If blocked or premature, say so and propose the smallest in-phase alternative
3. Prefer simplest working solution over speculative architecture
