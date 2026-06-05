# Serializer & value shapes — the core surfaces

> One-page reference of the four core serialization/value shapes, with accurate F#
> signatures. Written to share the substrate's serialization surfaces (e.g. with
> Kestrel/Amara for review). Sources are the authoritative files cited per section;
> if a signature here drifts from the code, the code wins — re-derive.

## 1. `DynamicValue` — the self-describing value tree (μF)
`src/Core/DynamicValue.fs`

```fsharp
// The value functor's fixpoint: μX. (Null | Bool | Int | Float | String | Bytes | List X | List (String × X))
type DynamicValue =
    | Null
    | Bool   of bool
    | Int    of int64
    | Float  of float
    | String of string
    | Bytes  of System.Collections.Immutable.ImmutableArray<byte>
    | Array  of DynamicValue list
    | Object of (string * DynamicValue) list      // ORDER-significant (a list, not a map)
    // custom structural Equals: floats compared BIT-WISE (NaN = NaN) so values round-trip

type EncodeError = FloatDeferred | BytesDeferred | NonRepresentable
type DecodeError = UnexpectedEnd | TrailingData | Unsupported | IntegerOverflow
                 | NonTextKey | NonCanonical | MalformedXml | MalformedArrow
```

Codecs over it — all strict-canonical; decode does a fixed-point check
`canonical(parse x) = x` (rejects every non-canonical spelling):

```fsharp
DynamicValue.toCanonicalJson  : DynamicValue -> Result<string, EncodeError>   // 6/8 (Float,Bytes deferred → CBOR)
DynamicValue.fromCanonicalJson: string       -> Result<DynamicValue, DecodeError>
DynamicValue.toCanonicalCbor  : DynamicValue -> byte[]                         // 8/8 total
DynamicValue.fromCanonicalCbor: byte[]       -> Result<DynamicValue, DecodeError>
DynamicValue.toCanonicalXml   : DynamicValue -> Result<string, EncodeError>   // 8/8 total (typed elements)
DynamicValue.fromCanonicalXml : string       -> Result<DynamicValue, DecodeError>
// + canonical YAML (the storage of record) via the Core.FSharp.Yaml project, and Arrow below.
```

All four value-tree formats (JSON/CBOR/YAML/XML) **commute** on the shared locked
subset (format-agreement matrix); each is 4-language byte-locked (TS reference + F#/C#/
Rust) via golden vectors. **Never-collapse**: `null`, empty `[]`, empty `{}` are three
distinct round-tripping states (encode is injective).

## 2. The regular (static) serializer seam — `ISerializer<'T>`
`src/Core/Serializer.fs`. For types **known at compile time**, serializing a **Z-set**
(the DBSP unit). Distinct from `DynamicValue` (runtime-unknown shapes).

```fsharp
type ISerializer<'T when 'T : comparison> =
    abstract Write : writer: System.Buffers.IBufferWriter<byte> * zset: ZSet<'T> -> unit
    abstract Read  : bytes: System.ReadOnlySpan<byte> -> ZSet<'T>
    abstract Name  : string
```
Tiers: `SpanSerializer` (blittable, zero-copy, same-host) · `TlvSerializer` (small
non-blittable deltas) · `FsPicklerSerializer` (exotic F# DUs/records/quotations) · the
Arrow pair below (large analytical cross-language batches).

## 3. Arrow — two faces
`src/Core/ArrowSerializer.fs` + `src/Core/DynamicValueArrow.fs`

(a) Columnar Z-set batch serializers (`ISerializer<'T>` instances — Arrow's natural fit):
```fsharp
type ArrowInt64Serializer()  // : ISerializer<int64>  — key:Int64 + weight:Int64 columns
type ArrowStringSerializer() // : ISerializer<string> — key:Utf8  + weight:Int64 columns
// framing: 4-byte little-endian length header + Arrow IPC stream
```

(b) DynamicValue ↔ Arrow codec — the **shredded node-table** (one row per tree node):
```fsharp
DynamicValueArrow.toArrow   : DynamicValue -> byte[]                       // Arrow IPC stream
DynamicValueArrow.fromArrow : byte[] -> Result<DynamicValue, DecodeError>
// schema (one RecordBatch, DFS pre-order, one row per node):
//   kind   : Int8    not-null   0=Null 1=Bool 2=Int 3=Float 4=String 5=Bytes 6=Array 7=Object
//   parent : Int32   not-null   parent row index; -1 for root (row 0)
//   key    : Utf8    nullable   set when node is an Object entry's value
//   b      : Boolean nullable   kind=Bool
//   i      : Int64   nullable   kind=Int
//   f      : Float64 nullable   kind=Float   (preserves IEEE bits: NaN/-0.0/±Inf)
//   s      : Utf8    nullable   kind=String
//   by     : Binary  nullable   kind=Bytes
```
Adjacency-list shredding (à la Dremel/Parquet); columnar (Arrow's strength) yet
round-trips arbitrary recursive/heterogeneous trees without Arrow's (unsupported)
recursive schemas. F#↔C# Arrow IPC is **byte-identical** (same .NET Arrow lib);
cross-library "cross-language" = standard Arrow-ecosystem IPC interop, not hand-rolled
TS/Rust oracles (those stay zero-dep).

## 4. Bonsai — serialized expression / closure AST
`src/Core/Bonsai.fs`. Computation as data (the νF-adjacent "deferred execution" shape).

```fsharp
type Expr =
    | Const  of ConstValue                 // int / str / bool / null literal
    | Param  of string                     // variable reference
    | Lambda of string list * Expr         // λ: params, body
    | Binary of BinOp * Expr * Expr        // binary op
    | Call   of string * Expr list         // named function application
    | Cond   of Expr * Expr * Expr         // if / then / else

type BonsaiFeedback =                       // typed decline channel (no exceptions)
    | UnsupportedVersion of found:int * expected:int
    | MalformedJson of message:string
    | UnknownKind of kind:string
    | UnknownConstTag of tag:string
    | UnknownOp of op:string
    | ExpectedString of where:string
    | ExpectedBool   of where:string
    // …

Bonsai.serialize   : Expr   -> Result<string, BonsaiFeedback>   // to JSON
Bonsai.deserialize : string -> Result<Expr,   BonsaiFeedback>
// also exposed behind an ISerializer-style seam (member Serialize)
```

## How they relate
- **`DynamicValue`** = the open, self-describing **value tree** (μF) — runtime-unknown
  shapes; the lowest-common-denominator all the value-tree codecs fold to/from.
- **`ISerializer<'T>`** = the **static, compile-time-typed** Z-set seam — a different
  shape, for types known at compile time.
- **Arrow** wears both hats: an `ISerializer` for columnar Z-set batches **and** a
  DynamicValue codec via the shredded node-table.
- **Bonsai** = a serialized **expression/closure AST** (computation as data) — the
  νF-adjacent deferred-execution shape, with its own typed-feedback codec.

Grounding: codecs are **catamorphisms** over μF (decode = anamorphism; the fixed-point
check = the parse∘print=id law). See `docs/serializer-recursion-schemes.md`.
