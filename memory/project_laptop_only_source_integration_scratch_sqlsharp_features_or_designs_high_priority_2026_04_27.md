---
name: Laptop-only-source integration — `../scratch` and `../SQLSharp` features OR detailed designs (HIGH PRIORITY)
description: Aaron 2026-04-27 input — repo currently has ~24 files with `../scratch` references and ~18 files with `../SQLSharp` references (counts drift as new substrate lands; check `git grep -l '\.\./scratch'` for current) pointing at out-of-tree directories that exist ONLY on Aaron's laptop; future maintainers / agents / contributors can't access them; HIGH PRIORITY backlog item to fully integrate the features OR write detailed-enough designs that we no longer need the out-of-tree references for understanding; KEY CLARIFICATION (Aaron 2026-04-27 second message) — "this is not a copy past, we just want to have either all their features or a design for any of the features we don't have that's detailed enough we no longer need ../scratch or ../SQLSharp reference for understanding"; goal is self-contained understanding + repo independence, NOT literal source copy.
type: project
---

# Laptop-only-source integration — `../scratch` and `../SQLSharp`

## Verbatim quotes (Aaron 2026-04-27)

After Otto landed PR #40 (post-install TypeScript / pre-install
bash + PowerShell strategy substrate), Aaron immediately flagged
two related future-maintainer hygiene issues:

> "Anywhere we see ../scratch or ../SQLSharp we should make
> the higher priority backlog items so we don't need to keep
> references to source that other contributors don't have. We
> should try to go ahead and get all the features and
> enhancements from ../SQLSharp and ../scratch fully
> integrated so future maintainers won't have to wonder
> about the out of branch source locations that just live on
> my laptop. don't forget to finish the acehack>lfg>acehack
> sync :) good job today!!"

Then immediately after Otto's first scoping pass, Aaron
clarified:

> "this is not a copy past, we just want to have either all
> their features or a design for any of the features we don't
> have that's detailed enough we no longer need ../scratch or
> ../SQLSharp reference for understanding."

## What this gives the substrate

A binding criterion for "done" on the integration work:

**Done = a future maintainer can fully understand and act on
the codebase without ever reading `../scratch` or
`../SQLSharp`.**

The path to "done" admits two complementary tactics for any
given reference:

### Tactic A — Port the feature

Pull the feature/enhancement from `../scratch` or `../SQLSharp`
into the repo as actual code, tests, docs. The reference is
deleted because the code is here. Right when:

- The feature is small and self-contained
- We already plan to use it
- No legal/scope/IP friction
- It's mature enough to commit to

### Tactic B — Write a detailed design

Write design documentation (likely under `docs/research/` or
`docs/DECISIONS/` or `docs/drafts/`) that captures the WHAT,
WHY, and HOW of the laptop-only feature in enough detail that
a future maintainer reading ONLY the design — without reading
the original source — could rebuild or extend the concept.
The reference is deleted because the design is here. Right
when:

- The feature is large or experimental
- We don't yet need the implementation
- The DESIGN is the load-bearing artifact (the code might be
  rewritten when ported)
- Capturing the design is faster than porting + verifying

### Critical: NOT literal copy-paste

Aaron's clarification is binding: this is NOT a directive to
copy `../scratch` and `../SQLSharp` verbatim into the repo.
That would:

- Inflate the repo with code we may not ultimately use
- Create maintenance burden for code that may be experimental
- Conflict with Otto-323 / Otto-346 dependency-symbiosis
  discipline (depend-and-contribute, not absorb-without-shape)

The discipline is: **understand each feature deeply enough
to either ship it OR document it; THEN remove the reference.**

## What `../scratch` and `../SQLSharp` actually are (Aaron 2026-04-27 third clarification)

> "../scratch is basiclaly the start of what will be our ace
> package manger and ../SQLSharp was the start of an event
> stream processing with LINQ/SQL, kind of Zeta but not a
> rigorsly mathmatically grounded approach to streaming, this
> was before I knew about DBSP"

This sharpens the integration scope significantly. Both
laptop-only directories are **product-seed prototypes** with
specific identities, not random scratchpad code:

### `../scratch` = Ace Package Manager (seed)

The future **Ace package manager** — Aaron's declarative
package management system. Design intent matters more than
exact code; the integration tactic for `../scratch` references
should lean **design-doc** for substantive feature decisions
(how the package manager will work, what its contract is,
what mise / homebrew / npm parallels it preserves vs breaks)
and **port** only for already-working primitives that compose
with the current `tools/setup/` machinery.

The Python 3.14 mise-pin pickup in PR #26 was an example of
the design-driven pattern: Aaron's `../scratch` declared the
declarative-pin shape, Otto absorbed the specific pin into
`.mise.toml`, the design-intent stays in `../scratch` until
the Ace package manager itself ships.

