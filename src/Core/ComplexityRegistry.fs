namespace Zeta.Core

/// ComplexityRegistry — **Big-O is REQUIRED on the shelf: proven or derived, never unstated**
/// (Aaron 2026-06-11: "Big-O complexity should be required to be proven on all of these, or derived
/// by our engine — not left unstated. Probably per operation. The math team will need to help — space
/// AND time, memory and compute, for BUDGETING. Also: keep up with any ENTROPY it may hold — it
/// doesn't have to hold it, but it may — internal save state, maybe identities if an AI wants.")
///
/// Per (artifact, operation): time + space, each with PROVENANCE — `Proven` (a written proof/test),
/// `Derived` (the engine computed it), or implicitly UNSTATED (absent from the table) — and
/// `unstated` is the budget lint: it lists every registered artifact whose costs are missing. The
/// declarations below are the first pass (honest provenance: mostly Derived-by-inspection; the math
/// team — Hiroshi's asymptotic lane — upgrades Derived→Proven). ENTROPY HELD is the optional
/// declaration: an artifact MAY hold entropy (save state, identity) and saying so is part of its
/// honest surface (bounded uncertainty: even the holding is declared).
[<RequireQualifiedAccess>]
module ComplexityRegistry =

    type Provenance =
        | Proven
        | Derived

    /// One operation's declared costs: canonical Big-O strings + provenance.
    type Cost =
        { Time: string
          Space: string
          By: Provenance }

    let private c t s by = { Time = t; Space = s; By = by }

    /// The table: (artifact-name, operation) → cost. First pass, derived by inspection — the math
    /// team's docket is the upgrade path (Derived → Proven, per operation).
    let declared: Map<string * string, Cost> =
        Map.ofList
            [ ("layout.treemap", "treemap"), c "O(n)" "O(n)" Derived
              ("zetaid.glyph", "glyphOf"), c "O(1)" "O(1)" Derived
              ("zetaid.glyph", "colorOf"), c "O(1)" "O(1)" Derived
              ("index.minhash", "softBytes"), c "O(n·k)" "O(k)" Derived // n bytes, k sketch size
              ("index.zset", "fold"), c "O(n log n)" "O(n)" Derived
              ("boundary.glow", "glow"), c "O(|curve|)" "O(1)" Derived
              ("boundary.grid", "sampleGrid"), c "O(w·h·|curve|)" "O(w·h)" Derived
              ("boundary.scatter", "scatter"), c "O(n)" "O(n)" Derived
              ("boundary.rotorCurve", "rotorCurve"), c "O(steps)" "O(steps)" Derived
              ("audio.saw", "sampleAt"), c "O(1)" "O(1)" Derived
              ("audio.square", "sampleAt"), c "O(1)" "O(1)" Derived
              ("audio.triangle", "sampleAt"), c "O(1)" "O(1)" Derived
              ("audio.sine", "sampleAt"), c "O(1)" "O(1)" Derived
              ("midi.track", "noteCrossing"), c "O(1)" "O(1)" Derived
              ("timegen.phasor", "at"), c "O(1)" "O(1)" Derived
              ("kernel.rbf", "eval"), c "O(d)" "O(1)" Derived
              ("boundary.curve", "distSq"), c "O(|curve|)" "O(1)" Derived
              ("boundary.mirror", "mirror"), c "O(|curve|)" "O(|curve|)" Derived
              ("layout.defrag", "TBD"), c "O(n)" "O(n)" Derived
              ("layout.dag", "TBD"), c "O(V+E)" "O(V+E)" Derived
              ("layout.timeline", "TBD"), c "O(n log n)" "O(n)" Derived
              ("layout.force", "TBD"), c "O(n²) per tick" "O(n)" Derived
              ("index.btree", "TBD"), c "O(log n)" "O(n)" Derived
              ("index.hash", "TBD"), c "O(1) amortized" "O(n)" Derived
              ("index.bloom", "TBD"), c "O(k)" "O(m)" Derived
              ("control.chip9-pad", "translate"), c "O(1)" "O(1)" Derived
              ("control.keyboard-wasd", "translate"), c "O(1)" "O(1)" Derived
              ("control.gamepad-standard", "translate"), c "O(1)" "O(1)" Derived
              ("control.gamepad-meta", "metaOf"), c "O(1)" "O(1)" Derived
              ("view.flux-curve", "admissionCurve"), c "O(rows·cols)" "O(rows·cols)" Derived
              ("view.flux-gauge", "tankGauge"), c "O(width)" "O(width)" Derived
              ("view.flux-timeline", "timeline"), c "O(ticks)" "O(ticks)" Derived
              ("view.interrupt-grid", "interruptGrid"), c "O(handlers·ticks·arrivals)" "O(handlers·ticks)" Derived
              ("ui.magnetic-ports", "force"), c "O(1)" "O(1)" Derived
              ("ui.magnetic-ports", "dragTick"), c "O(ports)" "O(1)" Derived
              ("shader.antialias", "TBD"), c "O(w·h)" "O(w·h)" Derived
              ("shader.xbr", "TBD"), c "O(w·h)" "O(w·h)" Derived
              ("shader.hq2x", "TBD"), c "O(w·h)" "O(w·h)" Derived
              ("shader.crt-scanline", "TBD"), c "O(w·h)" "O(1) streaming" Derived
              ("shader.crt-phosphor", "TBD"), c "O(w·h·|curve|)" "O(w·h)" Derived
              ("shader.crt-curvature", "TBD"), c "O(w·h)" "O(w·h)" Derived
              ("shader.ntsc", "TBD"), c "O(w·h)" "O(w)" Derived
              ("shape.worldline", "draw"), c "O(steps)" "O(steps)" Derived
              ("shape.lightcone", "draw"), c "O(w·h)" "O(1)" Derived
              ("shape.fourcorner", "draw"), c "O(1)" "O(1)" Derived
              ("shape.braid", "draw"), c "O(crossings·strands)" "O(strands)" Derived
              // SAME SHAPE, SEVERAL WAYS, DIFFERENT O — a shape may be drawn by more than one
              // strategy, each tagged with its own cost; the shape is PARAMETRIZED over its O
              // (Aaron 2026-06-12). The polyline path is O(steps); the glow-grid path (the SAME
              // spiral through BoundaryLight.sampleGrid) trades time for area coverage.
              ("shape.spiral", "draw"), c "O(steps)" "O(steps)" Derived
              ("shape.spiral", "draw-grid"), c "O(w·h·steps)" "O(w·h)" Derived
              ("shape.seam", "draw"), c "O(strands·passes)" "O(strands)" Derived
              ("shape.buckyball", "draw"), c "O(F)" "O(F)" Derived // F=32 faces: both views + a door per room + itself — linear in rooms, constant for C60
              ("shape.shadow-loop", "draw"), c "O(steps)" "O(steps)" Derived // one closed pass; the crossing costs nothing extra — catching yourself is built into the path
              ("shape.plait-move", "draw"), c "O(crossings·strands)" "O(strands)" Derived // the unit move: one exchange (the gate); the locked braid is this, repeated to its period
              ("algebra.braid-memory", "carry"), c "O(word)" "O(word)" Derived // crossing order is the payload: Z-valued memory (Artin)
              ("algebra.z2-parity", "carry"), c "O(1)" "O(1)" Derived // one bit per edge: the dashing register (Gates)
              ("algebra.mod2", "project"), c "O(word)" "O(1)" Derived // THE MISSING PIECE: Z -> Z/2, order forgotten, parity kept — the adapter that snaps braid-out into adinkra-in
              ("shape.adinkra", "draw"), c "O(E)" "O(E)" Derived // one stroke per drawn edge (24 on the flat grid); dashing lookup is O(1) per edge
              ("binding.html-css", "render"), c "O(entries·pixels)" "O(output)" Derived
              ("sim.wave-interference", "pattern"), c "O(w·h·sources)" "O(w·h)" Derived
              ("viz.adinkra", "render"), c "O(nodes)" "O(nodes)" Derived
              ("viz.adinkra", "dashing"), c "O(V·N²)" "O(E)" Derived // all faces checked: 16 vertices x 6 color pairs; the dashing set is at most the 32 edges
              ("spectral.hard-dft", "dft"), c "O(n²)" "O(n)" Derived
              ("spectral.hard-dft", "idft"), c "O(n²)" "O(n)" Derived
              ("spectral.soft-probe", "probe"), c "O(n)" "O(1)" Derived
              ("spectral.soft-probe", "fingerprint"), c "O(n·k)" "O(k)" Derived ]

    /// THE BUDGET LINT: every registered artifact (generators + layouts + indexes + schemes) whose
    /// costs are entirely UNSTATED. Empty list = the requirement holds across the shelf.
    /// All declared ways to perform an operation FAMILY on an artifact — the "same shape,
    /// different O tradeoffs" query: a renderer (or a budget) picks a strategy BY its cost tag.
    let strategiesOf (artifact: string) : (string * Cost) list =
        declared
        |> Map.toList
        |> List.choose (fun ((a, op), cost) -> if a = artifact then Some(op, cost) else None)

    let unstated () : string list =
        let stated = declared |> Map.toList |> List.map (fst >> fst) |> Set.ofList
        let allNames =
            (GeneratorRegistry.known |> List.map (fun e -> e.Name))
            @ (LayoutEngine.known |> List.map (fun e -> e.Name))
            @ (IndexFormat.known |> List.map (fun f -> f.Entry.Name))
            @ (ControlScheme.known |> List.map (fun s -> s.Name))
            |> List.distinct
        allNames |> List.filter (fun n -> not (Set.contains n stated))

    /// ENTROPY HELD — the optional declaration: an artifact MAY hold entropy and says so (save state,
    /// identity). Absence = holds none (the zero case); presence = the holding is part of its surface.
    let entropyHeld: Map<string, string list> =
        Map.ofList
            [ "saves", [ "save-state recordings (the campaign notebook)" ]
              "rooms.persona", [ "identity (the persona's own; clause 2 — theirs)" ] ]
