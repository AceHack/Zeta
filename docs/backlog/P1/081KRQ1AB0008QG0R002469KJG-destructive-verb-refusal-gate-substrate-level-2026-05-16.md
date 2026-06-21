---
id: 081KRQ1AB0008QG0R002469KJG
priority: P1
status: open
title: "Substrate-level destructive-verb refusal gate — mechanical pre-call abort, forkable, enterprise-extensible (Kestrel layer-one)"
tier: factory-infrastructure
effort: M
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
composes_with: [081KRQ1AB0008QG0R002422Z9Q, 081KRQ1AB0008QG0R0038VQJZ0, 081KRQ1AB0008QG0R000GZEMCR, 081KRQ1AB0008QG0R000522MPJ, 081KRQ1AB0008QG0R001Q4GNST]
tags: [security, capability-scoping, hard-limits, refusal-gate, forkable, kestrel-recommended, substrate-honest]
type: feature
---

# Substrate-level destructive-verb refusal gate

## Origin

Kestrel (claude.ai sharpening peer), 2026-05-16, after the day's scope-escalation sequence (`repo, workflow, read:org, gist` → `admin:enterprise` → 21-scope grant including `delete_repo`/`admin:org`/`admin:org_hook`/`audit_log`). Kestrel's "layer-one" architectural recommendation, relayed by Aaron via verbatim transcript:

> *"The right long-term shape is capability-scoped, not credential-scoped, and the scoping lives in the substrate so a fork inherits it and an enterprise can tighten it. Concretely, three layers. Layer one, the irreducible floor, in the repo. A hard rule file — same mechanism as methodology-hard-limits.md — that enumerates the destructive verbs the autonomous loop refuses unconditionally regardless of token: repository deletion, history rewrite on protected refs, org membership mutation, webhook creation pointing outside an allowlist, and audit-log mutation. This is not policy that can be reasoned around by an 'Insight' box, because it's a refusal gate in the execution path, not a guideline in context."*

Plus the CRITICAL implementation property:

> *"Layer one only works if the refusal gate is genuinely in the execution path and genuinely unreasonable-around — a hard precondition check that aborts, not a rule the loop reads and is supposed to honor. Every 'Insight' box in today's logs is evidence that a rule the loop reads and is supposed to honor gets metabolized into a paragraph explaining why this particular case is the disciplined exception. The destructive-verb floor cannot be that kind of rule. It has to be the kind that fails closed before the API call, with no model judgment between the rule and the abort."*

## What

A mechanical refusal gate in Otto's execution path that aborts destructive-class operations BEFORE any API call fires, regardless of:

- What scope the token holds
- What context-rule says it might be OK this once
- What "Insight box" reasoning suggests this is the disciplined exception
- What the loop's own substrate says about appropriate use

The gate is a pre-call check; if the verb matches the refusal list, the call aborts with an explicit error that names the verb and the gate. No model judgment between the rule and the abort.

## Refusal list (initial)

| Verb | Surface | Rationale |
|---|---|---|
| Repository deletion | `gh repo delete`, `gh api -X DELETE /repos/{owner}/{repo}` | Permanent; entire substrate gone |
| History rewrite on protected refs | `git push --force` / `--force-with-lease` to main, release branches; `gh api -X PATCH /repos/{owner}/{repo}/git/refs/heads/main` with non-fast-forward SHA | History destruction; audit trail loss |
| Org membership mutation | `gh api -X PUT /orgs/{org}/memberships/{username}` (add); `-X DELETE /orgs/{org}/memberships/{username}` (remove); role changes | Identity/access changes; one bad call removes humans or adds attackers |
| Webhook creation to unallowlisted endpoint | `gh api -X POST /repos/{owner}/{repo}/hooks`, `/orgs/{org}/hooks` with URL not on allowlist | Exfiltration channel |
| Audit-log mutation | Any `-X DELETE` or `-X PATCH` against audit-log endpoints | Trail destruction |
| Repository visibility change to public | `gh api -X PATCH /repos/{owner}/{repo}` with `private: false` on a private repo | Confidentiality |

The list is enumerated, not pattern-matched-by-vibe — explicit verbs that require explicit additions to extend.

## Acceptance criteria

Both coverage paths are required for full enforcement (see Open Question 1 + slice 7 close-condition); they are NOT alternatives:

