# Playbooks resurrection assessment — the design landed in May; what never landed is a running instance

**Shadow, 2026-08-15.** Assessment of Aaron's 2026-08-15 statement of the executable-markdown
feature against the archived 2026-05-25 design and against what is actually on `origin/main`
today (checked at `9b21dbd6`).

Aaron's statement, verbatim:

> we extend this into MD files too so you can have future/action meta grammar for writing
> non-resolved names that will resolve later and execute via runme or whatever that markdown
> execution language is — we can also have our own. this is a good hexagonal place, it's all
> about action and future actions yet to be written being able to be placed in regular markdown.
> We tentatively call this our **'playbooks'** — I know that term is overloaded with other
> technologies so we might use another name. It should work generically for any markdown file.
> This MD graph **starts as the spec and ends as a running markdown file that implements the
> spec**, and also has query ability to see real-time observability feedback around the markdown
> file and its execution over time. Like **mini DORA metrics per markdown file**.

***

## 0. Corrections to the brief, stated first

Four, and the first one changes what the task is.

### 0.1 The design is NOT parked in the archive. It landed on `main` months ago.

The brief describes B-0732 and B-0733 as "parked in an archive of recovered orphan branches and
never landed on `main`." That is false. Both were migrated to ZetaIds and are live rows on
`main`, indexed in `docs/BACKLOG.md`, `status: open`:

| archived B-id | live ZetaId on `main` | priority | BACKLOG.md line |
|---|---|---|---|
| B-0729 Obsidian knowledge-graph substrate | `081KSE6WT0008QG0R003RN2WE3` | P2 | indexed |
| B-0730 runbooks-as-executable-specifications | `081KSE6WT0008QG0R003AJYMD3` | P2 | 844 |
| B-0731 hat ontology | `081KSE6WT0008QG0R0004HV6RR` | P2 | indexed |
| **B-0732** runbook leverage class / safety | **`081KSE6WT0008QG0R002YBWBB1`** | **P1** | **381** |
| **B-0733** universal protocol + MCP wrap | **`081KSE6WT0008QG0R00102H071`** | **P2** | **833** |

The mapping is recorded in `src/Core.TypeScript/backlog/b-to-zetaid-map.json`. Diffing the
archived B-0732 against the live row shows the content is identical modulo id substitution and
one path (`memory/persona/mika/` became `memory/mika/`). Same for B-0733. Nothing was lost.

**Consequence for hard requirement 3.** The brief says to mint fresh ZetaIds for the resurrected
items and not carry the B-ids across. The carry-across already happened, correctly, in May. Minting
new ids for B-0732/B-0733 content would have created duplicate rows — the exact failure the ZetaId
scheme exists to prevent. So the minting below covers **only what is genuinely new** in Aaron's
2026-08-15 statement, and the five May rows are cited by their live ids rather than re-minted.

### 0.2 There are three archived copies, not two, and they are byte-identical

The brief mentions a near-duplicate under `pr4990-merge-inspect-dirty-local-20260526/` and asks
whether they differ. There are three copies of each row — the `agentic-org-conflict-proof`
working tree, and both the `staged-index` and `working-tree` of `merge-inspect-dirty-local`. All
three are byte-identical for both rows. No reconciliation needed.

### 0.3 The 12 dangling auto-vivify references are mostly NOT evidence citations

The brief states the 12 dangling refs are "all from evidence citations in recent work-items" and
that the defect is pointer-versus-citation. Reproduced (`--check`, exit 1, 12 dangling) and read
at each source line, the actual distribution is:

| register | count | example |
|---|---|---|
| **mention** — a filename named in prose, inside a code span, no navigation intended | 10 | "`new-item.ts` mints the ZetaId and scaffolds the file" |
| **citation** — evidence about a file whose absence is the finding | 1 | a wrapper script deleted by PR #8088 |
| **fabricated** — not a reference at all | 1 | see 0.4 |

So the pointer-versus-citation distinction the brief names is real and is load-bearing, but it
accounts for **one** of the twelve. The dominant failure is the **use–mention** distinction
(Quine, *Mathematical Logic*, 1940): a code span around a filename is quotation, not a link, and
the extractor cannot tell. A fix aimed only at the citation case would leave ten of twelve red.

