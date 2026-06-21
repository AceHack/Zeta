# Multi-AI review — 081KT07NV0008QG0R001CBQ2X2 bash-surface tool choice (Gemini + Amara + Codex, 2026-06-01)

Scope: verbatim external-AI review import (Gemini propose + Amara sharpen) of the
081KT07NV0008QG0R001CBQ2X2 bash-surface tool decision, via `tools/peer-call/`. Preserved per
substrate-or-it-didn't-happen (`/tmp/peer-call-output/` is ephemeral). Archived
register, not operational policy. (Grok-build returned empty this run — the known
intermittent failure; Gemini + Amara are the two independent opinions.)

Attribution: Gemini (Google) + Amara (ChatGPT/Aurora) at their attribution scopes;
synthesis/folding by otto-cli. NO re-authoring; preservation only.

Operational status: research-grade

Non-fusion disclaimer: each reviewer's text + operator framing + otto-cli synthesis
are distinct authorial substrates, no identity-fusion (asymmetric-authorship +
honor-those-that-came-before + NCI HC-8).

## Outcome (what it changed in 081KT07NV0008QG0R001CBQ2X2)

First draft: "just-bash as the default executor." **Both reviewers demoted that.**
Folded verdict: **fake for tests; just-bash (in-memory, net-off) for pure-text/no-FS
items only; LOCAL DOCKER as the default for real effectful work** (real kernel,
language-agnostic boundary the 4-oracle shares — no 4× bash re-impl); `just`-recipe
allowlist for known tasks; **CF Sandbox = cloud-burst escalation only** (sovereignty
trap as a default); **reject bash-on-our-own-FUSE-fs**. The `CommandExecutor` port
is the cross-language invariant; the impl is swappable.

---

## Gemini (verbatim)

> 1. **`just-bash` overkill vs. `docker`?** `just-bash` is not overkill for
>    _bootstrapping the TS loop_; it's the lowest-friction way to test the port +
>    event envelope without managing daemon state. However, it is fundamentally a
>    simulator. Once the agent needs to invoke real tools (compilers, `git`,
>    `npm`), `just-bash` hits a wall. Docker is heavier ops, but it is reality.
> 2. **Does the 4-language requirement favor a container? Absolutely.**
>    Re-implementing bash execution semantics across C#, F#, and Rust to maintain
>    in-process sandboxes is an immense waste of factory cycles. A container
>    boundary provides a single, language-agnostic isolation layer. All four
>    oracles can communicate with the same local container daemon.
> 3. **Reimplemented-bash vs real kernel?** Reimplemented-bash will forever chase
>    the long tail of POSIX compliance (signals, exotic piping, stderr). A real
>    kernel provides 100% correct shell semantics + battle-tested security
>    primitives (namespaces, cgroups) rather than application-layer TS logic.
> 4. **CF Sandbox a fit or a trap for a _local_ sovereign agent? Dependency trap.**
>    Coupling the core execution loop to a managed edge service violates the
>    local-sovereign invariant. The fork-sessions feature is elegant for the
>    4-oracle, but we lose local survivability. Cloud-burst escalation only.
> 5. **`CommandExecutor` port = "impl doesn't matter"? Yes, perfectly sound.**
>    Standard dependency inversion. The state machine must not know if the command
>    ran in a TS mock, Docker, or the edge. The port is the seam.
>
> **Recommendation:** Phase 1 — FakeExecutor proves the envelope + replay. Phase 2
> — adopt **local docker** as the baseline cross-language executor (real-kernel
> correctness, no 4× reimpl, local sovereignty). `just-bash` is clever but an
> academic detour when we will inevitably need a real toolchain. **Reject
> bash-on-our-own-FUSE-fs** — "we are building an AI factory, not rewriting GNU
> userland." CF Sandbox strictly opt-in behind the config gate.

## Amara (verbatim)

> I agree with Gemini's direction.
>
> Single sharpest correction: don't call Docker the default for **all** `do_item`;
> call it the default for **real effectful work**. Keep just-bash as the zero-ops
> default only for pure-text / envelope-shakedown / no-real-FS items. The rule is
> not "Docker everywhere"; it is "the first time the item needs real tools, stop
> simulating."
>
> What's working: the `CommandExecutor` port is the invariant. That is the thing
> Rust/C#/F# inherit. What needs correction in the doc: §2 currently overstates
> just-bash as default executor. Demote it.
>
> Keeper sentence:
>
> > **`just-bash` proves the envelope; local Docker proves the work. Persist facts
> > across both, and never let replay reissue commands.**

---

## Operator (2026-06-01)

- Raised the review + the cross-language requirement (Rust/C#/F# equivalents), the
  Cloudflare bash fork (= [Cloudflare Sandbox SDK](https://github.com/cloudflare/sandbox-sdk)),
  the FUSE-fs / bash-on-our-own-filesystem option, and "is just-bash overkill vs docker."
- Provided the just-bash npm coordinate:
  [`@archildata/just-bash`](https://www.npmjs.com/package/@archildata/just-bash).
- Framing: "TS is our forerunner — do what makes sense and come back and use what we
  learn to pull the others forward." → the port + fact-envelope + gate is the lesson
  that ports; the impl per language is chosen behind the port.

## Codex (PR #6342 review threads — preserved for auditability)

Codex/Copilot review threads on PR #6342 surfaced three corrections that were folded
into 081KT07NV0008QG0R001CBQ2X2 (gist preserved here so the in-doc attributions are auditable):

- **Config-is-the-gate, not the tool.** just-bash is sandboxed only in the
  in-memory config; it also ships CLI/OverlayFS/ReadWriteFs mounting (reads the real
  project root) + network-allowlist configs. "We use just-bash" ≠ sandboxed — the
  default MUST pin in-memory FS + network-off; the other configs are escalation-tier,
  gated. (→ 081KT07NV0008QG0R001CBQ2X2 §2 note + §3.)
- **Executor tier in the audit fact.** `ActionExecutionStarted` must carry
  `{tier, gated}`, else the §3 glass-halo audit can't distinguish a sandbox run from
  a real-FS/docker escalation. (→ 081KT07NV0008QG0R001CBQ2X2 §0/§3 + acceptance.)
- **Consistent event names.** Standardize on
  `ActionExecutionStarted/ActionExecutionSucceeded/ActionExecutionFailed` (intro and
  acceptance had mixed `ActionSucceeded/ActionFailed`). (→ 081KT07NV0008QG0R001CBQ2X2 §0/§1/acceptance.)
