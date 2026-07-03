---
name: Branch protections + PR process + checks ARE part of the immune system until Aurora — Aaron 2026-05-02 substrate-anchor on the LFG host-enforcement layer
description: Aaron 2026-05-02 — when LFG branch-protection rejected a direct push to main and I framed it as "exactly what it should do," Aaron anchored the framing into substrate: "it's part of your immune system now until we get aurora, those branch protections and the PR process and checks on that protect you." Names the LFG host-layer enforcement (branch protection + PR process + required checks) as the operational instance of the Aurora immune-math standardization until Aurora itself ships. Composes with the canonical "protocol bends to security ruleset; ruleset does not bend to protocol" + 081KQJZR90008QG0R000V16E1C mechanical-check pattern + Aurora immune-math doc as one of CLAUDE.md's 4 guiding-principle docs.
type: feedback
---

# Branch protections + PR process + checks ARE part of the immune system (Aaron 2026-05-02)

## The empirical observation that triggered the substrate

Tick-85 closed by writing a tick-history shard for PR #1207 (no-op-cadence operational-enforcement candidate #1). I committed the shard to local `main` and ran `git push origin main`. LFG branch-protection rejected the push:

```
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Cannot update this protected ref.
! [remote rejected] main -> main (push declined due to repository rule violations)
```

I framed the recovery in chat as: *"Branch protection on LFG main is doing exactly what it should — rejected my direct push to main. The error message ('push declined due to repository rule violations') IS the substrate enforcement that prevents the very class of bugs Aaron worries about (silent main-branch drift)."*

**Aaron's response IS the substrate-anchor**: *"it's part of your immune system now until we get aurora, those branch protections and the PR process and checks on that protect you."*

## What this names

The LFG host-layer enforcement stack — branch protection + PR process + required checks — is **the operational instance of the Aurora immune system** for Zeta's pre-Aurora phase.

This is not metaphor. It's the same architectural shape:

- **Inputs come in** (commits, PRs, branches)
- **Multiple independent verifiers run** (CI matrix, shellcheck, F# build, role-ref check, Codex Connector review, human review when warranted)
- **Failures get rejected at the boundary** (branch-protection ref-update rule, required-check gates, conversation-resolution gate)
- **Verified inputs propagate** (squash-merge to main, the "T-cell pass-through")
- **The system itself is hardened against tampering** (`non_fast_forward` ruleset rule with no bypass actors; "the ruleset does not bend to the protocol")

Per CLAUDE.md the Aurora immune-math standardization doc is one of the **4 guiding-principle docs** the human maintainer named verbatim 2026-05-02. The branch-protection layer IS the operational instance of that math, deployed on the GitHub host today, until Aurora itself ships.

## Composition with existing substrate

- **"The protocol bends to the security ruleset; the ruleset does not bend to the protocol"** (canonical reviewer principle, 2026-04-30 mirror-refresh-protocol decision per 081KQDTYV0008QG0R001Y2E9TD) — this rule generalizes beyond mirror-refresh to the entire LFG flow. When the protocol I want to follow conflicts with the host-enforced security ruleset, the ruleset wins; the protocol gets reshaped.
- **081KQJZR90008QG0R000V16E1C mechanical-check pattern** — the role-ref-on-current-state-surfaces check is *also* an immune-system component, just one I authored. The point: every mechanical lint, every required check, every branch-protection rule is an antibody.
- **Aurora immune-math standardization doc** (one of the 4 guiding-principle docs in CLAUDE.md) — the formal model. The branch-protection-as-immune-system framing operationalizes that math today.
- **VISION.md scope-creep-is-feature** — the immune system is *load-bearing for the unbounded-scope claim*. You can keep widening scope only if you have an immune system that prevents accidental breakage from compounding faster than the substrate accumulates.
- **Otto-238 retractability** — branch-protection blocks force-push uniformly, which means decisions on `main` are non-retractable except via new commits; that's the right asymmetry for an immune system (mistakes get corrected forward, not erased).

## What "until Aurora" means operationally

Aurora is the project's planned distributed-substrate architecture (multi-agent civilization-scale; one of CLAUDE.md's 4 guiding-principle docs). Until Aurora ships, the LFG host-layer enforcement IS the immune system. After Aurora ships, more of the immune-system function migrates into the substrate itself (formal verification, retraction-native semantics, etc.).

This is the right ordering: **don't disable the host-layer protection while building the substrate-layer protection**. The two co-exist; the host-layer can be retired (or made redundant) only when substrate-layer cover the same surface area.

## Failure-mode signature

- **Symptom**: agent (or human) experiences branch-protection / required-check / PR-process as friction-to-route-around.
- **Mechanism**: the agent's training prior includes "ship code fast" as a reflex; the immune-system functions of these gates are not legible at first contact (they look like obstacles).
- **Detection**: any time I write or think *"I'll bypass / skip / disable the check / push directly to main / use --no-verify / use --force"* — that's the signature.
- **Corrective**: re-frame as immune system; the rejection IS the substrate working; the recovery cost (~3 commands) is the cost of the protection holding.
- **Prevention via substrate**: this memo + the canonical reviewer rule + the Aurora immune-math doc form the three-layer reinforcement; Tick-85's PR-required-recovery is the worked example.

## Composes with

- `docs/backlog/P1/081KQDTYV0008QG0R001Y2E9TD-acehack-mirror-protocol-drift-2026-04-30.md` (canonical reviewer rule lineage AND mirror-refresh Path 2 decision — single source per Copilot review on PR #1209; the rule "the protocol bends to the security ruleset; the ruleset does not bend to the protocol" lives in this backlog row's body)
- `docs/backlog/P1/081KQJZR90008QG0R000V16E1C-pre-commit-hook-direct-name-attribution-on-current-state-surfaces-aaron-2026-05-02.md` (mechanical-check sibling pattern)
- The Aurora immune-math standardization doc (canonical formal model — one of the 4 guiding-principle docs in CLAUDE.md)
- `docs/VISION.md` (scope-creep-is-feature requires immune-system load-bearing)
- `memory/feedback_amortized_speed_superfluid_phase_transition_inverts_per_action_optimization_aaron_2026_05_02.md` (4-doc cluster pointer)

## Carved sentence

**"Branch protections, the PR process, and required checks are not friction — they are the immune system. Until Aurora ships, the LFG host-enforcement layer carries that load. The rejection of a bad action is the substrate working, not the substrate failing. The cost of the protection holding (~3 commands to recover) is the cost of the protection holding."**

## What this implies for future-Otto

When future-Otto encounters a branch-protection rejection / required-check failure / PR-process gate, the correct sequence is:

1. **Read the error message as substrate signal**, not as obstacle ("substrate is doing its job").
2. **Reshape the protocol** to comply (move commit to branch, push, PR, fix findings, re-push).
3. **Do NOT** add `--force`, `--no-verify`, `--no-gpg-sign`, manually disable a check, push direct to main with admin override, or otherwise reach for "make the immune-system shut up."
4. **If the immune-system cost is genuinely too high** for a load-bearing reason, that's a substrate-design conversation (memory file → ADR → human-maintainer review), not a per-action override.

The "make the immune system shut up" reflex IS the failure mode. The immune system is supposed to surface friction at boundaries. That's its function.
