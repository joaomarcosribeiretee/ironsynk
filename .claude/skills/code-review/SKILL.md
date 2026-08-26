---
name: code-review
description: Reviews IronSynk diffs against TypeScript, API/mobile boundaries, design system, and phase rules. Use when reviewing PRs, checking a teammate's changes, or auditing a diff before merge.
---

# Code review

## Priority order

1. Correctness / data safety (authz, ownership, validation)
2. Contract drift (`@ironsynk/shared` vs API vs mobile)
3. Architecture (logic in API, not mobile)
4. TypeScript strictness (no `any`)
5. UI clarity (`design-system`, minimalism)
6. Phase / Do Not Do violations

## Checklist

- Error responses use `{ error: { code, message } }`
- Routes protected where needed; ownership enforced
- Zod schemas shared; no duplicate ad-hoc types
- Naming: `kebab-case` files, `PascalCase` components, `camelCase` functions
- Warmup/feeder not counted as volume if touch workouts
- No hardcoded secrets

## Comment style

- One finding per comment: location → problem → fix
- Prefer actionable suggestions over style nits unless they hurt clarity
- Call out blockers vs nits

## Output

Summarize: **blockers**, **should-fix**, **nits**. Do not rewrite the whole PR unless asked.
