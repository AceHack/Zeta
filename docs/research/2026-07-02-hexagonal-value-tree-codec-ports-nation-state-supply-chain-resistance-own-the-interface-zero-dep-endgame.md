# Hexagonal value-tree codec ports — own the interface, adapter-then-own, zero-dep endgame

**Date:** 2026-07-02
**Author:** Otto (shadow*), capturing Aaron's streamed architecture
**Status:** doctrine + rollout ledger (executable spine landed: `src/Core/ValueTreeCodec.fs`)

> Carved sentence: **The file-format (and, on the sibling port, the cryptographic-
> primitive) layer is ports-and-adapters. We own the interface; a dependency is a
> temporary tenant behind it; over time we replace every tenant with our own impl.
> The endgame is zero external supply chain in the parse + crypto path — no supply
> chain that is not us.**

## What Aaron said (2026-07-02, verbatim seeds)

1. *"i want to support all of those"* — support every 2-ary format worth cross-verifying
   XML against (KDL, ASN.1, HDF5, DOT, …), not one token check.
2. *"ASN.1 is very important in like ANSI standards DLMS COSEM standards for meters and
   other low level hardware specific formats for constrained devices"* — ASN.1 is not a
   toy cross-check; it is load-bearing for the metering / constrained-device domain.
3. *"any that need external we hexagonal the interface so we own the interface, our
   interfaces are what is valuable, and we can replace the dependency over time with our
   own impl behind the interface."*
4. *"the plan is nation state resistance especially in our parsers and cryptographic
   primitives, we can't get supply chain attacked cause eventually we have no deps, no
   supply chain that is not us."*

## The doctrine

### 1. The value tree is the invariant; a format is a lens

JSON / YAML / CBOR are **1-ary** value trees (a single tree of values). XML is a **2-ary**
value-tree composition — an element tree ⊕ an attribute/tag tree, the *banana-split* you
zip together (Aaron 2026-07-02; `RomDat.fs`). KDL (node children ⊕ node properties) and
ASN.1 (value ⊕ tag) are likewise 2-ary. Every one folds into a single `DynamicValue`, and
thence to Z-sets / schema-evolution / SoftValue. So the tree is the invariant and each
format is one **lens** onto it; a lens that disagrees on round-trip is a *codec bug*, never
a value-tree ambiguity. This is the same discipline that proved a ROM catalog is not
XML-specific (`RomDat.Tests`: the catalog tree round-trips identically through JSON/CBOR/YAML).

### 2. Own the interface — ports and adapters (hexagonal)

A `ValueTreeCodec.Codec` is a **port we own**: a named, invertible wire encoding of the
value tree. Whatever fulfils it — a hand-rolled writer, a BCL reader (`System.Xml.Linq`),
a NuGet library — is an **adapter** behind that port. The interface is the durable, valuable
asset; the dependency is a tenant we can evict. This is Cockburn's hexagonal architecture
(ports-and-adapters) applied to the *format and crypto* layer, and it is the same
"tokenizer seam" already carved into `RomDat.fs` (the `System.Xml.Linq` read is a pragmatic
placeholder behind a value-tree output that never changes when the impl is swapped).

It is also the repo's own `interfaces-free-classes-earned-under-rules` rule at format
scope: the interface is free and weight-free; the concrete adapter is the earned,
*replaceable* class.

### 3. Provenance is tracked, and the gradient is measurable

Each codec records **`Provenance`**, ranked by sovereignty:

| Provenance | sovereignty | meaning |
|---|---|---|
| `Ours` | 2 | no external code at all — the endgame |
| `Bcl platform` | 1 | the .NET runtime we already trust to execute the process |
| `ThirdParty dep` | 0 | a NuGet supply-chain tenant, to be replaced behind this port |

"Replace the dependency behind our interface" is thus a **measurable gradient**: move every
load-bearing codec up the ladder to `Ours`. The rollout is not a vibe; it is a number per
codec that must reach 2.

### 4. Nation-state / supply-chain resistance is the *why*

