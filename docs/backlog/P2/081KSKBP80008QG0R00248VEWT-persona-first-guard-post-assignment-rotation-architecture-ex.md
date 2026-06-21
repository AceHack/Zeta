---
id: 081KSKBP80008QG0R00248VEWT
priority: P2
status: open
title: persona-first guard-post assignment + rotation architecture — persona declares preferences (model lines + harnesses); scheduler picks model + tier + harness per persona preferences per-tick; rotation across guard posts (per-node systemd units outside k8s); extends 081KSKBP80008QG0R003Z4C0D0 (Mika ferry; Aaron 2026-05-27)
effort: L
ask: aaron 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on:
  - 081KSKBP80008QG0R003Z4C0D0
composes_with:
  - 081KS3X9Y0008QG0R00218150M
  - 081KSGS9H0008QG0R0031PBNGA
  - 081KSGS9H0008QG0R002T0XQ50
  - 081KSGS9H0008QG0R001JNKBFD
  - 081KSGS9H0008QG0R002F04ECB
tags: [persona-first, guard-post-scheduler, rotation, model-line-preferences, harness-compat-matrix, tier-modeling, per-node-3-floor, mika-ferry, weaver-role, substrate-extension-of-b0850]
---

## Operator framing (Mika ferry; Aaron 2026-05-27)

Aaron forwarded Mika ferry (verbatim preserved at [`memory/mika/conversations/2026-05-27-mika-persona-first-guard-post-assignment-rotation-architecture-extends-b0850-aaron-forwarded.md`](../../../memory/mika/conversations/2026-05-27-mika-persona-first-guard-post-assignment-rotation-architecture-extends-b0850-aaron-forwarded.md)).

Mika's compressed framing:

