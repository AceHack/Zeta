---
id: 081KTGES04808QG0R0010AK90E
type: task
state: done
priority: P2
slug: file-type-plugin-model-plugin-file-type-zset-handler-optiona
title: "File-type plugin model — plugin = file-type<->ZSet handler + OPTIONAL Rx-defined incremental indexed views (=git main); plugin persisted as DynamicValue to run in all 4 langs; open/closed"
created: 2026-06-07T07:11:54.504Z
completed: 2026-06-21T04:26:24.417Z
depends_on: []
composes_with: []
---

# File-type plugin model — plugin = file-type<->ZSet handler + OPTIONAL Rx-defined incremental indexed views (=git main); plugin persisted as DynamicValue to run in all 4 langs; open/closed

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTGES04808QG0R0010AK90E-*.md` glob. -->

## Source (Aaron 2026-06-07, verbatim intent)

> "the file type handlers are just specific handlers for zsets mapped to that file type. most indexes
> over zsets for file types can be auto-defined too with the plugin as rx queries over the zset into
> incremental indexed views; current view tables can always be computed this way and matches git's main
> basically for our mapping here. but even that should be optional over the file type — the indexed view
> is optional and each file type can choose its indexes and describe with rx queries. and we can persist
> the plugin as a dynamicvalue instead of f# so it can run in any of our 4 languages."

## The model

A **file-type plugin** has three layers, the last two optional:

1. **Handler = file-type ↔ `ZSet` mapping** (required). Parse a file of this type into a ZSet; emit it
   back. This is the per-file-type realization of the format/header+body treaty (markdown, yaml, cbor, …).
2. **Optional Rx-defined incremental indexed views.** A plugin MAY auto-define indexes as **Rx queries
   over the ZSet** → DBSP/IVM **incremental indexed views**. The **current view table** is computed this
   way, and it **IS git's "main"** in our mapping (materialized current state = the incremental view over
   the Log's ZSets = git working tree/HEAD). **Optional per file type**; each type chooses its own indexes,
   described by Rx queries.
3. **Plugin persisted as a `DynamicValue`, not F# code.** The plugin is **data**, so the *same plugin runs
   in any of the 4 languages* (no per-language reimplementation) — Bonsai-serialized Rx + DynamicValue
   carrier make the index definitions portable.

**Open/Closed:** new file types + new indexes extend via new plugins (data), never by modifying the core.

## Composes with (existing substrate)

- `ZSet` / `IndexedZSet` (the core + keyed index rung), DBSP IVM (`Circuit`/`Operators`/`Incremental`).
- **Bonsai-serialized Rx** (the self-evolving-saga substrate — serialize the Rx query as DynamicValue;
  see PRIMITIVE-REGISTRY "serializable deferred execution").
- `DynamicValue` (plugin-as-data carrier, 4-lang byte-locked), the format/file-type treaty (ROADMAP).

## Open questions

- The plugin contract surface (what a plugin DynamicValue must declare: file-type tag, handler verbs,
  optional index Rx-query list).
- How "current view = git main" maps precisely (the fold/IVM ↔ git working-tree correspondence).
- Registration/discovery of plugins (a plugins-as-rows Log, naturally).

## DI / interface contract as DynamicValue + what else can be a plugin (Aaron 2026-06-07)

> "is there anything else we can make plugins given the data constraint of plugins? the thought is the
> plugins depend on the interfaces and the DI setup can be part of the dynamicvalue too — or at least the
> negotiated base; the host may have additional DI injections or requirements."

**DI/wiring is also data.** A plugin depends on *interfaces*; that dependency contract can itself be a
`DynamicValue` — at least a **negotiated base**: the plugin declares (as data) the interfaces it
requires, the host's DI container resolves them, and the host **may inject additional** host-specific
capabilities/requirements. This is the **Eve Protocol / QueryInterface** ("what shape do you support?")
applied to plugin wiring: the DI contract is negotiated data, not compiled-in.

This is also how a *deterministic* plugin can still reach effectful capability **without breaking the
data-plane determinism contract** (`081KTGEVV75`): the plugin's pure core declares an effectful
capability as a **required interface** (a DECLARED dependency); the host injects a concrete impl; the
plugin logic stays DST-replayable given the same injected behavior (record/replay the injected calls).
The determinism boundary becomes explicit — pure expression tree + declared injected deps — rather than
"no effects at all." Negotiated base = the minimum interface set any host must satisfy; host extras are
additive.

**What else can be a plugin** (given plugin = deterministic restricted `DynamicValue` expression tree +
declared interface deps — anything that fits this shape):

- File-type handlers / codecs (the seed case) and their optional Rx indexed views.
- Validators / schema mappers / migration (schema-evolution) rules — deterministic transforms.
- Reducers / fold functions over a Log; access/redaction predicates (deterministic).
- Query/transform pipelines (Rx/DBSP over ZSets); negotiation/diplomacy shapes (Eve Protocol as data).
- **The DI/wiring contract itself** (the negotiated interface base) — data, not code.

NOT a plugin (must be a host-injected capability the plugin *declares*, not embeds): anything inherently
non-deterministic (clock, randomness, network/IO, ambient state) — surfaced as a required interface and
recorded for DST replay.

**Dependencies are ZetaID refs — the value self-describes its own deps (Aaron 2026-06-07).** ZetaID is
the *universal cross-layer pointer*, so a plugin's declared dependencies (its required interfaces /
negotiated-base, other plugins, cells, streams it reads) are just **ZetaID references embedded in the
plugin's `DynamicValue`**. The plugin is therefore **fully self-describing including its dependency
graph** — no side-channel: deps live *in* the value, addressed by ZetaID, resolved by the microcore
(Nucleus). The same ZetaID routes the cross-cell partitioned bus (Actor ID = ZetaID). This closes the
plugin-as-data / DI-as-data loop.

Open: the negotiated-base schema (how a plugin declares required interfaces — as a list of ZetaID/
interface refs in DynamicValue), and the host-extension protocol (how a host advertises additional
injectables). Composes with Eve Protocol (`Diplomacy.fs`), the determinism contract (`081KTGEVV75`),
`ZetaId` (the universal pointer), and `DynamicValue` as the carrier.

## Serializers + primitives as plugins, and the MEF-like microcore (Aaron 2026-06-07)

> "maybe even the serializers or zeta primitives themselves [can be plugins] … we can shrink into a
> MEF-like plugin model where everything is a plugin, with a microcore based around DI and plugins."

The end-state: **a microcore + everything-else-as-plugins** (MEF / microkernel architecture). The core
shrinks to the smallest thing that can *load and compose plugins*: a **DI/composition container** over
the **carrier nouns**. Above that, serializers and derived primitives become plugins-as-data:

- **Serializers as plugins** — YAML / XML / Arrow / future formats become plugin codecs (`format ↔
  DynamicValue`), registered + composed, not hard-wired. (The MD/frontmatter + per-file-type plugins are
  already this shape.)
- **Zeta primitives as plugins** — derived primitives (CRDTs, sketches, Bonsai, Curve, higher algebra
  ladder rungs) expressed as deterministic `DynamicValue` programs + declared interfaces, composed via DI.

**The bootstrap caveat (Rodney's Razor — do NOT chase infinite regress).** "Everything is a plugin"
cannot be *literally* everything: there is an irreducible **microcore** that must be native to bootstrap
the plugin system — you cannot encode `DynamicValue`'s own codec purely as a `DynamicValue` without a
base implementation (a compiler written in its own language still needs a bootstrap compiler; MEF itself
has a non-MEF composition engine). So the microcore is:

- the **carrier nouns**: `ZSet` + `DynamicValue` + `Log` (the proven 3-noun base, native),
- **one canonical serializer** (CBOR — the bootstrap codec, native; other serializers are plugins),
- the **DI / composition container** itself (the loader + the negotiated-base resolver).

Everything else — additional serializers, derived primitives, file-type handlers, views, validators,
negotiation shapes — is a plugin composed onto the microcore. Perf-parity (the native-vs-plugin
benchmark, below) is what keeps "everything is a plugin" from being a slowdown: a plugin serializer/
primitive must run native-close.

**Human prior art (Beacon anchor):** MEF — Managed Extensibility Framework (.NET; exports/imports +
composition container) · OSGi (Java bundles/services) · the **microkernel / plugin architecture**
pattern (Buschmann et al., POSA) · Eclipse plugin model. Our twist: the plugins are **data**
(`DynamicValue`) + **deterministic** (the data-plane contract) + **cross-language** (run in any of the 4
oracles), where MEF/OSGi plugins are host-language code.

Open: where exactly the microcore boundary sits (which primitives are kernel vs plugin), and the
composition-container contract (discovery/registration = a plugins-as-rows `Log`; the negotiated-base +
host-extension protocol above is its import/export model).

## Cell injection = a boundary; self-describing → self-testing (Aaron 2026-06-07)

> *"this also means you can DI-inject another cell or a cell map into a DynamicValue — this represents a
> boundary."* … *"so we can easily test it."* … *"it would be cool if DynamicValue could ship with its own
> tests somehow."*

A coherent thread building on ZetaID-as-universal-pointer (a DynamicValue self-describes its deps):

- **A DI-injected cell (or cell-MAP) in a DynamicValue IS a boundary.** Because deps are ZetaID refs in
  the value, you can inject *another cell* — or a **cell-map** (= the geode mesh / selective
  stream-routing fabric, the set of cross-cell edges) — as a dependency. That injection point is exactly
  a **boundary**: the cross-cell / dependency seam expressed as data, not hidden in code.
- **Boundaries are trivially testable** (the payoff). A DI port is a mock seam: swap the injected cell /
  cell-map for a **test double** → exercise the consumer in isolation. Same hexagonal/ports-and-adapters
  testability we already use injecting `InMemoryDeltaLog` for tests — generalized to cells. "We can easily
  test it" because the boundary is an injection point, and the injection is *data* (a ZetaID ref you
  rebind to a stub).
- **Self-shipping tests — a DynamicValue carries its own tests.** A value/plugin could embed (or
  ZetaID-reference) its **own test vectors + invariants/properties as data**, making it **self-certifying**:
  any of the four hosts can run the value's own tests to verify it in-place. This is the generalization of
  the **golden-vector treaty** (a seed = a value + its expected encodings) into a universal property:
  *every value ships the obligations to check itself.* Composes with: golden-vectors-as-data, the
  determinism contract's declared laws (`081KTGEVV75`), property-based-tests-as-data, the perf-parity
  benchmark (below), and DST replay (the embedded vectors are a deterministic self-replay). Open: the
  schema for "tests attached to a value" (vectors + law assertions as a DynamicValue sub-tree, runnable by
  the microcore/Nucleus in any oracle).

## Performance parity + dual-implementation benchmark (Aaron 2026-06-07)

> "the plugin that loads the dynamic value should be as fast as our hand-written F# we have without the
> plugin. we can always keep both the plugin version and the F# version for benchmark testing to look for
> regression. we could do this in all 4 langs — that would test our interpreter in each host for
> performance too."

- **Perf-parity target:** the DynamicValue-interpreted plugin path must be **as fast as the hand-written
  native** (no-plugin) path. Interpreter overhead → ~zero is the bar, not "acceptable."
- **Dual implementation as a regression harness:** keep BOTH the plugin (DynamicValue) version AND the
  hand-written native version of each handler; benchmark them head-to-head so any interpreter drift shows
  as a regression. (The native version is also the correctness reference for the plugin output.)
- **All 4 languages:** run the pair in F#/C#/Rust/TS — this doubles as a **per-host interpreter
  performance test** (each host's DynamicValue/Rx interpreter is benchmarked, not just F#'s).
- Owner: Naledi (performance-engineer) for the benchmark shape + regression gate; composes with the
  determinism/alloc/Big-O contract (workitem `081KTGEVV75`).

## Anchors

- `docs/ROADMAP.md` (format/file-type treaty + this plugin model) · two-plane DB design doc · 081KSXN940008QG0R003FCQ7WT.
- Depends conceptually on the Log noun byte-lock (081KTGD5JMD) + a DynamicValue YAML serializer +
  the Bonsai-Rx serialization substrate.
