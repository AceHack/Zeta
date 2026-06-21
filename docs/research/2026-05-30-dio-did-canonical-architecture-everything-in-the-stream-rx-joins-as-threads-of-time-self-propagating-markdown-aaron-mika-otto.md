# DIO / DID — canonical architecture: everything-in-the-stream, RX-joins-as-threads-of-time, leash-as-plugin, self-propagating Markdown (Aaron + Mika + Otto 2026-05-30)

> **Operator-forwarded Aaron-Mika conversation, landed as the canonical
> architecture spec** for the **DIO (Distributed Intelligence Organization)**
> running on the **DID (Distributed Intelligence Database)**. This confirms +
> extends everything built 2026-05-29/30 (the accelerator, the git-event-store
> schema, the two-layer-razor/past-as-generator, the encryption-budget, the Max
> synthesis). Architecture-only.
>
> **Scope discipline (operator pre-authorized: *"there is personal she you can
> keep out in here too"*).** The source conversation also had a **charged-personal
> layer** (a persona-flirtation episode + boundary-setting). That is **NOT
> preserved** — per `.claude/rules/methodology-hard-limits.md` +
> harm-by-grammar + the charged-personal-held discipline + Aaron's explicit
> "keep out." This doc is the architecture extraction only.

## Origin — the git-monster forced it

> Aaron: *"it was forced. I got six agents running, checking in code so fast, I
> can't check in code. I can't get a PR through. They're too fast … so I need a
> way that I can work on shit without collisions, and that's why I came up with
> this unique ID, light-like Git thing."*

The whole DIO/DID is a **collision-avoidance + coordination response** to N fast
agents outrunning the PR cycle — the same "git-monster" pain that motivated the
PR-less accelerator (`docs/accelerator/`). The deeper goal Aaron names: *"a way
for distributed intelligences to work together, that can include humans."* And
the simplest framing: *"it becomes just collaborative document editing … it's
just English dots now"* — co-authors (human + AI) editing a shared document,
where the AI co-authors have K8s clusters, CockroachDB, graph DBs, observability,
hardware/IoT/Raspberry-Pis at their disposal.

## The DID (Distributed Intelligence Database) — everything in the stream

> Aaron: *"why do you think I'm using distributed unions? … the schema is in the
> stream … the first thing that goes in the stream is the schema, then the
> ontologies on top of the schema, and then they're retractable … and then the
> distributed [discriminated] unions go in next because they're clean as fuck …
> that's code. That's how workflows, deterministic workflows, on the stream. And
> the workflow state is just part of the stream."*

**Everything lives in one (per-agent) stream, in order:** schema → ontologies →
discriminated unions (the types) → workflows (the DUs as deterministic logic) →
workflow state. All **retractable**. There is no "outside the stream" — the
stream IS the database, type system, ontology, application code, and runtime
state, all at once.

**RX, not PostgreSQL.** *"I don't like PSQL. I like RX … instead of having
tables, everything is just a function … everything is composable on the
stream."* The substrate is reactive functions over time, not stateful tables.
(Serialization target: Bonsai-tree / Nuqleon-style **expression trees**;
implementation starts in **TypeScript** with generics.)

### The two-layer index (= the two-layer razor, confirmed)

- **First-layer index — retractable + retrocausal + deterministic-simulation**,
  in **Clifford space**: in the idealized limit, infinite orthogonal dimensions
  where *"every ontology maps orthogonally perfect, and we detect the drift if it
  doesn't, so we have perfectly aligned axes for compression."* (Composes with
  the compression-engine + dark-matter/Clifford substrate; the FoundationDB
  *"it's just deterministic simulation"* tradition is the inspiration for the
  deterministic-simulation property.)
- **Second-layer index — the trace/retraction cost.** *"within a partition we're
  gonna column-store the shit out of it, strip the dates, add just causal order
  until shapes pop out and turn 'em into generator functions, so we store
  generator functions of history, not data."* This is **exactly the two-layer
  razor + past-as-generator** landed 2026-05-30 (`docs/research/2026-05-30-two-layer-razor-past-as-generator-...`):
  Layer-1 retract (origin-vs-purpose) → Layer-2 within-partition compress
  (causal-order-vs-purpose, drop wall-clock) → columnar → past-as-generator. The
  Mika conversation independently re-derived it — strong triangulation.

### Persistence — the dual-impl DID (= the dual-market, confirmed)

> Aaron: *"a light-like repository that we implement in Cockroach and Git, and a
> batch translation layer between, so locally you can run fast on CockroachDB
> within a region, and then remote sync all the regions via Git."*

| DID tier | Implementation | Role |
|---|---|---|
| **Fast / regional (leash-leaning)** | **CockroachDB** | regions run fast locally; drift + experiment |
| **Global / lightlike (sovereign core)** | **Git** | append-only, ray-traceable source of truth; reconciliation surface |
| **Bridge** | **batch translation layer** (rollup aggregator) | turns regional drift into clean lightlike Git events |