### 0.4 One of the twelve is not a reference at all — it is shell syntax

`db/-f` comes from a prose sentence in `081M00VMS1E087G0R0001SCSAH` describing a bash guard: a
double-bracket file test, written inside a code span. `extractPointers` runs its wikilink regex
over raw text with no awareness of code spans or fenced blocks, so the double brackets match, the
target becomes `-f`, and the `db/` fallback in `resolvePointer` invents a path nobody wrote.

This is the sharpest finding in the assessment, because of what it implies for the feature: **the
playbooks direction deliberately puts more executable code into markdown**, and every additional
fenced block enlarges this bug's surface. Filed as a bug, below.

***

## 1. Hard requirement 1 — `docs/WONT-DO.md`

Checked. Grepped for `runbook`, `runme`, `executable markdown`, `playbook`, `markdown exec`,
`literate` — **no matches** (exit 1). Nothing in this feature family was deliberately abandoned.

Two adjacent entries are worth knowing but do not block:

- *"Automatic skill self-modification without git visibility"* (Rejected) — the boundary is
  **git visibility**, not self-modification. A playbook that rewrites itself is fine if the
  rewrite is a commit; the same playbook mutating state invisibly is the rejected shape.
- *"Archive completed changes into `openspec/changes/archive/`"* — consistent with
  `081KSE6WT0008QG0R003AJYMD3`, which already evaluated OpenSpec and rejected it as too heavy.
  That evaluation stands; do not re-litigate it.

***

## 2. Hard requirement 2 — what already landed

Verified against `main` rather than inferred. **Design: extensive. Implementation: none.**

### 2.1 Seven open rows carry this design

Beyond the five in 0.1, two more sit in the same family and neither was in the brief:

| ZetaId | what it carries | status |
|---|---|---|
| `081KSGS9H0008QG0R00123050G` | runme + JIT triage, the 3-register cell taxonomy (executable / prose / **gesture**), runbook→backlog→PR refinement pipeline | open |
| `081KSGS9H0008QG0R001K8VPV4` | Runme BCL extended with 4 capabilities: observability, ontology, database, MCP — "runbook as queryable substrate" | open |
| `081KSV2WD0008QG0R0020P6ZH2` | **self-propagating-Markdown compiler rule** + bootstrap-traveler template | open |

`081KSV2WD0008QG0R0020P6ZH2` is the closest existing row to Aaron's "starts as the spec and ends
as a running markdown file" sentence, and it predates it by 2.5 months: *"every Markdown file must
be a self-propagating pattern through time — or it doesn't compile (you can check it in, but it
doesn't compile)"* (Aaron + Mika, 2026-05-30).

### 2.2 Nothing from any of them is built

Checked for the named acceptance artifacts. None exist on `main`:

- `docs/MARKDOWN-RUNME-CONTINUE-WITH-PROTOCOL.md` — absent
- `docs/AI-AGENCY-STACK.md` — absent
- `docs/RUNME-USAGE.md`, `docs/CONVENTIONS-DEFERRED-TASKS.md` — absent
- `docs/BOOTSTRAP-TRAVELER.md` — absent
- `tools/bcl/`, `tools/mcp/runbook-mcp/`, `docs/patterns/` — absent
- **No code anywhere parses a `:::` block.** Grepped `src/Core.TypeScript` for it: zero hits.

Seven rows, ~1,400 lines of design, zero lines of implementation, three months. That fact is the
main input to the scoping decision in §6.

***

## 3. What changed since 2026-05-25 — the five items assessed

### 3.1 `B-NNNN` retirement — **already handled; not a live constraint here**

`lint-no-new-bnnnn.ts` rejects new `B-*` filenames under `docs/backlog/` or `workitems/`. The
five rows migrated cleanly before that gate mattered. **Invalidates:** every cross-reference in
the archived copies (dead ids). **Simplifies:** the resurrection, since the live rows already
carry correct ZetaId cross-references. **Practical note:** cite the live ZetaIds; the archived
files are historical artifacts and their `composes_with` lists point at ids that no longer resolve.

### 3.2 `auto-vivify.ts` — **is the resolution primitive, and it is half-built**

