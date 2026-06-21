---
id: 081KQZVQW0008QG0R003FXRGQZ
priority: P1
status: closed
closed: 2026-05-07
closed_by: "PR #1875"
title: "Skill: osascript/Chrome authenticated browser content extraction"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: []
decomposition: atomic
owners: [architect, developer-experience-engineer]
---

# 081KQZVQW0008QG0R003FXRGQZ — Skill: osascript/Chrome browser extraction

## What

Create a skill that teaches future sessions how to extract
content from authenticated browser sessions using osascript
with Chrome JavaScript execution instead of fighting Playwright.

## Why

2026-05-07 session wasted 20+ minutes fighting Playwright's
isolated browser before discovering the osascript approach.
The pattern is proven and should be discoverable via the
skill router so future sessions try it first.

## The pattern

1. Kill Playwright Chrome (shadows real Chrome for AppleScript)
2. Verify real Chrome visible to AppleScript
3. Find target tab by URL fragment
4. Extract via chunked JS execution (40KB chunks)
5. Prerequisite: Chrome JS from Apple Events enabled

## Acceptance criteria

- [ ] Skill file at `.claude/skills/browser-extraction/SKILL.md`
- [ ] Pattern documented with copy-paste commands
- [ ] Prerequisite check (JS from Apple Events) included
- [ ] Name-scrubbing step included as standard post-extraction
- [ ] Router description triggers on "extract from browser /
  download conversation / authenticated session"

## Composes with

- Per-user memory: `feedback_osascript_chrome_extraction_skill_candidate_aaron_2026_05_07.md`
- The conversation extractions this session (ChatGPT, Claude.ai ×2, Gemini, DeepSeek ×2)