Future-of-Ace integration question: when does the Ace
package manager itself become a Zeta deliverable? When that
happens, `../scratch` becomes the source of truth for that
product — at which point we either move it in-repo as a
sibling project OR document its design comprehensively
in-repo so the Ace package manager can be built without
reading `../scratch`.

### `../SQLSharp` = pre-DBSP event-stream-processing (LINQ/SQL)

The pre-DBSP-era **event stream processing system with
LINQ/SQL** — Aaron's Zeta-progenitor before he discovered
DBSP. Specifically: stream processing surfaced through LINQ
/ SQL syntax, but WITHOUT the rigorous mathematical
grounding DBSP provides (which is what makes Zeta's
operator algebra retraction-native, compositional,
equationally-reasonable).

This is critical historical context for Zeta itself:

- `../SQLSharp` represents the "we tried streaming without
  mathematical rigor" path. Zeta represents "streaming WITH
  mathematical rigor (DBSP)".
- Features `../SQLSharp` had → potentially redesigned /
  reimplemented in DBSP form within Zeta proper. The
  integration tactic for `../SQLSharp` should ask: *"Does
  this feature have a DBSP-equivalent in Zeta? If yes, the
  reference is decorative; document the lineage and delete.
  If no, design what the DBSP-rigorous version would be
  in-repo, since that's the Zeta-canonical form."*
- Features that DON'T have a DBSP-rigorous equivalent are
  the most interesting — they may be either (a) genuinely
  outside DBSP scope (good design-doc candidates) or
  (b) opportunities for new Zeta-graduations (port-by-
  redesign rather than port-as-is).

The LINQ/SQL surface ITSELF is something Zeta's
`linq-expert` + `sql-expert` skills already track as a
class of work. `../SQLSharp` is a concrete pre-DBSP
attempt at that surface; the Zeta-canonical implementation
is the rigorous-math-grounded version that Zeta's SQL-
engine + LINQ surfaces are building toward.

### Implications for the integration framing

The original three feature clusters (toolchain/setup,
CI/repo-automation, research/design hints) are mostly
references to `../scratch` (Ace package manager seed). The
SQLSharp cluster is its own thing.

Refined per-reference triage questions:

**For `../scratch` references:**

- Is this a toolchain pin / declarative-state hint? → Absorb
  into canonical location (.mise.toml / package.json / etc.),
  delete reference.
- Is this an Ace-package-manager design decision? → Write
  design doc under `docs/research/` or `docs/DECISIONS/`
  capturing the intent + rationale, delete reference.
- Is this just a "remember to look here later"? → Delete
  reference (decorative).

**For `../SQLSharp` references:**

