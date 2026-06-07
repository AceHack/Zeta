namespace Zeta.Core

/// **Evolution migration-window gate — the backward-projection constraint mechanized (Aaron 2026-06-07).**
///
/// During an expand/migrate/contract evolution, *adding* a relation is reversible, but **writing data that
/// only the new (expanded) shape can represent** — "expand-INTO" — is unsafe while any older reader still
/// lives: serving that reader requires projecting the richer shape back down to its flatter shape, a LOSSY
/// backward projection. So expand-into is GATED on contract-complete: you may expand into version `targetV`
/// only once every live reader is already at `>= targetV` (no one is owed a lossless flat projection of it).
///
/// This module tracks the live-reader set and answers `mayExpandInto`; `guardExpandInto` turns the
/// constraint into a `Result` so an attempted unsafe write is a clean Error, not corruption. Pairs with the
/// SchemaEvolution down-direction (the projection that WOULD be lossy is exactly the missing/None inverse).
[<RequireQualifiedAccess>]
module EvolutionWindow =

    /// The migration window: which schema versions still have a LIVE reader. (A reader at version `v` can
    /// losslessly receive any value whose shape is `<= v`; it would need a lossy down-projection for data
    /// authored at a version `> v`.)
    type Window = { LiveReaderVersions: Set<int> }

    /// No readers — vacuously safe to expand into anything.
    let empty: Window = { LiveReaderVersions = Set.empty }

    /// Register a live reader at schema version `v`.
    let readerJoins (v: int) (w: Window) : Window =
        { w with LiveReaderVersions = Set.add v w.LiveReaderVersions }

    /// Drop a live reader at schema version `v` (e.g. its deployment was retired — part of CONTRACT).
    let readerLeaves (v: int) (w: Window) : Window =
        { w with LiveReaderVersions = Set.remove v w.LiveReaderVersions }

    /// The oldest live reader version, or `None` if there are no readers.
    let minLiveVersion (w: Window) : int option =
        if Set.isEmpty w.LiveReaderVersions then None else Some(Set.minElement w.LiveReaderVersions)

    /// May we expand INTO version `targetV`? Iff every live reader is already at `>= targetV` — i.e. no
    /// older reader remains that would be owed a lossy flat projection of the expanded data.
    let mayExpandInto (targetV: int) (w: Window) : bool =
        w.LiveReaderVersions |> Set.forall (fun rv -> rv >= targetV)

    /// `mayExpandInto` as a guard: `Ok ()` when safe, else an `Error` naming the oldest blocking reader.
    /// Use before authoring expanded-only data so an unsafe expand-into is a clean failure, not corruption.
    let guardExpandInto (targetV: int) (w: Window) : Result<unit, string> =
        if mayExpandInto targetV w then
            Ok()
        else
            let oldest = minLiveVersion w |> Option.defaultValue targetV
            Error(
                sprintf
                    "cannot expand-into v%d: a live reader at v%d remains (would owe a lossy backward projection; contract first)"
                    targetV
                    oldest
            )