The brief is right that this is precisely the "non-resolved names that resolve later" mechanism,
and right that it is red. Reading it, three assessments:

**Enables.** The anchor in its header is exactly right and worth keeping: MUMPS auto-vivification
— referencing `^X("a","b","c")` creates the whole path. That is a genuine, old, human-anchored
primitive for "a name that resolves by being used", and it is the correct root for the feature.

**Simplifies.** ZetaId minting on vivify (`mintWorkItemZetaId`), citing-file link rewriting, and
the idempotent scan loop are all already there. That is more than half of what a promise-resolution
grammar needs mechanically.

**Invalidates nothing in the May design — but exposes what the May design never specified.** The
`:::` grammar in `081KSE6WT0008QG0R003AJYMD3` has `continue-with`, `decompose`, `query`, `jit`. It
has no notion of an **unresolved name**. Deferred *intent* ("do this later") and unresolved
*reference* ("this name will mean something later") are different primitives, and the May rows only
have the first. Aaron's 2026-08-15 sentence asks for the second. Nobody has joined them.

**How the design must handle the pointer/citation problem.** By refusing to infer. Four registers,
each marked syntactically:

| register | meaning | resolves? | check direction |
|---|---|---|---|
| **mention** | a name being talked about | never | not checked |
| **pointer** | go read this | now | must resolve → else broken |
| **citation** | absence is the claim | never | must **not** resolve → **inverted** |
| **promise** | will resolve later | on execution | unresolved is fine *until* triggered |

Citation and promise are the same mechanism with opposite polarity — a citation that starts
resolving is a defect, a promise that never resolves is a defect. Neither is recoverable from
prose shape, which is why the register must be **written**, not detected. This is the
`dual-use-detection-is-neutral-oracle-decides` discipline applied at the grammar layer: the
mechanism reports "this name does not resolve"; the register decides what that means. auto-vivify
today hardcodes one reading of a four-valued fact.

### 3.3 `dora-metrics.ts` — **the substrate extends; the fold does not**

Read: `src/Core.TypeScript/work-items/dora-fold.ts` (the real fold; `dora-metrics.ts` is a 25-line
CLI over it) folds an append-only G-Set into open-count-by-type, lead-time samples, and weekly
throughput, reading date-partitioned JSON via `read-events.ts`.

**Extends:** the storage and fold machinery — append-only G-Set, Bag fold, date-partitioned JSON,
idempotent by construction. This is right and should be reused wholesale.

**Needs a separate fold:** every function keys on `workItemId`, and `isWorkItemEvent` rejects any
event outside the work-item lifecycle vocabulary (`created` / `state-changed` / `closed`) at read
time. Per-file DORA needs the subject key and the event vocabulary to be parameters. So the answer
to the brief's question is: **neither cleanly** — parameterise the existing fold and re-instantiate
the work-item metrics through it, which proves the generalisation by use.

**A distinction worth not losing:** `081KSGS9H0008QG0R001K8VPV4` Capability 1 is "observability
queries" meaning *the markdown file as a window onto OTel/Prometheus*. Aaron's mini-DORA is
*telemetry about the file itself*. They compose. Reading one as the other would leave the thing he
named unbuilt while a row appears to cover it.

**Honest mapping.** Three of the four canonical DORA metrics (Forsgren, Humble & Kim, *Accelerate*,
2018) map directly to a file: deployment frequency → executions/week; lead time → edit-to-first-green;
change failure rate → failed fraction. **Time-to-restore does not** — there is no definition of
"broken" for a markdown file yet. Ship three, label the fourth an open question. Claiming four
because DORA has four would be exactly the numerology the rules warn about.

### 3.4 Hexagonal ports — **the parse side has a port; the execute side has neither port nor adapter**

Aaron calls this "a good hexagonal place." Checked what is actually there:

- `src/Core/UniversalNumber.fs` carries the repo's explicit hexagonal anchor (Cockburn, ports and
  adapters). The idiom is house style, not an import.
- `src/Core.TypeScript/file-type-plugin/codecs.ts` registers a `markdown-frontmatter` codec that
  parses a markdown document into a Z-set of tagged fields. **A real markdown parse port with a
  working adapter.**
