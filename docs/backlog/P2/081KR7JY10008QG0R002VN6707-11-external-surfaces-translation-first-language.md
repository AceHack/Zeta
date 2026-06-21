---
id: 081KR7JY10008QG0R002VN6707
priority: P2
status: open
title: "081KR7JY10008QG0R002VN6707 — External-facing surfaces translation — first language (NuGet metadata, GitHub description, README)"
created: 2026-05-10
last_updated: 2026-05-10
parent: 081KQ0YZ80008QG0R002HWBHKJ
depends_on: [081KR7JY10008QG0R001XQ6N71]
classification: blocked
type: feature
effort: XS
decomposition: atomic
---

# 081KR7JY10008QG0R002VN6707 — External-facing surfaces translation — first language

**Slice of:** [081KQ0YZ80008QG0R002HWBHKJ](081KQ0YZ80008QG0R002HWBHKJ-translate-repo-to-other-human-languages.md)  
**Depends on:** 081KR7JY10008QG0R001XQ6N71 (folder structure + index formalized; structure doc is the reference for provenance footers)

## What

Translate the external-facing surfaces that are the *first contact point* for a non-English speaker discovering Zeta:

1. **README.md** — translate the top-level README to first language, place at `docs/i18n/<code>/README.md`. Add a language-switcher header to the English README pointing at the translation (≤3 lines, does not clutter the English surface).

2. **GitHub repository description** — provide translated description (≤350 characters) as a draft in `docs/i18n/<code>/github-description.txt`. (Actual GitHub UI update requires maintainer sign-off; the file captures the translation.)

3. **NuGet package metadata** — for each `.fsproj` / `.csproj` that has `<Description>` and `<Summary>` fields, provide translated equivalents in `docs/i18n/<code>/nuget-descriptions.json` keyed by package name. (NuGet supports `<Description>` in resource assemblies; the JSON captures the strings for later integration.)

4. **Backlog item 081KQ0YZ80008QG0R002HWBHKJ** itself — translate this parent row to `docs/i18n/<code>/backlog/081KQ0YZ80008QG0R002HWBHKJ.md` as a sample showing that backlog rows are translatable.

## Why

081KQ0YZ80008QG0R002HWBHKJ body explicitly includes: *"External-facing surfaces: package metadata, NuGet descriptions, GitHub repo description."* These are the highest-leverage surfaces for discoverability — a Spanish-speaker searching NuGet or GitHub hits the English metadata first. A translated README + description is the lowest-friction change that reaches the largest audience outside the factory substrate. Per Aaron's framing, this is about "meeting humans at their starting point."

## Acceptance criteria

1. `docs/i18n/<code>/README.md` committed with full translated README.
2. English `README.md` updated with ≤3 line language-switcher header (e.g., "Also available in: [Español](docs/i18n/es/README.md)").
3. `docs/i18n/<code>/github-description.txt` committed (≤350 characters, native-checked).
4. `docs/i18n/<code>/nuget-descriptions.json` committed for all packages with `<Description>` fields.
5. `docs/i18n/<code>/backlog/081KQ0YZ80008QG0R002HWBHKJ.md` committed as sample translated backlog row.
6. `bun tools/i18n/drift-check.ts --lang <code>` and `bun tools/i18n/xref-check.ts --lang <code>`: still green after additions.
7. `dotnet build -c Release`: 0 warnings, 0 errors.

## Out of scope

- Translating all backlog rows (very large; future child, not this slice).
- Posting to GitHub (maintainer sign-off required; 081KR7JY10008QG0R003SATDK8 community outreach plan covers it).
- NuGet resource assembly integration (engineering effort; documented as a follow-on once strings are approved).
