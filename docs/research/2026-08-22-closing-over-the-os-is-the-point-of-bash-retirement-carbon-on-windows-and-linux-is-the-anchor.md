# Closing over the OS is the point of bash retirement — Carbon on Windows and Linux is the anchor

**Date:** 2026-08-22 · **Register:** Mirror→Beacon · **Status:** principle recorded; the
ledger below is measured, the error model in §4 is **toy / proposed** and metered by nothing yet.

## 0. The observation (Aaron, 2026-08-22)

> *"rewrite .sh files into .ts files allows the developer to have one interface, the same
> interface for every operating system. One of the overarching goals of Zeta is to **completely
> close over the OS**, like an interpreter closing over a compiler, and make every OS look the
> same. I've done this before when I implemented the **Carbon API on Windows and Linux at
> MacVector** — the one from Apple. The difference is it will be our interfaces and CLIs and
> commands and such that are **tuned for AI and good teaching feedback** that does not force
> **louder limit erasure** on errors, but instead gives teaching and **potential generator
> function updates in -1 zsets**."*

This reframes the bash-retirement programme. The existing artifacts
(`check-bash-retirement-inventory.ts`, `docs/SHELL-DEPRECATION-SEQUENCE.md`) sequence the work
by *measured key exposure*, which is a good ordering and answers "which first". Neither answers
**"why at all"**, and the honest answer is not "TypeScript is nicer".

## 1. Why a `.sh` file is an OS-specific interface, not merely an OS-specific implementation

The distinction is the whole claim, and it is checkable rather than aesthetic.

A `.sh` file's *interface* — the thing a caller must know to invoke it — includes: that a POSIX
shell exists, that it is on a path the caller can reach, that word-splitting and globbing rules
apply to the arguments, that the result arrives as an 8-bit exit status plus untyped bytes on two
streams. None of that is implementation detail; all of it is what the caller must model. So the
host leaks into the *caller's* mental model, not just into the script's body.

A `.ts` entry point replaces that with: one command, one argument grammar, one result shape.
The host still exists underneath — but it is now behind a door the caller does not have to model.

**"like an interpreter closing over a compiler"** is the precise part of Aaron's sentence. An
interpreter closes over the compilation step: the consumer stops needing to model the target
machine because the interpreter holds it. The Futamura projections are the formal statement of
that relationship, and they are already the repo's frame for this move
(`user_aaron_incremental_dependency_tracking_is_the_mental_model_wall_futamura_is_the_extreme`).

**The honest limit, stated first because it is the part most likely to be skipped:** a `.ts`
entry point closes the *invocation* interface immediately and closes the *host calls* not at all.
`osascript` is exactly as macOS-specific inside a `.ts` file as inside a `.sh` file. Which is why
this document carries a ledger (§3) rather than a claim.

## 2. The Beacon anchor: Carbon on Windows and Linux at MacVector — checked, not cited

Per `.claude/rules/anchor-to-human-prior-art.md`, an anchor must be **checked** (does it entail
what it is cited for?), not merely named.

**The anchor.** Aaron implemented Apple's **Carbon API** on Windows and Linux at MacVector. That
is a shipped, first-hand instance of the exact technique: take one platform's interface, and make
other platforms present it, so that consumers written against it stop modelling the host.

**What it entails, and does not.** Carbon (Apple, 1998–2000) was a transitional API letting
classic Mac OS applications run natively on Mac OS X. Reimplementing it on Windows and Linux is
therefore **interface reimplementation for portability** — the same shape as this programme.

**The asymmetry Aaron himself draws, and it is load-bearing:**