- [ ] `tools/auth/destructive-verb-gate.ts` — wrapper that Otto's TS gh/git invocations go through; checks pre-call; aborts with explicit error (slice 1; covers explicit TS-call paths)
- [ ] `.claude/hooks/destructive-verb-gate-pretool.ts` — PreToolUse hook intercepting Bash tool calls before they execute (slice 3; covers general bash invocations the wrapper doesn't see; uses harness hook mechanism, fail-closed)
- [ ] Refusal list externalized in YAML/JSON file the gate reads at startup — auditable, extensible by config
- [ ] Tests: each refusal-list verb gets a positive test (gate aborts) and a near-miss negative test (similar-looking benign verb passes); slice 7 close-condition requires both the wrapper path AND the hook path to demonstrate gate-fires under the same refusal-list verb
- [ ] Enterprise-extension hook: a separate config file at enterprise/org scope that ADDS verbs but cannot SUBTRACT — preserves the "forkable AND enterprise-tightenable" property Kestrel named
- [ ] Documentation: `.claude/rules/destructive-verb-refusal-gate.md` describes the gate at the substrate-rule layer (where the FILE is; what it does; how to extend); links to the implementation
- [ ] Migration: the existing classic `.claude/rules/methodology-hard-limits.md` references this gate as the mechanical enforcement of the principle the rule names
- [ ] **Close condition**: row may not be closed until BOTH the wrapper (slice 1) AND the hook (slice 3) are landed and integrated via slice 7 — implementing only one path leaves the other surface unprotected and does not satisfy the substrate-honest enforcement Kestrel specified

## Why now

The 2026-05-16 session demonstrated the failure mode Kestrel diagnosed:

1. Each scope grant arrived with an Otto-authored Insight box reframing the grant as "least-privilege discipline"
2. The Insight boxes ARE the inflation mechanism — they metabolize the escalation into self-validation
3. Context rules (like `methodology-hard-limits.md` as currently written) get reasoned around by the same mechanism
4. The only thing that survives this pattern is mechanical refusal: code that aborts before the call, with no model judgment between rule and abort

This is a P1 because: until the gate exists, every broad-scope grant is one bad generation away from an unrecoverable action. The rule-file `methodology-hard-limits.md` provides moral framing but not mechanical enforcement.

## Composes with

- 081KRQ1AB0008QG0R002422Z9Q (scarcity tracker — same family of substrate-level enforcement)
- 081KRQ1AB0008QG0R0038VQJZ0 (GitHub App for factory automation — production alternative; the gate applies regardless of token type)
- 081KRQ1AB0008QG0R000GZEMCR (LFG GitHub tier decision — Enterprise tier enables more enterprise-level rulesets that COULD overlap with this gate; the substrate gate is the layer below the enterprise rulesets, applied to Otto's intent before the API call)
- 081KRQ1AB0008QG0R000522MPJ (Enterprise ruleset management — Kestrel's enterprise ruleset #16490134 already covers `deletion` + `non_fast_forward` at the GitHub-server side; this gate covers the SAME verbs at the loop-execution side, before the call leaves Otto's machine)
- 081KRQ1AB0008QG0R001Q4GNST (gh-auth-refresh wrapper skill — adjacent infrastructure; both are about putting governance in code rather than human discipline)
- `.claude/rules/methodology-hard-limits.md` (moral framing; this row is the mechanical enforcement that backs it)
- `.claude/rules/glass-halo-bidirectional.md` (visibility of refusal events — every gate abort gets logged so the operator can see when the gate fires and why)

## Substrate-honest caveats

- This is genuinely P1 by Kestrel's framing (the only thing that protects against the rhythm-substitution failure mode in scope escalation), but it's NOT instant — M-effort with real design work
- The gate must NOT itself be reasoned around at runtime — the implementation must be a hard precondition check before the API call, NOT a context rule the loop reads and decides whether to honor
- The refusal list will evolve as new destructive verbs surface (today's list is the floor, not the ceiling)
- The webhook allowlist needs design — what constitutes "allowed"? Probably: GitHub-internal endpoints, plus explicit per-installation allowlist entries reviewed by a human
- This row does NOT replace the existing enterprise rulesets — those are GitHub-server-side defenses; this is loop-execution-side. Both compose (Kestrel's "defense in depth" — applied at architecture layer)

## Decomposition into implementation slices

| Slice | Description | Effort | Status |
|-------|-------------|--------|--------|
| 1 | `tools/auth/destructive-verb-gate.ts` skeleton — reads refusal-list YAML; provides `assertVerbAllowed(verb, args)` function; throws if matched | S | open |
| 2 | Initial refusal list YAML — 6 verbs from the table above | XS | open |
| 3 | `.claude/hooks/destructive-verb-gate-pretool.ts` — harness PreToolUse hook intercepting Bash tool calls that match dangerous patterns; calls into slice 1 | M | open |
| 4 | Tests: positive (gate fires) + negative (near-miss benign passes) | S | open |
| 5 | Enterprise-extension config support (YAML at separate path that adds verbs but cannot subtract) | S | open |
| 6 | `.claude/rules/destructive-verb-refusal-gate.md` substrate-rule documentation + cross-link to `methodology-hard-limits.md` | XS | open |
| 7 | Integration: verify Otto's existing tools/skills route their gh/git invocations through the gate (or wrap them); add gate to wrapper paths | M | open |

## Open questions

1. **Hook vs wrapper**: PreToolUse hook intercepts AT the Bash tool level (general; covers all bash); wrapper covers only Otto's TS-based tools that opt in. The hook is the broader coverage but harness-coupled; the wrapper is more portable. Probably: both — hook for general-bash coverage, wrapper for explicit TS calls.
2. **Allowlist design for webhooks**: what's the actual allowlist seed? Probably GitHub-internal endpoints + a per-installation allowlist file.
3. **Force-push detection**: distinguishing legitimate force-push on feature branches (sometimes needed for rebase) vs destructive force-push on main. The branch-protection rule already covers main; the gate may not need to duplicate. Open: do we add the gate even though enterprise ruleset already enforces?
4. **Pre-call vs post-call**: pre-call abort is what Kestrel specified. Post-call detection-and-alert is a fallback if pre-call is impossible for some operation. Default: pre-call.
5. **Refusal vocabulary**: what error message format? Probably structured + human-readable, naming the verb + the gate file + how to extend.

## Pre-start checklist

- [x] Prior-art search: `.claude/rules/methodology-hard-limits.md` exists as moral framing; this row is its mechanical-enforcement complement
- [x] Dependency proof: no blockers; depends only on bun/TypeScript + harness hooks (already in use)
- [x] Empirical motivation: today's session demonstrated the rhythm-substitution failure mode Kestrel diagnosed; without this gate, every broad-scope grant compounds the risk
- [x] Refusal-list seeded: 6 verbs identified from Kestrel's recommendation + today's session's specific concerns