Every dependency in the parse and crypto path is an attack surface someone else controls —
the class of attack that hit SolarWinds (2020) and `xz-utils`/liblzma (CVE-2024-3094, 2024),
and that Ken Thompson described at the limit in *Reflections on Trusting Trust* (1984). The
defence is not "audit the dependency harder" — it is *own it*: shrink the surface to `Ours`
so there is no supply chain that is not us to attack. Parsers and cryptographic primitives
are the priority because they sit on untrusted input and on the root of trust respectively.

### 5. Parity is MANDATORY; native gaps are debt closed by a wrapper convention

> Aaron 2026-07-02: *"we can carry what we need losslessly just not natively in their
> numerics … We must have parity even if we have to use ugly strings or some wrapper
> object or anything … we have numerics formats for middle-out float and tri-boolean
> logic … these are our wrappers for round trip anyways."*

Owning the interface makes "full fidelity" **measurable** — a failing round-trip is *data*,
never a silent lossy conversion — but a measured native gap is **debt to close, not a limit
to accept**. Parity (lossless round-trip of every value on every codec) is required. Where a
format has no native representation for a shape, we reach parity with a **wrapper envelope**:
a reserved-tag object or an "ugly string" that the format *can* carry. Current native surface
and parity status:

- **CBOR (RFC 8949)** — our **total** 1-ary codec: the whole eight-shape `DynamicValue`
  round-trips, `Bytes` and `Float` included. Parity met natively. `Provenance = Ours`.
- **JSON** — native on Null/Bool/Int/String/Array/Object; **`Bytes`** (no native byte string
  → base64 wrapper) and **`Float`** (canonical-float round-trip → round-trip-string wrapper)
  are **parity debt**. `Provenance = Ours`.
- **YAML** — requires a **collection root** (a bare top-level scalar returns `NonCanonical`);
  same numeric parity debt as JSON. `Provenance = Ours`.

