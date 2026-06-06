namespace Zeta.Core

open System
open System.Runtime.InteropServices


/// **Best-effort parent-directory fsync** — closes the crash-consistent-*create*
/// gap. Writing a file with `FileOptions.WriteThrough` + `Flush(flushToDisk=true)`
/// makes the file's *data + metadata* durable, but does NOT make a NEW file's
/// directory entry durable — after a crash the file can be missing even though its
/// bytes were on disk. POSIX requires `fsync` on the *directory* to durably commit
/// the new entry. There is no managed .NET API for this, so this is a libc
/// P/Invoke on Unix.
///
/// **Platform honesty (no silent equivalence claims):**
///   - Linux / macOS: `open(dir, O_RDONLY)` + `fsync` + `close`. Real dir-entry
///     durability. (macOS `fsync` is weaker than `F_FULLFSYNC` but commits the
///     directory entry; full-barrier is a documented future option.)
///   - Windows: **no-op** — there is no directory-fsync; NTFS commits metadata via
///     its own journal on a different model. We do NOT claim equivalence; callers
///     relying on crash-consistent creates on Windows must treat this as a gap.
///   - Failure is surfaced to stderr (never silently swallowed); the file write
///     itself already succeeded, so we do not throw and lose that.
module FileSync =

    [<DllImport("libc", EntryPoint = "open", SetLastError = true)>]
    extern int private posixOpen(string pathname, int flags)

    [<DllImport("libc", EntryPoint = "fsync", SetLastError = true)>]
    extern int private posixFsync(int fd)

    [<DllImport("libc", EntryPoint = "close", SetLastError = true)>]
    extern int private posixClose(int fd)

    [<Literal>]
    let private O_RDONLY = 0

    /// fsync the directory at `dir` so newly-created entries within it are durable.
    /// Best-effort + honest per the module doc.
    let fsyncDir (dir: string) : unit =
        if OperatingSystem.IsWindows() then
            ()   // no directory-fsync on Windows; documented gap, not an equivalence
        else
            let fd = posixOpen (dir, O_RDONLY)
            if fd < 0 then
                eprintfn "FileSync.fsyncDir: open(%s) failed (errno %d)" dir (Marshal.GetLastWin32Error())
            else
                try
                    if posixFsync fd <> 0 then
                        eprintfn "FileSync.fsyncDir: fsync(%s) failed (errno %d)" dir (Marshal.GetLastWin32Error())
                finally
                    posixClose fd |> ignore