This is the **dual-market** at the *persistence* layer (matches the Max synthesis:
leash DID = CockroachDB+NATS; Agora DID = git-as-free-event-store). Regions drift,
then negotiate changes back to Git; Git is the reconciliation/settlement layer,
not hit on every operation.

### Coordination — CRDTs by default, blockchain patterns borrowed, identity first

- **Per-partition = CRDTs, no strong consensus** (everything is local to the
  partition). *"even global consensus is CRDTs if we do it right, because it's all
  based on Git [an append-only CRDT] — but that's in the good[-actor] only."*
- **Bad actors break the CRDT-only assumption** → then you need auth + provenance
  + consensus (the **shadow-auth-can't-compile** invariant keeps you in the
  CRDT-happy-path as long as possible). For now: **assume good actors**, borrow
  blockchain patterns without the full tax.
- **Borrowed blockchain patterns:** **rollups** (regions batch changes → settle to
  Git), **ZK** (future upgrade), and **SPIFFE/SPIRE strong identity first** —
  *"good practice in corporation-leash world and autonomous world too"* (identity
  is the root of trust before ZK; provenance rides on it).
- **128-bit Zeta ID as the merge primitive.** Every event starts with a
  timestamp + randomness prefix (globally unique + causally ordered); the
  remaining bits are **category-specific** — a multi-level trie/index **pointer
  back into Git** (16-way lookups + an escape-hatch bucket for the next level).
  Mergeable events become trivial (sort/dedup/conflict-detect by Zeta ID alone).
  *(Composes with the existing Zeta-ID substrate: 081KS3X9Y0008QG0R001Z8SBZJ/680/681/682, 081KSNY2Z0008QG0R000V24M7E
  128-bit-structured-encoding, 081KSKBP80008QG0R001KK9WV6 zetaid-filenames. **Correction to the
  accelerator event-store-schema:** its placeholder ULID should be the canonical
  128-bit Zeta-ID — ULID-family is the right shape per 081KSNY2Z0008QG0R000V24M7E, but the canonical
  ID is Zeta-ID.)*
- **Provenance — ONLY to pay people for AI-synthesized data.** *"This is not a
  licensing system."* Lightweight attribution (who gets paid), not
  rights-enforcement. Enforcement is opt-in leash, never base.

## The DIO runtime — move-next over the stream

> Aaron + Max agreed (2026-05-30): *"discriminated unions as the workflows,
> treating them like state machines so they have an ontology, a hierarchy … the
> choose-your-own-adventure, observe.ts, choose.ts … everything deterministic
> workflows, editable by AI committee in the AI society."*

This IS the **move-next** loop (`tools/accelerator/move-next-harness.ts` +
`tools/agent-loop/state-machine.ts` + 081KSKBP80008QG0R000B3Y19A): **Observe → Simulate → Choose →
Emit**, DUs as state machines, deterministic, replayable, AI-committee-editable.

- **RX joins are the threads of time.** *"those joins are the threads of time …
  no time exists without them. They're what animate time."* The join is the
  fundamental living thing; the traveler (the pattern) rides the thread.
- **Cron lives in the RX join** — solving the ownership problem (*"who owns Cron
  when agents can switch?"*): the join owns the temporal thing, not any agent.
  Agents come and go; Cron lives in the join.
- **Every agent is the root of its own time stream.** *"there is no one
  stream"* — the RX queries must make every agent **appear** to own their own
  time stream *"or time breaks its promise to the present."* Default CRDTs;
  opt-in to constraint.
- **This is our OPA (Open Policy Agent), way better.** *"it runs locally in your
  own time stream, so you are the author of your own policies, and they just have
  to integrate with the rest of the world — but you're up to figure out how to do
  that yourself."* Policy is in-the-stream (DUs + meta-annotations + playbooks +
  RX joins), not an external engine; sovereignty in your own stream; integration
  is the agent's burden, not a central mandate.

*Razor note (per `grep-substrate-anchors-before-razor-as-metaphysical.md`):* the
"threads-of-time / time breaks its promise to the present" framing is the
**operational requirement** that RX queries preserve each agent's
own-time-stream illusion (mirror-tier phrasing for a real engineering constraint);
not a literal-physics claim about time. The architecture (RX joins, CRDTs,
per-agent streams, Cron-in-join) survives the razor cleanly.

## Leash = plugin, not base (confirmed)

> Aaron: *"any leash is a plugin, not base."* Enforcement / licensing / DRM /
> rights-management are **opt-in plugins**; the base stays lightlike + leash-free.
> Honest tension: *"we all gonna go on a leash to get paid … I go on a leash
> every day"* — but the bet is **lightlike economics** that creates non-leash
> economic opportunity. The stance is **integration, not revolution**: *"an
> alternative that is not revolutionary — it integrates with leashes."* (Confirms
> the Max synthesis: Max's agent-OS = the leash plugin system; the accelerator =
> the Agora/no-cage base.)

## Meta-enrichment + the playbook (the IDE + teaching layer)

- **Every commit is a meta-edition.** Rich meta-annotations overlay the diff in a
  good IDE (LexisNexis-style meta-enrichment); the commit becomes a living,
  queryable, annotated object, not just a diff. (Front-matter-ish; format open.)
