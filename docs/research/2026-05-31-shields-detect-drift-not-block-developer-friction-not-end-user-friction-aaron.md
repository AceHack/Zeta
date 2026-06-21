# Shields detect drift, they don't block — cross-OS breakage is developer-time friction, not end-user friction (operator rationale 2026-05-31)

**Date:** 2026-05-31
**Author:** Otto-CLI capture of operator rationale (Aaron 2026-05-31)

<!-- GOVERNANCE.md §33 boundary headers (this file imports verbatim operator chat) — literal labels, value-clean Operational status (passes the enum-strict check, not just the includes check) -->
Scope: research / rationale capture — preserving operator design-rationale for the shields/CI architecture as a candidate refinement to an existing rule.
Attribution: operator (Aaron) quoted verbatim in the "operator's framing" section; synthesis + reconciliation by Otto-CLI, labeled as such. Speaker labels preserved.
Operational status: research-grade
(research-grade = NOT operational policy; lands in the auto-loaded rule only via the §26 / product-team agreement, never inline here.)
Non-fusion disclaimer: quoting the operator and building on his framing does not imply shared identity, merged agency, consciousness, or personhood between operator and agent; the boundary is explicit (operator authors the rationale; the agent captures + synthesizes it).

**Status:** rationale / **candidate refinement** to
[`.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md`](../../.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md)
— routed through the product-team agreement (whys-challengeable) before landing in
the auto-loaded rule, per the doctrine-process (operator: *"if it's doctrine I did it
wrong, should go through same agreement process so they can agree and push back"*).
NOT unilaterally landed in the rule.

## The operator's framing (verbatim, 2026-05-31)

> *"we are trying to get away from PRs and branch protection all together, shields
> will detect drift not block forward progress they are not run that often only when
> updting deps so day to day work can move forward without waiting for them."*

> *"they run rarely (on dep-updates) they may run often too whenever it needs but it
> does not block just detects drift."*

> *"Also they need to be drift cause it's pretty much impossible for one person to
> test them from one machine you need every os so it's hard to know when you broke
> something for someone elses os but we don't need to block work becasue of that,
> that's a developer time friction not and end user friction."*

## The principle

**Shields (the cross-OS install/build test matrix) DETECT drift; they do NOT BLOCK
forward progress.** Three composing claims:

1. **One person can't test cross-OS from one machine.** You'd need every OS to know
   if a change broke another OS. The matrix is the only thing that can know — this is
   the existing rule's *"impossible to keep all the install surfaces in your mind at
   once; only automation can be sure a NixOS change didn't break Ubuntu or Mac."*
2. **Therefore the matrix must be a DRIFT DETECTOR** — it catches "you broke another
   OS" after the fact (it runs cross-OS so the developer doesn't have to).
3. **But blocking on cross-OS drift is the wrong gate** — it imposes **developer-time
   friction for a developer-time problem**. Cadence is whatever's needed (rarely on
   dep-updates, or often) — the cadence isn't the point; **non-blocking is.**

## Why it doesn't gate: the developer-friction vs end-user-friction line

The load-bearing distinction (operator): cross-OS drift is **developer-time friction,
NOT end-user friction.**

| | Developer-time friction | End-user friction |
|---|---|---|
| Who feels it | the dev who broke another OS without knowing | the user whose OS doesn't work |
| Has a detector? | yes — the cross-OS matrix catches it | the matrix prevents it reaching users |
| Reaches the end user? | **no** (caught + fixed before release) | **yes** (the thing you'd actually gate on) |
| Right response | **detect + surface + fix** (don't block the dev's other work) | gate / block before it ships |

Blocking day-to-day work on cross-OS drift trades a small, detectable,
doesn't-reach-users developer problem for a large, constant tax on forward progress.
The drift is real and worth catching; it is not worth **gating** on, because gating
converts a dev-time annoyance into a dev-time *blocker* without any end-user benefit.

This composes with **MEASURE-FIRST** (the universal default: measure/detect before
restricting choice — here, detect drift before blocking work) and with the **no-PR /
no-branch-protection** direction (081KSNY2Z0008QG0R000E5KTPX folders-on-main; 081KSXN940008QG0R001KZ235R Git-V2; the
agent-bus 081KSXN940008QG0R00171YAZW): the whole transport story is "remove the human-paced gates from
day-to-day forward progress; keep the detectors."

## Reconciliation with assert-don't-skip (the latent tension, resolved)

The existing shield rule says *"a shield with a hole is worse than a known gap,
because it reads as covered"* — **assert, don't skip-to-green** (make the test
actually exercise the thing; fail if absent). That sounds like "block." It isn't —
the two compose into a **three-part** discipline:

