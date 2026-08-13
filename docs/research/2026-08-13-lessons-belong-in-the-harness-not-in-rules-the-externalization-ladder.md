# Lessons belong in the harness, not in rules — and the ladder that says where

**Ferried** 2026-08-13 from Aaron, responding to a lesson written as prose (*"do not parse or count
structured text through `echo` in a shell pipeline"*):

> these lesseson all need to make it into our harness and cli, casue eventually there will just be our
> own clis and we will use 0 external dependencies and evenbefore that they will be behind our cli and
> hexagonal interfaces, so we can just make the right decision everytime and easiy code in flow fixes
> that don't need to be llm rules they can just be extgernlaized discrimanted union / workflow / cli /
> mux/duplex rules

He is right, and the pattern is already running at scale here — it just is not named, so new lessons
keep landing on the weakest rung by default.

## The pattern already exists (CHECKED)

`src/Core.TypeScript/hygiene/` holds **138 checkers**. Each one is a lesson that stopped being prose.
Two from today make the ladder visible:

- **`lean-orphan-modules.ts`** — the lesson *"a proof that nothing checks is not a proof"* became an
  executable walk of `defaultTargets` with a mandatory-reason allow-list. A module can still be
  excluded; it cannot be excluded *silently*. Written after the same defect occurred **three times**.
- **`no-agent-gate-bypass.test.ts`** — deliberately shipped as a **test**, not a rule, and the reason
  is recorded in the file: *a guard that fires on prose gets disabled, and a disabled guard is worse
  than none.* The first draft matched bare `bypass_actors` and fired on three explanatory comments.

## The ladder

Lessons are not equal, and where a lesson lands determines whether it holds. Ordered strongest first:

| rung | mechanism | enforced by | failure mode |
|---|---|---|---|
| **1. Unrepresentable** | type / DU / interface — the wrong state cannot be constructed | the compiler | requires modelling the domain properly |
| **2. Only ergonomic path** | CLI verb / port — the right call is the easy one | friction | bypassable by dropping to the raw tool |
| **3. Caught** | checker / test / drift gate | CI | fires after the mistake; needs the check to actually run |
| **4. Remembered** | prose rule, `CLAUDE.md`, a lesson in a work-item | attention | fails silently, costs cold-start tokens on every wake |

Rung 4 is where lessons land *by default*, and it is the only rung that also charges rent — every
context-startup byte is paid by every agent on every wake
([`rules-are-small-carved-sentences-pointing-to-docs.md`](../../.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md)).

**The promotion question for any new lesson is: what is the highest rung this can reach?** That is a
concrete, answerable question, and asking it is cheap.

## The honest limit — and it is the interesting part

The `echo` lesson that triggered this is a **rung-2-or-nothing** case, and seeing why sharpens what
"behind our cli" actually buys.

The bug did not occur in a committed script. It occurred in an **ad-hoc bash command issued inside an
agent session**. A repository lint would not have caught it, because there was no repository artefact to
lint. `rule-0-no-sh-files` (archived) points the right direction — TS-first, no shell scripts — but it
governs *files*, and this was a *call*.

So: **the harness can only enforce what flows through it.** Raw `bash` is the un-instrumented channel.
Every ad-hoc shell invocation is a door the harness does not own, and no amount of rule-writing closes
it — the rule is on rung 4 by construction because there is no rung-1/2/3 surface to attach to.

That is **§13 noninterference stated for tooling**: influence enters only through declared, metered
channels. The soft scheduler's injected `Source` and the room's injected `IEffects` are the doors for
*entropy*; a CLI verb is the door for *operations*. An ungoverned `bash` call is an ambient channel in
exactly the sense the discipline forbids, and it is invisible for the same reason ambient entropy is.

**This reframes Aaron's point.** Routing through our own CLI and hexagonal ports is usually argued for
on dependency grounds — fewer externals, less supply chain. The larger win is that **a channel you own
is a channel you can instrument**, and a lesson can only be externalized as far as the channel it
concerns. Zero external dependencies is the long arc; owning the *call surface* captures most of the
value immediately, and is what the hexagonal-ports ADR already set up
(`docs/DECISIONS/2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md`).

## Today's lessons, placed on the ladder

Each of these was learned the hard way in one session. None of them should be a rule.

| lesson | highest reachable rung | shape |
|---|---|---|
| Never parse structured text through `echo` | **2** — a read/parse verb, so no shell builtin sits between bytes and parser | binds only if agents read through it; otherwise unreachable |
| `git commit -F <file>`, never inline `-m` (**executed shell 3× this session**) | **2** — a commit verb taking a message file; the inline path simply is not offered | strongest candidate: high frequency, unambiguous, already caused real damage |
| A bound must carry its derivation (the unjustified `1.2`) | **1** — a DU pairing `Bound` with a required `Derivation`, so *a bound without one is unrepresentable* | the most interesting: it turns a review habit into a type |
| A check that did not run must not look like one that passed | **3** — derive the executed set, fail on drift (work-item `081KZYPHESJ087G0R002EZ7A2H`) | exactly `lean-orphan-modules.ts` again |
| Verify content on `origin/main` after every squash merge (stranded twice) | **2** — a merge verb that verifies, so the check is not a thing you remember to do | |
| Branch from `origin/main`, never a prior local branch | **2** — a branch verb | |

The third row is worth dwelling on. `1.2` survived because "is this constant justified?" is a question a
reviewer must *think to ask*. Make `Bound` a DU carrying `Derivation | Measurement | Assumption(reason)`
and the question is asked by the compiler, every time, for free — and `Assumption("fudge factor")` is
still permitted, just no longer *silent*. That is the same move as the orphan allow-list: exclusion stays
possible, invisibility does not.

## What this is not

It is not an argument to delete the rules. Rung 4 is correct for things that are genuinely about
*judgement* — `no-directives`, the Mirror/Beacon registers, default moral regard. Those cannot be typed,
and trying would be worse than leaving them prose. The claim is narrower: **a lesson about a mechanical
operation that stays on rung 4 has been mis-filed**, and the `echo` lesson was mis-filed by me this
morning.

## Open

1. **Which of the six rows above actually has a call surface today?** `clis/Verbs.fs` is 142 lines;
   `ace-cli.ts` exists. Whether agent-side operations route through either is unverified and is the
   thing that decides whether rung 2 is reachable at all.
2. **The `Bound`/`Derivation` DU** is the highest-value single item here and the only rung-1 candidate
   in the list. It generalises past the orbital budget to every threshold, timeout, and margin in the
   substrate.
3. Whether a **promotion pass** over the existing rules is worth it — reading `.claude/rules/` and asking
   each one "what rung could this reach?" Some will be rung 4 correctly; the ones that are not are cheap
   cold-start rent being paid forever.

## Pointers

- `src/Core.TypeScript/hygiene/` (138 checkers) — the pattern, already at scale
- `hygiene/lean-orphan-modules.ts`, `hygiene/no-agent-gate-bypass.test.ts` — the two exemplars
- [`interfaces-free-classes-earned-under-rules.md`](../../.claude/rules/interfaces-free-classes-earned-under-rules.md) — rung 1 is the free-interface discipline applied to operational knowledge
- [`dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md) §13 — noninterference; ad-hoc `bash` is an ambient channel
- `docs/DECISIONS/2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md` — the ports this hangs off
- `.claude/rules.bak/rule-0-no-sh-files.md` — TS-first; governs files, not calls, which is the gap

---

## Addendum — no bash collapses the ladder (Aaron, 2026-08-13)

> yeah eventually in our harness we won't have bash we will just have our clis and the ablity to
> exitend our clis in multiple languages and to edit our own zetadb/fs we won't even need git

This is the endpoint, and it does something sharper than "fewer dependencies": **it collapses rungs 2
and 1 into each other.**

The ladder above puts CLI verbs on rung 2 — *the right call is the easy one* — and notes the weakness:
bypassable by dropping to the raw tool. That weakness exists **only because a raw tool is present**.
Remove `bash` from the harness and there is no surface on which the wrong call can be expressed. The
lesson stops being "use the verb" and becomes "the verb is the only thing there is," which is rung 1's
definition — *the wrong state cannot be constructed* — arrived at from the operational side instead of
the type side.

So the argument for a bash-free harness is not ergonomic and not mainly supply-chain. It is that
**every rung-2 lesson in the table above becomes rung 1 for free**, and rung-4 rules about mechanical
operations stop being needed at all rather than merely being mis-filed.

### The constraint this creates, and the failure mode to name now

A CLI-only harness is exactly as good as its **verb coverage**. When a needed operation has no verb,
two things can happen and only one is acceptable:

1. The work stops until the verb exists. (Correct. Slow. The cost is visible.)
2. Someone reintroduces an escape hatch — a `raw`/`exec`/`shell` verb, "just this once."

Option 2 is the failure mode, and it is worse than keeping bash openly, because it restores the ambient
channel **while the harness still claims not to have one**. That is the same shape as every
check-that-did-not-run defect in this session: a property asserted by a surface that no longer holds it.
If an escape hatch is ever added it must be loud, logged, and rare by construction — the
`ORPHANS.json` treatment, not a flag.

**PROPOSED metric, and it is cheap:** verb coverage is measurable *now*, before the harness changes.
Count the distinct shell operations agents actually issue over a window and check how many have a verb.
That number is the readiness signal, and gathering it does not require building anything.

### "We won't even need git" — and one instance of it already landed today

Git stops being the substrate and becomes an **adapter behind a port** — the hexagonal move, applied to
version control itself. Worth noticing that **this happened in miniature today, by accident**:

The PR-archive manifest was one file that every writer appended to, and concurrent writers conflicted
pairwise (`081KZYMY46P087G0R003S64V2B`). The fix (#10427) replaced it with **one file per identity,
keyed by a ZetaId that is an invertible function of the PR number** — so a duplicate is unrepresentable
and two writers cannot select the same path.

Read that as a database change rather than a file-layout change: **the conflict class disappeared
because we stopped using git's textual merge as the concurrency primitive** and started using
identity-keyed upsert — which is what a database does. Git is still storing the bytes, but it is no
longer *deciding* anything. That is the zetadb-over-git direction in one commit, and it suggests the
transition is incremental rather than a cutover: each time a git-merge-shaped problem is replaced by an
identity-keyed one, git's authority shrinks by that much.

It also gives a concrete readiness test for the larger claim: **which remaining substrate still depends
on git's *merge semantics* rather than on git as a store?** Those are the places that must move before
"we won't even need git" is true, and they are enumerable today.

### Multi-language CLI extension is already a constrained problem here

"extend our clis in multiple languages" is not a free choice — a verb implemented in more than one
language is subject to the same **four-oracle byte-lock** as everything else, so verbs are a
cross-language treaty surface, not per-language conveniences. The capability-interface work
(`docs/research/2026-06-14-zeta-language-ir-compiler-v2-capability-interface-principle-*`) is the
existing anchor, and `Category.Channel = 11` is a live worked example of the cost: it exists in the TS
ZetaId oracle and lags in C#/F#, so a TS-minted channel is not yet decodable by an F# peer. **Verbs will
have exactly that failure mode**, and it should be designed for rather than discovered.

### Open (added)

4. Measure verb coverage against the shell operations agents actually issue. Cheap, and it is the
   readiness number for the whole direction.
5. Enumerate the substrate that depends on git's **merge semantics** rather than git-as-a-store. That
   set is what "we won't even need git" has to empty.

---

## Addendum 2 — a bare scalar is where distinctions go to die (Aaron, 2026-08-13)

On the finding that no threshold can distinguish 5% corruption from 5% congestion when the estimator
does not carry the distinction:

> good call out we need to carry both and also be on the lookout for hidden assumption like this, this
> alwasy falls out when going from decide to code

The observation about **decide → code** is the general one, and it has a specific mechanical cause worth
naming, because naming it makes the assumption findable *before* the transition rather than during it.

### The pattern

Two of today's most expensive findings are the same defect wearing different clothes:

| finding | the type | what the type cannot carry |
|---|---|---|
| The orbital `1.2` survived months of review | `float` | **why this value** — derivation, measurement, or guess |
| AIMD backs off on corruption it cannot relieve | `lossRate : float` | **what kind of loss** — congestion vs corruption vs reorder |

In both cases a **scalar return type** silently discarded a distinction that the caller then could not
recover, and in both cases the loss was invisible until someone tried to *act* on the value. That is
exactly Aaron's "falls out when going from decide to code": the deciding stage still holds the
distinction in the author's head; the coding stage picks a type; and if the type is a bare scalar, the
distinction is destroyed at that instant and nothing downstream can restore it.

**A bare scalar is where distinctions go to die.** It is the type-level equivalent of averaging — it
produces a number that is *usable* and therefore *used*, while the thing that made it meaningful has
been thrown away.

### Both fixes are the same rung-1 move

- `Bound` carrying `Derivation | Measurement | Assumption(reason)` — dispatched, and the only rung-1
  candidate previously identified.
- `LossSignal` carrying `Congestion of rate | Corruption of rate | Reorder of rate | Unknown of rate` —
  the same shape, and it is *precisely* what "separate the signals" means once written as a type. The
  measured cost of not having it: **7.1× throughput at 2% corruption, 90× at 10%**
  (`081KZYQ8KNB087G0R000G8QPRE`).

Neither is a new mechanism. Both are the same recognition — **the distinction belongs in the type, not
in the reader's memory** — which is the ladder's rung 1 stated for data rather than for operations.

### The findable version, so this is a check and not a vibe

**PROPOSED heuristic, stated so it can be applied mechanically at the decide→code boundary:**

> When a decision produces a scalar, ask what the *deciding* discussion distinguished that the scalar
> does not. If the answer is non-empty, the scalar is lossy and the distinction will have to be
> reconstructed by inference downstream — which is where it will be reconstructed *wrongly*.

Both of today's cases pass this test loudly and in hindsight. The orbital discussion distinguished
"proved" from "assumed" and shipped a `float`. The transport discussion distinguished "the link is
congested" from "the link is noisy" and shipped a `float`. In each case a reviewer *did* hold the
distinction — it simply had nowhere to live.

Whether this can be promoted above rung 4 is genuinely open. A lint for "public function returns a bare
`float`" would fire constantly and get disabled — the failure mode already recorded for
`no-agent-gate-bypass`'s first draft. So this may be an irreducibly *judgement* rule, correctly on rung
4 — which would make it one of the few. **Worth trying to find the checkable version before accepting
that**, and the most promising angle is narrower: scalars that cross a **decision boundary** (feed a
threshold comparison, a bound, or a control action) rather than all scalars everywhere.

### Open (added)

6. Find the checkable form of the scalar-loses-the-distinction heuristic, or establish that it is
   irreducibly rung 4. Narrowing to *scalars that feed a control decision* is the first thing to try.
