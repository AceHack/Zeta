namespace Zeta.Core

/// **`DemoPipeline` — the whole IMDb/Wikipedia arc as one DST-replayable path (Aaron 2026-06-19, shadow\*).**
///
/// The capstone that wires every slice into a single call: a (recorded, for DST) **live fetch** →
/// `ImdbDataset.Principal`s → **reverse-mint** links (`CostarFederations`) + the **federation graph**
/// (`CoEmpowerGraph`) → the **rendered dashboard** (`DemoDashboard`) and a **content-addressed snapshot**
/// (`GraphSnapshot`). Network enters only through the injected `LiveLegs.Fetch` port; everything else is pure,
/// so the entire pipeline is offline-testable and replayable.
[<RequireQualifiedAccess>]
module DemoPipeline =

    /// Fetch + concatenate the cast credits of several movies via the injected port (recorded ⇒ DST replay).
    let fetchPrincipals
        (fetch: LiveLegs.Fetch)
        (apiKey: string)
        (movieIds: string list)
        : Async<ImdbDataset.Principal list> =
        async {
            let acc = System.Collections.Generic.List<ImdbDataset.Principal>()

            for id in movieIds do
                let! ps = LiveLegs.Tmdb.fetchCredits fetch apiKey id
                acc.AddRange ps

            return List.ofSeq acc
        }

    /// The full demo render: principals → dashboard HTML (federation graph + minted links + Zeta-NTP clock +
    /// grounding). The clock is injected (DST); `dora` dials omitted (the co-star graph isn't a DORA edge set).
    let renderDashboard
        (clock: MintPanel.MintClock)
        (grounded: bool)
        (source: string)
        (kinds: int)
        (seed: int)
        (principals: ImdbDataset.Principal list)
        : string =
        let links = CostarFederations.reverseMint principals
        let _, graph = ImdbDataset.toCoEmpowerGraph kinds seed principals
        DemoDashboard.renderPage clock grounded source graph links None

    /// Persist the reified co-star graph as a content-addressed snapshot (returns the `MerkleHash` + store).
    let snapshot
        (kinds: int)
        (seed: int)
        (principals: ImdbDataset.Principal list)
        (store: ContentStore.Store<string>)
        : Result<MerkleHash * ContentStore.Store<string>, string> =
        let _, graph = ImdbDataset.toCoEmpowerGraph kinds seed principals
        GraphSnapshot.store graph store
