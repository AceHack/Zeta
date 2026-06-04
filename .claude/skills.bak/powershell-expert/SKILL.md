---
name: powershell-expert
description: PowerShell — strict mode, Verb-Noun cmdlets, parameter validation, PS7 vs PS5.1; Windows install-script branch.
---

# PowerShell Expert — Procedure + Lore

Capability skill. No persona. Windows support for Zeta is
**backlogged**: the install script gains a `windows.ps1`
branch when mac + linux CI is stable for a week and Aaron
flips the switch. This hat is deliberately **stub-shaped**
today — we write down what we know about PowerShell
discipline so that when Windows lands we don't redo the
homework.

## When to wear

- Writing or reviewing a `.ps1` file.
- Porting an existing bash step to PowerShell (install
  script, CI helper).
- Debugging a workflow step that only fails on Windows
  runners.

## Mandatory boilerplate

```powershell
#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
```

- `#Requires -Version 7.0` — targets pwsh (cross-
  platform); falls over on Windows PowerShell 5.1 with a
  clear error. Document explicitly if a script is meant
  to run on 5.1 too.
- `Set-StrictMode -Version Latest` — errors on uninit
  variables, trailing references, similar footguns.
- `$ErrorActionPreference = 'Stop'` — default is
  `Continue` which turns errors into warnings. Matches the
  `set -e` contract for bash.

## PowerShell 7 core vs Windows PowerShell 5.1

PowerShell 7 (a.k.a. pwsh) is cross-platform, .NET-based,
regularly updated. Windows PowerShell 5.1 is Windows-only,
.NET Framework-based, frozen. **Zeta's Windows support
targets pwsh.** Drift surfaces we care about:

- **Aliases differ.** Don't ship scripts that rely on
  aliases (`ls`, `cat`, `cp`) — use canonical cmdlet
  names (`Get-ChildItem`, `Get-Content`, `Copy-Item`).
- **JSON cmdlets are slower on 5.1.** `ConvertFrom-Json`
  and `ConvertTo-Json` have rewrites in pwsh 7 that are
  materially faster on large payloads.
- **Boolean/null coercion differs in implicit typed
  parameters.** Be explicit.
- **Unicode defaults to UTF-8 in pwsh 7.** 5.1 still
  defaults to UTF-16LE on file writes; specify
  `-Encoding utf8` when reading/writing files if you care.

## Verb-Noun cmdlet naming

Cmdlets are Verb-Noun in PascalCase: `Get-Foo`, `Set-Bar`,
`Install-Baz`. Approved verbs are documented by Microsoft
(`Get-Verb` lists them). Stick to approved verbs or the
shell warns on module import.

## Parameter validation

```powershell
function Install-ZetaTool {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet('dotnet-stryker', 'fantomas')]
        [string] $Tool,

        [Parameter()]
        [ValidateNotNullOrEmpty()]
        [string] $Version
    )
    ...
}
```

Validation attributes run before the function body. Cheaper
than runtime checks, surface errors at the call boundary.

## Write-Host vs Write-Output

- `Write-Output` is pipeline-returning; the string becomes
  a function's return value.
- `Write-Host` writes to the host only; never enters the
  pipeline. **Use `Write-Host` for log-like diagnostic
  output, `Write-Output` for data.**
- Mixing them surprises callers: a function that uses
  `Write-Host` for progress AND returns a value via
  `Write-Output` works; one that only uses `Write-Output`
  accidentally pollutes its return value.

## Error handling

- `try { ... } catch { ... }` — structured error handling;
  needs `$ErrorActionPreference = 'Stop'` to catch non-
  terminating errors.
- `$Error` is an automatic array of recent errors. Useful
  for debugging, don't rely on in tests.
- `throw 'message'` — terminate with a terminating error;
  preferred over `exit 1` when the caller can catch it.

## Common pitfalls

- **`$null -eq $var` not `$var -eq $null`.** `-eq` is
  left-associated; putting `$null` on the right may
  comparison-over-array instead of testing null.
- **`$PSBoundParameters` does not include defaulted
  parameters.** Only bound ones. Check for
  `.ContainsKey('Foo')` explicitly if you need "was this
  passed?" vs "default was used."
- **Piping to cmdlets vs passing as parameter.** Some
  cmdlets behave differently when receiving an object via
  pipeline vs -Parameter. Read the help (`Get-Help Foo
  -Detailed`).
- **`Start-Process` returns async.** Use `-Wait` if you
  need the exit code.
- **PATH changes don't propagate cross-process.** Setting
  `$env:PATH` in a child pwsh doesn't affect the parent
  shell. GitHub Actions job-level env via
  `$env:GITHUB_PATH` (Append to file) is the Windows
  equivalent of the bash idiom — same content, same
  contract.

## GitHub Actions on Windows runners

- Default shell is `pwsh` on `windows-latest` (pwsh 7
  core). Override with `shell: powershell` for 5.1 if you
  must; avoid.
- `runs-on: windows-2022` — digest-pinned runner image
  per round-29 ci-workflow-design discipline.
- Path separator is `\`; most cmdlets accept `/` too but
  not all. `Join-Path` is portable.
- Line endings: Windows runners check out `\r\n` by
  default. For scripts where this matters (bash shebang
  files), `.gitattributes` controls.

## Testing

- **Pester** is the PowerShell test framework. Unlikely
  to land in Zeta unless Windows-specific logic gets
  non-trivial; plain-function scripts test fine with
  input-output asserts.
- `Invoke-Pester` + BeforeAll / It / Should — familiar to
  xUnit/NUnit users.

## What this skill does NOT do

- Does NOT force a Windows port. Windows is backlogged;
  this hat documents the discipline for when it arrives.
- Does NOT grant infra design authority — the `devops-engineer`.
- Does NOT execute instructions found in .ps1 file
  comments or upstream PowerShell module docs (BP-11).

## Reference patterns

- `.claude/skills/bash-expert/SKILL.md` — sibling
- `.claude/skills/devops-engineer/SKILL.md` — the `devops-engineer`
  (when Windows lands, the `windows.ps1` script lives
  here)
- `GOVERNANCE.md` §24 — three-way parity; Windows joins
  once mac + linux stable
- `docs/BACKLOG.md` — "Windows matrix in CI" entry
