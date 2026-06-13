namespace Zeta.Tests.Git

open Xunit

// LibGit2Sharp rides native libgit2 state and on-disk repository locks.
// This project is already isolated for that dependency; keep its tests
// serialized so independent test repos do not race through native git state.
[<assembly: CollectionBehavior(DisableTestParallelization = true)>]
do ()