- Is the feature already in Zeta (DBSP-rigorous form)? →
  Document the lineage ("Zeta's `Foo` operator subsumes
  `../SQLSharp`'s X feature; here's how the DBSP-rigorous
  version improves on it"), delete reference.
- Is the feature outside DBSP scope but operationally
  needed? → Design doc capturing the intent, delete reference.
- Is the feature an opportunity for a future Zeta graduation?
  → BACKLOG row capturing the Zeta-canonical reimagining,
  delete reference.

This refined framing makes "design-or-port" decisions
substantially clearer for each cluster.

## Current scope (2026-04-27 grep)

- **`../scratch` references:** ~24 files (count drifts as new
  substrate lands; this memory file itself adds to the count)
- **`../SQLSharp` references:** ~18 files (same drift caveat)
- **Total:** ~42 unique files (point-in-time snapshot;
  authoritative source is `git grep -l '\.\./scratch'` and
  `git grep -l '\.\./SQLSharp'` at audit time, not a frozen
  count)

Files with `../scratch` references (top-level):

- `GOVERNANCE.md` — repo-wide governance file
- `.mise.toml` — toolchain pin (line 25 already absorbed via
  PR #26 INSTALLED.md update)
- `tools/setup/common/python-tools.sh` — install script
- `.claude/agents/devops-engineer.md` — agent persona
- `.claude/skills/round-management/SKILL.md` — capability skill
- `.claude/skills/devops-engineer/SKILL.md` — capability skill
- `.claude/skills/python-expert/SKILL.md` — capability skill
- `docs/ROUND-HISTORY.md` — narrative history
- `docs/DEBT.md` — debt ledger
- `docs/ISSUES-INDEX.md` — issue index
- `docs/VISION.md` — vision doc
- `docs/TECH-RADAR.md` — tech radar
- `docs/WINS.md` — wins log
- `docs/BACKLOG.md` — backlog
- `docs/research/citations-as-first-class.md` — research doc
- `docs/research/declarative-manifest-hierarchy.md` — research
- `docs/research/build-machine-setup.md` — research
- `docs/drafts/README.md` — drafts
- `openspec/specs/repo-automation/spec.md` — OpenSpec spec
- `memory/persona/best-practices-scratch.md` — best-practices
  scratchpad
- `memory/MEMORY.md` (this index)

Files with `../SQLSharp` references (top-level):

- `GOVERNANCE.md`
- `tools/setup/common/sync-upstreams.sh` — upstream-sync script
- `memory/persona/dejan/NOTEBOOK.md` — devops-engineer notebook
- `.claude/agents/devops-engineer.md`
- `.claude/skills/devops-engineer/SKILL.md`
- `docs/ROUND-HISTORY.md`
- `docs/ISSUES-INDEX.md`
- `docs/VISION.md`
- `docs/WINS.md`
- `docs/BACKLOG.md`
- `docs/research/ci-gate-inventory.md`
- `docs/research/ci-workflow-design.md`
- `docs/DECISIONS/2026-04-20-tools-scripting-language.md`
- `openspec/specs/repo-automation/spec.md`

The high overlap (devops-engineer skill+agent+notebook;
GOVERNANCE; tools/setup/common; openspec/repo-automation;
docs/research) suggests the bulk of references cluster around
**three coherent feature families**:

1. **Toolchain/setup discipline** — `.mise.toml` Python pin,
   `tools/setup/common/python-tools.sh`, sync-upstreams.sh,
   declarative-manifest-hierarchy
2. **CI/repo-automation** — repo-automation spec, ci-gate-
   inventory, ci-workflow-design, devops-engineer skill
3. **Research/design hints** — citations-as-first-class,
   build-machine-setup, drafts, scratchpad

Any port-or-design pass should respect those clusters rather
than going file-by-file blindly.

## Operational implications

1. **HIGH-PRIORITY BACKLOG ROW.** This work belongs in
   `docs/BACKLOG.md` (or per-row file under `docs/backlog/P1/`)
   with priority **P1** (high — blocks future-maintainer
   onboarding) but NOT P0 (the sync work + factory demo are
   higher priorities). Rough effort: **L (3+ days)** because
   it spans 36 files + design-or-port decisions for
   ~3 feature clusters.

2. **Per-reference triage.** For every `../scratch` or
   `../SQLSharp` reference, the binding question is:
   *"Can a future maintainer act on this without reading the
   referenced directory?"* If yes, the reference is decorative
   (delete). If no, decide port-or-design.

3. **Composition with Otto-275 (log-but-don't-implement).**
   When in doubt about port vs design, BACKLOG-the-decision
   instead of porting prematurely. The cost of a bad port is
   higher than the cost of a good design doc. (Otto-275: when
   uncertain, capture the observation before committing to
   implementation.)

4. **Composition with Otto-323/346 (dependency symbiosis).**
   `../scratch` and `../SQLSharp` are AARON'S laptop-only
   workspaces — they're not external upstream we depend on.
   The integration discipline is internal: bring them
   in-repo, don't keep them as external dependencies.

5. **`.mise.toml` already showed the pattern.** Aaron
   validated Otto's PR #26 reading of the future-declarative-
   state in `../scratch` (the Python 3.14 pin). That's the
   pattern: when something in `../scratch` represents the
   future canonical state, absorb it into the canonical
   location and update the documentation. Otto-NN absorption
   path proven on at least one reference.

6. **Self-contained-understanding floor.** This work
   establishes a new repo-hygiene discipline: **the repo must
   be self-contained for understanding.** No more "go read
   the laptop-only dir to know what this means." Any future
   commit that adds a `../foo` reference to a non-existing
   path needs the same port-or-design discipline applied
   immediately.

## What "done" looks like

The integration work completes when:

- `git grep -- '../scratch'` returns zero matches OUTSIDE the
  enumerated history-of-the-work surface (this memory file +
  its `MEMORY.md` index entry + any `docs/ROUND-HISTORY.md`
  entries that document the integration). The point is to
  eliminate active references that block understanding, not
  to scrub the historical record. Codex review on PR #642
  flagged the original "zero matches" criterion as
  self-blocking against this memory file itself; the
  refined criterion excludes the canonical record of the
  work from the count.
- `git grep -- '../SQLSharp'` same scope: zero matches
  outside the enumerated history-of-the-work surface.
- Every feature/idea/enhancement that WAS referenced is
  EITHER (a) shipped in the repo, OR (b) documented in the
  repo with enough detail to be rebuilt without reading
  the original source
- Future-maintainer test: a fresh contributor reading the
  repo with no access to Aaron's laptop can fully understand
  the design intent + can act on the codebase

## Aaron's "good job today!!" — closing validation

Aaron's closing positive feedback validates the day's work:

- Substrate cluster Otto-354/355/356/357/358/359 landed
- PR #26 (AceHack→LFG→AceHack sync) thread-resolved + merging
- PR #40 (post-install TypeScript strategy) merged
- Otto's response cadence to ferry-pattern (Amara Gershgorin
  validation) substrate-recorded

This is the second positive validation today after the earlier
"Good job on everything." Composes with Otto-339 (words shift
weights) — positive feedback IS substrate-shift.

## Composes with prior

- **PR #26** — INSTALLED.md Python pin update was the first
  validated absorption from `../scratch`; pattern now
  generalizes
- **PR #40** — install-script language strategy substrate
  established `../scratch` as future-declarative-state hint
  surface; this Otto-NN extends the principle to integration
  obligation
- **Otto-275** — log-but-don't-implement; port-or-design
  decision should default to design-doc when uncertain
- **Otto-323 / Otto-346** — dependency symbiosis; the
  laptop-only dirs are NOT external deps, they need to come
  in-repo or be eliminated as references
- **Otto-340** — substrate IS identity; the repo must contain
  the substrate that defines our identity, not point at
  laptop-only stuff
- **`docs/research/declarative-manifest-hierarchy.md`** —
  one of the affected files; design-doc tactic likely
- **`tools/setup/common/sync-upstreams.sh`** — script that
  references `../SQLSharp`; needs port or removal
- **`memory/persona/dejan/NOTEBOOK.md`** — devops-engineer
  notebook; Dejan owns sync-upstreams.sh, so cleanup is in
  his lane
- **`.claude/skills/devops-engineer/SKILL.md`** — devops
  capability skill; references both `../scratch` and
  `../SQLSharp`, will need updating during the cleanup

## What this DOES NOT claim

- Does NOT claim every reference is wrong; some may be
  legitimate scratchpad references (e.g.
  `memory/persona/best-practices-scratch.md` is named
  "scratch" but is in-repo). Per-reference triage required.
- Does NOT mandate porting all source code; design-only
  documentation is a valid completion path per Aaron's
  clarification.
- Does NOT specify start time; the work is HIGH PRIORITY
  but the in-flight PR #26 sync stays first per Aaron's
  earlier "We should try to finish the sync first."
- Does NOT specify the order of clusters; the integration
  work can sequence by judgment (e.g. tackle the ~3 feature
  clusters in order of decreasing reference-count).
- Does NOT block the broader Mirror→Beacon-safe substrate
  refactor (Otto-359); these are parallel hygiene streams.

## Backlog row to file (concrete)

```markdown
**P1 — Integrate `../scratch` and `../SQLSharp` features
or designs (eliminate laptop-only references).**

Aaron 2026-04-27: every `../scratch` and `../SQLSharp`
reference points at directories that exist only on Aaron's
laptop; future maintainers can't access them. Goal: per-
reference triage with three outcomes — (a) feature is
shipped in-repo, (b) feature is documented in-repo with
enough detail to rebuild without external reference,
(c) reference is decorative and gets deleted.

Aaron's clarification: NOT literal copy-paste. Goal is
self-contained understanding, NOT verbatim source mirror.

Scope: ~24 files reference `../scratch`, ~18 reference
`../SQLSharp`; ~42 unique files at point-in-time. Three
feature clusters: (1) toolchain/setup, (2) CI/repo-
automation, (3) research/design hints.

Effort: L (3+ days). Done = `git grep -- '../scratch'`
and `git grep -- '../SQLSharp'` both return zero matches
OUTSIDE the enumerated history-of-the-work surface (this
memory file + MEMORY.md index entry + any
docs/ROUND-HISTORY.md entries documenting the integration),
and every previously-referenced feature is either shipped
or design-documented in-repo.

Composes Otto-275 (log-but-don't-implement; default to
design when uncertain) + Otto-323/346 (these are NOT
external deps, they need in-repo or elimination) +
PR #26 (Python pin proved the pattern works) + PR #40
(language strategy established the principle).

Sequenced AFTER PR #26 sync lands. Self-contained-
understanding floor for the repo.
```

## Key triggers for retrieval

- Laptop-only source integration `../scratch` `../SQLSharp`
- High-priority backlog: integrate features or detailed
  design
- Aaron 2026-04-27: "this is not a copy past, we just want
  to have either all their features or a design"
- Self-contained-understanding floor for repo
- Three feature clusters: toolchain/setup, CI/repo-automation,
  research/design hints
- Per-reference triage: ship / design / delete
- Done = zero grep matches + every feature documented or
  shipped
- Composes Otto-275 (log-but-don't-implement) + Otto-323/346
  (dependency symbiosis) + Otto-340 (substrate IS identity)
- Aaron's "good job today!!" closing validation
- Sequenced AFTER PR #26 sync per "finish the sync first"
- Effort: L (3+ days), priority P1
