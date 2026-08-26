#!/usr/bin/env node
/**
 * Mirrors .agents/ (source of truth) into tool-specific folders:
 * - .claude/skills + .claude/agents  (Claude Code)
 * - .cursor/agents                   (Cursor subagents)
 *
 * Skills stay loaded from .agents/skills for Cursor + Antigravity.
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const srcSkills = path.join(root, '.agents', 'skills')
const srcAgents = path.join(root, '.agents', 'agents')

function rmDir(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name)
    const d = path.join(to, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

function sync() {
  if (!fs.existsSync(srcSkills) || !fs.existsSync(srcAgents)) {
    console.error('Missing .agents/skills or .agents/agents')
    process.exit(1)
  }

  const claudeSkills = path.join(root, '.claude', 'skills')
  const claudeAgents = path.join(root, '.claude', 'agents')
  const cursorAgents = path.join(root, '.cursor', 'agents')

  rmDir(claudeSkills)
  rmDir(claudeAgents)
  rmDir(cursorAgents)

  copyDir(srcSkills, claudeSkills)
  copyDir(srcAgents, claudeAgents)
  copyDir(srcAgents, cursorAgents)

  console.log('Synced .agents → .claude/skills, .claude/agents, .cursor/agents')
}

sync()
