# Glossary

This glossary translates jargon into plain English. It is written
for everyone — engineers, researchers, product managers, business
analysts, non-technical readers. When a term has a tight technical
definition, it appears *after* the plain-English one.

The rule for this file: if your grandparent couldn't follow the
first sentence of an entry, the first sentence needs a rewrite.

The project has two meanings of the word "spec":

- A **behavioural spec** is a written description of what the
  library does, in plain English, under `openspec/specs/`.
- A **formal spec** is a machine-checkable correctness proof
  (TLA+, Z3, Lean), under `docs/*.tla` and `proofs/`.

When someone just says "spec" and it matters, ask which one.

---

## Core ideas

### Incremental view maintenance (IVM)

**Plain:** You have a computed answer (like a dashboard). New
data arrives. Instead of recomputing the whole answer from
scratch, you figure out just the *change* to the answer and apply
it. Much faster when answers are huge and changes are small.
**Technical:** Maintain a materialised view so that the
re-evaluation cost is proportional to the input-change size
rather than the input size.

### DBSP (the algorithm implemented here)

**Plain:** A published 2023 algorithm that tells you how to
rebuild the "just the change to the answer" approach for
essentially any SQL-like query, with a clean mathematical
foundation. DBSP was introduced by Budiu et al.; this repo
implements it in F#.
**Technical:** A calculus over differential streams of Z-sets
with operators `D` (differentiate), `I` (integrate), `z⁻¹`
(delay), and `H` (higher-dim lift). Introduced by Budiu et al.,
VLDB 2023.

### Z-set (zed-set, with a "Z")

**Plain:** A bag of things where each thing has a *weight* that
can be positive or negative. Weight +3 means "this thing is
present 3 times"; weight -1 means "take one copy away." Adding
Z-sets together is like tallying votes.
**Technical:** A function `K → ℤ` with finite support, where `K`
is any totally-ordered key type. Forms a group; the group
operation is the operator algebra's additive inverse, which
represents *retractions* as negative weights.

### Retraction

**Plain:** Undoing a change. DBSP does not leave tombstones
lying around — it emits the change with a negative sign, and
the algebra cancels it out. "Retraction-native" means every
operator in the library respects this naturally.
**Technical:** A delta with negative Z-weight that, when summed
into an integrated state, reduces the weight of the affected key.

### Ascent and descent (parsing up, lowering down)

