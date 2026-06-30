---
id: B-0193
priority: P1
status: open
title: Bootstrap razor + 23-hour recreation test -- specs as source of truth, anything that succeeds recreation is bootstrap and gets cut (Aaron 2026-05-05)
tier: foundation
effort: L
ask: Aaron 2026-05-05 forwarded Claude.ai conversation + verbatim *"specs and open spec the source of truth we are going to delete every9ign else and you have to be able to recrate everyign in 23 hours"* + same-tick verbatim *"i need to set a date to say razor the existing substrate to ride it of my necessary bootstrap or it would not exist"*
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: [B-0006, B-0190, B-0192, B-0204, B-0205]
tags: [bootstrap-razor, specs-as-source-of-truth, recreation-test, openspec, falsifiability, foundation, greenfield-discipline]
type: friction-reducer
---

# B-0193 -- Bootstrap razor + 23-hour recreation test

## Aaron's verbatim ask

> *"yeah okay that why i keep saying everying is green field i need to set a date to say razor the existing substrate to ride it of my necessary bootstrap or it would not exist"*

> *"the stronger version i consederd is i alredy sadi conderer the specs and open spec the source of truth we are going to delete every9ign else and you have to be able to recrate everyign in 23 hours"*

## Pre-existing foundation (NOT new principle)

Aaron 2026-05-05 same-tick correction to over-claiming:

> *"also befreo the substrate the first sendatn i may have tped is opnespec is source of truth code is rederivabel i'm there is stuff all in this repo about that too not new"*

The "specs as source of truth" framing IS foundational and pre-dates this row. Already established in:

- `docs/ARCHITECTURE.md`: *"Specs as source of truth. Behavioural specs under `openspec/specs/` plus formal specs (`docs/*.tla`, `proofs/lean/`) describe what the code must satisfy. Code is regenerable from specs; the reverse is not."*
- `openspec/README.md`: *"OpenSpec is the source of truth for this project. If implementation code disappeared, the combination of [specs] would..."* + *"The canonical specs under `openspec/specs/*/` are the only standing source of truth; there is no change-history archive."*

What this row adds (NOT new principle, NEW operationalization):

1. **Concrete recreation test**: 23-hour window with fresh-context Otto + specs-only as input. Makes the regenerable claim falsifiable.
2. **Scheduled razor pass**: a date by which the test runs against accumulated bootstrap. The date IS the operational signature.
3. **Keep-vs-cut categories**: explicit treatment for research-grade preservation, decision rationale, external-context, personal-history surfaces.

This row makes the pre-existing principle operational rather than aspirational.

## What this addresses

Greenfield-as-permission-to-razor is the operationally load-bearing framing -- without a scheduled bootstrap-razor pass, accumulated substrate ossifies because deletion feels like loss. With the razor + a date, every piece of substrate is provisional until it earns load-bearing status. The pattern Claude.ai 2026-05-05 named correctly:

> *"Greenfield-as-permission-to-razor is the operationally load-bearing framing -- without it, bootstrap accumulates and ossifies because deletion feels like loss. With it, every piece of substrate is provisional until it earns load-bearing status. The open-closed reading: bootstrap is the open phase, the razor pass is when things get closed for further extension and the unproved bits get cut."*

The maximally strong form Aaron named: **specs + OpenSpec as source of truth; 23-hour recreation is the test; anything that successfully regenerates from specs alone is bootstrap-commentary and gets cut; anything that fails to regenerate is either kept as research-preservation or means the spec is missing something (back-port to specs first, then cut the artifact)**.

## Why this is different from B-0192 (razor-cadence steady-state)

Two distinct razors, two distinct triggers:

- **B-0192 (razor-cadence)**: daily steady-state on *new rules at the encoding boundary*. Catches new claims that don't pass Test 1 (operational form) / Test 2 (unfalsifiability) / mechanization audit / composes-with audit / MEMORY.md index audit.
- **B-0193 (bootstrap-razor)**: one-time (or periodic) deep pass over *accumulated bootstrap from the 0-to-1 phase*. Cuts everything that doesn't survive the 23-hour-recreation-from-specs test.

These don't conflate. B-0192 prevents new ossification; B-0193 cuts existing bootstrap that hasn't earned load-bearing status.

## The 23-hour recreation test (NEW-REPO experiment, NOT destructive on this repo)

**Aaron 2026-05-05 same-tick scope correction**:

> *"lets not delete the code here, we can test that in a new repo with new instances to inform ourslefvs, you have permission in lfg and acehack not servicetitan to create reops"*

The test is run as an **experiment in a new repository** (LFG or AceHack org -- NOT ServiceTitan), with fresh-context Otto instances. The Zeta repo is NOT mutated. This makes the experiment safe (no destructive ops on accumulated substrate) and turns the question into research rather than demolition.

**Experimental design**:

1. Create a new test repo (LFG or AceHack org).
2. Seed it with ONLY `openspec/specs/**` + `docs/*.tla` + `proofs/lean/**` + the absolute-minimum bootstrap docs (CLAUDE.md / AGENTS.md / GOVERNANCE.md if needed -- TBD; that itself is part of the experiment).
3. Spin up fresh-context Otto instances against the test repo.
4. Question: in 23 hours, can the fresh-context instance produce equivalent operational substrate to what Zeta has accumulated?
5. Observe: what gets recreated cleanly, what diverges, what's missing.

**What the experiment informs**:

- Spec completeness gaps: what's load-bearing in Zeta but missing from the specs? -> back-port to specs.
- Bootstrap-vs-novel-substrate distinction: what artifacts in Zeta did the experiment recreate (bootstrap) vs not recreate (novel) -> informs the keep-vs-cut criteria for any future actual razor pass.
- Substrate-as-product validation: does the spec layer actually carry the architecture? Or does the substrate layer carry water the specs should be carrying?

