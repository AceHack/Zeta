---
name: PREFERRED UPDATE METHOD — `tools/setup/install.sh` after editing `.mise.toml` pins; NOT direct binary installs / system package managers / `mise install <tool>`; the install script is the canonical update path on every machine; verified 2026-04-24 with .NET 10.0.202 → 10.0.203 security bump (build green with Otto-248 DOTNET_gcServer=0 workaround); GOVERNANCE §24 three-way-parity (dev laptop / CI / devcontainer) only holds if everyone uses the same path
description: Maintainer 2026-04-24 directive. Preferred method to update toolchain is editing `.mise.toml` pins then running `tools/setup/install.sh`. NOT `mise install <tool>` directly, NOT system package managers, NOT manual binary downloads. The install script is the GOVERNANCE §24 three-way-parity contract; everything else diverges from CI behaviour. Verified end-to-end on 2026-04-24 dotnet 10.0.203 bump (security update with ASP.NET Core Data Protection fix).
type: feedback
---

## The directive (verbatim)

Maintainer 2026-04-24:

> *"you should note somewehre durable that that's the
> prefered method of update"*

Context: I had just (a) edited `.mise.toml` to bump dotnet
10.0.202 → 10.0.203, (b) run `tools/setup/install.sh`,
(c) verified `mise exec -- dotnet --version` returns
10.0.203, (d) verified `DOTNET_gcServer=0 mise exec --
dotnet build Zeta.sln -c Release` is green with the
Otto-248 workaround. (Both verifications go through `mise
exec --` so PATH order can't silently resolve a legacy /
Homebrew `dotnet` ahead of the mise-managed shim.)

## The rule

**Preferred update path:**

1. Edit the pin in **both** `.mise.toml` **and**
   `global.json` for any .NET SDK bump. These two
   files are the .NET pinning contract — they MUST
   stay in sync. `.mise.toml` drives the
   `tools/setup/install.sh` install path; `global.json`
   drives runtime SDK resolution. Editing one without
   the other produces pin drift: `install.sh` installs
   one version, `dotnet` invocations resolve a
   different one, build fails or worse silently
   diverges from CI. (For non-.NET tools the contract
   is `.mise.toml` alone — `global.json` is .NET-only.)
2. Run `tools/setup/install.sh` from repo root.
3. Verify with `mise exec -- dotnet --version` (or
   equivalent for other tools).
4. Run the build gate via mise to avoid SDK pin drift
   (a legacy/Homebrew `dotnet` earlier on PATH would
   silently bypass the `.mise.toml` pin):
   `DOTNET_gcServer=0 mise exec -- dotnet build Zeta.sln -c Release`
   (Otto-248 workaround until the .NET 10 GC SIGSEGV
   on Apple Silicon is fixed upstream).

**Anti-patterns** (do NOT do these for routine
toolchain updates):

- `brew install dotnet` / `brew upgrade dotnet` —
  diverges from the mise-managed pin; `mise` and `brew`
  fight over `dotnet-root/`.
- Direct `mise install dotnet@<version>` without
  updating `.mise.toml` — pin-drift; CI uses the file,
  your laptop uses your shell history.
- Manual download from `dotnet.microsoft.com` — version
  becomes invisible to the rest of the toolchain.
- `dotnet-install.sh` from Microsoft directly — bypasses
  the round-34 flip to mise (see `.mise.toml` header).

## Why this discipline matters

GOVERNANCE §24 three-way-parity says the install script
is the SAME script consumed by:
1. Dev laptop (you)
2. CI runner (GitHub Actions)
3. Devcontainer image

If your laptop deviates from the install-script path,
**you lose the parity guarantee**. CI sees a different
toolchain than your laptop. Reproducible-stability
(the project's load-bearing thesis from
`AGENTS.md`) breaks.

## Verified on 2026-04-24

- **Trigger**: maintainer noticed CI log showed
  `dotnet@10.0.202` and said "there is a newer version
  now".
- **Search**: WebSearch confirmed 10.0.203 released
  2026-04-21 with ASP.NET Core Data Protection
  security fix (per Otto-247 version-currency-search-
  first rule).
- **Bump**: edited `.mise.toml:24` and `global.json:3`
  from `"10.0.202"` to `"10.0.203"`.
- **Install**: ran `tools/setup/install.sh` end-to-end;
  exit clean; printed standard "=== Install complete
  ===" footer.
- **Verify**: `mise exec -- dotnet --version` →
  `10.0.203`.
- **Build gate**: `DOTNET_gcServer=0 mise exec -- dotnet
  build Zeta.sln -c Release` → `0 Warning(s) 0 Error(s)`.
  (Routed through `mise exec --` per step 4 above, so a
  legacy / Homebrew `dotnet` earlier on PATH cannot
  silently bypass the `.mise.toml` pin.)

End-to-end the install script is what the maintainer
runs; it's what CI runs; it's what the devcontainer
will run. Same script, three places.

## Composes with

- **GOVERNANCE §24 three-way-parity** install script
  (the rule this discipline upholds).
- **Otto-247 version-currency-always-search-first**
  (the WebSearch trigger before bumping).
- **Otto-248** .NET 10 GC SIGSEGV workaround
  (`DOTNET_gcServer=0` until upstream fix).
- **Otto-275 log-don't-implement** (this memory IS the
  durable note the maintainer asked for).

## Future Otto reference

When asked to update a toolchain: **edit `.mise.toml`
+ run `tools/setup/install.sh`**. Don't shortcut to
`mise install` or brew. Verify the build gate after.
The script is the contract; every other path is drift.