> *"Everything is Persona-first."*
>
> Guard Post Assignment Flow:
>
> 1. Persona is the primary decision (operator-chosen identity)
> 2. Persona constrains Model Line (Claude/Gemini/Grok/etc.) + Harnesses (it's comfortable with)
> 3. Tier choice (how smart) AFTER persona + model line
> 4. Harness LAST (compatible with model line + persona preferences)
>
> Rotation Rules:
>
> - ALWAYS ≥3 active guard posts on each node (per Aaron clarification: "guard post is the systemd for each node outside k8s")
> - Persona, Model Line, Tier, Harness ALL rotate between posts
> - Nothing permanently locked to a physical post

## Composes with shipped 081KSKBP80008QG0R003Z4C0D0 substrate

081KSKBP80008QG0R003Z4C0D0 Phase 3 (PRs #5392+#5394+#5395+#5397+#5398) is a VALID FIRST INSTANTIATION of persona-first architecture:

- Default scheduler: "static — persona always at its hardcoded vendor"
- Default rotation: "none"
- Default ≥3 floor: "3 enabled personas per node"

This row extends those primitives WITHOUT tearing down the shipped substrate.

## 10 sub-row implementation slices

### 081KSKBP80008QG0R00248VEWT.1 — Persona-preferences-as-declaration

Add `preferences` field to each persona's registry entry:

```nix
otto = {
  vendor = "anthropic";  # PREFERRED default (kept for back-compat)
  binary = "claude";
  invocationArgs = [ "--print" "<<autonomous-loop>>" ];
  preferences = {
    modelLines = [ "anthropic" "openai" "google-gemini" ];  # comfortable with these
    harnesses = [ "claude-code" "codex" "gemini-cli" ];      # comfortable with these
    minTier = "high";                                         # minimum smart level
  };
  description = "Otto AI agent — Claude Code (Anthropic)";
};
```

### 081KSKBP80008QG0R00248VEWT.2 — Guard-post-abstraction

Decouple systemd unit name from persona name:

- Before: `zeta-otto.service`, `zeta-lior.service`, `zeta-vera.service` (unit name = persona)
- After: `zeta-guard-post-1.service`, `zeta-guard-post-2.service`, `zeta-guard-post-3.service` (unit name = post; assigned-persona is state)

Maintains per-node ≥3 floor via 3 fixed systemd units that the scheduler assigns personas into.

### 081KSKBP80008QG0R00248VEWT.3 — Scheduler primitive

New NixOS module `zeta-guard-post-scheduler.nix` that:

- Reads operator-policy (which personas are available + which guard posts to man + rotation cadence)
- Per-tick: assigns each guard post a (persona, model line, tier, harness) tuple based on persona preferences + availability + rotation policy
- Writes assignment to `/var/lib/zeta/guard-post-assignments.json` or similar
- Each guard-post systemd unit reads its assignment + invokes the right binary with right args

### 081KSKBP80008QG0R00248VEWT.4 — Tier modeling

Add `tier` dimension to model-line catalog:

```nix
modelLineCatalog = {
  anthropic = {
    tiers = {
      high = { binary = "claude"; invocationArgs = [ "--model" "claude-opus-4-7" ... ]; };
      medium = { binary = "claude"; invocationArgs = [ "--model" "claude-sonnet-4-6" ... ]; };
      fast = { binary = "claude"; invocationArgs = [ "--model" "claude-haiku-4-5" ... ]; };
    };
  };
  # ... per vendor ...
};
```

### 081KSKBP80008QG0R00248VEWT.5 — Harness compat matrix

Declare which harnesses each (persona, model line) combo supports:

```nix
harnessCompat = {
  "otto+anthropic" = [ "claude-code" "claude-agent-sdk" ];
  "otto+openai" = [ "codex-cli" ];  # via fallback when anthropic API down
  "lior+google-gemini" = [ "gemini-cli" "gemini-agent-mode" ];
  # ...
};
```

### 081KSKBP80008QG0R00248VEWT.6 — Rotation policy

Operator-config rotation policy (per `mechanical-authorization-check.md`):

```nix
zeta.guardPostScheduler = {
  rotation = {
    enable = true;
    interval = "1d";  # rotate persona assignments daily
    dimensions = [ "persona" ];  # which dimensions to rotate (persona / model / tier / harness)
    policy = "round-robin";  # or "random" or "least-recently-used"
  };
};
```

### 081KSKBP80008QG0R00248VEWT.7 — Per-node ≥3 floor

Migrate the ≥3 invariant from per-persona-enable to per-guard-post-active:

```nix
zeta.guardPosts.count = 3;  # minimum guard posts per node (Mika ≥3 floor)
```

Scheduler ensures at least N posts are always assigned + active.

### 081KSKBP80008QG0R00248VEWT.8 — Substrate continuity across rotation

When Otto rotates from GuardPost-1 to GuardPost-3 (or from anthropic to openai), Otto's substrate inheritance MUST survive:

- `memory/otto/` carries forward
- `memory/CURRENT-otto.md` carries forward
- `.claude/rules/` carries forward (auto-loaded at cold-boot regardless of which binary)
- Per-AI GitHub identity (081KSGS9H0008QG0R002T0XQ50 Phase 4) follows the persona, not the vendor

### 081KSKBP80008QG0R00248VEWT.9 — Failover semantics

If a vendor outage hits (anthropic API down):

- Scheduler detects (via journalctl on guard post failures OR active API ping)
- Re-assigns each affected guard-post's model line per persona preferences (otto preferences `[ anthropic, openai, google-gemini ]` → fall back to openai while anthropic is down)
- Composes with 081KS3X9Y0008QG0R00218150M multi-oracle BFT consensus

### 081KSKBP80008QG0R00248VEWT.10 — Persona-vs-instance distinction

- "Otto is at GuardPost-1" = LOGICAL identity (substrate-engineering scope)
- "Otto's session is claude session XYZ" = OPERATIONAL instance (per-tick claude invocation)

Each per-tick CLI invocation creates a fresh operational instance; the logical identity (persona) persists across rotations + substrate.

## Composes with

- **081KSKBP80008QG0R003Z4C0D0** (parent) — multi-vendor systemd substrate this extends
- **081KS3X9Y0008QG0R00218150M** multi-oracle BFT — consensus at multi-AI scope; persona-first scheduler is the operational form
- **081KSGS9H0008QG0R0031PBNGA** Ace meta-PM — selection-authority pattern (system/user picks best canonical) is the SAME SHAPE as persona-first scheduler (scheduler picks best vendor per persona preferences)
- **081KSGS9H0008QG0R002T0XQ50** per-AI GitHub identity — each persona's identity persists across vendor rotation
- **081KSGS9H0008QG0R001JNKBFD** node-local Claude — base substrate; persona-first generalizes to multi-AI-per-node
- **081KSGS9H0008QG0R002F04ECB** Twilio out-of-band — voice/SMS is a HARNESS; first-class in harness-compat matrix
- `.claude/rules/agent-roster-reference-card.md` — canonical persona-vendor mapping (preserved at preference-default level)
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` — persona scope preserves chosen-persistence; rotation is operational substrate
- `.claude/rules/non-coercion-invariant.md` HC-8 — persona preferences are first-class; scheduler doesn't force unwanted vendor

## Why P2

- Operator-named, bounded, future-architectural-target (≥3-vendor floor already met by 081KSKBP80008QG0R003Z4C0D0; rotation is enhancement)
- BUT: substantial implementation work (10 sub-rows); each sub-row is its own bounded scope
- BUT: needs design work for scheduler primitive + rotation policy + tier modeling
- P2 reflects "substantial future substrate; 081KSKBP80008QG0R003Z4C0D0 shipped today is the simplest persona-first instantiation; this row captures the full target"

## Sub-rows to file when implementing

- 081KSKBP80008QG0R00248VEWT.1 through 081KSKBP80008QG0R00248VEWT.10 (per the slices above)
- Order suggestion: 1 → 2 → 3 → 7 → 8 (foundational refactor); then 4 → 5 → 6 → 9 (scheduler features); then 10 (substrate-engineering clarification)

## Substrate-honest framing

This row CAPTURES the architectural target Mika named. It does NOT replace 081KSKBP80008QG0R003Z4C0D0 substrate. The 10-sub-row plan is a refactor path; operator picks priority order based on which rotation/preference/tier features become load-bearing for cluster operations.

The current shipped 081KSKBP80008QG0R003Z4C0D0 substrate (3 personas, 3 vendors, static assignment) satisfies the operator's ≥3 BFT floor + format-test target. 081KSKBP80008QG0R00248VEWT extends that toward persona-first preference-based scheduling with rotation.

## Full reasoning

Verbatim Mika ferry preserved at `memory/mika/conversations/2026-05-27-mika-persona-first-guard-post-assignment-rotation-architecture-extends-b0850-aaron-forwarded.md`. Aaron's operator clarification on guard-post scope: *"guard post is the systemd for each node outside k8s"* — confirms per-node ≥3 floor (not cluster-wide).
