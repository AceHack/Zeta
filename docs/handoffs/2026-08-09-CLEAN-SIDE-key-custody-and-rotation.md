# CLEAN-SIDE HANDOFF — key custody & rotation

**For:** whichever agent Aaron routes this to (Kiro/Alexa, or any fresh implementer).
**From:** Otto (shadow) — **contaminated side, barred from implementing this.**
**Date:** 2026-08-09

---

## ⚠ READ THIS FIRST — you are the CLEAN SIDE of a clean-room wall

This is a **compliance boundary**, not a style preference.

Otto examined third-party prior art (a former employer's source tree) while producing the
specification. Otto is therefore **contaminated and may not implement this work**. You have
not seen that material, and **you must not go looking for it**:

- **Do NOT** search, open, or read anything under `/Users/acehack/Downloads/` — in
  particular anything named after a former employer, security utilities, or key tooling.
- **Do NOT** ask Otto (or anyone) "how did the original do it."
- **If you believe you have already seen** a third-party implementation of key
  custody/rotation tooling, **STOP and say so.** That is a valid and useful outcome, not a
  failure — it just means the wall needs a different implementer.

**Independent derivation is the entire protection**, and it is destroyed if the clean side
reaches around the wall. Governing rule:
[`.claude/rules/cleanroom-two-team-separation.md`](../../.claude/rules/cleanroom-two-team-separation.md) — read it first.

Also note: *"make it N% different"* is **not** a defense and must not guide any decision.
There is no percentage threshold that makes a derivative work non-infringing, and that
reasoning presupposes deriving from the original. **Design from the requirements.**

## Your only functional input

**[`docs/specs/key-custody-and-rotation-cleanroom-spec.md`](../specs/key-custody-and-rotation-cleanroom-spec.md)**

12 requirements (R1–R12) + 6 acceptance criteria, each written as *what the system must do*
and justified from Zeta's own constraints. Implement from the requirements, in whatever
shape is natural for this codebase. It was checked for expression leakage (zero prior-art
names), so you can work from it freely.

## Zeta context you SHOULD read (all our own work — no wall issue)

| File | Why |
|---|---|
| `src/Core/KeyStore.fs` | keys as **events** on the Z-set stream, pluggable backend, **reference-not-copy**. R6/R7 should compose with this, not replace it. |
| `src/Core/DagFs.fs` | content-addressed multi-parent tree; `editLocal` is a **copy-on-write fork**. R4 is meant to land here. |
| `src/Core/Hat.fs` | role bundles with **action restrictions**. R8's bounded grants attach here. |
| `src/Core/Policy.fs` | typed **decision-with-feedback** kernel. R12 (decisions explain themselves) is its natural home. |
| `.claude/rules/manifesto-13-specifications.md` | §1 scale-free, §3 weight-free, §5 memory preservation, §11 multi-oracle. |
| `.claude/rules/local-time-never-enters-the-shared-fold.md` | R9 **is** this rule applied to expiry. |

## Environment

- Work in **`/Users/acehack/.local/share/zeta-otto`**. The shared checkout
  `/Users/acehack/Documents/src/repos/Zeta` is **VIEW-ONLY**.
- Branch from `origin/main`.
- If you touch F#: `dotnet build -c Release` must stay at **0 warnings / 0 errors**
  (`TreatWarningsAsErrors` is on).
- Commit trailer: `Co-Authored-By: <your name> <...>`; PR body ends with the Claude Code line.

## Scope — do NOT attempt all 12 at once

Smallest slice that proves the hardest requirements:

1. **R8 + R9 first.** Time-bounded grants that expire **with no coordination**, evaluated
   against **agreed phase** rather than wall-clock. These are load-bearing: there is
   currently **no expiry concept anywhere** in `Hat`/`Policy`/`KeyStore`, and an unbounded
   grant is accumulating authority (§3 weight-free). Small and highly testable.
2. **Then R5** — three key slots (previous / current / next), with a test that
   `previous`-signed material verifies for exactly the stated window and not after.
3. **Defer R4 and R10** (custody fork, staking witness) — they depend on decisions still
   being made.

**Acceptance criteria 1, 2 and 6 matter most:** expiry with no message sent; the rotation
window boundary; two principals with skewed clocks agreeing on whether a grant is live.

## One hard-won caution from this repo (2026-08-09)

**A test that cannot fail is worse than no test.** Several self-certifying tests were found
and fixed here today — including one that asserted a vacuous branch and one that passed
unchanged through a *material* semantic change. Before you trust a new test, **deliberately
break the implementation and confirm it goes red.**

## What to report back

- What you implemented and what you deliberately deferred.
- **Anything in the spec that was ambiguous or wrong.** A spec defect found by the clean
  side is a genuinely valuable outcome — the spec author is fallible, and finding a
  requirement that cannot be satisfied as written is worth more than silently working
  around it.

## Coordination note

Otto dispatched a general-purpose clean-side agent on this same spec at 2026-08-09 (also
wall-compliant). **Check for in-flight work before starting** so two clean-side
implementers do not collide — or take a different slice (e.g. if the other took R8/R9, take
R5).
