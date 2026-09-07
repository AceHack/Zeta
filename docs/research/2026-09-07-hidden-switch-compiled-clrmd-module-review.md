# Guarded controller: ClrMD dependency and module inspection

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: finite local dependency copying accepted; no public MVID route found

This supplements the [settled helper plan](2026-09-07-hidden-switch-compiled-sos-feasibility-review.md).
Seven [lossless static records](hidden-switch-compiled-validation/2026-09-07/clrmd-module-static-inspection/manifest.json)
retain installed dependency identities and complete `ClrModule`/`ModuleInfo`
IL inspections. Both bounded disassembler commands exited zero with empty
stderr. They inspect installed tool assemblies only; no analyzer, dump, study
target, policy or measurement was launched. A preceding overbroad local text
search was truncated and used an incorrect report filename; it supplied no
new identity conclusion. The exact subsequent metadata reads are retained.

The installed `dotnet-dump.deps.json` hashes to
`430f074d7e0b2be60f5091c43a525bd80eec8b55c92b892bd3b6d38ece9fdbc7`.
Its ClrMD dependency graph has thirteen generic managed runtime assets, all
present locally: ClrMD, Azure.Identity, Azure.Core, NETCore.Client,
Microsoft.Identity.Client, its Extensions.Msal, Logging.Abstractions,
Bcl.AsyncInterfaces, System.ClientModel, System.Memory.Data,
IdentityModel.Abstractions, ProtectedData and DependencyInjection.Abstractions.
The retained inventory gives exact package versions, file lengths and hashes.
The only additional RID-specific runtime asset in this dependency set is a
Windows ProtectedData alternative, outside the macOS candidate.

A finite copy of these explicitly referenced installed assets is appropriate
for the isolated helper. Pin its generated dependency/configuration files and
ordinary framework resolution separately. Copy inventory is not evidence that
all copied assemblies loaded, or that only those assemblies loaded. Record
actual managed/native loads separately. The deny-all locator must be supplied
before `DataTarget` construction; the helper must not construct credentials or
invoke authentication paths. That locator does not prove process-wide network
or filesystem isolation and does not remove direct local-image fallback.

Installed `ClrModule` exposes module/assembly addresses, name, image base,
metadata address and metadata length, but no public MVID. Its metadata reader
is internal. The version-specific
[ClrModule source](https://github.com/microsoft/clrmd/blob/41c1e91786141d37b26cfdfb8059fc522e81fb8d/src/Microsoft.Diagnostics.Runtime/ClrModule.cs)
agrees. Record those DAC identities with the method token, signature and current
body address. A captured file's MVID, read through PE metadata without loading
the study assembly, can match the target's reflection record; that association
must not be described as a dump-derived MVID check. Public
[ModuleInfo.BuildId](https://github.com/microsoft/clrmd/blob/41c1e91786141d37b26cfdfb8059fc522e81fb8d/src/Microsoft.Diagnostics.Runtime/ModuleInfo.cs)
represents native build identity or a Mach-O UUID, not a managed MVID.

The old dump's same-path study DLL has since been rebuilt. The parent selected
a fresh, separately named capture with current DLL/configuration bytes copied
into owned custody before further rebuilding. The old dump and three analyzer
refusals remain separate history. A fresh copy does not retroactively repair
the old dump's missing image custody. No additional metadata-range dump read
or broad memory scan follows from this inspection. Exact helper source,
fresh capture custody, DAC behavior and selected physical code correspondence
still require their own review; all complete admission flags remain false.

```text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1XXWTTF087G0R000X1HMD0
Co-Authored-By: Codex <noreply@openai.com>
```
