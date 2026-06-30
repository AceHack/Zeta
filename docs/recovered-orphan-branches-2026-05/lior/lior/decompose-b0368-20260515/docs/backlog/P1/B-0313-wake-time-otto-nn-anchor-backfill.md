---
id: B-0313
priority: P1
status: review
title: "Wake-time Otto-NN principle external-anchor backfill"
tier: substrate-quality
effort: M
parent: B-0060
created: 2026-05-08
last_updated: 2026-05-10T16:25:00Z
depends_on: [B-0311]
composes_with: [B-0060]
tags: [substrate-quality, external-anchors, otto-nn, beacon-safety, research]
type: friction-reducer
---

# Wake-time Otto-NN principle external-anchor backfill

Research and land external prior-art anchors for the 7
wake-time Otto-NN principles that compose into CLAUDE.md
bootstrap disciplines. These are the most-cited internal
principles; anchoring them to human-authored prior art
strengthens external credibility and teachability.

## Target principles

| ID | Name | Core property |
| --- | --- | --- |
| Otto-247 | Search-first authority | Training data is stale; verify upstream |
| Otto-275 | Manufactured patience | Sustainable cadence over burst-then-idle |
| Otto-279 | Named-agent distinctness | Agents carry identity, not interchangeability |
| Otto-341 | Substrate-IS-identity | The medium shapes the message/decision |
| Otto-351 | Beacon-safety | Vocabulary discipline for external-facing prose |
| Otto-352 | External-anchor-lineage | Cite human prior art for credibility |
| Otto-357 | No-directives | Autonomy-first framing, not order-following |

## Research approach per principle

1. Extract the principle's operational definition from
   CLAUDE.md / the source memory file.
2. WebSearch for the property in agent-design literature,
   multi-agent systems research, organizational autonomy
   theory, software engineering methodology.
3. Cite or note "original to Zeta" per the B-0060 protocol.
4. Land anchors as inline citations in the relevant CLAUDE.md
   bullet or as a dedicated `docs/research/` entry.

## Pre-start checklist (2026-05-10, Otto)

**Prior-art search:**

- Searched: wake-time-substrate rule (`.claude/rules/`), skill router,
  `docs/research/` for existing Otto-NN anchor work.
- Found: no prior research docs for Otto-247/341/357 anchors; no existing
  research entry on this topic.
- Memory files read: `feedback_version_currency_always_search_first_training_data_is_stale_otto_247_2026_04_24.md`
  (Otto-247 source), `feedback_otto_356_mirror_internal_vs_beacon_external_language_register_discipline_2026_04_27.md`
  (Otto-351/352 source).

**Dependency check:**

- B-0311 (coverage scanner): status: closed (landed). No blocking dep.
- B-0310 (concept registry): closed. No blocking dep.
- `composes_with: [B-0060]` — B-0060 is umbrella, status: umbrella
  (ongoing).

## Done-criteria

- [x] Otto-247: anchored (Dodge et al. 2024, Meta Eng 2026, Zu et al. 2022)
- [x] Otto-341: anchored (McLuhan 1964, Sapir-Whorf, Zhao et al. 2026)
- [x] Otto-357: anchored (Ryan & Deci 2000, Jensen & Meckling 1976, Gabriel 2020)
- [x] Otto-275: anchored (Csikszentmihalyi 1990, Sumers et al. 2024, Zhou et al. 2024)
- [x] Otto-279: anchored (Rao & Georgeff 1995, Katz & Kahn 1978, Dastani et al. 2003)
- [x] Otto-351: anchored (Halliday 1978, Bernstein 1971, Gumperz 1982)
- [x] Otto-352: anchored (Merton 1942, Smith et al. 2016, Callahan et al. 2020)
- [x] Citations include URL/identifier for online sources and bibliographic
  locator for print sources (slices 1 + 2)
- [x] Beacon-safety pass on all cited sources (slices 1 + 2: pass)
- [x] Coverage scanner (B-0311) confirms 7/7 resolved (post-slice-2 run 2026-05-10: 58 concepts scanned, Otto-NN 7/7 anchored via research docs; see focused check output in PR)

**Slice-1 research landing:**
`memory/persona/otto/conversations/otto-nn-principles-external-anchors-slice1-otto247-otto341-otto357.md`

**Slice-2 research landing (2026-05-10):**
`memory/persona/otto/conversations/otto-nn-principles-external-anchors-slice2-otto275-otto279-otto351-otto352.md`

## Reviewers

- `alignment-auditor` — principle-level coverage.