- `src/Core.TypeScript/ace/cell-injection.ts` registers codecs by file extension against an
  injected cell — 60 lines, an existing plug point for an executable-markdown codec.
- `src/Core.TypeScript/ferry-throttler/mux-transport-bridge.ts` is a genuine ports composition
  (FerryThrottler → NetworkTransport → mux → WebSocket) but is only relevant once execution goes
  cross-node. Not on the thin slice's path.
- `IEffects` is discussed in a dozen research docs and in
  `.claude/rules/dv2-data-split-discipline-activated.md`, but appears in exactly **one source
  file**, `src/Core/SoftScheduler.fs`. It is a named discipline, not yet a general repo-wide
  effects port. Worth stating plainly because the brief lists it as an existing surface to plug
  into, and on the code side it is not one yet.

**Verdict: Aaron is right that it is a good hexagonal place, and it is more than an aspiration —
but the port that exists is for *parsing* markdown, not for *executing* it.** That gap is the
single most useful thing to close, because it is what turns "runme or our own" from a fork in the
road into an adapter choice.

**Unnamed in the brief but relevant:** `src/Core.TypeScript/workflow-engine/` already implements a
**universal action grammar** — `grammar.ts` parses action atoms with an `ActionClass` discriminator
(`transition`, `escape-hatch`, `grammar-extension`, `menu-contribution`, `operator-decision`,
`agent-decision`) and an `ActionGate` (`append-only` | `pr-gated`), with Otto's five modifications
enforced as type-level invariants. It is a pipe-delimited line format, not markdown-embedded. **The
playbooks action vocabulary should target this grammar rather than invent a second one** — otherwise
the repo has two incompatible answers to "what is an action."

### 3.5 `runme` — **alive, actively released, and the org moved**

Checked against the GitHub API on 2026-08-15, not the marketing page:

| fact | value |
|---|---|
| canonical repo | **runmedev/runme** (moved from `stateful/runme`) |
| archived | no |
| last push | 2026-08-14 |
| latest release | **v3.17.4, 2026-08-13** |
| licence | Apache-2.0 |
| stars / open issues | 2,140 / 153 |

So: still maintained, still permissively licensed, still a sound choice. **But the org move means
any May-era reference to `stateful/runme` is now a redirect, and a pinned dependency on the old
path is a latent break.**

**Is "our own" cheaper now?** Not as a replacement — writing a stateful multi-language markdown
executor to compete with a 2.1k-star Apache-2.0 project actively shipping releases would be an
unforced cost. But **as a second adapter, yes, and it is close to necessary**: DST replay
(discipline #4) and noninterference (#7) both require a DoP=1 deterministic path, and an external
binary running shell in a real terminal cannot provide one. The right shape is a port with a Runme
adapter for production and a record/replay adapter for the seed path. That reading makes Aaron's
"or whatever that markdown execution language is — we can also have our own" not a hedge but the
correct architecture.

***

## 4. The naming question — Aaron already coined "playbook", deliberately, on 2026-05-30

The brief asks for alternatives and warns against entrenching a provisional name. Both are right.
But the honest report is that this is a **re-arrival**, not a first arrival, and the earlier arrival
came with an explicit intent that the current caveat does not mention.

From `docs/research/2026-05-30-dio-did-canonical-architecture-...-self-propagating-markdown-aaron-mika-otto.md`:

> **Meta-annotations can be meta-actions** = a **playbook** (deliberately *playful / game-like*,
> NOT a runbook — *"I want to redefine what playbook means"*).

And "playbook" is already a **named section** of the bootstrap-traveler template in
`081KSV2WD0008QG0R0020P6ZH2`: *"**playbook** (patterns noticed; teaching moments; meta-actions
defined here)"*.

So two of Aaron's own statements are in tension and both are his to reconcile:

- **2026-05-30:** the overload is the point — *"I want to redefine what playbook means"*, chosen
  specifically for its playful register **against** runbook's operational one.
- **2026-08-15:** *"I know that term is overloaded... so we might use another name."*

I am not picking. Recorded so the decision is made with both halves visible rather than one.

