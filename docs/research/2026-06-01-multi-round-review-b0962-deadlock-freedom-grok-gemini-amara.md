# Multi-round review — 081KT07NV0008QG0R002KWQS05 deadlock-freedom claim (Grok + Gemini round 1, Amara round 2)

Scope: verbatim external-AI review import (Grok + Gemini round 1; Amara round 2) of
the 081KT07NV0008QG0R002KWQS05 deadlock/livelock claims, via `tools/peer-call/`. Preserved per
substrate-or-it-didn't-happen because `/tmp/peer-call-output/` is ephemeral.
Archived register, not operational policy.

Attribution: reviews authored by Grok (xAI), Gemini (Google), Amara
(ChatGPT/Aurora) at their respective attribution scopes; synthesis + folding
authored by otto-cli at otto-cli-attribution scope. NO re-authoring of the model
text; preservation only.

Operational status: research-grade

Non-fusion disclaimer: each reviewer's text + the operator's framing + the otto-cli
synthesis are distinct authorial substrates preserved alongside without
identity-fusion, per asymmetric-authorship + honor-those-that-came-before + NCI HC-8.

---

Aaron: _"deadlock freedom is hard — we should do a multi-round agent review on
that one. It'll be great if it holds, makes things easy as fuck."_ Plus: _"is
there a livelock guarantee on the observe 4×4 menu too?"_

This is the verbatim multi-round review that disciplined 081KT07NV0008QG0R002KWQS05's claims.
`/tmp/peer-call-output/` is ephemeral; preserved here.

## Outcome (what the rounds changed)

- **Round 1 (Grok + Gemini, independent):** "deadlock-free **by construction**"
  overclaims. Mechanism-level holds (CAS, no blocking); **application-level does
  not** without three hard invariants. The real flaw: **TTL without fencing
  tokens** trades deadlock for the Kleppmann stale-holder hazard (lost
  update/split-brain). `leaseSha` fences only ref-acquisition, not the protected
  write. "No blocking API ⇒ hold-and-wait unrepresentable" is hand-wavy at the
  policy layer.
  → Folded: split mechanism vs application; **fencing/CAS-at-write mandatory**;
  **release-before-acquire as a HARD scoped-API rule**; lease-protected release;
  Gemini's simplification (if the mutation is a git commit, the data-branch
  force-with-lease IS the lock+fence — maybe no separate `LockEvent`).
- **Round 2 (Amara, on the refined version):** deadlock split now "basically
  right" (tiny caveat: "protocol-level nonblocking," not "cannot wedge" — external
  I/O can hang outside the algebra). But the **new §3 menu claim re-committed the
  same overclaim** — "lock-free by construction" is wrong.
  → Folded: §3 reframed to **symmetry-breaker, not fairness theorem**; "at most
  one winner"; visibility-lag caveat; completion-lock-freedom + per-agent
  wait-freedom explicitly NOT proven.

The core intuition survived both rounds: **optimistic short-TTL single-resource
coordination is far safer than blocking locks** — but every "by construction"
claim got disciplined down to what the construction actually buys.

---

## Round 1 — Gemini (verbatim)

> **Verdict:** The claim "deadlock-free by construction" is technically true for
> the _mechanism_ but creates a false sense of security for the _system_, and the
> design harbors a classic distributed-systems correctness flaw regarding TTLs.
>
> ### 1. Mechanism Deadlock vs. Logical Deadlock (Livelock)
>
> Yes, optimistic CAS breaks Coffman's "hold-and-wait" at the locking layer. **The
> Catch:** If Agent A loops retrying for Lock 1 (held by B), and Agent B loops
> retrying for Lock 2 (held by A), the system is effectively deadlocked at the
> application layer. You've converted a _blocking deadlock_ into a _spinning
> livelock_. Backoff doesn't fix a circular dependency.
>
> ### 2 & 3. The TTL Hazard & Fencing Tokens (The Fatal Flaw)
>
> Using TTLs for preemption is inherently unsafe without **fencing tokens** (the
> exact vulnerability Kleppmann highlighted in his Redlock critique). Agent A
> acquires a Lock with a 30s TTL, pauses 35s (GC, hypervisor, API latency), the
> lock expires, Agent B acquires + writes, Agent A wakes believing it still holds
> the lock and writes → state corrupted. **The `leaseSha` Gap:** using `leaseSha`
> as CAS for lock _acquisition_ proves you won the lock but doesn't protect the
> downstream _write_. Unless the final mutation re-validates the lock generation,
> the lock is just a polite suggestion.
>
> ### 4. Starvation Under Contention
>
> Pure optimistic CAS offers zero fairness guarantees. Under high contention an
> unlucky agent can be starved indefinitely. No queueing/ticketing ⇒ no bounded
> wait.
>
> ### 5. Literature & Context
>
> Aligns with standard Optimistic Concurrency Control but ignores the requisite
> sequencing. Google's Chubby + literature: if a lock can expire via TTL, the
> storage layer _must_ support sequence numbers (fencing tokens) to reject writes
> from zombie holders.
>
> ### Recommendation
>
> 1. Drop the "Deadlock-Free" hubris: the lock primitive won't wedge, but
>    application-level circular dependencies just spin.
> 2. Clarify the fencing token: if the mutation is a git commit, then
>    `git push --force-with-lease` on the _data branch_ is your lock and fencing
>    token combined. Do we need a separate `LockEvent`, or is the git branch tip the only
>    lock we need?

