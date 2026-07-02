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

> **Not landed unilaterally:** the wrapper-envelope *schema* (reserved tag keys, collision
> discipline, exact decimal/tri-boolean encodings, byte-lock interaction) is a design
> decision for Aaron and touches the canonical/golden-vector lineage — routed as the next
> slice, not invented in a tick.

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
| **ASN.1 (BER/DER)** | 2 | our own TLV (no lib needed for the subset) | `Ours` | **DLMS/COSEM meters, constrained devices — Aaron-flagged load-bearing** |
| KDL | 2 | our own reader | `Ours` | cleanest text 2-ary; node children ⊕ properties |
| HDF5 / netCDF | 2 | `ThirdParty` (native lib) | `Ours` (long) | scientific data; datasets ⊕ first-class attributes; heaviest |
| GraphViz DOT | 2* | our own reader | `Ours` | *graph not tree — lossy; structure ⊕ attribute lists |

ASN.1 is the first 2-ary to build our-own from the start: DER is a simple tag-length-value
grammar for our value subset (SEQUENCE / INTEGER / UTF8String / BOOLEAN / NULL / OCTET
STRING), needs no external library, and pays off directly in the metering domain. HDF5 is
the one likely to start as a `ThirdParty` adapter (native library) — exactly the case the
hexagonal port exists for: ship behind our interface now, replace later.

**Cross-cutting parity slice (blocks "full fidelity" on the 1-ary codecs):** the
wrapper-envelope convention that closes JSON/YAML's `Bytes`/`Float` (and future
Decimal / SoftValue / Kleene tri-boolean) parity debt. Design-gated on Aaron (reserved-key
schema, byte-lock interaction). Once landed, `crossVerify` of the *full* eight-shape tree
returns empty for every 1-ary codec, not just the portable subset.

## Anchors (Beacon)

- **Hexagonal / ports-and-adapters:** Alistair Cockburn, *Hexagonal Architecture* (2005).
- **Supply-chain attacks:** Ken Thompson, *Reflections on Trusting Trust* (CACM 1984);
  SolarWinds/SUNBURST (2020); `xz-utils`/liblzma backdoor, CVE-2024-3094 (2024).
- **ASN.1:** ITU-T X.680 (syntax) / X.690 (BER/CER/DER encoding). **DLMS/COSEM:** IEC 62056
  (electricity metering data exchange) — Aaron's Itron/metering prior art.
- **CBOR:** RFC 8949. **KDL:** kdl.dev (KDL Document Language). **HDF5:** The HDF Group.
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
