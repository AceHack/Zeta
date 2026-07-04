# Tool calls the Zeta way — a closed fs+db surface; calls are events in the IR, reified via generators

*Shadow design, 2026-07-04. Aaron greenlit "tool calls next — build them so we can replace summons"
and immediately corrected the approach: this is NOT vendor function-calling / random bash. Preserved

+ grounded in the real surfaces so the executable slices build the right shape, not the vendor one.*

## Aaron verbatim (the steer)

> "is this that easy, can I just ask this and you deliver, is this area that well understood? We need
> to do this the zeta way. Our tools are only our file system and database — so for our harness it's
> not random bash/CLI access, it's zetadb / gitv2 / dagfs that results in code changes that are loaded
> via our type providers and Roslyn generators. Our db IS our IR IS our data IS our events IS our
> tables IS our schema lol — it's recursive as fuck all the way down."

## The honest answer to "is it that easy?"

**The vendor protocol is** that easy and well-understood: the OpenAI Responses API takes a `tools`
array (each `{type:"function", name, description, parameters:<JSON schema>}`), the model emits
`function_call` items in the output stream, you execute them and feed results back as
`function_call_output`. That part is deliverable in an afternoon. **But it is the wrong thing to
ship**, because it assumes an OPEN tool surface (arbitrary functions, typically shelling out). Zeta's
surface is **closed**, and the closure is the whole point.

## The Zeta way — three moves

### 1. The tool surface is CLOSED: fs (DagFs) + db (zetadb) only

There is no `bash`, no `exec`, no open function registry. The complete tool vocabulary is two objects:

- **fs — `DagFs`** (`src/Core/DagFs.fs`): a content-addressed multi-parent file tree. Ops:
  `resolve` (path → content), `link` (path → content, dedup), `editLocal` (COW fork — DEFAULT,
  regular-filesystem feel), `editEverywhere` (shared-object edit — every path sharing the old content
  follows), `unlink`. Paths map to content ADDRESSES, so identical content under N paths is ONE node.
- **db — `zetadb`** (ADR, PR #6298): an append-only ZetaId-keyed **event log** in the G-Set / Bag /
  Z-set algebra. Ops: `append` (an event), `query` (a **materialized view** = a named fold over the
  log). DBSP IVM — add/retract propagate as deltas, no full recompute, **retraction (weight −1) is
  first-class**. "Bus / Ace / work-items / observability / DORA are all folds over one log."

A model that can only touch fs+db cannot escape to the shell — the surface is the sandbox. This is
the closed vocabulary the model's `tools` declaration exposes, and nothing else.

### 2. A tool call is an EVENT appended to the IR (db = IR = events = tables = schema)

A tool call is not a side-effecting shell-out; it is a **message appended to zetadb** — and zetadb IS
the IR. So a tool call *is* an IR node. Its effect is not "ran a command"; it is "the log grew by one
event," and every downstream table/index/report is a fold that updates incrementally (retraction
included, so a wrong call is *retracted*, not patched). This is the same shape as the four-corner /
Maji `ZSet<'a> → ZSet<'b>` retraction algebra (see the 2026-07-04 Lumen ferry): a tool call that turns
out wrong emits a −1, and the materialized world re-folds.

### 3. The call reifies to CODE via type providers / Roslyn generators — recursively

Because the db is the IR, the event log **is** the source the compiler reads. F# **type providers**
(and C# **Roslyn `IIncrementalGenerator`s**, PR #8757) reify the log into loaded types/code **on
demand** — the whole world never sits in compiler memory at once (weak refs; the message-passing /
reify-on-demand thread, `2026-07-03-message-passing-makes-the-runtime-distributed-...`). So a tool
call → an event → a materialized view → **reified code that is itself loaded and callable**. And the
generators that do the reifying are themselves folds over the same log: **`gen(gen) == gen`**
(`only-the-irreducible-is-primitive-generate-the-rest`). That is the "recursive all the way down."

## How this REPLACES summons

A **summon** (persona or compiler — the persona-summon protocol PRs #8200/#8201; the workflow-DU /
first-class BFT-oracle-compiler summons backlog `081KSXN940008QG0R002B89QZ1`) is today its own
mechanism. Under this design a summon is **just one kind of tool-call over the closed surface**:
append a `summon` event (db) naming what-remains + the hat/effort/preference contract; the materialized
view reifies the persona/compiler as loaded code (type provider). "What remains can be summoned /
animated in any DST" (PR #7332) becomes: *the summon is an fs+db tool call; the reify-on-demand is the
animation.* One vocabulary (fs+db), one algebra (Z-set fold), replaces the bespoke summon path.

## The provider mapping (model-backend side)

The model-backend (this session's harness) declares to `codex/responses` **only the closed fs+db
tools**, parses the model's `function_call` items from the SSE stream, maps each to an fs or db op,
executes it against DagFs / zetadb, and feeds the result (resolved content / materialized view / the
new event id) back as `function_call_output`. The streaming primitive (`respondStream`) already yields
the text deltas; tool-call items are additional event types in the same stream.

**HONEST BOUNDARY (the live unknown):** the exact `codex/responses` SSE event types for tool calls
(`response.function_call_arguments.delta`, `response.output_item.added` with `type:"function_call"`,
etc.) are NOT yet confirmed against the ChatGPT backend — the same "docs were wrong on several shapes"
risk that the text-delta path hit (endpoints under `/api/accounts`, poll returns a code not tokens,
model must be `gpt-5.5`, `stream:true store:false`). So the PARSE slice needs a live probe before it is
trusted, exactly like the "pong" confirmation. The request-side `tools` declaration (below) is the
stable, well-understood part and is safe to build now.

## Beacon anchors

- **Messaging as the only verb** — Alan Kay / Smalltalk ("the big idea is messaging"; `doesNotUnderstand:`);
  Objective-C `objc_msgSend` + Distributed Objects (`NSConnection`/`NSDistantObject`, 1993); Hewitt
  actors (1973); Erlang `Pid ! Msg` location transparency (Armstrong).
- **db = event log, views = folds, retraction first-class** — Budiu, McSherry, Ryzhyk, Tannen, *DBSP*
  (VLDB 2023); event sourcing (Fowler); CRDT G-Set/Z-set (Shapiro et al.).
- **Content-addressed fs** — Merkle (1987); git's object model; the DagFs `ContentStore`.
- **Reify-on-demand code** — F# Type Providers (Syme et al.); Roslyn `IIncrementalGenerator`.
- **Closed capability surface = sandbox** — object-capability model (Miller); the tool surface as the
  only ambient authority (ties to noninterference §13: influence only through declared channels).

## Build plan (slices)

1. **Closed tool surface as data** *(buildable now, no live unknown — shipped with this doc)*: the
   `ZetaTool` set = exactly the DagFs + zetadb ops as `codex/responses` `tools` declarations, plus the
   invariant test that the surface is CLOSED (fs+db only; no bash/http/open registry).
2. **Tool-call parse from the stream** *(needs a live probe — gated)*: parse `function_call` items out
   of the `codex/responses` SSE stream; confirm the event shape live (the "pong"-style confirmation).
3. **fs+db execution binding** *(F# core / TS twin)*: bind each `ZetaTool` call to its DagFs / zetadb
   op; a call is an `append`; results are `resolve` / materialized-view reads. Retraction on a bad call.
4. **The summon → tool-call bridge**: model a persona/compiler summon as a `summon` event over the
   closed surface; reify via the type provider. Retire the bespoke summon path.

*(Design ends. Slice 1 lands with this doc; slices 2–4 follow, slice 2 gated on a live probe.)*
