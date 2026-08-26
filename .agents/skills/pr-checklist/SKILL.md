---
name: pr-checklist
description: Prepares IronSynk pull requests with the repo GitHub PR template, including sync-with-main. Use when opening a PR, drafting PR description, or splitting work for review with a teammate.
---

# PR checklist

Official template (auto-fills on GitHub): `.github/PULL_REQUEST_TEMPLATE.md`

## Before opening

1. **Sync with `main`** (required):
   ```bash
   git fetch origin
   git merge origin/main
   # or: git rebase origin/main
   ```
   Resolve conflicts, then re-test.
2. In-phase (`phase-gate`) — no AI/payments sneak-ins
3. Shared Zod updated if API contract changed
4. No secrets in the diff
5. UI matches `design-system` if visible

## PR body

Fill the GitHub template sections:

- **O que mudou** — bullets (what + why)
- **Como testar** — checkboxes
- **Sync com `main`** — both boxes checked
- **Checklist** — secrets / shared / UI / phase
- **Notas** — optional (athlete vs trainer, screenshots)

When using `gh pr create`, pass a body that matches that template (or rely on GitHub’s default form in the UI).

Do not push unless the user asks.
