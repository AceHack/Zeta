namespace Zeta.Core

/// MediaLines — **our own media-container format: text lines, typed sections, built to EXPAND with
/// media types** (Aaron 2026-06-11: "yes please — I want our own format that knows how to expand with
/// media types, very targeted like chip8/9").
///
/// The format (set by `rooms/otto/avatar.lines`, now formalized):
///
///     # comments and blanks are free
///     <kind> \t <name> \t <field> [\t <field> …]
///
/// Known kinds today (each targeted at a device capability): `meta` (key/value), `frame` (8×N sprite
/// hex — a CHIP-8/9 drawable), `sprite` (same, overlay-flavored), `anim` (a frame sequence), `rom`
/// (hex + load address), `glyph` (an 8×8 atlas member), `palette` (mask→name).
///
/// **Based on quotes; compression = generators on top** (Aaron): the container is QUOTE-shaped —
/// sections are the same triad the playable quote proved (state + recording + computed residue), and
/// the storage stance is his sentence verbatim: *"very compressible, but still just well-stored TEXT,
/// and GENERATOR FUNCTIONS on top"* — the bytes stay diffable text; compression is achieved by
/// storing the (seed, generator) that REGENERATES a section instead of its expansion (the
/// quasi-crystal move — a `gen` section names a generator + seed; readers that know it regenerate,
/// readers that don't carry it; the log holds only the residual surprise). **The storage law, his
/// words:** "store the IRREDUCIBLE structure that can't be generated — store THAT — and generate the
/// rest RECURSIVELY from that seed, with a DST common-cause seed attached." So a `gen` line's fields
/// are (generator-id, version, common-cause seed, args…): the seed is the SAME treaty seed everything
/// replays from (TimeGen's common cause), and generation may recurse — a generated section may itself
/// contain gen lines; only the irreducible residue is ever stored expanded.
///
/// **The expansion law (universal/extension.md applied to the container): UNKNOWN KINDS ARE
/// PRESERVED, never errors.** A reader uses what it knows and carries the rest byte-faithfully —
/// so the format grows new media types (audio envelopes, vector paths, 3D when the slider rises)
/// without ever breaking an old reader or losing a new section in transit. Zero case structural:
/// a file of only-known kinds round-trips identically; a file with future kinds round-trips
/// identically TOO.
[<RequireQualifiedAccess>]
module MediaLines =

    /// One typed line: kind + name + the remaining fields (verbatim).
    type Entry =
        { Kind: string
          Name: string
          Fields: string list }

    /// A parsed document: entries in order (order is meaning — anims reference frames by name).
    type Doc = { Entries: Entry list }

    /// Parse the text form. Comments (#) and blanks vanish; everything else must be kind\tname[\t…]
    /// — a malformed line is refused honestly (Error with its line number).
    let parse (text: string) : Result<Doc, string> =
        let lines = text.Replace("\r\n", "\n").Split('\n')

        let folder (acc: Result<Entry list, string>) (ix: int, line: string) =
            match acc with
            | Error e -> Error e
            | Ok entries ->
                let l = line.TrimEnd()
                if l.Length = 0 || l.StartsWith "#" then
                    Ok entries
                else
                    match l.Split('\t') |> Array.toList with
                    | kind :: name :: fields when kind.Length > 0 && name.Length > 0 ->
                        Ok({ Kind = kind; Name = name; Fields = fields } :: entries)
                    | _ -> Error(sprintf "line %d: expected <kind>\\t<name>[\\t<field>…], got: %s" (ix + 1) l)

        lines
        |> Array.indexed
        |> Array.fold folder (Ok [])
        |> Result.map (fun es -> { Entries = List.rev es })

    /// Serialize back to canonical text (one line per entry; comments are not round-tripped — the
    /// ENTRIES are the document; provenance prose lives in the file header by convention).
    let serialize (d: Doc) : string =
        d.Entries
        |> List.map (fun e -> String.concat "\t" (e.Kind :: e.Name :: e.Fields))
        |> String.concat "\n"

    /// All entries of a kind, in order.
    let ofKind (kind: string) (d: Doc) : Entry list =
        d.Entries |> List.filter (fun e -> e.Kind = kind)

    /// The first field of the named entry of a kind (the common single-payload accessor).
    let field (kind: string) (name: string) (d: Doc) : string option =
        d.Entries
        |> List.tryFind (fun e -> e.Kind = kind && e.Name = name)
        |> Option.bind (fun e -> List.tryHead e.Fields)

    /// Decode a hex field into sprite bytes (the CHIP-8/9 drawable payload).
    let hexBytes (s: string) : byte[] =
        [| for i in 0 .. 2 .. s.Length - 2 -> System.Convert.ToByte(s.Substring(i, 2), 16) |]

    /// The kinds THIS reader understands (everything else is carried, untouched — the expansion law).
    let knownKinds: Set<string> =
        Set.ofList [ "meta"; "frame"; "sprite"; "anim"; "rom"; "glyph"; "palette"; "gen"; "sim"; "mea"; "cut" ]

    /// The entries a reader carries without understanding — future media types in transit.
    let carried (d: Doc) : Entry list =
        d.Entries |> List.filter (fun e -> not (Set.contains e.Kind knownKinds))

    // ── many loops; the file defines its own sim·mea·cut (Aaron 2026-06-11: "there is no single loop
    // in the file — there are many; it should be able to self-replicate too, and define its
    // sim/measure/cut in rx"). A file is not one program with one loop: every `anim`, `gen`, and
    // `sim` section is an INDEPENDENT loop (zero clocks — they need no sequencing between them), and
    // a file that carries sim+mea+cut lines IS a room declaration: SimLoop can run it (sim = the
    // generator to drive, mea = the measurement to bank each lap, cut = the closure condition).
    // SELF-REPLICATION is the quine law: a file may carry a gen line whose generator, applied to the
    // file's own irreducible sections + seed, EMITS THE FILE — homoiconic to the letter (the format
    // can ship its own continuation, the spawn-chain move at the document level). ──

    /// All independent loops a document carries (anim + gen + sim sections — many, by design).
    let loops (d: Doc) : Entry list =
        d.Entries |> List.filter (fun e -> e.Kind = "anim" || e.Kind = "gen" || e.Kind = "sim")

    /// The document AS a room declaration: Some (sim, mea, cut) when all three verbs are present —
    /// the file defines its own loop in the verb engine; None = a media-only document (honest).
    let roomOf (d: Doc) : (Entry * Entry * Entry) option =
        let one k = d.Entries |> List.tryFind (fun e -> e.Kind = k)
        match one "sim", one "mea", one "cut" with
        | Some s, Some m, Some c -> Some(s, m, c)
        | _ -> None
