---
name: mobile-component
description: Builds reusable React Native UI components for IronSynk mobile. Use when creating or refactoring shared components under apps/mobile/src/components or feature-local UI pieces.
---

# Mobile component

## Rules

- PascalCase component, file matches export (`MacroSummary.tsx` → `MacroSummary`)
- Props fully typed; no `any`
- Presentational by default — data fetching stays in screens/hooks
- Follow `design-system` colors/spacing
- Prefer composition over prop explosion

## Placement

| Reused across features | `apps/mobile/src/components/` |
| Feature-only modal/sheet | next to the feature screens (e.g. `screens/nutrition/`) |

## Patterns already in repo

- Cards with surface + border
- Modals for create/edit forms
- Toast for success/error feedback
- Confirm before destructive actions

## Checklist

1. Typed props interface/type
2. StyleSheet or NativeWind consistent with neighbors
3. Accessible hit targets on touchables
4. No direct Prisma/DB concepts — only view models / API types
