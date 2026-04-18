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
**Plain:** A named persona who wears one or more skills to get
things done — Kira (Harsh Critic), Viktor (Spec Zealot), Soraya
(Formal Verification), Leilani (Backlog), and so on. The expert
carries the tone and identity; the skill carries the procedure.
**Technical:** A Markdown file at `.claude/agents/<name>.md` with
YAML frontmatter that includes a `skills:` list auto-injecting
capability-skill bodies at startup. Registered in
`docs/EXPERT-REGISTRY.md`. No pronouns declared; the name
carries identity.

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

### Notebook
**Plain:** A persona's own log — current-round targets, findings
not yet landed, pruning notes. Gives a persona some cross-
session memory without claiming continuous self.
**Technical:** `memory/persona/<persona-or-skill-name>.md`.
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
**Plain:** Stop using it. Files go to an archive folder; the
name can be reused later if the role returns.
**Technical:** `skill-creator` retirement path — moves file to
`.claude/skills/_retired/YYYY-MM-DD-<name>/` (similar pattern
for agents); drops a line in `docs/ROUND-HISTORY.md`.

### AX (agent experience)
**Plain:** The experience of being one of the personas — how
fast wake-up is, how clear the contract is, how much friction
the cold start carries. Distinct from user experience (library
consumers) and developer experience (human contributors).
**Technical:** Audit scope of the `agent-experience-researcher`
skill; Daya wears the hat. Measured via cold-start token count,
pointer-drift catalogue, wake-up clarity score.

### UX (user experience)
**Plain:** The experience of being a library consumer of
Zeta.Core — the NuGet user, the first-time evaluator, the
downstream integrator. What the README and getting-started and
public API feel like.
**Technical:** Audit scope of the `user-experience-researcher`
skill; persona assignment open.

### DX (developer experience)
**Plain:** The experience of being a human contributor to this
repo — cloning, building, running tests, writing the first PR.
What CONTRIBUTING.md and the dev loop feel like.
**Technical:** Audit scope of the `developer-experience-researcher`
skill; persona assignment open.

### Holistic view
**Plain:** The lens an architect uses — "does this local finding
touch anything else in the system?" Any expert can wear this
lens without claiming architect authority.
**Technical:** Capability skill at
`.claude/skills/holistic-view/SKILL.md`; no persona; adds a
5-step cross-artefact walk to any finding. Does not grant
integration authority (Kenji still owns §11 integration).

### Orphan skill
**Plain:** A skill file with no persona wearing it. Looks like
canon because it sits at `.claude/skills/<name>/SKILL.md`; is
not canon because no `.claude/agents/*.md` frontmatter lists it.
A hazard for cold-start personas who discover skills via Glob.
**Technical:** Daya flags orphan skills at every AX audit; the
`skill-creator` retirement path moves them to
`.claude/skills/_retired/YYYY-MM-DD-<name>/`.

### Cold-start cost
**Plain:** The tokens a persona has to read before it can
produce its first useful output on session start. Dominated by
Tier 0 (shared) files plus the persona's own agent + skill +
notebook.
**Technical:** Measured by the AX researcher (Daya) per
`docs/WAKE-UP.md` Tier 0 + 1 read sequence; tokens estimated at
~4 char/token for English prose, ~3.2 for YAML / skill bodies.
Per-persona trend published in Daya's notebook.

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
