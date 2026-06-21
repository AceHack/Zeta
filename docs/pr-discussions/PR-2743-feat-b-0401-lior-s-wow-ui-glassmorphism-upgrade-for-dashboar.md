---
pr_number: 2743
title: "feat(081KR7JY10008QG0R001VP6JWG): Lior's WOW UI glassmorphism upgrade for dashboard"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-11T20:06:32Z"
merged_at: "2026-05-11T20:09:24Z"
closed_at: "2026-05-11T20:09:24Z"
head_ref: "feat/wow-ui-dashboard-lior-2026-05-11"
base_ref: "main"
archived_at: "2026-05-11T20:13:05Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #2743: feat(081KR7JY10008QG0R001VP6JWG): Lior's WOW UI glassmorphism upgrade for dashboard

## PR description

Implements the requested Glassmorphism UI for the Zeta static dashboard, utilizing animations, gradients, and Google's Outfit font.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T20:09:54Z)

## Pull request overview

This PR upgrades the `demo/index.html` static dashboard UI to a glassmorphism-style layout with animated background elements, updated typography (Google “Outfit” font), and refreshed card/list styling, while also adjusting the client-side rendering of agents, PR queue, and timeline.

**Changes:**
- Replaces the previous dark dashboard styling with a glassmorphism design (panels, gradients, animations, icons).
- Restructures the dashboard layout (header/status badge, new grid composition, updated list/timeline presentation).
- Updates the dashboard JS (agent mapping tweaks, value animations, reworked HTML rendering, faster refresh interval).

## Review threads

### Thread 1: demo/index.html:523 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:09:52Z):

P1 (accessibility): `<ul id="agent-list">` has a `<div>` child (`loading-state`), which is invalid list markup and can confuse screen readers / CSS list semantics. Use an `<li>` for the loading placeholder, or change the container to a `<div>` if the children aren’t meant to be list items.

### Thread 2: demo/index.html:533 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:09:53Z):

P1 (accessibility): `<ul id="pr-list">` contains a `<div>` loading placeholder, which is invalid inside a list. Use an `<li>` placeholder or switch the container element to match the intended semantics.

### Thread 3: demo/index.html:672 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:09:53Z):

P0 (security): `pr.title` from the GitHub API is interpolated into both `innerHTML` and a `title="..."` attribute without escaping. Titles containing quotes/HTML can break markup and enable XSS. Prefer building DOM nodes with `textContent`/`setAttribute`, or HTML-escape before templating.

### Thread 4: demo/index.html:706 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:09:53Z):

P0 (security): `msg` (commit message) is injected into `innerHTML` and a `title` attribute without escaping. A message containing `<`, `&`, or quotes can lead to HTML/attribute injection (XSS). Build these elements via DOM APIs + `textContent` / safe attribute setting, or escape before concatenation.

### Thread 5: demo/index.html:727 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:09:54Z):

P0 (operational_implications): Refreshing every 2 minutes will exceed unauthenticated GitHub rate limits because each refresh performs 3 API requests (commits + open PRs + closed PRs). This will cause frequent 403/rate-limit failures in normal use. Increase the interval, add authentication, and/or implement rate-limit-aware backoff.

### Thread 6: demo/index.html:48 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:09:54Z):

P2 (accessibility): Continuous animations are enabled by default (e.g., `animation: float …`). Consider honoring `@media (prefers-reduced-motion: reduce)` by disabling/reducing animations and transitions for users who request reduced motion.

### Thread 7: demo/index.html:472 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:09:54Z):

P2 (maintainability): Inline styles (e.g., `style="margin-bottom: 2rem;"`) make styling harder to maintain and reuse. Prefer CSS classes for spacing/layout so changes stay centralized in the stylesheet.

## General comments

### @chatgpt-codex-connector (2026-05-11T20:06:37Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
