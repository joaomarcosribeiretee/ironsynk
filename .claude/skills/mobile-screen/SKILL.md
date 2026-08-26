---
name: mobile-screen
description: Creates or updates Expo React Native screens in apps/mobile with navigation, TanStack Query, and IronSynk patterns. Use when adding a screen, wiring navigation, or building a user flow in the mobile app.
---

# Mobile screen

## Stack

- Expo + React Native + TypeScript
- Navigation: React Navigation v6 (`AppNavigator`, tab navigators)
- Server state: TanStack Query
- Client state: Zustand (`authStore`, `sessionStore`, …)
- API: `apps/mobile/src/lib/api.ts`

## Where things go

| Kind | Path |
|------|------|
| Tab / app screens | `apps/mobile/src/screens/app/` |
| Auth | `apps/mobile/src/screens/auth/` |
| Workout | `apps/mobile/src/screens/workout/` |
| Nutrition | `apps/mobile/src/screens/nutrition/` |
| Trainer | `apps/mobile/src/screens/trainer/` |
| Navigators | `apps/mobile/src/navigation/` |

## Checklist

1. Register route in the correct navigator + param list types
2. Fetch with `useQuery` / mutate with `useMutation` + invalidate keys
3. Reuse `showToast`, `ConfirmModal`, `ActionSheet` patterns
4. Pad scroll content with `useFloatingTabBarInset()` on tab screens
5. No business rules in the screen — call API; logic lives in `apps/api`
6. Apply `design-system` tokens
7. File name: `SomethingScreen.tsx`; export named `SomethingScreen`

## Anti-patterns

- Hardcoding API base URLs or secrets
- Duplicating Zod/types that belong in `@ironsynk/shared`
- Giant screens — extract presentational pieces to `components/` or feature folders