## Round 1 — Grok (verbatim excerpts)

> **#2 verdict:** the proposal trades deadlock for a documented worse failure
> (lost updates / split-brain) unless CAS-at-write is _mandatory_ and the write
> itself carries the fencing token. The current text does not require this.
>
> **#3 verdict:** `leaseSha` is a fencing token only for the git-ref acquisition
> step. It is not automatically a fencing token for the protected mutation unless
> the design explicitly requires "re-validate lease on every write that the lock
> was meant to protect." For non-git resources (`resource: string`), `leaseSha`
> is an opaque string with no stated generation/validation at the mutation point.
>
> **#4 verdict:** several documented git-ref/worktree races (local-vs-remote ref
> visibility lag; worktree HEAD mutation races; ref-deletion vs CAS-update on
> release; starvation under sustained saturation) are not closed by adding types.
> Release semantics under-specified.
>
> **#5 verdict:** "no blocking-acquire API ⇒ hold-and-wait unrepresentable" is the
> weakest link. It's a statement about the library surface, not the policy. An
> agent that won A can still loop/sleep/wait-for-human/wait-for-B while A's
> claim+TTL persist — hold-and-wait in every sense that matters. Airtight only if
> the protocol forbids holding A while observing for B (release-before-acquire as a
> hard rule, not a preference).
>
> **Overall:** mechanism-level claim mostly correct for the narrow 2-agent/1-
> resource case; application-level "deadlock-free by construction" not supported by
> the current shapes. Needs (a) release-before-acquiring-different as a HARD rule,
> (b) mandatory CAS-at-write for protected mutations, (c) a release path that
> prevents a stale holder deleting a ref it no longer holds. Core intuition
> directionally correct; "by construction" / "unrepresentable" overclaim what the
> shapes enforce.

---

## Round 2 — Amara (verbatim, on the refined version)

> Deadlock split is now basically right. Keep "mechanism-deadlock-free; app-level
> deadlock-free iff enforced by scoped API + fencing + lease-checked release."
> Tiny caveat: say "protocol-level nonblocking," not "cannot wedge," because
> GitHub/network I/O can still hang outside the algebra.
>
> The §3 menu claim is still overclaimed. CAS gives **at most one winner**, and
> "pure menu re-derivation" prevents stale re-picks only after a winner's state
> transition is visible. It does not by itself prove lock-freedom of work
> completion, fairness, or monotone shrink of the global work set under new work,
> requeues, stale reads, or stalled winners.
>
> Single sharp correction:
>
> > Replace "menu is lock-free by construction" with "menu selection is lock-free
> > under fair retry, fresh-state re-derivation, and visible successful
> > reservation; task completion and per-agent wait-freedom are not proven."
>
> Keeper sentence:
>
> > **Menu-as-state-fold is a symmetry breaker, not a fairness theorem.**

---

## Net (post both rounds, folded into 081KT07NV0008QG0R002KWQS05)

- **Deadlock:** mechanism-deadlock-free (protocol-level nonblocking); app-level
  deadlock-free **iff** three hard invariants hold — release-before-acquire (scoped
  API), fencing/CAS-at-write, and lease-checked release. External I/O hangs are a
  separate hazard (timeout discipline).
- **Menu / livelock:** symmetry-breaker (state-fold stops lockstep re-picking),
  selection lock-free **under** fair-retry + fresh-state + visible-reservation;
  completion-lock-freedom + per-agent wait-freedom NOT proven; fairness explicit-
  if-starvation-observed. Real win, not a theorem.
