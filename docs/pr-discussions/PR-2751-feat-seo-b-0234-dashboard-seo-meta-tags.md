---
pr_number: 2751
title: "feat(seo): 081KQX9B50008QG0R0004N4HNK dashboard SEO meta tags"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-11T20:35:21Z"
merged_at: "2026-05-11T20:54:05Z"
closed_at: "2026-05-11T20:54:05Z"
head_ref: "feat/b-0234-dashboard-seo-meta-tags"
base_ref: "main"
archived_at: "2026-05-11T21:19:49Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #2751: feat(seo): 081KQX9B50008QG0R0004N4HNK dashboard SEO meta tags

## PR description

Implements the presentation side of 081KQX9B50008QG0R0004N4HNK (SEO). Adds meta description, OpenGraph tags, Twitter Cards, and SoftwareApplication JSON-LD to demo/index.html.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T20:38:04Z)

## Pull request overview

Adds SEO/social sharing metadata to the Zeta Factory Dashboard demo page to support 081KQX9B50008QG0R0004N4HNK’s presentation layer goals (search snippets + rich previews).

**Changes:**
- Added `<meta name="description">` for the dashboard page.
- Added OpenGraph + Twitter Card meta tags for richer link previews.
- Added `SoftwareApplication` JSON-LD structured data.

### COMMENTED — @copilot-pull-request-reviewer (2026-05-11T20:46:24Z)

## Pull request overview

Copilot reviewed 1 out of 1 changed files in this pull request and generated 1 comment.

## Review threads

### Thread 1: demo/index.html:21 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:38:02Z):

P1: `og:image` points to `/assets/og-image.png`, but there is no `assets/` directory (or that image) in the repo. This will produce broken OpenGraph previews unless the image is added at that path or the URL is updated to an existing hosted asset.

### Thread 2: demo/index.html:21 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:38:03Z):

P1: Twitter Card meta tags should use `name="twitter:*"` (not `property="twitter:*"`). Using `property` can cause Twitter to ignore these tags, resulting in missing/incorrect card previews.

### Thread 3: demo/index.html:21 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:38:03Z):

P1: `twitter:image` points to `/assets/twitter-card.png`, but that file/path doesn’t exist in this repo. Either add the image at the referenced location or update the URL to an existing hosted asset to avoid broken Twitter previews.

### Thread 4: demo/index.html:13 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:38:03Z):

P1: `og:url`/`twitter:url` are set to the site root (`/Zeta/`), but these tags live on `/demo/index.html` while the root page is just a meta-refresh redirect. Many social crawlers don’t follow meta-refresh, so shares of `/Zeta/` may miss these tags. Consider either updating these URLs to `/Zeta/demo/index.html` or duplicating the meta tags on the root `index.html`.

### Thread 5: demo/index.html:19 (resolved)

**@copilot-pull-request-reviewer** (2026-05-11T20:46:23Z):

P1: `twitter:site` / `twitter:creator` are set to a personal handle (`@AceHack00`), which both misattributes the project after the repo transfer (Pages now under lucent-financial-group.github.io) and violates the repo convention of avoiding named attribution in current-state surfaces. Prefer using an official org/project account if one exists, or omit these tags entirely rather than hard-coding a personal handle.
