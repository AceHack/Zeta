namespace Zeta.Core

open System.Xml.Linq

/// **RomDat — read + understand the ROM-catalog metadata (TOSEC / GoodTools / MAME).**
/// (Aaron 2026-07-02, shadow*: "read and understand the TOSEC/MAME catalog metadata".)
///
/// TOSEC, GoodTools, No-Intro, and MAME all publish their curated game catalogs as
/// **Logiqx-format DAT** files (`<datafile>` XML): each game carries its ROM(s) and the
/// content signatures (CRC32 / MD5 / SHA1) that ARE its identity — the hard distributed
/// problem those communities already solved. This module parses that format so a ROM
/// we `GameFingerprint`-hash can be RESOLVED to its curated identity (name, category,
/// metadata). We build ON their signatures; we do not reinvent them.
///
/// The self-verification (RomDat.Tests): our own `GameFingerprint.crc32Hex` of a byte
/// sequence equals the `crc` a DAT records for it — so a ROM we fingerprint resolves to
/// the catalog entry. Our identity IS their identity; that is what "understanding the
/// catalog" means. TOSEC/MAME `<machine>` and Logiqx `<game>` are both read.
///
/// TOKENIZER SEAM (Aaron): the `System.Xml.Linq` read here is a PRAGMATIC PLACEHOLDER.
/// The real parsing grows into our own parser combinators / generators (FParsec-style,
/// GLR/LR*, ANTLR-shaped) — routed/work-itemed, not built here. What is load-bearing is
/// the OUTPUT: `toDynamicValue` lands the catalog as a DynamicValue value tree, and the
/// cross-verifications hold no matter which tokenizer produces it. When the combinator
/// layer lands it swaps in behind the same value-tree output. XML is a 2-ary value-tree
/// composition (element tree ⊕ attribute tree); JSON/YAML/CBOR are 1-ary trees; all fold
/// into DynamicValue → Z-sets / schema-evolution / SoftValue.
[<RequireQualifiedAccess>]
module RomDat =

    /// One ROM row in a DAT game (signatures normalised to lower-case hex).
    type Rom =
        { Name: string
          Size: int64 option
          Crc32: string option
          Md5: string option
          Sha1: string option }

    /// A curated game entry: its name, description, optional category, and its ROM(s).
    type Game =
        { Name: string
          Description: string
          Category: string option
          Roms: Rom list }

    /// A parsed catalog: the header name and its games.
    type Catalog = { Name: string; Games: Game list }

    let private attr (name: string) (e: XElement) : string option =
        match e.Attribute(XName.Get name) with
        | null -> None
        | a -> Some a.Value

    let private childText (name: string) (e: XElement) : string option =
        match e.Element(XName.Get name) with
        | null -> None
        | c -> Some c.Value

    let private normHex (s: string option) : string option =
        s |> Option.map (fun v -> v.Trim().ToLowerInvariant())

    let private parseSize (s: string option) : int64 option =
        s |> Option.bind (fun v -> match System.Int64.TryParse v with | true, n -> Some n | _ -> None)

    /// Parse a Logiqx/TOSEC/MAME DAT (XML) into a `Catalog`. Reads both `<game>`
    /// (TOSEC/Logiqx/No-Intro) and `<machine>` (MAME) entries.
    let parse (xml: string) : Result<Catalog, string> =
        try
            let doc = XDocument.Parse xml
            match doc.Root with
            | null -> Error "empty DAT: no root element"
            | root ->
                let headerName =
                    match root.Element(XName.Get "header") with
                    | null -> "(unnamed catalog)"
                    | h -> childText "name" h |> Option.defaultValue "(unnamed catalog)"
                let gameEls =
                    Seq.append (root.Elements(XName.Get "game")) (root.Elements(XName.Get "machine"))
                let games =
                    [ for g in gameEls ->
                        let roms =
                            [ for r in g.Elements(XName.Get "rom") ->
                                { Name = attr "name" r |> Option.defaultValue ""
                                  Size = parseSize (attr "size" r)
                                  Crc32 = normHex (attr "crc" r)
                                  Md5 = normHex (attr "md5" r)
                                  Sha1 = normHex (attr "sha1" r) } ]
                        { Name = attr "name" g |> Option.defaultValue ""
                          Description = childText "description" g |> Option.defaultValue ""
                          Category = childText "category" g
                          Roms = roms } ]
                Ok { Name = headerName; Games = games }
        with ex -> Error(sprintf "DAT parse error: %s" ex.Message)

    /// Resolve a ROM's curated identity by its CRC32 (as `GameFingerprint.crc32Hex`
    /// emits it) — the games in the catalog that contain a ROM with that signature.
    let resolveCrc (crc32Hex: string) (cat: Catalog) : Game list =
        let target = crc32Hex.Trim().ToLowerInvariant()
        cat.Games |> List.filter (fun g -> g.Roms |> List.exists (fun r -> r.Crc32 = Some target))

    /// Resolve by SHA1 (the stronger curated signature).
    let resolveSha1 (sha1Hex: string) (cat: Catalog) : Game list =
        let target = sha1Hex.Trim().ToLowerInvariant()
        cat.Games |> List.filter (fun g -> g.Roms |> List.exists (fun r -> r.Sha1 = Some target))

    /// A CRC32 → games index for O(1) lookup over a whole catalog.
    let crcIndex (cat: Catalog) : Map<string, Game list> =
        cat.Games
        |> List.collect (fun g -> g.Roms |> List.choose (fun r -> r.Crc32 |> Option.map (fun c -> c, g)))
        |> List.groupBy fst
        |> List.map (fun (c, pairs) -> c, List.map snd pairs)
        |> Map.ofList

    // ── The catalog as a value tree (the substrate) ──
    // A DAT is XML: our model is a banana-split — an element tree ⊕ an attribute tree
    // zipped together (the rom SIGNATURES live in the attribute tree). XML / JSON / YAML
    // / CBOR are all value trees; they fold into `DynamicValue`, and thence to Z-sets,
    // schema-evolution, and SoftValue. `toDynamicValue` lands the parsed catalog in that
    // substrate so a catalog is just data — and (the cross-verification) the SAME value
    // tree round-trips through JSON / CBOR / YAML, proving it is NOT XML-specific.

    let private optStr k (v: string option) = v |> Option.map (fun s -> k, DynamicValue.String s)

    let private romToDv (r: Rom) : DynamicValue =
        DynamicValue.Object(
            [ Some("name", DynamicValue.String r.Name)
              r.Size |> Option.map (fun s -> "size", DynamicValue.Int s)
              optStr "crc32" r.Crc32
              optStr "md5" r.Md5
              optStr "sha1" r.Sha1 ]
            |> List.choose id)

    let private gameToDv (g: Game) : DynamicValue =
        DynamicValue.Object(
            [ Some("name", DynamicValue.String g.Name)
              Some("description", DynamicValue.String g.Description)
              optStr "category" g.Category
              Some("roms", DynamicValue.Array(g.Roms |> List.map romToDv)) ]
            |> List.choose id)

    /// The whole catalog as a `DynamicValue` value tree — the substrate form (foldable
    /// to a Z-set of game identities keyed by signature, schema-evolvable, SoftValue-
    /// liftable). XML is one lens onto this tree; JSON/CBOR/YAML are others.
    let toDynamicValue (cat: Catalog) : DynamicValue =
        DynamicValue.Object
            [ "name", DynamicValue.String cat.Name
              "games", DynamicValue.Array(cat.Games |> List.map gameToDv) ]