| | Carbon-on-Windows/Linux | Zeta's `.sh` → `.ts` |
|---|---|---|
| interface being closed over | **an existing, externally-owned API** (Apple's) | **our own**, designed as we go |
| the consumer | **existing applications**, unmodified — source compatibility | **agents**, and humans reading agent output |
| the success test | a program that compiled against Carbon compiles and runs elsewhere | an agent's model of "how do I do X" does not change per host |
| what the design may optimise for | fidelity to a fixed spec; deviation is a bug | legibility and teaching; the spec is ours to shape |

**So the parallel is real in technique and false in constraint.** Carbon closure was
*constrained* — deviating from Apple's semantics broke the applications that were the whole
point. Ours is *unconstrained* in that respect and constrained differently: the consumer is an
agent, so the interface may be shaped for teaching feedback, which Carbon could never do.

Do not read the anchor as "we are doing what Carbon did". Read it as: **the technique is known to
work at production scale, by someone in this repo, on a harder version of the problem** (harder
because the spec was someone else's and could not be negotiated).

**Beacon citations:** Apple Computer, *Carbon Porting Guide* / *Carbon Specification* (1999–2001)
— the API surface. Y. Futamura, "Partial Evaluation of Computation Process" (1971) — the
interpreter-closes-over-compiler relation. MacVector is already an anchored lineage in this repo
(`docs/PRIOR-ART-LIST.md`, `clis/README.md`, `docs/VISION.md`).

## 3. The OS-closure ledger — what each conversion actually closes

**This is the deliverable of the OS-closure lane**, and it exists because "converted to
TypeScript" is otherwise a claim with no denominator. A conversion is entitled to say it closed
the *invocation* interface; it must separately declare which host calls it did **not** close.

### 3.1 `tools/setup/op-token-setup.sh` → `.ts` (first entry, 2026-08-22)

| what | status | what closing it needs |
|---|---|---|
| invocation interface (shell, word-splitting, exit-status-only result) | **closed** | — |
| argument grammar / result shape | **closed** | — |
| `osascript` — native secure prompt | **not closed** | a secure-prompt port: Windows `CredUIPromptForWindowsCredentials`, Linux `systemd-ask-password` / `zenity --password` |
| `security -i` — Keychain write | **not closed** | the keystore port already scoped in `081KVNRSGVR08QG0R003R3RNJX` (libsecret / Credential Manager), and `081M00VN3FX087G0R0006ZGRWG` for the in-process `SecItemAdd` re-store |
| `pbpaste` — clipboard read | **not closed** | `wl-paste` / `xclip` / `Get-Clipboard` |

Net: **1 of 4 seams closed, 3 named.** The three that remain are behind one injected effects
door (`OpTokenSetupEffects`), which is what makes them portable *later* by adding an adapter
rather than by rewriting the command. On a non-macOS host the command **refuses and names the
missing port** — it does not degrade, and it does not silently no-op, because a setup step that
quietly does nothing is the vacuity class.

**What the conversion genuinely buys**, stated without inflation: the token no longer reaches an
argv (the `.sh` put it in `ps` output); the security model is held by tests instead of a header
comment; the failure paths teach; testability without a real Keychain; one fewer entry in the
retained-shell allowlist. **What it does not buy:** it does not remove `osascript` or `security`
— it moves who spawns them, and it is still macOS-only for those two calls.

## 4. The error model — `-1` z-sets, and what is genuinely novel here

**Register: `toy` / proposed.** Nothing in this section is metered. It is written down so it
lands as a designed thing rather than an aside.

Aaron's phrase names three distinct things and only the third is new:

- **"louder limit erasure"** — the failure mode where an error is flattened into a louder
  version of *"it failed"*. The information about *what the caller should now believe
  differently* is erased, so the only remaining escalation is volume. Every bare `exit 1` with a
  message is this. It is the same defect as an unfalsifiable check, moved to the error channel.
- **"teaching"** — the error explains the *model* the caller had wrong, not merely which
  assertion tripped. **Demonstrated concretely in this conversion:** every refusal in
  `op-token-setup.ts` renders `assumed` / `observed` / `believe now` (+ `next`).
- **"potential generator function updates in -1 zsets"** — the sharp one, and the open one.

### 4.1 The `-1` claim, and the test it has to pass before it is believed

The proposal: an error should be able to emit a **retraction** — a `-1` against the *prior that
produced the wrong behaviour* — so the **generator** is corrected rather than the failure merely
reported. Error handling becomes a Z-set operation on the generating model, not a terminal state.

The repo already has the retraction primitive (`src/Core/ZSet.fs`; the grant(+1)/revoke(−1)
config-topology fold), so the temptation is to declare the analogy sound and move on. Per
`.claude/rules/numerology-vs-number-theory.md`, **a shared `-1` is not an identification** — the
count matches, and matching counts identify nothing. What has to be checked is whether the
*invariants* transfer:

| Z-set retraction invariant | does an error-as-`-1` satisfy it? |
|---|---|
| the retraction names the **exact tuple** that was asserted | **unclear, and this is the crux.** An error knows what failed; it does not generally know *which prior* produced the failing behaviour. Attributing the `-1` to a specific generator input is a **causal** claim, and errors carry correlational evidence. |
| `+1` then `-1` sums to **∅** — the retraction is exact, not approximate | **not satisfied in general.** "This model was wrong" is not the exact inverse of "this model was right"; a partially-wrong prior retracted whole is over-correction. |
| retraction is **commutative** with other operations (order-free fold) | **plausibly satisfied**, if the `-1` is against a declared prior and not against wall-clock-ordered observations (`local-time-never-enters-the-shared-fold`). |
| the fold is **idempotent** under redelivery | **satisfiable** with an idempotency key (the work-item id / the refusal identity). |

**So the finding is: the analogy breaks at exactness and at attribution, and holds at
commutativity and idempotency.** That is more useful than a forced fit. It says the design should
*not* be "errors emit `-1` tuples into the generator's Z-set"; it should be something closer to
**"errors emit an ordinal, witnessed observation against a NAMED prior, and only a prior that was
explicitly declared can be retracted"** — which is the same `Evidence.AssertedOnly` /
`supportsClaim` discipline already typed in `src/Core/DerivationProtocol.fs`, and the same
ordinal-not-cardinal register the uncertainty ledger already uses
(`db/uncertainty/README.md`).

Filed as its own work-item; deliberately **not** built inside a token-capture script, because a
half-built error framework is worse than none.

## 5. Consequences for the rest of the programme

1. **Every future conversion adds a row to §3's ledger.** "Converted" without a ledger row is the
   claim without the denominator.
2. **The ordering does not change.** Key exposure still sequences the work
   (`docs/SHELL-DEPRECATION-SEQUENCE.md`); OS closure supplies the *why*, not the *when*.
3. **`curl-fetch.sh` and `host-tier.sh` remain structurally unconvertible** — they are `source`d
   libraries, and a compiled program cannot export functions into its parent shell. Under the
   OS-closure frame they are the honest permanent floor, not a backlog item.
4. **Refuse, never degrade.** A converted entry point on an unported host must fail loudly and
   name the missing port.

## Pointers

- `tools/setup/op-token-setup.ts` (+ `.test.ts`) — the first entry in the ledger
- `src/Core.TypeScript/secrets/keychain-macos.ts` §WRITE — the argv-free Keychain write
- `docs/SHELL-DEPRECATION-SEQUENCE.md` — the ordering (measured key exposure)
- `src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts` — the allowlist / denominator
- `.claude/rules/anchor-to-human-prior-art.md` · `.claude/rules/numerology-vs-number-theory.md` ·
  `.claude/rules/toy-is-free-metered-must-be-earned.md` — the three disciplines this note is
  written under
- `docs/research/2026-08-14-shell-deprecation-sequenced-by-key-exposure-the-interpreter-is-the-identity-gap-not-the-shell.md`
  §0.2 — "the interpreter, not the `.sh`, is the identity gap"; unchanged and not weakened by this