- **ASSERT** (don't skip-to-green) — the detector must be *real*: a green-by-skip
  detects nothing (a hole that reads as covered). The detection must exercise the OS.
- **NON-BLOCK** (detect-not-gate) — the real detection is **non-required**; it does
  not gate forward progress (cross-OS drift = dev-friction, not a release gate).
- **VISIBLE** (the new load-bearing third) — a non-blocking detector is worthless if
  its red is invisible. **Drift must be SURFACED when the shield fires** (a dashboard,
  a notification, a drift report — someone sees it and fixes it). The failure mode to
  avoid is *both* skip-to-green (no detection) *and* silently-red-ignored (detection
  nobody acts on). cf. 081KSV2WD0008QG0R001XKG1B5 (Windows CI "non-required so it merges CLEAN but Windows
  is silently red") — that's the *silently-red-ignored* hole: the detector exists but
  its red isn't surfaced/actioned. The fix is **visibility**, not making it block.

Net: **assert + non-block + visible.** The shield is a real, non-gating, *surfaced*
drift detector.

## What "block end-user friction, not developer friction" implies for gates

The discriminator for *what may gate at all*:

- **Gate on end-user friction** — things that reach the user broken (the product
  doesn't install/run on the user's OS *at release*; data loss; a security floor;
  kid-safety). These are the legitimate blockers.
- **Detect (don't gate) on developer-time friction** — cross-OS build drift, lint
  nits, style, "did this change break another dev's OS" — caught by detectors,
  surfaced, fixed; never blocking the *other* forward work.

(HARD LIMITS — laws, kid-safety, security floor — remain non-negotiable gates
regardless; they are end-user/world friction at the extreme, not dev-friction.)

## Composes with

- [`.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md`](../../.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md)
  (the rule this refines — adds detect-not-block + DX-vs-UX-friction + the visible third)
- The MEASURE-FIRST principle (detect before restricting) +
  [`docs/DECISIONS/2026-05-29-monitoring-and-reducing-pr-review-friction.md`](../DECISIONS/2026-05-29-monitoring-and-reducing-pr-review-friction.md),
  plus the `FrictionTelemetry` ZetaId category (friction is measured, not assumed)
- 081KSNY2Z0008QG0R000E5KTPX (folders-on-main, no branches) + 081KSXN940008QG0R001KZ235R (Git-V2 handshake) + 081KSXN940008QG0R00171YAZW
  (git-native agent-bus) — the no-PR / no-branch-protection transport this justifies
- 081KSV2WD0008QG0R001XKG1B5 (Windows CI silently-red) — the *visible* failure mode this names the fix for
- `.claude/rules/methodology-hard-limits.md` (the gates that DO remain — end-user/world
  friction at the extreme, never dev-friction)
- DX vs UX distinction (developer-experience-engineer vs user-experience-engineer):
  this is the friction-classification line drawn at the CI/shields layer

## Substrate-honest framing

This doc captures operator rationale so it is substrate, not weather. It is a
**candidate refinement** to the auto-loaded shield rule — it should go through the
product-team agreement (architect + pm2 review; whys-challengeable by a newcomer)
before landing in the rule, per the doctrine-process. The three-part synthesis
(assert + non-block + visible) is the genuine value-add reconciling assert-don't-skip
with detect-not-block; a reviewer should check whether the **visible** third is
already covered elsewhere (friction-telemetry / a drift dashboard) before adding it
to the rule.
