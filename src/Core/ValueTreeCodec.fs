namespace Zeta.Core

/// **ValueTreeCodec — the hexagonal port for value-tree serialisation formats.**
/// (Aaron 2026-07-02, shadow*: "any that need external we hexagonal the interface so
/// we own the interface, our interfaces are what is valuable, and we can replace the
/// dependency over time with our own impl behind the interface … the plan is nation
/// state resistance especially in our parsers and cryptographic primitives, we can't
/// get supply chain attacked cause eventually we have no deps, no supply chain that is
/// not us.")
///
/// Ports-and-adapters (Cockburn) applied to the file-format layer. A `Codec` is a
/// named, invertible wire encoding of the `DynamicValue` value tree — a PORT WE OWN.
/// Whatever fulfils it (a hand-rolled writer, a BCL reader, a NuGet library) is an
/// ADAPTER behind that port, and its `Provenance` records how sovereign that impl is.
/// The interface is the durable, valuable thing; the dependency is a temporary tenant
/// we replace over time with our own implementation. The endgame is `Ours` everywhere
/// — ZERO external supply chain in the parse (and, on the sibling crypto port, the
/// cryptographic-primitive) path, so there is no supply chain that is not us to attack.
///
/// The value tree is the invariant; each codec is one LENS onto it. JSON / YAML / CBOR
/// are 1-ary (a single value tree); XML / KDL / ASN.1 are 2-ary (an element tree ⊕ an
/// attribute/tag tree — the banana-split). `crossVerify` asserts every lens round-trips
/// the SAME tree, so a disagreement is a codec bug, never a value-tree ambiguity — the
/// same discipline that proved (RomDat.Tests) a catalog is not XML-specific.
///
/// Doctrine + rollout: docs/research/2026-07-02-hexagonal-value-tree-codec-ports-nation-
/// state-supply-chain-resistance-own-the-interface-zero-dep-endgame.md.
[<RequireQualifiedAccess>]
module ValueTreeCodec =

    /// Supply-chain provenance of the impl BEHIND a codec — the surface we shrink
    /// toward `Ours` everywhere. Ranked most-sovereign first: `Ours` (no external code
    /// at all) ▸ `Bcl` (the .NET runtime we already trust to execute the process) ▸
    /// `ThirdParty` (a NuGet supply-chain tenant, to be replaced behind this same port).
    type Provenance =
        | Ours
        | Bcl of platform: string
        | ThirdParty of dep: string

    /// How sovereign a provenance is: 2 = Ours, 1 = Bcl, 0 = ThirdParty. The rollout
    /// target is `sovereignty p = 2` for every codec on a load-bearing path.
    let sovereignty (p: Provenance) : int =
        match p with
        | Ours -> 2
        | Bcl _ -> 1
        | ThirdParty _ -> 0

    /// A named, invertible wire encoding of the `DynamicValue` value tree — the port.
    /// `Arity` is the value-tree shape it round-trips: 1 = single tree (JSON/YAML/CBOR),
    /// 2 = element ⊕ attribute banana-split (XML/KDL/ASN.1).
    type Codec =
        { Name: string
          Arity: int
          Provenance: Provenance
          Encode: DynamicValue -> Result<byte[], string>
          Decode: byte[] -> Result<DynamicValue, string> }

    let private utf8 (s: string) : byte[] = System.Text.Encoding.UTF8.GetBytes s
    let private ofUtf8 (b: byte[]) : string = System.Text.Encoding.UTF8.GetString b
    let private es (r: Result<'a, 'e>) : Result<'a, string> =
        r |> Result.mapError (fun e -> sprintf "%A" e)

    /// JSON — hand-rolled canonical writer/reader in `DynamicValue.fs` (no third-party
    /// dependency). 1-ary. Text wire, carried as UTF-8 bytes through the port.
    let json: Codec =
        { Name = "json"
          Arity = 1
          Provenance = Ours
          Encode = fun dv -> DynamicValue.toCanonicalJson dv |> es |> Result.map utf8
          Decode = fun b -> ofUtf8 b |> DynamicValue.fromCanonicalJson |> es }

    /// CBOR (RFC 8949) — hand-rolled strictly-canonical bijection in `DynamicValue.fs`
    /// (no third-party dependency). 1-ary. Native binary wire.
    let cbor: Codec =
        { Name = "cbor"
          Arity = 1
          Provenance = Ours
          Encode = fun dv -> Ok(DynamicValue.toCanonicalCborOk dv)
          Decode = fun b -> DynamicValue.fromCanonicalCbor b |> es }

    /// YAML — hand-rolled writer/reader in `DynamicValue.fs` (no third-party
    /// dependency). 1-ary. Text wire, carried as UTF-8 bytes.
    let yaml: Codec =
        { Name = "yaml"
          Arity = 1
          Provenance = Ours
          Encode = fun dv -> DynamicValue.toYaml dv |> es |> Result.map utf8
          Decode = fun b -> ofUtf8 b |> DynamicValue.fromYaml |> es }

    /// ASN.1 DER (X.690) — the first **2-ary** codec (tag ⊕ value), built our-own from the
    /// start (DER is simple TLV → no library → `Ours` immediately). Natively carries 7 of 8
    /// shapes; `Float` is its parity debt, closed by `parity`. Load-bearing for DLMS/COSEM
    /// meters and constrained devices (Aaron 2026-07-02).
    let asn1: Codec =
        { Name = "asn1"
          Arity = 2
          Provenance = Ours
          Encode = Asn1Der.encode
          Decode = Asn1Der.decode }

    /// The codecs we own end-to-end today — zero third-party supply chain, every one
    /// `Ours`. This is the sovereign core the 2-ary formats (XML/KDL/ASN.1) are being
    /// brought up to: adapter first (BCL / NuGet, honestly marked), our own impl later.
    let sovereign: Codec list = [ json; cbor; yaml ]

    /// Round-trip a value through a codec: encode then decode.
    let roundTrip (c: Codec) (dv: DynamicValue) : Result<DynamicValue, string> =
        c.Encode dv |> Result.bind c.Decode

    /// A codec is FAITHFUL on `dv` iff encode-then-decode returns `dv` unchanged.
    let isFaithful (c: Codec) (dv: DynamicValue) : bool =
        match roundTrip c dv with
        | Ok dv' -> dv' = dv
        | Error _ -> false

    /// Cross-verify: every codec must round-trip `dv` back to itself (and therefore all
    /// agree). The value tree is the invariant; each codec is one lens onto it. Returns
    /// the names that FAILED — empty ⇒ the tree is format-agnostic across every codec.
    let crossVerify (codecs: Codec list) (dv: DynamicValue) : string list =
        codecs
        |> List.filter (fun c -> not (isFaithful c dv))
        |> List.map (fun c -> c.Name)

    /// Lift a codec to TOTAL over the whole `DynamicValue` shape space by routing through
    /// the versioned `ValueTreeEnvelope`: non-native shapes (`Float`, `Bytes`, later
    /// `Decimal` / `SoftValue` / Kleene) are carried losslessly as version + category-
    /// tagged wrappers. This closes the parity debt for a 1-ary format with no native
    /// bytes/float (JSON/YAML) — `parity json` is faithful on the full eight-shape tree.
    /// The envelope's version tag makes the wrapper itself zero-downtime-rollable
    /// (SchemaEvolution 081KSRGFP0008QG0R001Y6RTY9): a newer wire is a clean `Error`, not
    /// silent corruption. `Provenance` is inherited — parity adds fidelity, not a dependency.
    let parity (c: Codec) : Codec =
        { c with
            Name = c.Name + "+env"
            Encode = fun dv -> c.Encode(ValueTreeEnvelope.encode dv)
            Decode = fun bytes -> c.Decode bytes |> Result.bind ValueTreeEnvelope.decode }
