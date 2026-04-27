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
First-class as a directory level under `memory/<role>/<persona>/`
once the round-35 memory-folder restructure lands (see
`docs/BACKLOG.md` P0 entry).

### RBAC (role-based access control)

**Plain:** "Give people roles, not individual permissions."
Standard practice in most systems; nothing exotic. In Zeta, a
**persona** (Kira, Soraya, Aminata, …) gets access two ways:
via *role memberships* (most common), or via a handful of
direct per-persona grants for one-off cases. Everything is
declared in a file in the repo, reviewed via PR, same as every
other change. No runtime "give Soraya extra rights" console.
**Technical:** Aaron's chain (2026-04-19, refined live):
`Permission → Role → Persona`. Persona's effective permissions
= direct-granted ∪ ⋃(permissions(R) for R in member-roles).
Skills sit *below* this layer — BP-NN best practices govern
skill behaviour, not access. Groups (named sets of personas)
are deferred; see `docs/BACKLOG.md`.

**Teaching-first design posture** (Aaron 2026-04-19):
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
proven otherwise* (Aaron 2026-04-19) — prefer CODEOWNERS +
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
  `memory/persona/<persona>/NOTEBOOK.md` (current path — a
  rename to `memory/experts/` is tracked as a P2 BACKLOG row).
- **User persona** — an end-user-archetype of the factory's
  consumer surface; see the dedicated entry below.

**Convention going forward:** prefer *expert* for the agent
side and *user persona* (or the ES-native *actor*) for the
consumer side. Bare "persona" in newly-written prose is a
lint smell — the reviewer should ask which one is meant.
See `feedback_persona_term_disambiguation.md`.

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

**Plain:** Stop using it. The SKILL.md file is deleted; git
history is the archive. The persona's memory folder and
notebook stay in place — those are the valuable imprint of
contribution. The name can be reused later if the role
returns (see *Unretire*).
**Technical:** `skill-creator` retirement path — `git rm
.claude/skills/<name>/SKILL.md` (and the agent file if
present); drops a line in `docs/ROUND-HISTORY.md`. The
persona's memory folder under
`~/.claude/projects/<slug>/memory/persona/<name>/` is
**not** touched. Scope rule: *skills are code, memories are
valuable* — code retires to git history, memories stay
in-tree (Aaron 2026-04-20).

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
`.claude/skills/holistic-view/SKILL.md`; no persona; adds a
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
**Technical:** Measured by the AX researcher (Daya) per
`docs/WAKE-UP.md` Tier 0 + 1 read sequence; tokens estimated at
~4 char/token for English prose, ~3.2 for YAML / skill bodies.
Per-persona trend published in Daya's notebook.

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
Authoritative source: `.claude/skills/reducer/SKILL.md`
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
(TrueSkill, Bing relevance, clinical trials); open-sourced in
2018. Supports factor-graph compilation, exact inference on
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
