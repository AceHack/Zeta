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
              ("control.gamepad-meta", "metaOf"), c "O(1)" "O(1)" Derived ]

    /// THE BUDGET LINT: every registered artifact (generators + layouts + indexes + schemes) whose
    /// costs are entirely UNSTATED. Empty list = the requirement holds across the shelf.
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
