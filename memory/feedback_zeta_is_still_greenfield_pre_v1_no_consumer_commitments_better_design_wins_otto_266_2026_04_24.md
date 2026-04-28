---
name: LOAD-BEARING CONTEXT — Zeta is STILL GREENFIELD / pre-v1 / no consumer commitments; decisions should be made on DESIGN MERIT, not on "what landed first"; roll-forward (Otto-254) does NOT mean "first-in wins" — it means "don't fight reversions" + "keep the ship moving forward"; when two designs exist (one on main, one in a stuck PR / closed PR / experiment), evaluate on MERIT and adopt the better one, even if that means replacing what already landed; breaking changes without migration plans are FINE right now because there are no external consumers to migrate; Ilyana's conservative API-design review still applies to intentional public-surface stability (GOVERNANCE §13), but the shipping codebase itself is still malleable; Aaron Otto-266 2026-04-24 "we are still greenfield" (triggering context: my default toward "main wins because it landed first" on SignalQuality)
description: Aaron Otto-266 load-bearing context reminder. I keep defaulting to "main wins because it landed first" when the actual principle is "better-design wins because we're greenfield." Save durable so future decisions compose correctly.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
## The principle

**Zeta is STILL GREENFIELD. Pre-v1. No external
consumers committed to any specific API yet. The
public-API designer (Ilyana) reviews new public
members for intentional stability, but the shipping
codebase is still malleable.**

**Therefore**: design decisions are made on MERIT, not
on "what landed first."

Direct Aaron quote 2026-04-24:

> *"we are still greenfield"*

## What greenfield means in practice

**We CAN**:

- Replace an already-shipped design with a better one,
  even if that means a "breaking" internal change.
  No consumers to migrate.
- Evaluate two design alternatives on merits. First-
  landed isn't canonical; best-designed is.
- Do semantics-level redesigns of existing modules
  without a deprecation cycle.
- Delete code that was added this week if a better
  approach emerges.
- Change the public-API shape in a new PR if the
  prior public-API shape was wrong — Ilyana reviews
  the NEW shape on merits.

**We CANNOT (yet)**:

- Ignore Ilyana's API-design gate on new public
  members (GOVERNANCE §13 conservative-by-default)
- Skip specs / ADRs for substantive changes
  (`docs/DECISIONS/**` + `openspec/specs/**`)
- Land changes that break the build / tests
- Skip alignment / safety / threat-model review
- Bypass the PR-gate + merge queue

## Relationship with Otto-254 roll-forward

Otto-254 says: **default to rolling forward rather than
backward**. That's about direction of change, not about
which design wins.

- ✓ Forward-roll: file a NEW PR that implements the
  better design on current main.
- ✓ Forward-roll: extend / refine / replace an
  existing module with a better design in a NEW
  commit.
- ✗ NOT: "the landed design wins because reverting
  it would be going backward." The landed design
  losing to a better design in a new PR IS forward-
  rolling.

Otto-266 composes with Otto-254: forward-rolling
toward the BETTER design is the correct response when
we realize the landed design isn't optimal.

## Triggering example — SignalQuality (2026-04-24)

PR #147's rebase hit conflict on `src/Core/SignalQuality.fs`:
- Main's version (landed via PR #142): empty-string → 0.5
  neutral, no size threshold
- PR #147's version: empty-string → 0.0 neutral, 64-byte
  `compressionMinInputBytes` threshold

My default: "main wins on Otto-254 roll-forward grounds
because main landed first."

Aaron's correction: "we are still greenfield" → if PR
#147's design is BETTER on merits, adopt it. Separate PR,
current main as base. No compatibility concerns because
no consumers yet.

Net result:
- For THIS rebase: main wins (to unblock #147's
  FactoryDemo C# scope which is the PR's primary value).
- Separately: evaluate SignalQuality designs on merits via
  a new PR. If PR #147's design is better, adopt it on
  current main.
- This BACKLOG row captures the re-evaluation work owed.

## Applies to (non-exhaustive)

Every design-choice decision in the codebase. Common
triggers:

- **Module semantics** — SignalQuality empty-handling,
  Retraction-safe recursion base-case behavior,
  BackingStore flush semantics.
- **Public API shape** — class vs struct, optional vs
  required parameters, sync vs async, Result vs
  exception.
- **Data representations** — Z-set internal storage,
  Spine layout, Graph adjacency format.
- **Algorithm choice** — sharder (currently
  InfoTheoretic vs JumpConsistent, per Otto-248
  DST-marked test documenting JumpConsistent's
  process-randomized flake).
- **Protocol / format** — KSK signature algorithm,
  retraction receipt format, Aurora message schema.

For any of these: if a better design emerges, the
right move is a new PR landing the better design —
not "preserve what landed first."

## Composition with prior memory

- **Otto-254** roll-forward default — composes:
  forward-roll to BETTER design, not "preserve-
  landed."
- **Otto-257** clean-default smell — composes: when
  reviewing drift, triage includes "is there a
  better design available?" not just "did content
  land?"
- **Otto-262** trunk-based-dev — composes: new
  short-lived branch for the better design;
  replaces the landed version via main; don't
  preserve stale branches hoping their design
  resurfaces.
- **Otto-263** best-of-both-worlds — composes:
  greenfield applies at the code layer; host-
  first-class still applies at the workflow layer;
  neither is the reason the other is/isn't
  canonical.
- **Otto-264** rule of balance — composes: the
  counterweight for "landed-first wins by default"
  drift is this rule. "Greenfield" is the
  counterweight's trigger condition.
- **Ilyana's API-design review** (GOVERNANCE §13)
  — unchanged. Greenfield doesn't bypass the
  public-API gate; it just means the conservative
  default applies to NEW public surface, not to
  "never change what's already public."

## When greenfield status ENDS

This memory assumes pre-v1. Once Zeta:

- Ships a v1.0 release to NuGet
- Has documented consumer commitments
- Has external users relying on specific API shape
- Promises SemVer semantics

...greenfield status ends. At that point:

- Landed-first DOES start winning on compatibility
  grounds
- Design changes require deprecation cycle
- API-design gate tightens further

Until then: merit wins.

**Status check cadence**: per Otto-264 maintenance
rule, recheck whether greenfield still applies every
20-50 ticks OR on-demand when any API-stability
event (external consumer visible, v1 release cut,
public commitment made) happens.

## Direct Aaron quote to preserve

> *"we are still greenfield"*

Future Otto: when tempted to default to "main wins
because it landed first," ask: "are we still
greenfield?" If yes, evaluate on merits. First-in
doesn't win automatically; better-design wins.
Roll-forward toward the better design is the
correct move, not preservation of the inferior-but-
already-shipped version.