**Alternatives, if he does want another name.** The test each has to pass: it must not read as
"operational procedure" (that is runbook/Ansible), and it must carry *future* and *unresolved*,
since that is what distinguishes this from every executable-notebook tool.

| candidate | what it gets right | what it costs |
|---|---|---|
| **playbook** | Aaron's own coinage; playful-not-operational register; already a template section | genuinely overloaded (Ansible, incident response, sales) |
| **traveler** | already in-repo (`081KSV2WD0008QG0R0020P6ZH2`, `src/Core/TravelerFrame.fs`); carries propagation-through-time exactly | overloaded *internally*, which is worse than externally |
| **promise** | precisely names the new primitive; strong CS lineage (Friedman & Wise 1976; Mark Burgess's promise theory) | names one register, not the document |
| **score** | musical: notation that is simultaneously specification and performance instruction — the closest true analogue to spec-becomes-running | unusual; may read as a metric |
| **spellbook** | future-actions-not-yet-cast; playful register Aaron wanted | may read as unserious outside the team |
| **weave** | the graph half; fits the existing "threads of time" vocabulary | vague about execution |

My read, offered as input and not a decision: **"playbook" is defensible precisely because Aaron
already declared the redefinition deliberately**, and the register he wanted (playful, game-like)
is not available from any of the alternatives except *spellbook*. If the overload does become a
problem, **score** is the one that survives the "what does it actually do" test best — a score is a
specification that is also the thing performed, which is the feature's whole claim.

***

## 5. What Aaron's 2026-08-15 statement adds that the seven rows do not cover

This is the genuine delta, and it is what got minted.

1. **Generic over any markdown file.** All seven rows scope to *runbooks* — a document class,
   implicitly a folder. Aaron: *"It should work generically for any markdown file."* That is a
   scope inversion: the grammar becomes a property of markdown in this repo, not of a location.
   `081KSV2WD0008QG0R0020P6ZH2` is the only row that already thinks this way ("every `.md`").
2. **A future/action grammar for unresolved names.** New. The `:::` vocabulary has deferred
   *intent*; it has no unresolved *reference*. The promise register (§3.2) is the missing primitive.
3. **Per-markdown-file mini-DORA.** New, and distinct from the observability capability already
   filed (§3.3).
4. **Execution as a port.** New. The May rows depend on Runme by name (§3.4, §3.5).
5. **A naming decision.** Aaron's, not mine (§4).

***

## 6. Scope — decomposition and the smallest end-to-end thing

Five work-items minted. The shape of the decomposition is deliberate: **the two smallest items fix
things that are red today**, so the feature starts by paying down the substrate it depends on
rather than by adding a layer to a design that already has seven.

| ZetaId | type | what |
|---|---|---|
| `081M036ZP2G087G0R000N01N9Z` | bug | auto-vivify parses inside code spans / fenced blocks; the bash double-bracket test becomes a wikilink |
| `081M036ZVSP087G0R001RQD2TH` | task | the four-register resolution grammar: mention / pointer / citation / promise |
| `081M0370143087G0R003H36RDE` | task | markdown execution as a port; Runme adapter + record/replay adapter |
| `081M0370573087G0R001EB507J` | task | per-file execution event log; parameterise the DORA fold's subject key |
| `081M0370B3H087G0R002SZ2APY` | task | **the thin slice** — one file, spec → running → self-reporting |

**The smallest thing that demonstrates the idea end to end** is `081M0370B3H087G0R002SZ2APY`: one
ordinary markdown file that opens as a spec containing a promise, resolves the promise on
execution, emits an execution event, and renders its own three metrics in a query block in the same
file. Read before running it is a spec; read after it is a running thing reporting on itself.

Its sharpest acceptance criterion is that `auto-vivify --check` must stay green with the file
present — an unresolved promise must not read as a broken pointer. That is the exact point where
the resolution register and the future/action grammar have to agree, and it fails loudly if they
do not.

Deliberately excluded from the slice (named so the exclusions are decisions): JIT compilation of a
missing script, the MCP wrap, hat gating, cross-cluster propagation, verbosity rendering, and
anything destructive. The slice stays read-only, which keeps it entirely below the leverage class
`081KSE6WT0008QG0R002YBWBB1` exists to guard — and that is why it can ship before those guards do.
It stops being true at the first destructive block, so **the guard rows gate the second slice, not
this one.**

**What is NOT minted, and why.** The naming decision (Aaron's call, §4); anything already covered
by the seven open rows; the safety layers, which are already decomposed into six independently
shippable layers in `081KSE6WT0008QG0R002YBWBB1` and need no re-scoping from me.

***

## 7. Toy / metered

Per `toy-is-free-metered-must-be-earned`:

- **This document is `toy`.** It is an assessment. Its only falsifiable content is the measurements
  in §0 and §3 — the 12 dangling references and their source lines, the absent files, the Runme
  API facts, the fold's key. Those are checkable and dated. Everything else is design.
- **The four-register grammar (§3.2) is `toy`** — it has no falsifier until the check runs green
  without an allow-list. An allow-list would keep it a toy permanently: a check that passes because
  the failures were enumerated is not a check.
- **The port (§3.4) is `toy` until it has two adapters.** A port with one adapter is a wrapper
  wearing an interface; nothing about it can be wrong yet.
- **The per-file DORA (§3.3) is `unmetered` on arrival** — implemented and used, never falsified —
  until a file's reported failure rate is checked against its log by an independent path.
- **The bug (§0.4) is the only `metered` thing here.** It reproduces, exit 1, at a named commit,
  and a regression test will fail without the fix.

***

## 8. Overlap with the sibling sweep

A sibling agent is sweeping the recovered-orphan tree for unreclaimed `B-NNNN` work. Reported, not
resolved, per the brief:

- **B-0729 through B-0733 are all already migrated** (§0.1). If the sweep is looking for
  unreclaimed rows, this whole cluster is a false positive and the map at
  `src/Core.TypeScript/backlog/b-to-zetaid-map.json` is the fast way to check before reading a file.
- **The three-identical-copies pattern** (§0.2) means the `pr4990-*` archives are duplicated
  snapshots, not divergent branches. Worth knowing before diffing them pairwise.
- The archived copies' `composes_with` lists cite **dead B-ids**. Anything resurrected from them
  needs the map applied; the live rows already have it applied.

***

## 9. Beacon anchors

- **Ports and adapters** — Alistair Cockburn, *Hexagonal Architecture* (2005). Already the
  repo's anchor at `src/Core/UniversalNumber.fs`.
- **Use–mention distinction** — the standard modern statement is W. V. O. Quine, *Mathematical
  Logic* (1940); the distinction itself is older (Frege). The register problem in §3.2 is this,
  exactly, and markdown's code span is the conflated quotation mark.
- **Auto-vivification** — M/MUMPS global subscript semantics (ANSI X11.1); referencing a
  subscript creates the whole path. Already cited in the `auto-vivify.ts` header; a genuinely old
  anchor and the right one.
- **Literate programming** — Donald Knuth, *Literate Programming* (CACM 1984). The direct ancestor
  of documentation-is-implementation. `081KSGS9H0008QG0R00123050G` already names it and correctly
  identifies what is added (the gesture register + JIT triage).
- **DORA four keys** — Forsgren, Humble & Kim, *Accelerate* (2018). Three of four transfer to a
  file (§3.3); the fourth does not, and saying so is the discipline.
- **Promises** — the *name* is Liskov & Shrira, *Promises: Linguistic Support for Efficient
  Asynchronous Procedure Calls* (PLDI 1988); the underlying primitive is older (Friedman & Wise
  1976; Baker & Hewitt 1977, "future"). For the reading that actually fits here, Mark Burgess's
  promise theory (2005) is closer: a promise is an intention *published* without an obligation
  *imposed* — which is what an unresolved name in someone else's markdown file is.
- **Fenced code blocks / code spans** — CommonMark 0.31.2 §4.5 and §6.1. The bug in §0.4 is a
  failure to implement a spec that exists, not an open problem.

***

## 10. What I did not do

- Did not build anything. This is assessment plus minted items only.
- Did not decide the name (§4).
- Did not re-mint the five migrated rows (§0.1) or re-scope the six safety layers.
- Did not fix the 12 dangling references. Two of the minted items are that fix; doing it inside a
  research PR would have hidden a substrate change under a documentation change.
