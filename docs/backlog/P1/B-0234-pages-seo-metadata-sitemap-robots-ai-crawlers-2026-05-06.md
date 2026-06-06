---
id: B-0234
zetaid: 081KQX9B50008QG0R0004N4HNK
priority: P1
status: open
title: "GitHub Pages discoverability - SEO metadata, sitemap, robots, and AI crawler access"
created: 2026-05-06
last_updated: 2026-05-08
parent: B-0154
depends_on: [B-0232, B-0233]
classification: blocked-on-pages-content
decomposition: decomposed
children: [B-0284, B-0285]
type: friction-reducer
---

# B-0234 - SEO metadata and crawler access

Make the Pages site legible to search engines, link-preview
surfaces, and AI-agent crawlers.

## Work scope

This row owns page titles, descriptions, canonical URLs, Open
Graph, Twitter Card metadata, JSON-LD structured data,
`sitemap.xml`, `robots.txt`, and explicit AI-agent crawler
allow-listing.

## Acceptance criteria

- Each public page has title, description, canonical URL, and
  social preview metadata.
- `sitemap.xml` and `robots.txt` are published and reachable.
- AI-agent crawler policy is explicit and matches the
  discoverability goal.
- JSON-LD is present where it helps agents parse the content.

## Decomposition

- `B-0284` owns per-page SEO metadata, canonical URLs, social
  preview cards, and JSON-LD.
- `B-0285` owns sitemap, robots, and AI-agent crawler policy.
