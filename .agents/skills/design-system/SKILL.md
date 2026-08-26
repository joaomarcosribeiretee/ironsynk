---
name: design-system
description: Applies IronSynk visual design tokens, NativeWind/styling patterns, and minimalist UI rules. Use when building or restyling screens, components, buttons, cards, gradients, typography, or colors in the mobile app.
---

# IronSynk design system

## Tokens

| Token | Value |
|-------|-------|
| Primary Cyan | `#4FC3F7` |
| Primary Blue | `#2979FF` |
| Primary Deep | `#1A237E` |
| Background | `#141418` |
| Surface | `#1E1E24` |
| Border | `#2A2A35` |
| Text primary | `#F0F0F5` |
| Text secondary | `#8A8A9A` |
| Text disabled | `#4A4A5A` |
| Success | `#00E676` |
| Warning | `#FFB300` |
| Error | `#FF5252` |

Brand gradient: `135deg, #4FC3F7 → #2979FF → #1A237E` (logo, primary CTAs, badges).

## UI rules

- Dark, modern, minimal — powerful under the hood, clean on the surface
- Border radius 12–16
- Icons: outline (Lucide / Ionicons outline style)
- Motion 200–300ms; subtle blue glow, never heavy shadows
- Cards: surface `#1E1E24` + subtle border
- Do not overload screens — one clear job per view
- Prefer existing components before inventing new chrome

## Typography

- Titles: Inter Bold (700–800)
- Body: Inter Regular (400–500)
- Stats/numbers: tabular / mono when available

## Before shipping UI

- Matches athlete vs trainer context if relevant
- Works with floating tab bar insets when on tab screens
- No purple-on-white generic AI look; stick to IronSynk cyan/blue/deep palette