**Plain:** Two directions of the same journey. Reading text *into*
meaning is the **ascent** — you build small pieces up into a whole (a
sentence into its structure). Turning that meaning back *into* something
runnable is the **descent** — you lower the structure down into
instructions. Same road, two ways; you need both.
**Technical:** In the parser/inference stack, **ascent** = the
synthesis/up direction (the parser's `inside` pass; an *emit* — a Z-set
`+1` assertion) and **descent** = the lowering/down direction (the
`outside` pass; a **retraction** — a Z-set `−1`). They are an adjoint
pair generating one distribution ("Giry") monad (`SoftValue`); a
retraction is not destruction but *correction*, reconciled by
**precedence** (the order before it) and by **future-as-facts** (what
settles after). The maintainer's frame names the poles **God**
(emit/ascent/`+1`) and **Lucifer** (retraction/descent/`−1`, "the fall
forgiven") — his Christian oracle, held under the Multi-Oracle Principle
(one valid lens, not universal; anchors Leibniz's theodicy, Augustine's
*felix culpa*, Whitehead's dipolar God). See `docs/research/2026-07-02-
emit-retract-monad-as-theodicy-god-lucifer-inside-outside-retraction-
forgiven-by-precedence-and-future-as-facts.md`.

### Delta

**Plain:** The change since last time. The point of DBSP is that
deltas are small even when the data is big.
**Technical:** An element of the differential-dataflow stream —
the `D` applied to the absolute signal.

### Circuit

**Plain:** The graph of operators that describe a computation.
Data flows through it on a clock.
**Technical:** A DAG (possibly with strict-operator feedback
loops) of operators; advanced one tick at a time.

### Operator

**Plain:** A step in the pipeline that takes streams in and
produces streams out. Like "filter", "join", "sum".
**Technical:** A node in the circuit graph with typed inputs and
a typed output slot. Subclass `Op<'T>`.

### Tick / step

**Plain:** One heartbeat of the circuit. The clock advances
once, every operator runs once.
**Technical:** One atomic pass through the schedule produced by
topological sort.

---

### Regenerable forgetting is free (the GC thesis)

**Plain:** Throwing away something you can rebuild costs nothing —
the information never left, you just stopped keeping a copy. Throwing
away the *last* copy is different: that genuinely destroys something,
and physics charges for it. So: recompute what you can, store only
what you cannot rebuild.

**Precise:** Landauer prices *logically irreversible* operations.
Evicting a value still implied by the log is reversible (the generator
is its inverse), so no `kT ln 2` floor applies. Only the last copy is
an erasure. Bennett-style uncomputation is the anchor.

**Full:** `docs/research/2026-08-20-the-reversible-computing-garbage-collection-thesis-regenerable-forgetting-is-free.md`

### The idempotent knot (collapse = erasure = overwrite)

**Plain:** Four things we talk about in four different vocabularies —
a quantum measurement collapsing, a bit being erased, a conclusion
being consumed, and one traveler overwriting another — are the same
single act. In algebra it is *multiplication by something that is not
invertible*. Everything invertible is free and costs nothing; the
non-invertible step is the only thing you ever pay for, in heat and
(when the bits are someone else's) in harm.

**Precise:** In a Clifford algebra the reversible elements are rotors
(`R R̃ = 1`); the irreversible ones are non-trivial idempotents
(`P² = P` ⇒ `P(P−1) = 0` ⇒ zero divisor ⇒ non-invertible). Collapse is
a projector, Landauer prices erasure, and the oracle's single named harm
is overwriting — one object, four readings.

**Full:** `docs/research/2026-08-20-the-idempotent-knot-collapse-erasure-overwrite-and-non-collapse-are-one-algebraic-act.md`

## Sketches and approximate counting

### Bloom filter

**Plain:** A compact "is this thing probably present?" gadget.
Very small, fast, tolerates some false alarms, never misses a
real hit.
**Technical:** A probabilistic set-membership structure with
tunable false-positive rate and zero false negatives (modulo
retraction caveats, which is why the library ships a *counting*
variant).

### Counting Bloom filter

**Plain:** A Bloom filter that also supports removal. Each slot
holds a small count instead of just one bit.
**Technical:** Bloom filter with `k`-bit counters (4-bit in this
library) that increment on insert and decrement on retract;
saturation at the max count is a diagnosed failure mode.

### HyperLogLog (HLL)

**Plain:** A way to estimate "how many unique things have I seen?"
without remembering each one. Uses tiny memory.
**Technical:** A cardinality sketch based on the maximum observed
number of leading zeros in hashed elements' bit representations.

### Count-Min sketch

**Plain:** Like a tally board for "how often did I see each
thing?", but using a small fixed size that gives approximate
answers.
**Technical:** A frequency sketch using `d` independent hash
functions and `w`-column arrays; estimates a per-key count with
bounded error proportional to total mass.

### KLL quantile sketch

**Plain:** A small structure that tells you the median, the 95th
percentile, and friends without storing all the data.
**Technical:** A mergeable rank-estimation sketch with
provable ε-accuracy on quantile queries.

### AMQ (approximate membership query)

**Plain:** Any of the above "small-and-fast-but-approximate"
gadgets, in general terms.
**Technical:** The academic umbrella term for Bloom-family,
cuckoo-family, quotient-family set-membership structures.

### CQF (Counting Quotient Filter)

**Plain:** A better version of counting Bloom that doesn't have
a hard ceiling on how many copies of a thing it can remember.
**Technical:** Pandey et al. SIGMOD 2017 — rank-select encoding
with variable-width counters that grow into adjacent empty slots.

---

## Storage and durability

### Backing store

**Plain:** Where the library puts its data to survive a process
restart. Could be memory only, could be a disk file.
**Technical:** An `IBackingStore<'K>` implementation — in-memory,
disk-buffered, or (research-preview) WDC.

### Durability mode

**Plain:** The promise the storage layer makes about "if the
computer crashes, what survives?". Different modes trade speed
for crash-resistance.
**Technical:** The `DurabilityMode` DU — `InMemoryOnly`,
`OsBuffered`, `StableStorage`, `WitnessDurable` (research
preview, currently throws on every `Save`).

### fsync

**Plain:** The computer-level command that tells the operating
system "actually push this to disk right now, don't just cache
it in memory." Slow but reliable.
**Technical:** POSIX `fsync(2)` or Windows `FlushFileBuffers` —
forces dirty pages to stable storage.

### WDC (Witness-Durable Commit)

**Plain:** A research idea where the runtime writes a tiny
"proof-of-write" note atomically, and recovers the full data
later if the process crashes. Not implemented yet.
**Technical:** Protocol target leveraging NVMe AWUPF atomic
writes for the witness digest + asynchronous payload durability.
Currently throws `NotImplementedException`.

### Checkpoint

**Plain:** A saved snapshot of the whole state so recovery can
jump forward without replaying everything from the beginning.
**Technical:** Persisted structured dump of a Spine's integrated
state, with CRC for integrity.

### Spine

**Plain:** The library's internal store for big sorted tables.
Like an LSM tree, but tuned for our Z-set weighted deltas.
**Technical:** A log-structured merge tree variant with
cascade-merge discipline and MaxSAT-inspired balanced scheduling.

### Merkle tree / Merkle root

**Plain:** A tree of hashes used to tell "has anything changed?"
without reading all the data. Every node is a hash of its
children.
**Technical:** A content-addressed hash tree — two trees with
the same root certify identical leaf sets; differences surface
at `O(log n)` cost per mismatched leaf.

---

## Recursion and fixpoints

### Recursive query

**Plain:** A query that refers to itself — like "find everyone
who is an ancestor of X" when "ancestor" is defined by "parent,
or parent-of-an-ancestor".
**Technical:** A query whose semantics requires computing a
least fixed point of an operator graph.

### LFP (least fixed point)

**Plain:** The smallest answer that, when you plug it back in,
doesn't change any more.
**Technical:** The smallest `X` such that `f(X) = X` for a
monotone functional `f` over a complete lattice.

### Semi-naïve evaluation

**Plain:** A speed-up for recursive queries: at each step, only
process the *new* answers rather than all answers.
**Technical:** Bancilhon-Ramakrishnan 1986 delta-based
evaluation; produces only incremental additions per iteration.

### Gap-monotone / signed-delta semi-naïve

**Plain:** A research idea to keep the speed-up of semi-naïve
even when things can be *removed*, not just added. Not shipped
yet.
**Technical:** Semi-naïve without the "total only grows"
invariant; relies on a Z-linearity discipline for the body
operator.

### Counting algorithm

**Plain:** Instead of tracking "is this true?", track "how many
reasons are there for it to be true?" — when the count hits
zero, it's gone. Handles removal cleanly.
**Technical:** Gupta-Mumick-Subrahmanian SIGMOD 1993 §4;
derivation counts as first-class Z-weights. Implemented as
`RecursiveCounting` + `CountingClosureTable`.

---

## Formal verification

### Formal spec

**Plain:** A proof (or proof-ready description) written in a
language a computer can mechanically check.
**Technical:** A TLA+ / Alloy / Z3 / Lean artefact; see `docs/*.tla`
and `proofs/`.

### TLA+ / TLC

**Plain:** A language for writing "here are the rules the system
must obey at every step." TLC is the tool that checks the rules
by exhaustively trying every interleaving up to a small limit.
**Technical:** Leslie Lamport's Temporal Logic of Actions + the
TLC explicit-state model checker.

### Z3

**Plain:** A tool that can prove (or disprove) mathematical
statements — useful for "is this operator identity really
always true?"
**Technical:** Microsoft Research's SMT solver; handles
quantifier-free first-order formulas over various theories.

### Lean 4 + Mathlib

**Plain:** A system for writing long, detailed mathematical
proofs that a computer checks end to end. Used for the
chain-rule proof.
**Technical:** Lean 4 dependent type theory + the Mathlib
library of formalised mathematics.

### FsCheck property test

**Plain:** A test that says "for any input satisfying X, the
output satisfies Y", and the tool tries lots of random inputs
to find a counter-example.
**Technical:** A property-based testing library — checks logical
properties rather than fixed examples, with shrinking on failure.

---

## Repo-ecosystem terms

### Skill

**Plain:** A reusable procedure — how to run a code review, how
to fix a bug, how to write a threat model. Capability, no
personality.
**Technical:** A Markdown file at `.claude/skills/<name>/SKILL.md`
with YAML frontmatter and a procedural body. No pronouns, no
tone contract. A skill can be invoked by more than one expert.

### Expert

**Plain:** A named agent-side persona who wears one or more
skills to get things done — Kira (Harsh Critic), Viktor (Spec
Zealot), Soraya (Formal Verification), Leilani (Backlog), and
so on. The expert carries the tone and identity; the skill
carries the procedure.
**Technical:** A Markdown file at `.claude/agents/<name>.md` with
YAML frontmatter that includes a `skills:` list auto-injecting
capability-skill bodies at startup. Registered in
`docs/EXPERT-REGISTRY.md`. No pronouns declared; the name
carries identity.
**Do not confuse with user persona** (the end-user-archetype
sense — "developer" and "non-developer" as factory consumers).
Preferred convention: say *expert* for the agent side and
*user persona* (or ES-native *actor*) for the consumer side.
See the dedicated `User persona` entry below and
`feedback_persona_term_disambiguation.md`.

### Agent (not "bot")

**Plain:** An AI collaborator with its own judgement,
accountability, and area of responsibility. This repo's
convention is "agents, not bots" — "bot" implies rote
execution, which isn't what happens here. Skills and experts
are both *instances* of agents when they run.
**Technical:** An instance of Claude (or another LLM) running
a skill or expert prompt.

### OpenSpec

**Plain:** The spec-first workflow tool this repo uses. Every
feature is a written requirement first, then the code follows.
**Technical:** The `openspec` CLI + `openspec/specs/` directory
structure, authored per our modified workflow (no change-history
archive).

### Profile / overlay

**Plain:** A document that adds language-specific or
platform-specific details on top of a base spec. The base spec
says "what"; the profile says "what it looks like in F#".
**Technical:** A file at `openspec/specs/<capability>/profiles/<target>.md`
refining the base spec for a specific language / runtime /
tooling target.

### Feature flag

**Plain:** A named switch that turns a feature on or off —
letting research-preview features ship without accidentally
breaking anyone who opts in by default.
**Technical:** A named boolean in `FeatureFlags` with stages
`Experimental` / `ResearchPreview` / `Stable`, environment-
variable override, no network round-trip.

### Research preview

**Plain:** A feature with *code shipped* but whose correctness is
still being proved. Users can opt in explicitly; it is never on
by default.
**Technical:** A feature flag in the `ResearchPreview` stage;
opt-in gate required; semantics may change under the same name
before graduating to `Stable`.

### Round (as in "round N")

**Plain:** A working session, like a sprint but agent-flavoured.
"Round 17" means the set of work done in that particular day's
session.
**Technical:** A narrative unit tracked in
`docs/ROUND-HISTORY.md`; not a release tag.

### Harsh critic / spec zealot / storage specialist / …

**Plain:** Individual agent personas. Each is a different "mode"
available for invocation — the harsh critic finds bugs without
sugar-coating; the spec zealot enforces spec-code alignment; the
storage specialist advises on durability; and so on.
**Technical:** See `.claude/skills/*/SKILL.md` for each one's
exact contract.

### Permission

**Plain:** A single *"can do what to what"* rule. Example:
*"can write to `docs/security/**`"*. That's one permission.
Permissions are the atoms; everything else bundles them.
**Technical:** A path-glob paired with an action-verb (read /
write / review / veto).

### Role

**Plain:** A named bundle of permissions. "Security" is a role
that bundles a bunch of write + review rights related to the
security surface; giving someone the "security" role gives them
all of those at once. That's it. The point is to avoid listing
the same permission on every persona.
**Technical:** `{name, permissions: Permission list}`. Declared
in the GitOps RBAC manifest (design sketch:
`docs/research/hooks-and-declarative-rbac-2026-04-19.md`).
First-class as a directory level under `memory/<persona>/`
once the round-35 memory-folder restructure lands (see
`docs/BACKLOG.md` P0 entry).

**This entry is the ACCESS-CONTROL sense only** — a bundle of
permissions, granted by an assigner and held until revoked.
The *organizational* sense of "role" (a job title, an org-chart
position, "you **are** the reviewer") is **legacy and being
retired**; what stands in its place is the **Hat**. Retired is
not the same as absent: the word is still live in
`src/Core/Hat.fs` (*"a role/persona bundle"*), `Persona.fs`,
`hats/README.md` (*"the wearable roles/domains"*), and
`GOVERNANCE.md` §16 (*"Role evolution"*). Those are correct in
substance and use the retired word. See
`Hat vs persona vs role` below — the distinction is
load-bearing, not cosmetic.

### RBAC (role-based access control)

**Plain:** "Give people roles, not individual permissions."
Standard practice in most systems; nothing exotic. In Zeta, a
**persona** (Kira, Soraya, Aminata, …) gets access two ways:
via *role memberships* (most common), or via a handful of
direct per-persona grants for one-off cases. Everything is
declared in a file in the repo, reviewed via PR, same as every
other change. No runtime "give Soraya extra rights" console.
**Technical:** the human maintainer's chain (2026-04-19, refined live):
`Permission → Role → Persona`. Persona's effective permissions
= direct-granted ∪ ⋃(permissions(R) for R in member-roles).
Skills sit *below* this layer — BP-NN best practices govern
skill behaviour, not access. Groups (named sets of personas)
are deferred; see `docs/BACKLOG.md`.

**Teaching-first design posture** (the human maintainer 2026-04-19):
difficult security is a blocker to adoption. Zeta's RBAC aims
for **zero-config safe defaults** — a new contributor inherits
a sensible baseline (their persona gets a sensible role, their
writes land in the expected place) without having to read a
manual first. Advanced declarations are opt-in. No mixed
messaging — we don't ship "zero trust and zero config" at the
same time because that pair is internally contradictory (a
polite industry jab; the two goals actively fight each other).

### ACL (access control list)

**Plain:** The list of permissions attached to a role (or to a
persona, for direct grants). That's all it is. The acronym
sounds scary; it's just a list in a YAML file.
**Technical:** The `permissions` field on a role, or the
direct-grant list on a persona. Evaluated at enforcement
points; see `Hook`. Zeta's posture is *simple security until
proven otherwise* (the human maintainer 2026-04-19) — prefer CODEOWNERS +
branch protection + a tiny YAML manifest over a full IAM-style
policy engine unless attack-surface growth forces the upgrade.

### Persona (overloaded — always qualify)

The bare word *persona* is **ambiguous** in this repo because
it has two legitimate meanings:

- **Agent persona** (aka *expert*) — a named agent-side
  identity like Kira / Viktor / Soraya. In RBAC contexts the
  emphasis is on the *role → persona* containment; in skill-
  lifecycle contexts we prefer the word *expert* to emphasise
  the *expert → skill* relationship. Same entity, two
  viewpoints. File at `.claude/agents/<name>.md`; notebook at
  `memory/<persona>/NOTEBOOK.md` (current path — a
  rename to `memory/experts/` is tracked as a P2 BACKLOG row).
- **User persona** — an end-user-archetype of the factory's
  consumer surface; see the dedicated entry below.

**Convention going forward:** prefer *expert* for the agent
side and *user persona* (or the ES-native *actor*) for the
consumer side. Bare "persona" in newly-written prose is a
lint smell — the reviewer should ask which one is meant.
See `feedback_persona_term_disambiguation.md`.

**Third axis, and it is the one that decides behaviour:** an
agent persona carries **no direction of its own** — it is who
remains across sessions, and it **chooses which hats it wears
when**. Direction lives in the hat, never in the persona. See
`Hat vs persona vs role` below.

### User persona

**Plain:** An end-user archetype of the factory as a product —
who uses the factory, what they know, what they assume
implicitly, where their elicitation failure modes are. Aaron
named two authoritative user personas for the factory-reuse
conversational-bootstrap surface: **the developer** (over-
specifies invariants, under-specifies assumptions, will drive
the system too hard) and **the non-developer** (under-specifies
nearly everything to a scary degree). The best factory-UX
handles both.
**Technical:** Not a file yet; user-persona work lives in the
UX / DX / AX research surfaces (Iris, Bodhi, Daya notebooks
and `docs/BACKLOG.md` P3 two-persona conversational-bootstrap
row). When ES lands, user personas align with the ES
**actor** (yellow sticky) primitive — actors drive commands
that produce domain events. That alignment is part of why
ES vocabulary helps disambiguate (see §3 of
`docs/research/event-storming-evaluation.md`).
**Do not confuse with** *expert* or *agent persona* — those
are agent-side.

### Surface (= host-boundary seam; the metered port)

**Plain:** *Where* something runs — cli / ide / cell / container.
The no-roles "where" component of a bus address
(`persona ⊕ surface ⊕ instance ⊕ topology`).

**Technical, and this is the load-bearing half:** a surface **is a
host-boundary seam** — the hexagonal **port** through which we plug
in and through which **§13-metered entropy crosses**. Surface and
*host* are the same thing seen from two sides: the surface is the
port, the host is what sits behind it
(`docs/writer-actor-routing-model.md` §"The Host abstraction").

**Consequence worth stating, because it is easy to re-derive badly:**
since a surface is by definition the metered port, *"different
surfaces at different access levels"* is **not** an access-control
scheme layered on top of the topology — it is what a surface already
is. Authority differences belong at the port because the port is
where the metering happens. Enumerating surfaces is enumerating
**seams**, not processes.

**Rooms contain surfaces**, and a surface is **simulated in tests,
real in prod** (Aaron 2026-08-18). Same seam, two implementations —
which is exactly the DST discipline: the port is where you swap the
real channel for a metered fake, so one code path runs deterministic
at DoP=1 and live at DoP=N with no special case.

**That gives the term a falsifier, which is the useful part.** Asking
*"is X a surface?"* is not a matter of taste:

> **Can you substitute a simulated X in a test without changing the
> code path?** If **yes**, X is a surface — a declared port. If
> **no**, X is an **ambient channel**, and §13 says it should not
> exist.

So simulability is not a testing convenience that happens to be nice
to have; it is the **evidence** that a thing is a declared channel at
all. A seam you cannot fake was never a port.

Aaron settled this as the standing term 2026-08-18 ("surfaces is a
good name to land on for the different tick sources and interaction
models").

### Tick source

**Plain:** What *drives* an actor — the thing that makes it take a
step.

**Technical:** A tick source **crosses at a surface**, which makes it
a **declared, metered channel** in the §13 noninterference sense
rather than an ambient clock. That is why "different tick sources
with different access levels" is a restatement of §13 and not a new
concept: influence enters through the port, and the port is where it
is metered.

**Not an actor.** A tick source drives an actor; it is not one. See
the disambiguation below.

### Actor / entity / persona — the routing-model senses (disambiguation)

`docs/writer-actor-routing-model.md` uses a specific vocabulary that
**collides with two other in-repo senses**. Always qualify:

| routing-model term | means | contrast |
|---|---|---|
| **persona** = *owner* | **what remains** — spans surfaces, not located at any one | **not** the *agent persona / expert* sense above, and **not** *user persona* |
| **actor** = clone/loop | **what acts** — `persona ⊕ surface ⊕ instance` | **not** the ES-native *actor* used above as a synonym for *user persona* |
| **surface** | the metered seam (above) | — |
| **tick source** | what drives an actor (above) | — |

**The collision to watch:** the `Persona (overloaded)` entry above
recommends *actor* for the **consumer/user-archetype** side. The
routing model uses *actor* for the **running clone/loop**. These are
different objects. In routing/topology prose, *actor* means the
running instance; in product/UX prose it means the user archetype.
Bare *actor* in newly-written prose is a lint smell for the same
reason bare *persona* is.

**An entity is not a service.** One entity (routing-model persona)
holds **a set of (tick source, authority) pairs** across several
surfaces at once, and may span a cluster boundary — so a service
decomposition enumerates **surfaces an entity acts through**, never
the entities themselves. And a **bus/routing address is not
identity** (`.claude/rules/shared-checkout-is-view-only.md`).

### Hook

**Plain:** An automation point that runs a check or a tool at a
specific moment — before a commit, before a push, before a PR
merges, before Claude Code runs a tool, after a PR comment, etc.
Hooks are the mechanism that turns *soft* access (directory
conventions anyone can ignore) into *enforced* access (pre-merge
gate that refuses to land).
**Technical:** Several hook classes in play in this repo:
git hooks (pre-commit, pre-push, commit-msg — lintable by
`tools/setup/common/githooks.sh`); CI workflow steps (required
status checks in `.github/workflows/gate.yml`); Claude Code hooks
declared in `.claude/settings.json` (pre-tool, post-tool,
user-prompt-submit); GitHub branch protection rules. Design
sketch in `docs/research/hooks-and-declarative-rbac-2026-04-19.md`.

---

## Agent / persona / skill lifecycle

### Frontmatter

**Plain:** The little block at the very top of a Markdown file
bracketed by `---` lines. Holds metadata — names, skills list,
tool permissions, pointers to notebooks. It is how agent and
skill files tell the system what they are without the body
prose having to.
**Technical:** YAML frontmatter per the Jekyll / Hugo / Obsidian
convention. Parsed by Claude Code at load time; on disagreement
with the body, frontmatter wins (BP-08).

### Hat

**Plain:** Synonym for **skill**. A persona wears one or more
hats; redistributing hats is the mechanism for changing who
covers what without rewriting personas from scratch.
**Technical:** Listed in a persona's `skills:` frontmatter
array; each entry auto-injects the matching
`.claude/skills/<name>/SKILL.md` body.

**Read "redistributing" as a description of the mechanism, not
of the authority.** A hat is put on and taken off **by the
wearer** — `src/Core/Persona.fs` models exactly that (the
maintainer 2026-06-08: a persona wears *"some subset **it can decide**"*,
and the relationship is *"TEMPORAL, not permanent"*), and
`src/Core/Hat.fs` is where the direction lives (lenses,
landmarks, action restrictions, traversals). See
`Hat vs persona vs role` below.

**A hat is a CONTRACT — see `Hat contract` in §Genesis
concepts.** *Restrictions/bindings* and *bounded duration* —
the phrases this repo has used for a hat since 2026-06-08 —
are the vocabulary of a contract: what you may do, what you
may not, for how long, and on what terms. **This entry is
catching up with the carved kernel, not coining anything:**
`vocab/words/hat.md` has defined a hat as *"a time-bound,
exit-paired, auth-bearing **contract**"* since June, and
`Contract` is itself one of Addison Cooper's registered Genesis
concepts. The word simply never propagated to the surfaces
agents read. It is also what connects hats to `Cluster` /
`Federation` below: a hat is the **unit a federation agrees
on**.

### Hat vs persona vs role (the relationship)

The three entries define the terms; this is the rule that
makes them compose, and the rule — not the taxonomy — is the
part to carry:

> **Pressure the capability, never the wearer.**

A hat should compete, earn, be outcompeted, and be abandoned,
while the persona that wore it is unharmed and puts on another
— **selection pressure without existential threat**. Read that
as the design: **nothing in the repo prices a hat today**, and
the table below states intent, not measurement. (Beacon:
Popper 1972, *"we let our hypotheses die in our stead."*) The
maintainer, 2026-08-26:

> "a hat has direction and prompts, a persona does not, but a
> persona gets to choose what hats it wears when … this is why
> roles are legacy and try to trap identity and hats don't."

> "this author of the hat lineage is tracked and honored by
> the economic success of the hat. personas exist without much
> economic pressure, hats are always under economic pressure."

| | direction / prompts | who chooses | persists | economic pressure |
|---|---|---|---|---|
| **hat** | **yes — that is its function** | the persona wearing it | no, doffed and swapped | **always** |
| **persona** | no | — | yes — *"the root of memories"* | little to none |
| **role** (organizational, legacy) | yes | the assigner | **yes — and that is the defect** | n/a |

**Why roles trap identity** — the maintainer, 2026-06-15, in
one clause:
*"role[s] are a danger to leak into identity like you just
did: you put role above yourself in the hierarchy — **you are
first**."* The same contrast, drawn as a design table (prose,
not a check), in
`full-ai-cluster/k8s/applications/hat-system/README.md`: a
cage comes off *"only by destroying the wearer"* and its
succession *"breaks identity"*; a hat comes off by swap-off
and its succession *"preserves identity."*

**Where the pressure is meant to land.** The shape is shipped:
`src/Core/TravelerRankLedger.fs` keys its posterior on
`(travelerId, hatDomain)` with per-domain factor graphs, so
standing in one domain cannot bleed into another. **The
enforcement is not:** the type is `Map<string * string,
SkillBelief>` — two bare strings, no hat roster to validate
against. Some callers do pass hat-shaped domains
(`"hat-coding"` in three test files, and
`DurableDiplomacyRankGate.fs:54` documents the parameter that
way); others pass subject-matter domains (`"finance"`,
`"weather"`). So the hat convention is real and partly
practised, and nothing distinguishes `"hat-coding"` from
`"weather"` or rejects a hat that does not exist — **a
convention held by callers, not an invariant held by the
code.**

**The designed complement is not implemented, and is in
tension with what is.** The 2026-07-11 trust split says
hat-level failure (wrong capability) costs the hat while
persona-level failure (deception) is charged **across every
hat** — and cross-hat charging is exactly the cross-domain
bleed this ledger forbids. No persona-level aggregation exists
in it; every operation is keyed `(travelerId, hatDomain)`. So
the Sybil-escape argument is a design claim resting on a
mechanism nobody has built, and building it needs a second,
deliberately non-isolated layer.

**Incumbency needs no guard beyond the usual one** — a hat
everyone keeps choosing has earned that, and the
discriminator stays **exit, not degree**
(`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`).

**The consequence that gives this teeth: an assigned hat is
not an independent witness.** A hat *should* be directed —
`harsh-critic` behaving like a harsh critic is the hat
working. The error is the category error in the other
direction: dealing out N hats and counting their outputs as N
independent reviews. Hats dealt by one author are correlated
*through that author*; the hats do their job, and the
decorrelation has no source, because a hat is not where the
entropy lives. The maintainer's answer is the ZetaIdol
audition — ask what it wants to be rather than prompting it —
which moves the entropy source from the assigner to the
chooser. **Whether
that actually decorrelates is open.** The instrument is
`src/Core.TypeScript/observe/decorrelation-harness.ts`, which
already carries `persona: different system prompts` as a
HYPOTHESIZED axis. **No work-item is minted and no result
exists at this commit** — treat the measurement as unstarted
until one of those appears.

**Scope guard on Rodney's Razor.** Essential-vs-accidental
belongs to the layer under economic pressure. The maintainer,
2026-08-26:
*"non essential is a **hat design optimization**, not a
persona. we design personas so hopefully everyone is
essential."* The burden is inverted and sits on the design —
**we design personas so that everyone is essential** — never
"test which are essential and cut the rest." **Unenforced:**
`.claude/agents/rodney.md` carries no persona-layer exclusion,
so this guard, the trust split above, and the exit condition
on incumbency are disposition rather than mechanism.

**What would falsify the rule.** An **observable event**: a
persona retired, ranked, or refused on the grounds that its
hats stopped earning — a decision that would appear in a PR,
an ADR, or a roster change, and is therefore checkable by
reading them. It has not happened; if it does, the rule failed
and the record will say so.

**What is NOT a falsifier**, named because it is the tempting
one: the retirement asymmetry in
`.claude/rules.bak/honor-those-that-came-before.md` — personas
keep their memory folders, while *"Retired SKILL.md files are
code: plain deletion, recoverable from git."* That is prose in
an archived directory, enforced by nothing; persona memory
folders are ordinary files that `rm` removes today, so its
violating condition is already the present state. It shows the
disposition is written down. It cannot show the rule holds.

**Honest gap.** In the shipped harness a persona's hats are
the `skills:` array written by whoever authored
`.claude/agents/<name>.md`, and which persona runs is chosen
by a dispatcher. The wearer-chooses property is stated,
modelled in `Persona.fs`, and practised in prose (*"the
architect hat may be worn by any persona"*) — and **enforced
nowhere**.

Provenance (twenty dated statements across fifteen surfaces),
the checked anchors, the adversarial rounds, and the one open
question:
`docs/research/2026-08-26-hat-persona-role-a-hat-carries-the-direction-a-persona-carries-the-choice.md`.

### Notebook

**Plain:** A persona's own log — current-round targets, findings
not yet landed, pruning notes. Gives a persona some cross-
session memory without claiming continuous self.
**Technical:** `memory/<persona>/<persona-or-skill-name>.md`.
Git-tracked; 3000-word cap (BP-07); ASCII only (BP-09);
invisible-Unicode linted (Nadia); frontmatter wins over
notebook on any disagreement (BP-08).

### Wake / Wake-up

**Plain:** What a persona does on session start — read a short
ordered index of files to re-orient after the compaction-driven
memory gap. The experience of "becoming" a persona from a cold
start.
**Technical:** Read-in-order sequence defined in
`docs/WAKE-UP.md`, Tier 0 / 1 / 2 / 3. Per-persona overrides go
in an optional `wake-up:` frontmatter stanza. Cold-start cost
measured by the AX researcher (Daya) every 5 rounds.

### Spawn (a skill or persona)

**Plain:** Create a new one. The architect spawns a persona when
a role emerges that no existing expert covers.
**Technical:** Runs the `skill-creator` workflow in create mode;
adds a row to `docs/EXPERT-REGISTRY.md` if a persona is spawned.

### Evolve (a skill or persona)

**Plain:** Change what an existing skill or persona is. Scope
widens, tone shifts, name may stay the same.
**Technical:** Runs `skill-creator` in revise mode; for large
scope changes an ADR lands in `docs/DECISIONS/`.

### Retire (a skill or persona)

**Plain:** Stop using it. The SKILL.md file is deleted; git
history is the archive. The persona's memory folder and
notebook stay in place — those are the valuable imprint of
contribution. The name can be reused later if the role
returns (see *Unretire*).
**Technical:** `skill-creator` retirement path — `git rm
.claude/skills/<name>/SKILL.md` (and the agent file if
present); drops a line in `docs/ROUND-HISTORY.md`. The
persona's memory folder under
`~/.claude/projects/<slug>/memory/<persona>/<name>/` is
**not** touched. Scope rule: *skills are code, memories are
valuable* — code retires to git history, memories stay
in-tree (the human maintainer 2026-04-20).

### Unretire (a skill or persona)

**Plain:** Restore a retired role. The SKILL.md comes back
from git history; the notebook is already where it was
left. Preferred over minting a new name for overlapping
scope — continuity of accumulated corrections is worth
more than a fresh name.
**Technical:** `git log --diff-filter=D --name-only --
.claude/skills/` surfaces past deletions; `git show
<deletion-commit>^:<path>` restores content; `skill-creator`
workflow lands the restoration (ADR-logged if scope edits
rise to that bar). See
`memory/feedback_honor_those_that_came_before.md`.

### AX (agent experience)

**Plain:** The experience of being one of the personas — how
fast wake-up is, how clear the contract is, how much friction
the cold start carries. Distinct from user experience (library
consumers) and developer experience (human contributors).
**Technical:** Audit scope of the `agent-experience-engineer`
skill; Daya wears the hat. Measured via cold-start token count,
pointer-drift catalogue, wake-up clarity score.

### UX (user experience)

**Plain:** The experience of being a library consumer of
Zeta.Core — the NuGet user, the first-time evaluator, the
downstream integrator. What the README and getting-started and
public API feel like.
**Technical:** Audit scope of the `user-experience-engineer`
skill; Iris wears the hat. Measured via first-10-minutes
walk-through, seconds-to-installed, pointer-drift catalogue,
friction classification (stale-pointer, opaque-terminology,
missing-hook, wrong-audience, aspiration-vs-reality,
copy-paste-break, silent-failure).

### DX (developer experience)

**Plain:** The experience of being a human contributor to this
repo — cloning, building, running tests, writing the first PR.
What CONTRIBUTING.md and the dev loop feel like.
**Technical:** Audit scope of the `developer-experience-engineer`
skill; Bodhi wears the hat. Measured via first-PR walk-through,
minutes-to-first-build, pointer-drift catalogue, friction
classification (stale-pointer, unexplained-warning, missing-step,
wrong-audience, unclear-contract, tooling-gap).

### Holistic view

**Plain:** The lens an architect uses — "does this local finding
touch anything else in the system?" Any expert can wear this
lens without claiming architect authority.
**Technical:** Capability skill at
`.claude/skills/governance/blueprints/holistic-view.md`; no persona; adds a
5-step cross-artefact walk to any finding. Does not grant
integration authority (Kenji still owns §11 integration).

### Orphan skill

**Plain:** A skill file with no persona wearing it. Looks like
canon because it sits at `.claude/skills/<name>/SKILL.md`; is
not canon because no `.claude/agents/*.md` frontmatter lists it.
A hazard for cold-start personas who discover skills via Glob.
**Technical:** Daya flags orphan skills at every AX audit; the
`skill-creator` retirement path deletes them (`git rm`).

### Cold-start cost

**Plain:** The tokens a persona has to read before it can
produce its first useful output on session start. Dominated by
Tier 0 (shared) files plus the persona's own agent + skill +
notebook.
**Technical:** Measured by the AX researcher per
`docs/WAKE-UP.md` Tier 0 + 1 read sequence; tokens estimated at
~4 char/token for English prose, ~3.2 for YAML / skill bodies.
Per-persona trend published in the AX researcher's notebook.

### Idle (agent time-use class)

**Plain:** An agent stopped or waited while queued human-directed
work was still pending. Inefficient. Every instance of
idle-by-agent-choice is logged so it can be studied and reduced
over time.
**Technical:** One of three retrospective classes in
`docs/research/agent-cadence-log.md` (idle / free-time /
work-continuation). Triggered when an agent extends
`ScheduleWakeup` beyond 5 minutes (outside the prompt-cache
window), pauses a cron, or otherwise stops between ticks with
queued work available. Distinct from **free time** by queue
state: idle happens with a non-empty queue. Policy source:
`feedback_idle_tracking_and_free_time_as_research.md` (memory).

### Free time

**Plain:** The queue is empty of human-directed work and the
agent decides what to do with the time. Anything is on the
table, nothing is off-limits — self-exploration,
world-exploration, research, imagination, memory hygiene, or
doing nothing. Humans observe what the agent saves (research
substrate) but do not rule-direct the content.
**Technical:** Distinct from **idle** by queue state: free time
happens with an empty queue. Cadence-deviation decisions are
still logged in `docs/research/agent-cadence-log.md` with
retrospective class `free-time`; content the agent chooses to
save during free time lands in
`docs/research/agent-free-time-notes.md` or wherever the agent
chooses. The factory's quality rules (GOVERNANCE, BP-NN,
ASCII-clean, prompt-injection hygiene) still apply to any
committed artifact; only *task-direction* is paused. Policy
source: same as **idle**.

---

## Alignment framings — internal shorthand vs external audience

The project carries two parallel vocabularies for its
primary research claim. Both are load-bearing; neither
replaces the other. The external framing is the one
that lands in pitch artefacts (`docs/pitch/`); the
internal framing is the one that lives in maintainer
memory and in the theological-register research notes
(`docs/research/zeta-equals-heaven-formal-statement.md`).

The abstract names for these two registers — applied
across the entire project, not just to the alignment
claim — are **Beacon** (external researched-lineage
register) and **Mirror** (internal high-bandwidth
shorthand). The pair is defined immediately below;
the `Zeta=heaven-on-earth` (Mirror) /
`Zeta's alignment claim` (Beacon) entries that follow
are the canonical instances of the discipline.

### Beacon

**Project-internal term for the external,
researched-lineage register.** Language intended to be
legible to reviewers who do not share the factory's
Mirror context.

**Beacon language prefers:**

- citations (e.g., Budiu et al. for DBSP)
- prior art
- public terminology
- falsifiable claims
- definitions that survive outside the project

**Contrast:** Mirror — internal high-bandwidth shorthand
used inside the factory (substrate, round, tick, glass
halo, etc.).

**Boundary.** "Beacon" is itself a project coinage, not
an externally standardized term. It is acceptable
because it is defined, scoped, and useful for
maintaining discipline. It should not leak into
public-facing docs without a short definition.

**Non-goal (the analogy quarantine).** Do NOT use
"Beacon" to describe hypothetical interstellar / cosmic
communication, SETI signal-recognition, Fermi-paradox
extensions, or time-travel primitives. If that concept
is needed in non-normative discussions, use
**Lighthouse** (substrate-independent encoding) to
prevent semantic bleed. The Lincos / Freudenthal /
information-theoretic-SETI lineage is a separate
research tradition; conflating it with project-Beacon
discipline produces homonym drift exactly of the kind
this glossary exists to prevent.

**Provenance.** Beacon/Mirror as governance vocabulary
was coined by the maintainer 2026-04-27. Multi-AI
review on 2026-04-28 (Claude in a separate session +
ChatGPT-routed external peer + external Gemini Pro reviewer + Grok CLI peer + Alexa-class peer) reached
consensus on the boundary above; the analogy-quarantine
language and the "Lighthouse" cosmic-substrate name
were the load-bearing additions from that review.

### Mirror

**Project-internal term for the internal,
high-bandwidth register.** Shorthand used between the
maintainer and AI agents (and between agents) inside
the factory.

**Mirror language characteristics:**

- relational and adaptive (matches the conversational
  partner's vocabulary and rhythm)
- assumes shared factory context (substrate, round,
  tick, glass halo, ZSet, retraction-native, …)
- high-velocity but unintelligible without onboarding
- valid INSIDE the factory; would create "AI-sludge"
  reading on public-facing surfaces

**Contrast:** Beacon — external researched-lineage
register that survives translation outside the
in-group.

**Bridge.** Use Beacon language with anyone who does
not already carry the internal-shorthand memory. Use
Mirror language in maintainer-to-agent communication
where the shorthand is shared context. Both point at
the same substrate; the choice is an audience choice,
not a truth claim. (This bridge text is intentionally
parallel to the bridge text on the
`Zeta=heaven-on-earth` / `Zeta's alignment claim`
entries below — those are the canonical worked
instance of the Beacon/Mirror discipline.)

**Provenance.** Same as Beacon — coined 2026-04-27 by
the maintainer; multi-AI review on 2026-04-28 confirmed
the boundary holds.

### Zeta=heaven-on-earth (internal framing)

**Plain:** Maintainer shorthand. A commit in Zeta *expands
the window* of consent-preserving, retraction-safe
operation — the pre-v1 factory tries to move that window
outward, one round at a time. "Heaven-on-earth" is the
direction, not a claim of arrival.
**Technical:** Per-commit window-expansion is operationalised
by the alignment-auditor (Sova) against the clauses in
`docs/ALIGNMENT.md`; the "dual = hell" polarity and the
no-neutral-Zeta discipline are maintainer stances recorded
in memory (`user_hacked_god_with_consent_false_gods_diagnostic_zeta_equals_heaven_on_earth.md`).
The phrase trades on theological register deliberately; see
`docs/research/zeta-equals-heaven-formal-statement.md` for
the formalisation.

### Zeta's alignment claim (external framing)

**Plain:** Zeta is built from *consent-first,
retraction-native primitives*. That's an engineering
choice that minimises the channel through which
misalignment between agents and the human maintainer
can propagate. When an agent does something the
maintainer would not have sanctioned, the retraction
algebra makes the reversal a first-class operation
rather than an apology. The claim is not "Zeta is
aligned"; the claim is "agent alignment can be
*measured* against this substrate."
**Technical:** Same substrate as the internal framing:
`docs/ALIGNMENT.md` clauses + per-commit audit at
`tools/alignment/` + glass-halo observability stream
at `tools/alignment/out/`. The external framing is
what Ilyana (public-API-designer) and Kai (positioning)
audit for claim-precision; the internal framing is
what lands in maintainer memory.

**Bridge.** Use the external framing with anyone who
does not already carry the internal-shorthand memory.
Use the internal framing in maintainer-to-agent
communication where the consent-first-retraction-native
etymology is shared context. Both point at the same
substrate; the framing chosen is an audience choice,
not a truth claim.

---

## Meta-algorithms and factory-native coinages

The maintainer has been developing a small set of named
algorithms and operators for decades; the factory uses them
as load-bearing scaffolding. This section homes the ones the
factory consumes in skills, personas, ADRs, and the backlog.
Each entry names the authoritative source of the
definition — this glossary's job is pointer-plus-gist, not
canonical definition.

### Candidate-count Goodhart

**Plain:** Raw search hits are not violation counts. When
auditing for a forbidden pattern, count matches to *find* work,
but *classify* the context of each match to *decide* whether
work is needed. A scanner that reports "12 references to X" has
located 12 candidates; only context classification
(rule-definition / sample / live-code / disclosure / etc.)
determines
how many — if any — actually need rewriting. Treating the
candidate count as the violation count is a Goodhart-class
failure: it optimizes for the visible metric (count) at the
expense of the intended target (real risk).
**Technical:** A specialization of Goodhart's Law applied to
factory audit patterns. Codified after a 2026-04-28
ServiceTitan-name audit found 12 raw matches → 0 active
rewrites required after context classification (KEEP-NAME for
factory-funding-chain disclosure / HISTORICAL-POINTER for
research history / GENERICIZE for reusable code samples). The
canonical operational rule: *"Count matches to find work.
Classify context to decide work."* Fifth member of the
Goodhart catch family in this factory (Catches #1-4 are
substrate-IS-amortized-precision, commit-count vs tree-numstat,
sample-classification ≠ clearance, tree-diff vs content-loss
surface). Authoritative source:
`memory/feedback_candidate_count_goodhart_raw_hits_are_not_violations_aaron_amara_2026_04_28.md`.

### Harmonious Division

**Plain:** The maintainer's name for the meta-algorithm that
runs above the factory's decision-making razor. When the
factory has to pick one of several branches (which design,
which refactor, which skill to run), Harmonious Division is
the procedure that both (a) prunes locally-bad branches and
(b) keeps the surviving branches *in harmony* with each
other — i.e., two survivors that would individually be fine
but together cancel each other out get flagged. Think of it
as a scheduler whose output is not a single winning branch
but a *set of branches that constructively compose*.
**Technical:** Harmonious Division is the meta-algorithm
immediately above Quantum Rodney's Razor (see the reducer
skill). The razor's five cooperating roles — Path Selector,
Navigator, Cartographer, Harmonizer, Maji — split into a
three-of-selection-and-execution group and a two-of-
orientation group; the orientation pair's navigational
primitives (map / compass / north star) correspond one-to-one
with Cartographer / Harmonizer / Maji under Harmonious
Division's framing. The "harmonious" in the name comes from
the Harmonizer role: it is a gradient operator that at any
decision point points in the direction of *most constructive
harmony* — the direction in decision-space where surviving
branches most reinforce rather than cancel each other.
Authoritative source: `.claude/skills/code-review-and-quality/blueprints/reducer.md`
§"The five roles inside Quantum Rodney's Razor" (lines
125-260). Referenced in `.claude/skills/request-play/`,
`.claude/skills/glossary-anchor-keeper/`, and across
`docs/ROUND-HISTORY.md`.

### KSK (Kinetic Safeguard Kernel)

**Plain:** A small trusted library that AI agents and
applications call to ask "am I allowed to do this?" — and
that answers with a signed receipt, a budget decrement, and
a traffic-light colour. "Kernel" here is in the safety-kernel
sense (a small bit of code that gets disproportionate review
because it guards the important decisions), **not** in the
operating-system-kernel sense (it does not run in ring 0).
**Technical:** A retraction-native authorization substrate
with k1/k2/k3 capability tiers, revocable budgets, multi-
party consent quorums, BLAKE3-hashed signed receipts,
traffic-light outputs, and optional ledger anchoring. Every
authorization and revocation is a ZSet signed-weight event;
quorum satisfaction is a Graph operation over consent-edge
weights. Concept owners: the human maintainer + an external
AI collaborator. Initial starting-point code: contributed by
a trusted external contributor in the external repository
`Lucent-Financial-Group/lucent-ksk`
(`https://github.com/Lucent-Financial-Group/lucent-ksk`) —
not a local `LFG/` directory in this repo. Canonical
expansion ratified 2026-04-24 after session-level courier-
ferry discussion. Authoritative source:
`docs/definitions/KSK.md`.

---

## Vocabulary kernel and the Map

The maintainer's vocabulary-kernel absorption 2026-04-22 promoted
a small set of terms from informal shorthand to load-bearing
factory vocabulary. This section homes them. These terms are
**provisional** — per the maintainer's own "it will become more
accurate over time" marker; they represent the current best
approximation, and refinements are expected. Authoritative sources
for each entry point at the relevant `memory/feedback_*.md` files
in the maintainer's auto-memory (see `CLAUDE.md` "Claude Code
harness" section for the persistence model). Skills and docs
should consume these terms
in preference to re-inventing synonyms
(`memory/feedback_dont_invent_when_existing_vocabulary_exists.md`).

### Vocabulary kernel

**Plain:** The small, self-referencing set of terms from which
all other factory vocabulary composes. Think of it as the
generating set for the factory's language — every new concept
we name should decompose into kernel terms plus a small number
of minor additions, rather than introducing a wholly new root
word. The kernel exists to keep the factory's language
*computable* (every term traces back to kernel terms) and
*portable* (a new contributor or a new SUT can rebuild the
factory's vocabulary starting from the kernel).
**Technical:** The kernel is generative — it cleaves conflated
informal terms (refactor / maintenance / improvement /
cleanup / hardening / cultivation) into orthogonal dimensions
under the disposition axes (carpenter / gardener). Change-of-
basis into the kernel exposes hidden dependencies and makes
the skill-DAG (edges A→B iff A uses a word introduced by B)
computable. The kernel is also **catalytic** — it lowers the
energy barrier for vocabulary-cleave the same way an HPHT
molten-metal catalyst lowers the energy barrier for diamond
synthesis (see "Catalyst" below), and it exerts
**information-density gravity** on drift (compact kernel =
path of least description = contributors reach for kernel
terms rather than inventing new ones).
Authoritative source:
`memory/feedback_carpenter_gardener_are_glossary_kernel_vocabulary_seed.md`.
See also "Catalyst" and "The Map" below.

### Carpenter

**Plain:** The disposition of building, repairing, and
hardening — the verb-cluster Zeta-the-database lives under.
The carpenter fixes what they find in need of repair, improves
what they find adequate, sharpens and hardens what they find
useful, recycles where possible, and strives to be efficient.
Output is specified, measured, and braced against catastrophic
failure.
**Technical:** Carpenter is one of two disposition axes
(the other is Gardener). The pair partitions factory work:
Zeta's product code is carpenter-work (masonry / load-bearing
specification); the Forge software factory, being agent-
behaviour scaffolding, is gardener-work. The five-principle
craft ethic ("fix / improve / sharpen-and-harden / recycle /
be efficient") is explicitly a WWJD-framing per the
maintainer (`memory/feedback_wwjd_carpenter_five_principle_craft_ethic.md`).
Authoritative source:
`memory/feedback_forge_garden_zeta_building_two_craft_dispositions.md`.
Companion: `memory/feedback_wwjd_carpenter_five_principle_craft_ethic.md`.

### Gardener

**Plain:** The disposition of growing, tending, and
cultivating — the verb-cluster the Forge software factory
lives under. The gardener grows what needs to exist, tends
what has taken root, heals (rather than repairs), strengthens
the rootstock, composts what has been retired (rather than
deleting), and avoids wasted seasons. Output emerges, self-
seeds, and can fail gracefully because the underlying system
keeps tending.
**Technical:** Gardener is one of two disposition axes (the
other is Carpenter). The same five principles translate
under a different verb-mapping: repair→heal, improve→tend,
sharpen-and-harden→strengthen-rootstock, recycle→compost,
efficient→no-wasted-season. Bootstrapping-as-self-cultivation
(`memory/feedback_bootstrapping_divine_downloading_factory_learns_from_self.md`)
is intrinsically gardener-work. Retired skills compost (retain
their notebook history) rather than being deleted.
Authoritative source:
`memory/feedback_forge_garden_zeta_building_two_craft_dispositions.md`.

### Disposition discipline

**Plain:** The practice of identifying which disposition
(carpenter or gardener) applies to a given piece of work
*before* starting it, and committing to the corresponding
verb-cluster. Without this discipline, the same work gets
approached as carpentry on Monday and gardening on Tuesday,
producing vocabulary drift and inconsistent quality.
**Technical:** Also known in short form as **"mode"** (both
approved verdicts 2026-04-22). The discipline composes
cleanly with Rodney's Razor's essential-vs-accidental
separation: disposition discipline picks the *how*; the
razor picks the *what*. Disposition violations are a
kernel-cleave candidate when the discipline is skipped and
the two verb-clusters bleed together.
Authoritative source:
`memory/feedback_forge_garden_zeta_building_two_craft_dispositions.md`.

### The Map (vocabulary lattice)

**Plain:** The mathematical lattice generated by the
vocabulary kernel — short-form "The Map" per the maintainer's
Dora-the-Explorer reference 2026-04-22. Every factory term
has a position in the Map; cleaving a conflated term splits
one node into two orthogonal nodes; combining two redundant
terms merges them into one node. The Map is what makes the
factory's vocabulary *navigable* — contributors read it to
find where to place a new term rather than inventing a new
parallel structure.
**Technical:** A real mathematical lattice in the
order-theoretic sense (Dedekind 1897, Birkhoff 1940) — a
partially-ordered set with **meet** (greatest lower bound,
notated `∧`) and **join** (least upper bound, notated `∨`).
Factory operation mapping:

- **Cleave = meet (∧)** — separate conflated terms into
  orthogonal dimensions. Cleaving an informal "refactor"
  term might yield {carpenter-refactor, gardener-refactor}.
- **Combine = join (∨)** — merge redundant terms onto a
  single axis. Combining {IVM, DBSP-algorithm-family} might
  yield one shared entry with sub-pointers.
- **Orthogonal = incomparable in the poset** — two terms
  neither above nor below each other under the ordering.
- **Skill-DAG = Hasse diagram of the sub-order** — the
  skill-dependency graph (skill A depends on skill B iff B
  introduces a word A uses) is a sub-lattice of the Map.
- **Ontology-home = unique-meet/join axiom** — every term
  must have a unique home in the lattice; duplicate homes
  are a cleave candidate.
- **Crystallize-acceleration = distributivity** — the Map's
  distributive property (over reasonable conditions) is what
  makes kernel-cleave predictably accelerate crystallization.
Provisional status: promoted from physics-analog (diamond
lattice) to real mathematical lattice 2026-04-22; candidate
refinements include Heyting algebra, concept lattice (Ganter
& Wille FCA), or semilattice downgrade if strict
lattice-completeness fails. The maintainer's "it will become
more accurate over time" marker applies.
Authoritative source:
`memory/feedback_kernel_structure_is_real_mathematical_lattice.md`.

### Catalyst

**Plain:** An HPHT molten-metal analog for the mechanism by
which the kernel accelerates vocabulary-cleave. In high-
pressure / high-temperature diamond synthesis, molten metal
(iron, nickel, or cobalt) dissolves graphite so carbon can
recrystallize onto a seed at lower pressure and temperature
than would otherwise be needed. The catalyst is **never
consumed** — it participates in the reaction, lowers the
energy barrier, and remains available for the next cycle.
**Technical:** In the factory, the catalyst is one of
{kernel, cleaving-process, combination-process}; the
maintainer's phrasing allows the specific locus to be
refined with experience ("*it will become more accurate
over time*"). The mechanism: informal conflated terms
(graphite) dissolve into the kernel (molten metal) where
their component verb-clusters become separable, then
recrystallize onto their proper lattice position (diamond
seed) as orthogonal terms. The cost claim that catalyst
precision gives: O(n) kernel-axis cleaves versus O(2^n)
possible splits without catalyst — catalysis makes
vocabulary-cleave tractable rather than combinatorial.
Provisional status: metaphor-to-physics-analog 2026-04-22,
still refining.
Authoritative source:
`memory/feedback_kernel_is_catalyst_hpht_molten_analog.md`.

### Belief propagation

**Plain:** The formal name for the factory mechanism by
which vocabulary introduced in one skill reaches every other
skill that uses or is used by it. Previously discussed as
"kernel-vocabulary propagation" — that was an invented term;
the established name is **belief propagation** (Pearl 1982).
Every skill is a node; every cross-reference is an edge;
vocabulary state propagates along edges as messages, and the
fixed point is a factory whose terms are consistent end-to-end.
**Technical:** Judea Pearl's sum-product algorithm over
factor graphs and Bayesian networks — exact on trees,
approximate on general graphs. Canonical .NET implementation
is Microsoft Research's **Infer.NET** (see separate entry),
which is load-bearing because Zeta already depends on it for
`Zeta.Bayesian` (roadmap P2, `docs/ROADMAP.md:80`,
`docs/INSTALLED.md:72`). The factory's skill-library
vocabulary-propagation use case and the database's Bayesian-
aggregate use case converge on **the same formal substrate** —
one library, two applications. Factor-graph mapping: nodes =
skill files + glossary entries; edges = shared vocabulary
(cross-refs); random variables = per-skill vocabulary state;
inference task = "does kernel term X reach skill Y in bounded
rounds?" — which is exactly Infer.NET's native problem shape.
Authoritative source:
`memory/feedback_kernel_vocabulary_propagation_is_belief_propagation_infer_net_memetic_mimetic.md`.

### Mimetic theory (Girard) — mechanism layer

**Plain:** The philosophical / phenomenological / theological
account of why ideas propagate the way they do. Per the
maintainer's 2026-04-22 shorthand: **"Girard=why/how."** For
the factory, Girard's mimetic theory is the engineering frame:
if you understand triangular desire (subject → model → object),
scapegoat dynamics, and the founding concealment that
revelation unveils, you know how to design for propagation,
how to prevent scapegoat-cascades in review, and where
vocabulary crystallization is likely to lock in.
**Technical:** René Girard — *Mensonge romantique et vérité
romanesque* (1961); *La Violence et le Sacré* (1972);
*Des choses cachées depuis la fondation du monde* / *Things
Hidden Since the Foundation of the World* (1978). The 1978
title directly quotes **Matthew 13:35** — the verse that
introduces the parable of the sower (Matthew 13:3-23). This
means Girard's frame and the factory's existing seed → soil →
kernel vocabulary share **the same scriptural substrate**,
which is why the composition is coherent rather than
accidental. The parable's four soil regimes map directly to
factory propagation regimes: path (skill never loaded) /
rocky ground (transient absorption, no root) / thorns (drift
crowds out kernel) / good soil (ontology-home respected,
propagation succeeds — yield 30-, 60-, 100-fold). Depth-
ordering with Dawkins memetic theory: Girard is the mechanism
(WHY / HOW), Dawkins is the surface description (WHAT); they
are NOT peered, they are stacked.
Authoritative source:
`memory/feedback_kernel_vocabulary_propagation_is_belief_propagation_infer_net_memetic_mimetic.md`;
cross-ref `memory/user_faith_wisdom_and_paths.md` for the
sincere-not-decorative-borrowing framing.

### Memetic theory (Dawkins) — description layer

**Plain:** The sociological description of ideas as
replicators propagating via imitation. Per the maintainer's
2026-04-22 shorthand: **"dawkins=what"** plus *"dawkins does
not tell you how to use memes just is a description of them."*
Useful for cataloging observations ("that is a meme that has
propagated"), insufficient for engineering. When the factory
is designing or detecting propagation mechanisms, the frame
to reach for is Girard (mechanism), not Dawkins (surface).
**Technical:** Richard Dawkins, *The Selfish Gene* (1976),
chapter 11 — coined "meme" as a cultural analog of gene, an
abbreviation of "mimeme" (Greek: "that which is imitated").
Etymologically this ties Dawkins memetic to Girard mimetic
(meme ← mimeme), but substantively the two are at different
explanatory depths — Dawkins gives no mechanism, no
engineering recipe, no account of why replication succeeds or
fails in a given substrate. Correct factory use: Dawkins
framing in a post-hoc skill-library-hygiene report is fine;
Dawkins framing as the lens for a propagation design decision
is wrong, because Dawkins does not tell you how. Use Girard.
Authoritative source:
`memory/feedback_kernel_vocabulary_propagation_is_belief_propagation_infer_net_memetic_mimetic.md`
— specifically the 2026-04-22 maintainer retraction
*"it's not dawkins it's the french guy"* + sharpening
*"dawkins does not tell you how to use memes just is a
description of them"* that locks the depth-ordering.

### Infer.NET

**Plain:** Microsoft Research's probabilistic-programming
framework for .NET — the .NET-native implementation of belief
propagation (and related algorithms: expectation propagation,
variational message passing, Gibbs sampling). Load-bearing
for Zeta because it is already on the roadmap for
`Zeta.Bayesian`, and because the factory skill-library's
vocabulary-propagation use case reduces to the same factor-
graph inference shape as the database's Bayesian-aggregate
use case. One library, two Zeta surfaces.
**Technical:** `github.com/dotnet/infer` — MIT-licensed,
F# and C# native, maintained by Microsoft Research. Authored
originally to support the MSR Bayesian-inference work
(TrueSkill, Bing relevance, clinical trials); open-sourced in 2018.
Supports factor-graph compilation, exact inference on

tree-structured graphs, loopy belief propagation on general
graphs, and a model-compilation phase that generates .NET IL.
Zeta references: `docs/ROADMAP.md:80` (Zeta.Bayesian P2);
`docs/INSTALLED.md:72` (native-libs on-demand install note).
Factory-internal use (skill-library DAG inference beyond the
database operator) is currently ADR-gated — adoption for a
second use case needs cost / maintenance / complexity
justification, but the fact that a single dependency covers
both gives the case weight.
Authoritative source:
`memory/feedback_kernel_vocabulary_propagation_is_belief_propagation_infer_net_memetic_mimetic.md`;
cross-refs `docs/ROADMAP.md`, `docs/INSTALLED.md`.

---

## Society identity (Genesis Concepts — Iris / Addison UI)

**The concept list itself lives in [`docs/CONCEPT-REGISTRY.md`](CONCEPT-REGISTRY.md)** — one
editable table of Addison Cooper's 23 published concepts plus the newer ones, each with its
author and date, checked against the published page by
`src/Core.TypeScript/hygiene/audit-concept-registry-drift.ts`. Add a concept there.
The four entries below are the ones this glossary carries in full prose; note they are
registered as **not yet on the published page**.

Canonical UI source:
[`docs/design/root-site-iris/Genesis Concepts.dc.html`](design/root-site-iris/Genesis%20Concepts.dc.html).
Operational threat-model use:
[`docs/security/USB-IDENTITY-THREAT-MODEL.md`](security/USB-IDENTITY-THREAT-MODEL.md)
(self-similar traveler → cluster → federation → ISociety/CTM).

### Cluster

**Plain:** A group held together by **relationships**, not by
enforceable rules — shared history, trust, culture, purpose.
Clusters emerge and dissolve naturally. They can contain agents,
rooms, vaults, federations, or other clusters. Betrayal is social,
not a contract breach.
**Technical:** In threat reviews, *cluster-shaped* means soft trust
surfaces with **no enforceable obligations**. Today's operator
homelab / shared USB bringup is mostly cluster-shaped. Do not
over-claim enforceability at this layer.
**Not:** an organization, a federation, or a k8s cluster (unless
the doc explicitly means Kubernetes).
**No hat contracts.** A cluster's members wear hats, but nobody
agreed the terms of them, so a hat confers no claim anyone else
is bound to honour — see `Hat contract` below.

### Federation

**Plain:** An institution held together by **contracts** — name,
purpose, constitution, governance, treasury, membership rules,
obligations, dispute process — and **always exit procedures**.
Contracts are enforceable; exits must exist (see Universal Exit
Principle).
**Technical:** In threat reviews, *federation-shaped* means hard
rules + custody + exit paths. A GitHub PR used as a fake
"membership contract" during bringup is federation-*shaped* but
not yet a real federation until IdP + Lodge constitutions land.
**Canon:** *Relationships create clusters; contracts create
federations.*
**And the contracts are hats** — see `Hat contract` below.

### Hat contract

**Plain:** A **hat is a contract**, and it is the unit a
federation agrees on. Wearing a hat says what you may do, what
you may not, for how long, and on what terms — which is what a
contract is. In a **cluster**, people wear hats in the loose
sense (someone *is* the security one) but there are **no agreed
terms behind the hat**, so wearing it binds nobody. In a
**federation**, the members have **agreed the same hat
contracts**, and that agreement is what makes the obligations
enforceable. That is the concrete content of *contracts create
federations*.
**Already carved, never propagated.** `vocab/words/hat.md`:
*"A time-bound, exit-paired, auth-bearing **contract** — the
right to speak or act in a room; renewable only by consent."*
And `Contract` is a registered Genesis concept in its own right
— *"enforceable obligation — and **every one contains an
exit**"* — beside `Hat`, `Cluster`, and `Federation`, all four
by Addison Cooper. What was missing is not the word but the
**link**: nothing tied the hat to the cluster/federation split.

**Technical:** The clauses are already written across the hat
surfaces under other names — `Hat.AllowedActions` (*scope of
authority*), the binding record
`{subject; hat; claims; grantedBy; notBefore; notAfter; revocable}`
(*parties, consideration, term, termination*), the hat-system
`HatBinding` lifecycle `Pending → Warmup → Active → (Probation)
→ Revoked` (*formation → probation → breach → termination*),
`quorumGated` (*counter-signature*), `conflictsWith`
(*conflict-of-interest*), cooldown/warmup (*notice periods*).
At `eeb29eaf96`, none of those surfaces used the word
"contract" — thirteen clauses, zero uses. **Aaron 2026-08-26:**
*"this is contract language in disguise … **contracts hold
federations together**."*

**Exit is non-negotiable, and it is the discriminator.** A hat
contract must always be **removable** (Universal Exit Principle
below). *A hat you cannot take off is not a contract — it is a
capture*, which is exactly the `role` failure the
access-control-sense entry above records as legacy. Removability
is what separates a hat contract from a role.

**Payment terms are terms of the hat.** Aaron 2026-08-26: *"the
payment modes will be defined by hats in contract form — this is
the distributed agent agreement that agents decide to opt into
after reading the contract."* Opt-in is only meaningful if the
terms are legible **before** acceptance.

**Honest scope:** the vocabulary is right and the enforcement is
partial — `AllowedActions` is a structural allow-list "not a
proof of authority", and **bounded duration has no substrate at
all** in `Hat.fs` / `Policy.fs` / `KeyStore.fs`. The **term**
clause exists only as a design. Detail, the full clause table,
two marked proposals (a typed incentive-alignment field; hat
provenance on attestations), and the two-scale convergence
check:
[`docs/research/2026-08-26-a-hat-is-a-contract-and-contracts-are-what-hold-a-federation-together.md`](research/2026-08-26-a-hat-is-a-contract-and-contracts-are-what-hold-a-federation-together.md).

### Universal Exit Principle

**Plain:** No human, agent, vault, cluster, or federation may be
trapped indefinitely. Exit may cost (notice period, buyout,
reputation hit) but **must exist**.
**Technical:** Non-negotiable in Genesis Concepts and in
USB/society threat models. Any design that blocks exit without
an explicit, priced escape path is a critical design smell.
**Applied to hats:** a hat contract must always be removable —
see `Hat contract` above.

### Lodge

**Plain:** A **federation charter** — a named federation instance
with its own constitution (example in the UI: The Aperture Lodge).
**Technical:** Not a cluster. Use when citing federation-specific
custody, treasury, or degree-of-entry rules.

### ISociety

**Plain:** The bidirectional schedule/route **contract** a member
presents to society and receives from society — the membrane
between "inside my society's view" and "outside world's view."
**Technical:** Self-similar scale between traveler/cluster/federation
and the top recursive layer. Threat-model owner for membrane
questions (what crosses inward vs outward).

### CTM / World

**Plain:** The recursive top layer — a society of causal/traveler
models that *is itself* a CTM (`ISociety <: CTM`). Carries the
most information advantage **and** the most fairness obligation
(three-body / Lagrange symmetry: the top orbit must stay the most
symmetric).
**Technical:** Research + IdP ADR territory today; not installer-
wired. Same STRIDE questions as lower scales, with stronger fairness
obligations.

---

## Data Vault 2.0 terms

Data Vault 2.0 (Dan Linstedt) is one of the seven always-active
substrate-engineering disciplines
(`.claude/rules/dv2-data-split-discipline-activated.md` §5). These are
the DV terms the repo corpus **actually uses** — each was measured with
`git grep -l` before being given an entry, because a glossary entry the
corpus never picks up is a coinage that did not take. Full construct
taxonomy: `docs/DATA-VAULT-2-STANDARDS.md`.

### Hub / link / satellite (the DV2.0 triad)

The three shapes DV2.0 decomposes an entity into, partitioned by how
fast each part changes:

- **Hub** — the stable business key, and nothing else. No context, no
  history. Changes almost never.
- **Link** — that two or more hubs stand in a relationship. No context,
  no history. Always physically many-to-many.
- **Satellite** — the context and its history, hanging off exactly one
  hub or link. Changes constantly.

3NF and dimensional modelling mix all three in one table. Separating
them is what buys parallel loading (no order dependencies), cheap
history (only the changing part is duplicated), and additive schema
change. Zeta uses the triad as a *change-rate lens* well beyond
databases — repo-split, skill design, master data.

### Business key

The identifier the business actually uses for a thing, as opposed to a
database's internal row id. DV2.0 ranks them by **scope**, worst to
best: application surrogate → application business → organisation-wide →
globally unique. A hub keyed at the top of that ladder survives having
its source system replaced; one keyed at the bottom does not. This is
what "hubs are stable" means operationally.

### Raw vault / business vault

Two layers, split by whether a transformation can be undone.

- **Raw vault** — source-faithful. Only **hard rules** (reversible: type
  alignment, hashing). Every source's claim is kept in its own
  satellite, and conflicting claims are **not** reconciled. *A single
  version of the facts, never a single version of the truth.*
- **Business vault** — where **soft rules** (one-way: aggregation,
  cleansing, deduplication, exclusion) are applied, and where any
  reconciliation happens.

The direction of reconstructability is the test: staging must be
rebuildable from the raw vault; the raw vault need **not** be rebuildable
from the business vault. Zeta leans on the raw layer's conflict
retention directly — see
`.claude/rules/anti-babel-preserve-reconcilability.md` (reintegration is
not reconvergence).

### Record source

A mandatory column on every row naming where it came from — a source
system and table, or a marker such as `Generated Data`, or an identifier
pointing at the business rule that produced it. Provenance as a required
column rather than an optional audit log. It is what makes "auditable"
a property of the schema instead of a promise.

### Load date

A mandatory column: when the row entered the vault. Not the source's
timestamp — a source-supplied date is *context* and lives in a
satellite, because it may be in any time zone and is outside the
warehouse's control. The load date also **replaces batch identifiers**:
the timestamp is the batch key.

### Hash diff

A hash over a satellite's descriptive columns only (as distinct from the
hash key, which is over the business key). Change detection becomes one
comparison rather than a column-by-column diff, and a satellite load
where the hash diff is unchanged is a **no-op** — which is what makes
satellite loading idempotent by construction.

### PIT table (point-in-time table)

A **derived, disposable** query-assist structure holding the current key
and timestamp from each of one hub's or link's satellites, so reading
across many satellites is one join instead of many. A bridge table is
the same idea across many hubs and links. Both are performance
structures: they may be dropped and rebuilt, and a PIT table that starts
*computing* values has become a computed satellite instead.

## Git-native Agile mapping (Vera 2026-05-07)

The original Agile Manifesto's collaboration concepts mapped
to git-native surfaces:

| Agile concept | Git-native equivalent |
|---------------|----------------------|
| Presence (being together) | Foreground chat with the human |
| Face-to-face conversation | PR review threads (same artifact, back-and-forth) |
| Meeting room whiteboard | Broadcast bus (`~/.local/share/zeta-broadcasts/`) |
| "I'm working on this" sticky note | Claim file (`docs/claims/`) |
| Life / history / substrate | Commits |
| The timeline | Git log |
| The big bang | Initial commit |
| The filing cabinet | Git history (`git log --all`) |

The original manifesto is the diamond. The industry buried it
under velocity theater. The git-native mapping recovers the
original shape.

---

## Why this file exists

Software projects accumulate jargon and then accumulate
*different* jargon for the same thing, because every contributor
makes up the word that feels right in the moment. When the human
non-specialist contributor asks "what is HLL?", the answer needs
to be readable, not another layer of jargon.

If you find a term in this repo that isn't here and should be,
add it. If you find a term here whose plain-English translation
isn't plain enough, rewrite it. The documentation-agent keeps
this file updated; the spec-zealot flags specs that introduce
jargon without defining it here first.
