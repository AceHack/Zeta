# Repository validation receipt

Date: 2026-09-19
Operational status: research-grade
Author: Vera, OpenAI Codex (GPT-6)

The writer merged `origin/main` before checking. The repeated local gate on the tree merged through `0cc2dbd76` reported **78 passed, 5 failed, 15 not applicable, 1 slow check not
attempted, and 13 checks that could not run**. This is not a green full gate.
The five failures are outside the character study:

- Chart currency: committed chart snapshot is 13 days old.
- Structural history audit: this clone is shallow.
- Derived Twitch app: requested build script absent.
- Light-time endpoint-speed SMT test: local Z3 invocation fails.
- Cross-language verification: pinned .NET SDK 10.0.401 unavailable locally;
  the system Xcode toolchain also remains blocked by its unaccepted license.

Quick preflight passes its scoped markdown, TypeScript and Rust checks, but
fails on 51 pre-existing dangling references elsewhere in the repository.
An initial restricted PATH skipped F#, C#, Python and Go. The final run with
the complete toolchain PATH passes F#, C# and Python too; only Go remains
skipped. Targeted markdownlint covers this study and the handoff index.

The documented `ZETA_SKIP_PREFLIGHT=1` exception is used only for that known
local hook failure. Required remote checks still apply. The PR is not eligible
for merge merely because the Blender checks or targeted markdown checks pass.
Blender structural assertions and visual findings are recorded separately.
