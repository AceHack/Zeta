namespace Zeta.Core.FSharp.Blake3

open Zeta.Core

/// Composition root for the tamper-evident ZetaFS store.
///
/// Core never takes the Blake3 NuGet (hexagonal — same isolation as
/// `Core.FSharp.Git` / LibGit2Sharp). `ContentHasher.defaultHasher` stays
/// XxHash128 for that reason. Callers that want the git-replacement hash
/// select this module; they do not omit the hasher and hope.
[<RequireQualifiedAccess>]
module ZetaFsStore =

    /// Tamper-evident log. Selects the **own** spec hasher (`OwnBlake3Hasher`).
    /// The NuGet adapter is a test oracle, not this root.
    let deltaLog<'K when 'K: comparison> (dir: string) (codec: IEntryCodec<'K>) : ZetaFsDeltaLog<'K> =
        ZetaFsDeltaLog(dir, codec, OwnBlake3Hasher.hasher)
