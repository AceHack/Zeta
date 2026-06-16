---
name: fsharp-no-async-entrypoint-sync-bridge-is-compiler-forced
description: "F# has NO async entry point — `[<EntryPoint>] let main : string[] -> Task<int>` fails to compile (FS0001: expected int, got Task<int>), verified on SDK 10.0.203. Only C# has async Main (`async Task<int> Main`). So the single sync↔async bridge at an F# exe entrypoint (Async.RunSynchronously / .GetAwaiter().GetResult() in main) is COMPILER-FORCED and irreducible — it is NOT a never-.Wait() / async-all-the-way violation (the rule targets library/hot paths; main is top-of-stack with no async caller to starve). Known sites: src/Core.FSharp.Cli/Program.fs, src/Core.FSharp.Mcp/Program.fs, src/Core.FSharp.SubstrateDiscovery/Program.fs. Don't re-flag them in .Wait() audits; don't try to convert them to async-main."
type: reference
created: 2026-06-16
metadata:
  node_type: memory
  originSessionId: a9bca54f-fdf0-41b7-8def-cb33ee1bec26
---

**Verified empirically (Otto, 2026-06-16, shadow\*; Aaron confirmed).** F#'s
`[<EntryPoint>]` is hard-required to be `string[] -> int`. A `Task<int>`-returning
main does **not** compile — minimal repro on this repo's SDK (10.0.203):

```fsharp
[<EntryPoint>]
let main _ : Task<int> = task { do! Task.Delay 1; return 0 }
// error FS0001: This expression was expected to have type 'int'
//               but here has type 'Task<int>'
```

**Only C# has async Main** (`static async Task<int> Main(string[])`, since C# 7.1).
F# never got the feature. So you **cannot** push the async boundary above `main`
in F#.

## Consequence for the never-`.Wait()` / async-all-the-way rule

The single sync↔async bridge at an F# **exe entrypoint** —
`... |> Async.AwaitTask |> Async.RunSynchronously` or `(task { … }).GetAwaiter().GetResult()`
inside `main` — is **compiler-forced and irreducible**, and is **NOT a rule
violation**:

- The async-all-the-way rule ([[async-all-the-way-truthful-signatures]]) targets
  **library / hot paths** (where blocking a pooled thread starves the pool).
- `main` is **top-of-stack**: there is no async caller that could be starved, and
  the .NET runtime calls `main` synchronously regardless.

The only "fix" is cosmetic (consolidate to one bridge, make the *logic*
async-all-the-way with `let!` in a `task { }`) — changes nothing observable; not
worth the build-gate churn. A *true* async entrypoint would require rewriting the
exe's `Program.fs` in **C#** (a real decision, not a cleanup).

## The right mental model: the bridge IS the pump (Aaron 2026-06-16)

The entrypoint bridge **is the pump** — the single **synchronous driver at the
root** that turns the async crank (runs the state machine to completion) because
nothing above it can. There is **always exactly one pump per execution root** —
you can't have *zero* (something must drive the loop); having *two* in series is
the bug. Same role as `Application.Run()` (WinForms/WPF message pump) or C#'s
compiler-generated `Main().GetAwaiter().GetResult()`. **C# *hides* the pump
(compiler writes it); F# makes you *write* it** — same pump, different visibility.
That's the whole reason it's irreducible.

This restates the async-all-the-way rule cleanly: **exactly ONE pump, at the root;
NO hidden pumps in the middle.** A sync-over-async call in a *library/hot path* is
a **hidden mid-stack pump** that blocks a pooled thread — *that* is the violation.
The entrypoint bridge is the *legitimate* root pump. (Resonance: the soft
`IScheduler` DoP=1 cooperative run loop / the CHIP-8 ISR tick loop / the
FoundationDB single-thread run loop are all **deliberate, knobbed pumps** — the
good kind; see [[async-all-the-way-truthful-signatures]].)

## Known compiler-forced bridge sites (do NOT re-flag in `.Wait()` audits)

- `src/Core.FSharp.Cli/Program.fs` (the `Db` command branch)
- `src/Core.FSharp.Mcp/Program.fs` (the db/git command handler in the stdin loop)
- `src/Core.FSharp.SubstrateDiscovery/Program.fs` (the `--smoke` branch)

Separately legitimate (not a bridge): `src/Core/PluginHarness.fs` —
`vt.IsCompleted then vt.GetAwaiter().GetResult()` is a **guarded fast-path** on an
already-completed ValueTask; it never blocks. Also not a violation.

Audit result 2026-06-16: **no `.Wait()`, no `.Result`, no `async void`, no
library-path sync-over-async anywhere** in `src/`+`tools/`. The codebase is clean
against the never-`.Wait()` rule; the above are the only sync↔async sites and all
are exempt. (The `Task.Run` smell sites at `src/Core/Runtime.fs` +
`src/Core/SpineAsync.fs` are a separate concern, assigned to Vera's ferry-throttle
workitem.)