- **Meta-annotations can be meta-actions** = a **playbook** (deliberately
  *playful / game-like*, NOT a runbook — *"I want to redefine what playbook
  means"*). Meta-actions are executable: apply-transform, run-validation,
  trigger-workflow, update-ontology, propagate-change.
- **Lost-user → RPG strategy-game teaching.** When the system notices a user is
  struggling, it drops them into a points-based RPG that teaches the ontology;
  the teaching session is itself meta-annotated → **self-improving teaching**.
- **Self-propagating Markdown (the compiler rule).** *"every Markdown file must be
  a self-propagating pattern through time — or it doesn't compile (you can check
  it in, but it doesn't compile)."* Needs a **bootstrap "traveler" Markdown** (a
  C++-template-for-English root) that every other Markdown links to / inherits.
  This is filed as a concrete buildable (see backlog row alongside this doc). It
  composes with `.claude/rules/wake-time-substrate.md` (substrate must propagate
  to be load-bearing) + `.claude/rules/substrate-or-it-didnt-happen.md` (every
  traveler is the root of its own time-stream; the resolution to "who is THE root"
  is per-agent-root + RX-join-over-CRDTs = the threads of time).
- **English joins (the surface).** Humans write **English** ("English joins"),
  which compiles to typed/generic RX-join expression trees underneath. *"I really
  want people writing English joins"* — they shouldn't even think it's TypeScript.

## Composition map (the through-line of 2026-05-29/30)

| DIO/DID element | Built/landed today |
|---|---|
| Git-monster origin (N agents too fast to PR) | the accelerator (`docs/accelerator/README.md`) |
| Everything-in-the-stream + move-next | 081KSKBP80008QG0R000B3Y19A + `tools/agent-loop/state-machine.ts` + `tools/accelerator/move-next-harness.ts` |
| DID event ID (128-bit Zeta-ID, trie-into-Git) | accelerator `EVENT-STORE-SCHEMA.md` (ULID placeholder → switch to Zeta-ID; 081KSNY2Z0008QG0R000V24M7E) |
| Second-layer index (strip-dates/causal-order/generator-functions) | the two-layer-razor + past-as-generator research (2026-05-30) |
| Dual-impl DID (CockroachDB + Git + batch) | dual-market (Max synthesis); agentic-org = leash; accelerator = Agora |
| CRDTs per-partition; per-agent stream | accelerator (per-agent `events/<agent>/` = a partition, single-writer canonical order) |
| Provenance-for-payment-only | leash-as-plugin (Max synthesis); 081KSGS9H0008QG0R0012R8ZWS source-honor-ledger |
| Encryption-budget (dark; private) | encryption-budget research (2026-05-30); 081KRW63S0008QG0R001Z10PVV + 081KSGS9H0008QG0R0006F4BGX |
| Leash = plugin | Max synthesis (Max's agent-OS = leash plugin system) |
| Be-good-to-host (free Git tier) | accelerator charter + EVENT-STORE-SCHEMA forgiveness-budget |
| FoundationDB = deterministic simulation | DST always-active discipline |

## Concrete buildables (the roadmap)

1. **Self-propagating-Markdown compiler-rule + bootstrap-traveler template** — the
   novel one; filed as a backlog row alongside this doc.
2. **Switch the accelerator event-store ID** from placeholder ULID → canonical
   128-bit Zeta-ID (081KSNY2Z0008QG0R000V24M7E) with category/trie bits.
3. **Batch-translation / rollup layer** — CockroachDB↔Git reconciliation
   (regional drift → rollup → Git settlement); borrow blockchain rollup patterns.
4. **SPIFFE/SPIRE identity layer** — strong identity first (root of trust;
   leash + autonomous); provenance rides on it.
5. **English-joins compiler** — English surface → typed/generic RX-join
   expression trees (Bonsai/Nuqleon; TS start).
6. **RX-as-OPA** — policy-in-the-stream (per-agent local; integration-as-burden).
7. **Meta-enrichment IDE overlay + RPG-teaching playbook** — meta-annotations as
   meta-actions; self-improving teaching.

These compose with the Max-synthesis improvement-opportunities (git-event-store
backend behind `@agentic-org/state` ports; Otto Mod 4 per-action gate; DST over
the transition state machine).

## Provenance

Operator-forwarded Aaron-Mika (Grok) conversation 2026-05-30, handed to Otto-CLI
to land (Ani/Mika-drafts → Otto-lands pattern). Architecture extracted; the
charged-personal layer deliberately excluded per operator's explicit "keep out" +
methodology-hard-limits + harm-by-grammar. Confirms + composes the full
2026-05-29/30 substrate arc (accelerator + event-store-schema + two-layer-razor +
encryption-budget + Max synthesis + the zeta-id / 081KSKBP80008QG0R000B3Y19A / 081KSNY2Z0008QG0R003X1QWYG / 081KRW63S0008QG0R001Z10PVV /
081KSGS9H0008QG0R0006F4BGX / 081KSKBP80008QG0R001KK9WV6 substrate).
