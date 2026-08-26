---
name: conventional-commit
description: Writes IronSynk conventional commit messages from git diffs. Use when the user asks to commit, draft a commit message, or summarize staged changes for git.
---

# Conventional commit

## Format

```
type: short imperative summary
```

Types: `feat`, `fix`, `chore`, `refactor`, `style`, `docs`, `test`, `perf`

Optional scope when useful: `feat(nutrition): ...`, `fix(api): ...`

## Rules

- Subject focuses on **why** / user impact, not file laundry lists
- 1–2 short sentences in body only if the why is not obvious
- Never commit `.env`, secrets, or credentials
- Only commit when the user asks
- Follow the repo's existing history style (sometimes `@ feat:` — prefer clean `feat:` for new commits unless matching a local convention the user wants)

## Process

1. `git status` / `git diff` / recent `git log`
2. Stage relevant files only
3. Commit with HEREDOC-style message
4. Verify with `git status`

Do not push unless explicitly asked.