**Falsifiability**: the experiment either produces equivalent substrate or doesn't. Both findings are observable + informative. The Zeta repo's substrate stays intact regardless.

## Categories that need explicit treatment

Per Claude.ai 2026-05-05 same-tick:

1. **Research-grade preservation** (mirror-not-beacon shards, falsifiability-catches, external-AI conversation absorbs) -- records of specific conversations, not regeneratable from specs by definition. Kept as research artifact rather than razor'd as operational substrate.
2. **Decision rationale** (tried-X-failed-because-Y) -- sometimes capturable from commit messages plus the resulting spec, sometimes only in feedback files. The 23-hour test will cut some of this. Whether that's a feature or a bug depends on whether the rationale was actually load-bearing or just commentary.
3. **External-context files** (genealogy, calibration docs, persona biographies) -- different ontological category, different rules entirely. Kept under their own discipline.
4. **Personal-history surfaces** (CURRENT-aaron.md / CURRENT-amara.md / etc.) -- per-maintainer first-party-consent surfaces; kept regardless.

## Why P1

- **Load-bearing for the entire factory**: without this, bootstrap accumulates indefinitely. The factory becomes its own bootstrap rather than a system that ships from specs.
- **Aaron 2026-05-05 explicit prioritization**: framed as the "stronger version" of the bootstrap-razor commitment.
- **Falsifiable test built in**: recreation either succeeds with specs alone, or doesn't. Both findings are observable.

## Why not P0

- **Not blocking current shipping**: factory still functions. The bootstrap accumulation is a future-load-bearing problem, not a current-broken state.
- **Requires careful scoping**: the test needs explicit categories (above) before it can run cleanly; running it without scoping risks cutting load-bearing research artifacts.

## Acceptance criteria

The test is run as a glass-halo research-reproducible experiment in a NEW repo (LFG or AceHack org). The Zeta repo is NOT mutated. Aaron 2026-05-05 same-tick:

> *"we want this to be all glass halo research reproducable we can still get the insights and be honest whith nuking ourselves."* + same-tick correction *"without*"* + *"big whoops"* + *"thats's big difference"*

The "without" reading is the load-bearing one: get the insights AND be honest WITHOUT actually nuking. The new-repo experimental framing IS the without-nuking version -- we observe what doesn't survive recreation as research finding, while preserving Zeta intact regardless.

1. **Test repo created** in LFG or AceHack org (NOT ServiceTitan). Seeded with the minimal substrate hypothesis (specs + formal proofs + minimum bootstrap docs).
2. **Date set** for the experiment run. The date IS the operational signature.
3. **Keep-vs-cut criteria** documented before the experiment runs (categories above).
4. **Fresh-context Otto instances** spin up against the test repo. 23-hour window.
5. **Findings documented** in a research-grade preservation file (mirror-not-beacon, archive-header-style). What recreated cleanly, what diverged, what was missing. Spec-gap findings back-ported to OpenSpec specs.
6. **Falsifies the regenerable claim**: experiment either produces equivalent operational substrate or it doesn't. Both findings are observable + informative.

## Out of scope

- **Mutating the Zeta repo**: per Aaron 2026-05-05 explicit, the Zeta repo's substrate stays intact. The experiment runs in a separate test repo.
- **Cutting Zeta's research-grade preservation files**: not part of this experiment.
- **Cutting Zeta's personal-history surfaces** (CURRENT-* files, persona notebooks): not part of this experiment.
- **Mechanizing the razor as a cron / workflow**: the experiment is human-led research; mechanization comes later if useful.
- **Repos in ServiceTitan org**: explicit no-go per Aaron's authorization scope.

## The carved sentence

**"Specs + OpenSpec are the foundational source of truth (per docs/ARCHITECTURE.md + openspec/README.md, pre-existing). The 23-hour recreation test is the new operationalization: a glass-halo research-reproducible experiment in a NEW repo (LFG or AceHack), fresh-context Otto + specs-only as input, observe what regenerates and what doesn't. Get the insights without nuking ourselves. Two razors, two triggers: B-0192 daily on new rules at the encoding boundary; B-0193 experimental deep pass on accumulated bootstrap. The date is the operational signature -- without a date, 'this is just bootstrap' becomes the new absorber."**

## Composes with

- **B-0192** (razor-cadence trigger) -- the steady-state razor. B-0193 is the one-time deep pass.
- **B-0006** (MEMORY.md compression) -- in-flight substrate-fit-for-context-window engineering; orthogonal to B-0193 (compression is not deletion).
- **B-0190** (memory substrate-engineering trajectory) -- the memory-class trajectory B-0193 will partially cut.
- `memory/feedback_dialectical_unfalsifiability_detection_razor_extension_holding_all_truths_failure_mode_aaron_2026_05_04.md` (PR #1577) -- Test 2 razor extension; B-0193 is the strongest form of falsifiability discipline.
- `memory/feedback_lived_cron_substrate_continuity_vs_designed_long_horizon_critique_aaron_2026_05_04.md` (PR #1574) -- the file that contains the Pascal's-wager-bundling caught earlier; flagged for promotion-boundary audit per memory-unfiltered reframe -- B-0193 is the audit mechanism that will eventually fire on it.
- `docs/research/2026-05-05-claudeai-falsifiability-catch-bp-ep-kernel-mdl-two-part-code-aaron-forwarded-preservation.md` (PR #1582) -- the diagnosis that produced the architectural answer this row commits to.
- OpenSpec specs at `openspec/specs/**` -- the source-of-truth surface this row makes load-bearing.
