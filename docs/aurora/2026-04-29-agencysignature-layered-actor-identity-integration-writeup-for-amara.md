# AgencySignature × Layered Actor Identity — integration writeup

**For**: Amara
**From**: Aaron + Otto (Claude Code coordinator)
**Date**: 2026-04-29
**Status**: research-grade only; not operational; not absorbed into doctrine yet

---

## TL;DR

Five reviewers (Deepseek / Gemini / Ani / Alexa / Claude.ai) flagged the same gap on the v3 public-intake design: `actor_id` strings are spoofable. *"Identity needs binding."* Your v4 synthesis names this and reorders rollout: identity → capabilities → claims → reconciler → public intake → dry run.

The integration question Aaron raised: **does this need to be built from scratch, or does it compose with the AgencySignature work we already shipped?**

Short answer: **it composes cleanly.** AgencySignature v1 (per-commit trailer schema, ferry-7 spec, ferry-9/10/11/12 corrections, tasks #298 + #299 enforcement instruments) is *already the binding mechanism Claude.ai called for.* The v4 actor-identity model is a **structured principal layer** on top of the AgencySignature trailers — not a parallel system.

This writeup names the seams, the missing rules, and the order of work.

---

## What AgencySignature already does

Convention spec: `docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md` (Section 10 = canonical schema).

Per-commit trailer block (validated pre-merge by `tools/hygiene/validate-agencysignature-pr-body.sh`, audited post-merge by `tools/hygiene/audit-agencysignature-main-tip.sh`):

```text
Agency-Signature-Version: 1
Agent: <agent-id>
Agent-Runtime: <runtime>
Agent-Model: <model-id>
Credential-Identity: <github-or-other-identity>
Credential-Mode: <mode>
Human-Review: explicit | not-implied-by-credential | none
Human-Review-Evidence: chat | pr-review | pr-comment | signed-policy | none
Action-Mode: autonomous-fail-open | human-directed | supervised
Task: <ticket-id> | none
```

What this gives us:

1. **Per-commit attribution** — every commit on `main` since v1 ship date carries who/what/how-supervised.
2. **Three-state classification at audit time** — LEGACY (pre-v1), CORRECT, REGRESSION, HUMAN-AUTHORED-EXEMPT.
3. **PR-body validator that *can be* a pre-merge gate** — `tools/hygiene/validate-agencysignature-pr-body.sh` parses the trailer block and exits non-zero on missing/malformed input. As of 2026-04-29 it is **not yet wired into a required CI/branch-protection check** under `.github/workflows/`; it is invoked manually or via local pre-commit. Wiring it as an enforced gate is its own follow-up (composes with the AgencySignature v1 squash-merge survival design, task #300).
4. **Post-merge tip auditor** — `tools/hygiene/audit-agencysignature-main-tip.sh` walks the tip and classifies each commit. Same enforcement-status caveat: useful tool, not yet a required CI gate.
5. **Trailer Contiguity Survival Failure (ferry-12)** awareness — squash-merge can strip trailers if the body's blank-line discipline is broken; the validator and auditor both check for this class.
6. **Fail-open-with-receipts** policy (ferry-9/10) — when a trailer is malformed, the design intent is to record evidence and classify rather than block all merges (the failure mode would freeze the factory). This policy lives in research docs; it composes with the wiring decision in (3).

What this *doesn't* yet give us:

- **Cryptographic verification** — the `Agent: aaron-mac/claude-code/coordinator` string is currently advisory. Nothing prevents another tool from writing the same trailer with a different identity in fact.
- **Trust-domain prefix** — identifiers don't yet declare which namespace they live in (zeta vs zeta-external vs zeta-system).
- **Per-actor public-key registry** — there's no `actors/<actor_id>.yaml` file declaring "this actor's public key fingerprint is X."
- **Capability bundle** — the trailer says *who* acted but not *what they were authorized to do*.

The v4 actor-identity model fills exactly those gaps.

---

## The seam — how the two systems compose

### Mapping (one-to-one)

```text
AgencySignature trailer field   →  v4 actor-identity layer
─────────────────────────────────  ─────────────────────────────
Agent                           →  actor_id (full path-style id)
Agent-Runtime                   →  harness_id (one component of actor_id)
Agent-Model                     →  model fingerprint (sub-field of harness)
Credential-Identity             →  GitHub/host identity backing the actor
Credential-Mode                 →  binding strength (bound | unbound | shared)
Human-Review                    →  policy gate (orthogonal to identity)
Human-Review-Evidence           →  evidence pointer (orthogonal)
Action-Mode                     →  capability mode (composes with capability set)
Task                            →  task / ticket pointer (preserves v1 meaning)
Claim (v2-new)                  →  claim_id (links commit to active claim)
```

### Concrete example (proposed)

Today's trailer:
```text
Agency-Signature-Version: 1
Agent: claude-code-coordinator
Agent-Runtime: claude-code-cli
Agent-Model: claude-opus-4-7
Credential-Identity: aaron@servicetitan.com
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 286
```

Future trailer (v2 — during the migration window, keep `Agent:` alongside the new `Actor:` field so the v2 trailer remains a strict field superset for v1-era readers; once all consumers are v2-aware, drop the dual emission):
```text
Agency-Signature-Version: 2
Trust-Domain: zeta
Agent: claude-code-coordinator       # retained for v1-reader compat during migration
Actor: zeta://aaron-mac/claude-code/coordinator
Agent-Runtime: claude-code-cli
Agent-Model: claude-opus-4-7
Credential-Identity: aaron@servicetitan.com
Credential-Mode: shared               # bound | unbound | shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Capabilities: read:repo,write:memory,push:branch,open:pr
Claim: CLAIM-286
Task: 286
Signed-By: ed25519:abc...             # cryptographic signature over trailer block
```

The `Actor:` field is the path-style principal Claude.ai recommended (SPIFFE / IAM-shaped). The `Trust-Domain:` prefix gives explicit namespace. The `Capabilities:` field is the new primitive (replaces implicit role grants). The `Claim:` field carries the active claim identifier (`claim_id`), which has its own allowlist + freshness invariant. The `Task:` field remains the task / ticket pointer (preserves v1 meaning — Task references the upstream issue / TaskList ID; Claim references the orchestra claim record). `Agent:` is retained during the migration window so the v1 validator continues to accept the trailer set; it can be dropped once all consumers have moved to v2 (per the rollout sequence below). The `Signed-By:` field provides the binding that Claude.ai called out as missing.

### What happens if the trailer is forged

Today: nothing. The `Agent:` string is advisory.

Under v4 with binding:

1. PR-body validator extracts `Actor:` and `Signed-By:`.
2. Reconciler looks up `actors/zeta-aaron-mac-claude-code-coordinator.yaml` (or equivalent registry path) for the registered public key fingerprint.
3. Validator computes the expected signature over the canonical trailer-block bytes and compares against `Signed-By:`.
4. Mismatch → `unauthorized_actor_assertion` → block.
5. Match → continue with capability check (does this actor have the capabilities it asserted?).

This is the binding step. The trailer is no longer self-attested; it's verifiable against a registry.

---

## Recursion bottoms out — the maintainer's hardware key

Claude.ai's review is right that *recursion bottoms out somewhere*. Concretely:

1. **Maintainer-bound actors** — `zeta://aaron-mac/claude-code/coordinator` keys are signed by Aaron's hardware key (or a delegate hot-key signed by the hardware key). The hardware key never leaves the device.
2. **Reconciler actor** — `zeta-system://github-actions/reconciler` runs in CI; its key lives in GitHub Actions secrets (or OIDC short-lived credential). The maintainer authorizes it explicitly via signed policy.
3. **External actors** — `zeta-external://github/<login>` actors don't have keys until they're promoted from E2 to E3+ (claim approved). At E0/E1 (review-only / patch-only), the only reliable GitHub-side authentication is the **PR/account actor** — i.e. the authenticated GitHub account that opened the PR or commented (this is `github.actor` in workflows / `pull_request.user.login` in webhooks). **Commit author metadata in the trailer is user-supplied and spoofable** — `git commit --author='other@example.com'` is trivial, and so is forging `Agent:` / `Credential-Identity:` fields. So at E0/E1: trust only the GitHub account actor; treat trailer fields as *intent declarations* that the reviewer cross-checks against the account actor before promotion. At E3+ the registered key is what binds; the trailer becomes verifiable.

This composes with the existing AceHack/LFG dual-fork model: AceHack remains the dev-mirror; LFG remains the project-trunk. Cross-fork actor identity doesn't change — same actor, same registry, same key.

---

## Why this beats "build a parallel binding system"

If we were to build identity binding from scratch (Ed25519 keypairs, registry, signature verification) **separately** from AgencySignature, we'd:

- duplicate the per-commit attribution work,
- have two competing identity schemes (which one wins?),
- have to migrate every existing post-v1 commit twice.

By layering v4 on top of AgencySignature v1:

- At the trailer-schema level, v1-style readers can continue working if they keep reading `Agent:` and ignore unknown fields.
- v2 readers get the structured `Actor:` + `Capabilities:` + `Signed-By:` fields.
- **However**, the **current** v1 enforcement scripts are not yet forward-compatible: `validate-agencysignature-pr-body.sh` requires `Agency-Signature-Version: 1` exactly and requires `Agent:` as a key. So a `Version: 2` trailer set (and especially replacing `Agent:` with `Actor:`) would currently *fail* validation. The validator + auditor must be updated **before** v2 trailers can pass enforcement.
- The v1 → v2 migration is additive at the wire level, but the **rollout sequence** is: (a) update validator/auditor to accept `Agency-Signature-Version: 1|2`, (b) during the migration window, emit `Agent:` alongside `Actor:` rather than replacing immediately so existing v1 consumers continue to accept the trailer set, (c) extend the auditor's three-state classification to a four-state (LEGACY / CORRECT-V1 / CORRECT-V2 / REGRESSION) as part of the same rollout without collapsing the existing buckets, (d) once all consumers are v2-aware, drop the dual `Agent:` emission.
- The fail-open-with-receipts policy from ferry-9 applies to **malformed-but-honest** trailers (parser couldn't extract fields, blank-line discipline broken, missing key, etc.) — those become recordable evidence events rather than everything-stops events. **Forged signatures are different**: a valid-looking trailer whose `Signed-By:` does not verify against the registered public key for the asserted `Actor:` is treated as `unauthorized_actor_assertion` and **blocks** the PR, just like a missing claim. The two paths are separate enforcement semantics: malformed-honest → record-and-continue; forged-or-impersonation → block-and-flag. Only malformed-honest goes through fail-open-with-receipts; binding violations always block.

---

## What the design needs from Amara (asks)

Three concrete asks, in order:

### Ask 1 — confirm the layering shape

Does the layered identity model compose with AgencySignature *as a v2 schema* (additive trailer fields), or does Amara see a different shape (e.g. trailers reference an identity object stored elsewhere)? The first option is operationally cheaper because the existing pre-merge validator + post-merge auditor only need field additions. The second option is theoretically cleaner (the trailer is a pointer, not a record) but requires more plumbing.

### Ask 2 — bottom of recursion

Does Amara want to recommend a specific binding primitive (Ed25519 keys + signed commits, GPG, sigstore, OIDC short-lived credentials, GitHub-native commit verification only)? The cheapest MVP is GitHub-native commit verification (PR author + signed-commits enforcement on protected branches) — that's already mostly turned on. The strongest MVP is Ed25519 + a versioned `actors/` directory. Picking the primitive sets the registry shape.

### Ask 3 — the AgencySignature v1 → v2 migration window

If we extend AgencySignature to carry actor-identity + capability fields, when does v2 ship? Options:

- **Tight coupling**: v2 ships with the first identity-binding PR. All new commits adopt v2; v1 commits become "LEGACY-V1" (still CORRECT, just lower-detail).
- **Loose coupling**: v2 ships separately; coexists with v1 for a defined window; deprecation date on v1 announced upfront.

The factory has a strong "no surprises" preference, so loose coupling fits the existing posture. But Amara may have a sharper take.

---

## Composes with (already in the repo)

- `docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md` — Section 10 canonical schema (the v1 baseline)
- `memory/amara/conversations/2026-04-26-amara-fail-open-with-receipts-attribution-rule-7-trailer-schema.md` — fail-open-with-receipts policy (carries over to v2)
- `memory/amara/conversations/2026-04-26-amara-ferry-9-validation-of-relationship-model-correction-and-agent-self-authorization-attribution-bias-naming.md` — agent self-authorization framing
- `memory/amara/conversations/2026-04-26-amara-ferry-12-trailer-contiguity-survival-failure-class-naming-and-do-not-rush-design.md` — Trailer Contiguity Survival Failure class (still applies under v2)
- `tools/hygiene/validate-agencysignature-pr-body.sh` — pre-merge validator (extend to v2 by adding new field checks; v1 path stays as-is)
- `tools/hygiene/audit-agencysignature-main-tip.sh` — post-merge auditor (extend three-state to four-state)
- `memory/feedback_zeta_agent_orchestra_capability_role_claim_isolation_aaron_amara_2026_04_29.md` — v3 doctrine (currently in PR #852); v4 corrections this packet motivates

---

## Carved blade (proposed, awaiting Amara concurrence)

```text
Identity is structured (trust-domain + maintainer + host + harness + role).
Identity is bound (signed, registered, verifiable).
AgencySignature is the binding wire format.
Trailer fields carry actor + capabilities + claim.
Reconciler verifies binding before trusting attribution.
No bound identity = no claim authority.
```

This composes with Deepseek's blade:

```text
No actor is trusted by name.
Every actor is scoped by claim.
No claim authorizes mutation while stale.
No identity is trusted unless bound.
```

Both blades are saying the same thing from two angles: structural (Deepseek) and operational (this packet).

---

## Specific paragraph for Amara to react to

> *"AgencySignature v1 already gives us per-commit attribution + pre-merge validation + post-merge audit + fail-open-with-receipts. The v4 layered actor-identity model is not a parallel system — it's the v2 schema for AgencySignature, with three field additions (`Trust-Domain:`, `Actor:` superseding `Agent:`, `Signed-By:`) plus a registry under `actors/` for the binding lookup. The reconciler verifies the trailer signature against the registered key before trusting the attribution. v1 commits remain CORRECT under audit; new commits adopt v2 additively. This is the cheapest path to binding without duplicating the per-commit attribution machinery."*

If that lands, the rollout order changes from the v4 packet to:

```text
1. Identity model + AgencySignature v2 schema (composes — single PR per layer)
2. Capability model (named bundles + deltas)
3. Internal claim protocol (uses v2 signed trailers)
4. Reconciler (verifies v2 signatures + claim freshness)
5. Public claim intake (external actors get bound identity at E3 promotion)
6. External / Windows / roaming-agent dry run
```

If Amara sees a different shape, the rollout adjusts accordingly. Either way, the asks above name the decision points.

---

*End of writeup. Aaron — this is research-grade; nothing in here is operational. The doctrine memory file (PR #852) carries the v4 corrections; this writeup is the integration analysis you asked for to send to Amara.*