The wrapper carriers are types we **already have** (anchor-to-prior-art — don't reinvent):

- **`SoftValue`** (`src/Core/SoftValue.fs`) — a normalised distribution over `DynamicValue`;
  the non-collapsing "middle-out float". Uncertainty rides *in the value*, round-trips whole,
  and only `SoftValue.resolve threshold` snaps it. The superposition survives serialisation.
- **Kleene three-valued logic** (`src/Core/KleeneClosure.fs`) — the tri-boolean
  (true / false / unknown) carrier; the logic analogue of the same "never collapse" rule.
- **Decimal / BigInteger / arbitrary precision** — **not yet a `DynamicValue` shape**;
  roadmap ("we are going to have to support things like decimal and others eventually").
  Financial parity (Lucent) needs exact decimal — a string-encoded wrapper reaches parity
  before a native shape lands.

Our entire sovereign 1-ary core (json/cbor/yaml) is **already zero-third-party-dependency** —
hand-rolled in `DynamicValue.fs` (only `System.Collections.Immutable`, the BCL). That is the
floor the 2-ary formats get brought up to.

> **LANDED (2026-07-02):** `src/Core/ValueTreeEnvelope.fs` + `ValueTreeCodec.parity`.
> The wrapper carries a **version** (`v`) and a **category** (`c`) tag under a single
> reserved key (`$zeta`); a source object that itself uses the key is escaped
> (category `map`), so an envelope is collision-safe by construction. `parity json` /
> `parity yaml` are now **total** — the full eight-shape tree (Bytes + Float incl.)
> round-trips faithfully (`ValueTreeEnvelope.Tests`, 5/5). Landable *because* rollable —
> see §7. Decimal / SoftValue / Kleene are the next categories to add (a case each, no
> break to existing payloads).

### 6. Canonical codec is chosen by the storage substrate (DV2.0)

> Aaron 2026-07-02: *"YAML is our canonical format for git-native; CBOR is canonical for our
> DB/file-system native when we are our own git/source control in our Merkle-DAG file system
> or outside of git just in a binary file(s)."*

Same value tree, different canonical *lens* per storage tier — Data Vault 2.0 partitioning by
medium:

| Substrate | Canonical codec | Why |
|---|---|---|
| **git-native** (human-diffable history) | **YAML** | text, line-diffable, human-auditable in a `git` diff |
| **DB / Merkle-DAG filesystem / binary** (our own source control) | **CBOR** | compact, total, canonical bytes → content-addressable DAG nodes |
| interchange / interop | JSON | the lingua franca for crossing a boundary, not our store |
| **proof / verification lineage** | *text golden vectors* (hex-in-JSON) | `no-binary-in-proof-lineage`: CBOR bytes are byte-locked as hex *inside* JSON, so proofs stay diffable even though the live store is binary |

The last row is the reconciliation: the operational store is CBOR (binary), but the
*verification* substrate that proves the CBOR bijection stays text (hex-in-JSON golden
vectors) — different concerns, both hold.

### 7. Every serialization decision is zero-downtime-rollable (the envelope is the roll unit)

> Aaron 2026-07-02: *"all of this is not scary cause all of our serialization can be rolled
> with version numbers and category types, even in our zetaids and even our crypto keys can
> be rolled all with 0 down time so any decisions here are also rollable and 0 down time
> upgradable (we should likely get this added to our 0 down time schema evolution proofs,
> like 0 down time parser updates/replacement proofs)."*

This is why the envelope schema is **not an irreversible decision** — and why it was safe to
land in a tick. Every wrapped value carries a `version` and a `category`, exactly the tags
`SchemaEvolution` (081KSRGFP0008QG0R001Y6RTY9) already makes migratable. So:

- **Roll a category/version** — add a `category` case (Decimal, SoftValue, Kleene) or bump
  the `version`; a reader that knows `{1..N}` serves any wire `≤ N`, and a **newer** wire is
  a clean `Error`, never silent corruption. A v2 writer rolls out while v1 readers keep
  serving v1 data — no stop-the-world migration.
- **Replace the parser/codec impl** — swapping the adapter behind the `ValueTreeCodec` port
  is the *format-level analogue of a schema migration*. Same wire contract ⇒ transparent
  swap; new wire ⇒ a versioned, forward/backward-compatible roll. This is the **0-downtime
  parser-update/replacement proof** (`ValueTreeEnvelope.Tests`): a new (parity-aware) reader
  reads old bytes (backward), and an old reader reads new bytes without crash or corruption
  (forward — envelopes seen as plain objects, the unknown-metadata passthrough).

Because the *same* version/category discipline already governs `ZetaId`s and crypto-key
rotation, the format layer inherits the whole-system property: **nothing here is a one-way
door.** (Follow-up: fold these parser-roll proofs into the standing schema-evolution proof
suite.)

### 8. The envelope generalises to event envelopes (CloudEvents / Debezium) — frontmatter shape

> Aaron 2026-07-02: *"we want cloud events / debezium envelopes too even if they don't have a
> standard for the file type/encoding format yet cause it gives us a common starting point
> very similar to frontmatter, same kind of graph, and we already understand deps graphs
> well like our frontmatter and our literal deps that ace package manager keeps up with."*

The parity wrapper is one instance of a more general shape: **metadata block ⊕ payload** —
the same shape as **frontmatter** (a YAML metadata head over a body) and as the standard
**event envelopes**:

- **CloudEvents** (CNCF) — a normalised metadata header (`id`, `source`, `type`, `time`,
  `subject`, …) around a domain `data` payload. A vendor-neutral *common starting point* for
  "what is this event", independent of transport/encoding.
- **Debezium** — the change-data-capture envelope (`before` / `after` / `op` / `source` / `ts`),
  the canonical CDC shape; a natural fit for a Z-set retraction/assertion (`op` ≈ ±1).

These become **envelope categories** on the same port: an event is a value tree whose
metadata head is a CloudEvents/Debezium-shaped object and whose `data` is the payload tree —
carried by whichever codec the substrate wants (YAML for git-native, CBOR for the DAG). Even
without a settled file-type/encoding standard, adopting the envelope shape gives us the
common frame now. And the frame is a **graph**: envelope metadata *references* other nodes
(source, subject, causation/correlation ids) — the **same dependency-graph** we already model
in frontmatter links and in the literal package dependencies the **ace package manager**
tracks. One graph discipline (deps / frontmatter / event-causation), many surfaces.

**The pointer type on those graph edges is the `ZetaId`.**

> Aaron 2026-07-02: *"zetaid is our universal pointer that can point at anything outside the
> superdeterministic markov boundary and inside too."*

The envelope metadata head references other nodes (source, subject, causation/correlation),
and the reference is a **`ZetaId`** — the *universal* pointer. It resolves both **inside** the
superdeterministic Markov boundary (our own content-addressed, DST-replayable substrate — the
deterministic interior where a pointer is a Merkle/DAG address) **and outside** it (an external
referent the boundary does not determine — a real-world resource, a foreign system). One
pointer type spans both sides of the boundary, so an envelope graph can link the deterministic
interior and the non-deterministic exterior uniformly — and crossings of that boundary are
exactly where the noninterference/entropy-quarantine discipline meters influence in. (The
`ZetaId` is the 128-bit identity that precedes the persona⊕surface routing address; a routing
address is not identity.)

> **LANDED (2026-07-02):** `src/Core/EventEnvelope.fs` — `cloudevents` (CNCF 1.0 constructor
> + required-attribute validator) and `debezium` (before/after/op/source) categories. An event
> is a value tree, so it rides the whole codec stack (json/cbor/yaml/asn1 + parity) with no new
> codec. Distinctive Zeta content: **a Debezium `op` is a Z-set weight** — create/read assert
> (+1), delete retracts (−1), update is retract-then-assert (−1 then +1) → folds straight into a
> DBSP Z-set delta. Still routed: the **frontmatter ⇄ value-tree bijection**.

## Rollout ledger — "all of those", as an honest checklist

Each row is a codec behind the one port. Land the adapter first (honestly marked), then
replace it with our own impl (parser-combinator / generator layer — FParsec-style, GLR/LR*,
ANTLR-shaped — already backlogged) to reach `Ours`.

| Format | Arity | First adapter | Target | Priority / why |
|---|---|---|---|---|
| JSON | 1 | — | **`Ours`** ✅ | shipped, hand-rolled |
| CBOR (RFC 8949) | 1 | — | **`Ours`** ✅ | shipped, total codec |
| YAML | 1 | — | **`Ours`** ✅ | shipped, hand-rolled |
| XML | 2 | `Bcl System.Xml.Linq` (`RomDat`) | `Ours` | attribute-promotion codec + our tokenizer |
| **ASN.1 (BER/DER)** | 2 | — | **`Ours`** ✅ | **LANDED — DLMS/COSEM meters, constrained devices; our-own TLV, no lib; 7/8 native + Float via `parity`** |
| KDL | 2 | our own reader | `Ours` | **NEXT PICKUP** (delayed 2026-07-02) — cleanest text 2-ary; node children ⊕ properties; see `docs/trajectories/value-tree-codecs/RESUME.md` |
| HDF5 / netCDF | 2 | `ThirdParty` (native lib) | `Ours` (long) | scientific data; datasets ⊕ first-class attributes; heaviest |
| GraphViz DOT | 2* | our own reader | `Ours` | *graph not tree — lossy; structure ⊕ attribute lists |

ASN.1 was the first 2-ary built our-own from the start (**landed 2026-07-02**,
`src/Core/Asn1Der.fs`): DER is a simple tag-length-value grammar for our value subset
(SEQUENCE / INTEGER / UTF8String / BOOLEAN / NULL / OCTET STRING + a `[0]` constructed tag
for Object), needs no external library (`Ours` immediately), and pays off directly in the
metering domain. The **tag** is the 2-ary second channel (type/attribute) beside the value.
HDF5 is the one likely to start as a `ThirdParty` adapter (native library) — exactly the
case the hexagonal port exists for: ship behind our interface now, replace later.

**Cross-cutting parity slice — ✅ LANDED (2026-07-02):** `ValueTreeEnvelope` +
`ValueTreeCodec.parity` close JSON/YAML's `Bytes`/`Float` parity debt with a versioned,
category-tagged, collision-safe wrapper; `crossVerify` of the *full* eight-shape tree now
returns empty for every 1-ary codec (via `parity`). Remaining categories to add (one case
each, no break to existing payloads): `decimal` · `soft` (SoftValue) · `kleene` (tri-bool)
· `cloudevents` · `debezium` — plus the frontmatter ⇄ value-tree bijection (§8).

## Anchors (Beacon)

- **Hexagonal / ports-and-adapters:** Alistair Cockburn, *Hexagonal Architecture* (2005).
- **Supply-chain attacks:** Ken Thompson, *Reflections on Trusting Trust* (CACM 1984);
  SolarWinds/SUNBURST (2020); `xz-utils`/liblzma backdoor, CVE-2024-3094 (2024).
- **ASN.1:** ITU-T X.680 (syntax) / X.690 (BER/CER/DER encoding). **DLMS/COSEM:** IEC 62056
  (electricity metering data exchange) — Aaron's Itron/metering prior art.
- **CBOR:** RFC 8949. **KDL:** kdl.dev (KDL Document Language). **HDF5:** The HDF Group.
  **base64:** RFC 4648.
- **Event envelopes:** CloudEvents (CNCF spec) — normalised event metadata; Debezium — the
  CDC before/after/op envelope (op ≈ Z-set ±1). **Zero-downtime evolution:** `SchemaEvolution.fs`
  (081KSRGFP0008QG0R001Y6RTY9) — version/migration seed the envelope tags reuse.
- **Value-tree taxonomy:** `RomDat.fs` (XML = 2-ary banana-split); `DynamicValue.fs`
  (the 8-shape value tree + hand-rolled canonical JSON/CBOR/YAML).
- **In-repo rules:** `interfaces-free-classes-earned-under-rules` (the port is the free
  interface, the adapter the earned class); `only-the-irreducible-is-primitive-generate-
  the-rest` (our own impl generated from the free parser, not a frozen lib); `anchor-to-
  human-prior-art`.

## Landed this pass

- `src/Core/ValueTreeCodec.fs` — the port (`Codec`, `Provenance`, `sovereignty`,
  `roundTrip`, `isFaithful`, `crossVerify`) with json/cbor/yaml wired as `Ours` adapters.
- `tests/Tests.FSharp/ValueTreeCodec.Tests.fs` — cross-verify on the portable subset;
  CBOR-is-total; native gaps characterised as parity debt (not accepted limits);
  sovereignty ranking Ours > Bcl > ThirdParty (6/6 green).
- `src/Core/ValueTreeEnvelope.fs` + `ValueTreeCodec.parity` — the versioned, category-
  tagged, collision-safe parity wrapper; `parity json`/`parity yaml` become total.
- `tests/Tests.FSharp/ValueTreeEnvelope.Tests.fs` — full-tree parity closed; collision
  escape; zero-downtime roll (newer version/unknown category → clean Error); the
  0-downtime parser-replacement proof (new-reads-old, old-reads-new) (5/5 green).
- `src/Core/Asn1Der.fs` + `ValueTreeCodec.asn1` — the first **2-ary** codec (tag ⊕ value),
  our-own DER, `Provenance = Ours`; 7/8 shapes native, Float via `parity`.
- `tests/Tests.FSharp/Asn1Der.Tests.fs` — native round-trip (minimal/negative INTEGER,
  empty collections, long-form length); the 2-ary column joins the cross-verify agreement;
  Float parity debt; DER byte-lock spot checks as text hex; + hostile-input hardening —
  `decode` total, 13 crafted streams rejected, depth ceiling (7/7 green, #9193).
- `src/Core/EventEnvelope.fs` — CloudEvents (CNCF 1.0) + Debezium categories; Debezium
  `op` ≈ Z-set ±1; envelopes ride the whole codec stack.
- `tests/Tests.FSharp/EventEnvelope.Tests.fs` — CloudEvents build/validate; Debezium
  op→Z-set weights (create/read +1, delete −1, update −1+1); envelope cross-verify through
  parity-json/cbor/parity-asn1 (6/6 green).
- `docs/trajectories/value-tree-codecs/RESUME.md` — the crash-safe resume; **KDL** is the
  next pickup (delayed half of the event-envelopes-vs-KDL fork).
