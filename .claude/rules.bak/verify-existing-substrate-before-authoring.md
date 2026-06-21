# Verify-existing-substrate-before-authoring — sibling to dep-pin-search-first-authority at substrate-scope

Carved sentence:

> Before authoring NEW substrate (backlog row, rule, skill, agenda
> entry, architectural framing in a PR body), grep for existing
> substrate on the same topic AND READ THE TOP HITS. Authoring from
> incomplete view produces parallel-shape substrate that has to be
> retracted + reconciled. The cost of the 5-minute substrate-inventory
> pass is small; the cost of "I thought this was new substrate but
> there's a 13-stage agenda + trajectory + 7 backlog rows already
> capturing it" is large (PR retract, multi-round substrate-honest
> corrections, operator-tax of catching the gap N times).

## Operational content

This rule extends [`dep-pin-search-first-authority.md`](dep-pin-search-first-authority.md)
(landed PR #5126) into the broader scope of **NEW SUBSTRATE AUTHORING**.
The dep-pin rule narrows search-first-authority to version pins + path
assertions; this rule narrows it to substrate authoring (backlog rows,
rules, skills, agenda framing, architectural shapes in PR bodies).

Both rules name the SAME root cause class: **"Otto-defaults-to-plausible-
but-unverified"** — at different surfaces. dep-pin catches it at version-
pin authoring time; this rule catches it at substrate-authoring time.

### Required process before authoring NEW substrate

1. **Grep for the topic across substrate surfaces**:
   ```bash
   # Pattern: search agenda + trajectory + backlog + rules + skills + memory + research.
   # Use grep -F (fixed-string) so $topic is treated as a literal, not a
   # regex — safe even when topic contains characters like B-NNNN, +, .,
   # 7z, c++, etc. (Copilot finding on #5131 — earlier draft used grep -E
   # which treats topic as a regex pattern.)
   topic="<topic-keyword>"
   # Content search (the load-bearing one — directory-name filtering alone misses substrate):
   grep -rlF "$topic" docs/agendas/      2>/dev/null | head -10
   grep -rlF "$topic" docs/trajectories/ 2>/dev/null | head -10
   grep -rlF "$topic" docs/backlog/      2>/dev/null | head -10
   grep -rlF "$topic" .claude/rules/     2>/dev/null | head -10
   grep -rlF "$topic" .claude/skills/    2>/dev/null | head -10
   grep -rlF "$topic" memory/            2>/dev/null | head -10
   grep -rlF "$topic" docs/research/     2>/dev/null | head -10
   ```

   Earlier draft used `find ... -type d | grep` (filename/directory-name
   filtering only) plus `ls memory/*${topic}*` (shell glob expansion which
   breaks on topics with spaces / metacharacters); both fail to surface
   substrate that mentions the topic in *content* without the keyword in
   the filename. Three Copilot findings on #5131 named this exact gap;
   the content-search via `grep -rlF` is the robust form across topics.

2. **READ THE TOP HITS** — not just list them. The agenda doc + canonical
   project memory + parent backlog row are the load-bearing substrate;
   skipping them = authoring from partial view.

3. **Decide**:
   - **Existing substrate covers the topic**: extend / refine / cite the
     existing substrate; do NOT mint parallel substrate. Authoring as if
     new is the failure mode.
   - **Existing substrate is partial but doesn't fully cover**: cite the
     existing + author the missing piece WITH explicit composes_with
     reference back to what exists.
   - **No existing substrate**: proceed; cite the search you performed
     in the new substrate's body or commit message.

4. **Cite the substrate-inventory step inline** in the new substrate's
   body — what you searched for, what you found, what you concluded.
   This is the substrate-honest audit trail; future-Otto reading the
   substrate can verify you actually looked.

### When this rule fires

- Authoring a NEW backlog row (`docs/backlog/P*/B-NNNN-*.md`)
- Authoring a NEW `.claude/rules/*.md` rule
- Authoring a NEW `.claude/skills/*/SKILL.md` skill
- Authoring a NEW agenda entry (`docs/agendas/<name>/AGENDA.md`)
- Authoring a NEW architectural framing in a PR description that
  references concepts (e.g., "Ace as meta-package-manager" — search
  for existing Ace substrate first)
- Authoring substrate-assertion lists (e.g., REQUIRED_FILES,
  EXPECTED_PATHS in audit tools — same shape as dep-pin)

### When this rule does NOT fire

- Trivial edits to EXISTING substrate (typo fixes, lint fixes, link updates)
- Substrate-internal references to itself (self-citations within a row)
- The maintainer's explicit instruction to author NEW substrate without
  reference to existing ("file a fresh row for X"); operator authority
  overrides + cite the operator's quote
- Substrate that's explicitly a `_retired/` or `_archive/` placement

## Why this rule auto-loads

Per [`wake-time-substrate.md`](wake-time-substrate.md): the operational
failure mode this rule catches is at WRITE-TIME, when the agent is
about to emit substrate. Memory-file-only encoding wouldn't intercept
the in-progress write. Auto-load at cold-boot makes the discipline
available at the moment the substrate-authoring decision is being made.

## Empirical anchors (3 instances, single session 2026-05-26)

The rule landed BECAUSE the 2026-05-26 session produced 3 same-root-cause
failures in sequence. Each anchor is preserved here so future-Otto sees
the empirical evidence at cold-boot.

### Anchor 1 — Cascade #4 ISO audit (PR #5119 → #5125)

`tools/ci/audit-installer-iso-content.ts` (shipped in PR #5119) authored
`REQUIRED_ISO_PATHS = [..., "boot/grub/grub.cfg", ...]` from training-data
assumptions about legacy GRUB layouts. NixOS installer ISOs use isolinux
plus refind, NOT legacy GRUB at the asserted path. Blocked 4 consecutive
ISO builds before fix landed via PR #5125.

The empirical anchor lives in
[`dep-pin-search-first-authority.md`](dep-pin-search-first-authority.md)
(Anchor 2 there). Cross-referenced here because it's the FIRST instance
of the same root cause class that surfaced today.

### Anchor 2 — 081KSGS9H0008QG0R001Y9FB62 Ace section authored without reading Ace agenda (PR #5129 → #5130)

081KSGS9H0008QG0R001Y9FB62 backlog row authored an Ace section as if Ace were just "a package
manager CLI in-progress at 081KR2E4K0008QG0R002YE3MMD" without reading:

- `docs/agendas/ace-package-manager/AGENDA.md` (OPERATOR-SELF-CLAIMED
  2026-05-22; 13-stage lifecycle; multi-oracle BFT)
- `docs/trajectories/ace-package-manager-skill-crystallization-pipeline/`
- `memory/project_ace_package_manager_unrestricted_local_models_guardian_oversight_aaron_2026_05_07.md`
  (canonical Aaron 2026-05-07 disclosure: unrestricted local models +
  Guardian/KSK + Bond Curve + Itron composition)
- 7+ related backlog rows (081KQZVQW0008QG0R000ZHEN62, 081KR2E4K0008QG0R0033WVCXE, 081KR2E4K0008QG0R002YE3MMD, 081KRFA460008QG0R001H98EXJ, 081KSE6WT0008QG0R000YYH3DY, 081KSE6WT0008QG0R000JSJ3SR)
- Research substrate (3+ docs/research/*ace* files)

The maintainer 2026-05-26 caught it: *"that is what ace has been since
we first talked about it you just keep forgetting we have substantial
backlog around this"*. Fixed in PR #5130 by rewriting the Ace section
with proper substrate citation + restating as "081KSGS9H0008QG0R001Y9FB62 sits INSIDE the
Ace agenda, not parallel to it."

### Anchor 3 — 081KSGS9H0008QG0R001Y9FB62 hat/fork-negotiation NOT integrated into architecture (PR #5130 follow-on)

After the Anchor 2 correction, the maintainer 2026-05-26 caught a third
gap: *"i'm assuming you have the hat / fork negoation for ace too"*.
Hats + fork-negotiation were CITED in the substrate-table after Anchor 2
but NOT integrated into 081KSGS9H0008QG0R001Y9FB62's architectural flow. The Ace agenda
specifies hats + multi-oracle BFT as load-bearing primitives + 081KSE6WT0008QG0R002CC6314
(prematurely closed earlier in same session) provides the cross-fork
ontology negotiation substrate; both should have been integrated into
the iter-7 architectural shape from the start.

Fixed in PR #5130 follow-on commit by adding "### Architectural
integration of hats + fork-negotiation" section + tracking 081KSE6WT0008QG0R002CC6314 as a
sub-row to re-file per Tier 3.

## The composition with dep-pin-search-first-authority

| Surface | Rule that catches it |
|---|---|
| Version pin (nix input, helm chart, container tag, mise runtime, REQUIRED_FILES list) | [`dep-pin-search-first-authority.md`](dep-pin-search-first-authority.md) |
| NEW substrate authoring (backlog row, rule, skill, agenda, architectural framing) | THIS RULE |
| Existing-rule citation as authorization for action | [`fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md`](fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md) |

All three are "Otto-defaults-to-plausible-but-unverified" at different
scopes. Together they cover the surfaces today's empirical evidence
showed are vulnerable.

## Substrate-inventory checklist template

When authoring new substrate, fill out this template inline in the new
substrate's body (or in the commit message):

```
## Substrate-inventory pass (per `.claude/rules/verify-existing-substrate-before-authoring.md`)

Topic: <topic-keyword>
Searched surfaces:
- docs/agendas/ : <hits or "none">
- docs/trajectories/ : <hits or "none">
- docs/backlog/ : <hit IDs or "none">
- .claude/rules/ : <hit names or "none">
- memory/ : <hit count or "none">
- docs/research/ : <hit count or "none">
Read the top hits:
- <list of files read>
Conclusion: <existing-substrate-covers / partial-covers / no-existing-substrate>
Authoring action: <extend / refine / cite-and-add-missing-piece / mint-new>
```

This is verbose at the per-substrate-authoring scope but proportional
to the operator-tax saved when the topic IS covered. Skipping it costs
N rounds of substrate-honest correction (today's session had 3).

## Composes with

- [`dep-pin-search-first-authority.md`](dep-pin-search-first-authority.md) — sibling at version-pin scope
- [`search-first-authority.md`](search-first-authority.md) — Otto-364 foundational rule both extend
- [`wake-time-substrate.md`](wake-time-substrate.md) — why this rule auto-loads
- [`fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md`](fighting-past-self-vs-peer-agent-distinguisher-fix-your-own-coordinate-on-peers-dont-punt-by-default.md) — companion at rule-citation scope; same root cause class
- [`grep-substrate-anchors-before-razor-as-metaphysical.md`](grep-substrate-anchors-before-razor-as-metaphysical.md) — sibling discipline: verify substrate anchors before razor-flagging; this rule extends to: verify substrate anchors before AUTHORING
- [`skill-router-as-substrate-inventory.md`](skill-router-as-substrate-inventory.md) — the skill router IS one of the inventory surfaces this rule checks
- [`refresh-before-decide.md`](refresh-before-decide.md) — the underlying invariant applied at substrate-authoring scope

## Composes with substrate

- PR #5119 + #5125 (cascade #4 ISO audit failure + fix-fwd) — Anchor 1
- PR #5126 (dep-pin-search-first-authority rule landing) — sibling rule
- PR #5129 + #5130 (081KSGS9H0008QG0R001Y9FB62 Ace section authoring failure + correction) — Anchor 2 + 3
- 081KSGS9H0008QG0R002BC2ZR7 (capstone: ALL deps current-version sweep) — composes at the dep-pin scope
- 081KSGS9H0008QG0R001Y9FB62 (iter-7 cluster-OS-substrate row) — empirical anchor 2 + 3 substrate

## Substrate-honest framing

This rule does NOT:

- Mandate exhaustive read of ALL existing substrate before any authoring (sample the top hits; quality over completeness)
- Require WebSearch for substrate authoring (WebSearch is for upstream-version verification per dep-pin rule; substrate-inventory is for in-repo substrate)
- Override operator authority (if the maintainer says "file fresh row," that wins; cite the operator quote)
- Eliminate all authoring-from-incomplete-view (humans + agents both have bandwidth limits; the rule reduces the rate, not the absolute occurrence)

This rule DOES:

- Force the inventory step at substrate-authoring time
- Provide the checklist template + the empirical anchors so future-Otto sees the cost of skipping
- Compose with dep-pin-search-first-authority for full surface coverage
- Encode the cite-the-search-inline discipline so the audit trail is preserved

## Full reasoning

Three same-root-cause failures in single 2026-05-26 session. Each was
caught by the maintainer; each required multiple rounds of substrate-
honest correction. Pattern is clear: the dep-pin rule landed earlier
today doesn't extend to substrate-authoring; this rule does.

The maintainer 2026-05-26 substrate-honest catches (verbatim):

1. *"that is what ace has been since we first talked about it you just
   keep forgetting we have substantial backlog around this"* (Anchor 2)
2. *"i'm assuming you have the hat / fork negoation for ace too"*
   (Anchor 3)

Both phrasings name the gap: "you keep forgetting" / "i'm assuming you
have" — the rule extension is the substrate-level prevention so the
operator doesn't pay the catch-tax repeatedly.
