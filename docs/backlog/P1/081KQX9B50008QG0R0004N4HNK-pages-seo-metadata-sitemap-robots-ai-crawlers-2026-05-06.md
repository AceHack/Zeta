---
id: 081KQX9B50008QG0R0004N4HNK
priority: P1
status: open
title: "GitHub Pages discoverability - SEO metadata, sitemap, robots, and AI crawler access"
created: 2026-05-06
last_updated: 2026-05-08
parent: 081KQGDBJ0008QG0R002NV04N9
depends_on: [081KQX9B50008QG0R001J6ARGX, 081KQX9B50008QG0R0001XDTDQ]
classification: blocked-on-pages-content
decomposition: decomposed
children: [081KR2E4K0008QG0R0028VW6B3, 081KR2E4K0008QG0R0037MW8ET]
type: friction-reducer
---

# 081KQX9B50008QG0R0004N4HNK - SEO metadata and crawler access

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

- `081KR2E4K0008QG0R0028VW6B3` owns per-page SEO metadata, canonical URLs, social
  preview cards, and JSON-LD.
- `081KR2E4K0008QG0R0037MW8ET` owns sitemap, robots, and AI-agent crawler policy.
