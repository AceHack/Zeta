namespace Zeta.Core

/// IndexFormat — **index formats are ZetaId-defined artifacts, and each has a visualization**
/// (Aaron 2026-06-11: "you should be able to define index formats from a ZetaId, and we have
/// visualizations for them").
///
/// The database's index structures register like every other stable artifact (content-addressed
/// name@version → ZetaId; a `gen`/`io` line can reference an index format by id, and the lint's
/// DI rule already covers it). And every format is VISIBLE: each carries a characteristic 8×8 glyph
/// (a sketch of its SHAPE — the tree fans, the hash scatters, the bloom speckles, the Z-set carries
/// its ± rows) so the board/TV can show WHAT KIND of index a room is holding at a glance — the
/// ZetaIdViz discipline (color=category, pattern=identity) extended to structure=kind.
[<RequireQualifiedAccess>]
module IndexFormat =

    /// A registered index format: registry entry + its glyph (the visualization).
    type Format =
        { Entry: GeneratorRegistry.Entry
          Glyph: byte[] }

    let private mk name version glyph =
        { Entry = GeneratorRegistry.register name version; Glyph = glyph }

    /// The shelf — each format's glyph sketches its structure (8 rows, hex-designed):
    let btree = mk "index.btree" 1 [| 0x10uy; 0x28uy; 0x44uy; 0xAAuy; 0x00uy; 0x44uy; 0xAAuy; 0x00uy |] // the fanning tree
    let hash = mk "index.hash" 1 [| 0x88uy; 0x22uy; 0x44uy; 0x11uy; 0x88uy; 0x22uy; 0x44uy; 0x11uy |] // the scatter
    let bloom = mk "index.bloom" 1 [| 0x24uy; 0x81uy; 0x18uy; 0x42uy; 0x24uy; 0x81uy; 0x18uy; 0x42uy |] // the speckle
    let minhash = mk "index.minhash" 1 [| 0xF0uy; 0x78uy; 0x3Cuy; 0x1Euy; 0x0Fuy; 0x1Euy; 0x3Cuy; 0x78uy |] // the sketch wedge
    let zset = mk "index.zset" 1 [| 0xFFuy; 0x18uy; 0x18uy; 0xFFuy; 0x00uy; 0xFFuy; 0x18uy; 0x18uy |] // the ± ledger rows

    /// All known index formats.
    let known: Format list = [ btree; hash; bloom; minhash; zset ]

    /// Resolve a format by its ZetaId — the filetype's direction (an index declared in a file by id).
    let byId (zetaId: string) : Format option =
        known |> List.tryFind (fun f -> f.Entry.ZetaId = zetaId)

    /// The format's visualization as MediaLines entries (glyph + a meta line naming it) — drop-in for
    /// any board/card/TV surface.
    let toMediaLines (f: Format) : MediaLines.Entry list =
        let hex = f.Glyph |> Array.map (sprintf "%02x") |> String.concat ""
        [ { Kind = "glyph"; Name = f.Entry.Name; Fields = [ hex ] }
          { Kind = "meta"; Name = f.Entry.Name; Fields = [ f.Entry.ZetaId ] } ]
