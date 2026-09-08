# Guarded controller: metadata language-runtime recovery review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Disposition: narrow dependency repair and startup regression accepted

The first fresh-capture helper attempt failed before its main logic could
produce a journal or query the DAC. The retained stderr names missing
`FSharp.Core, Version=10.1.0.0`; helper PID 77319 exited with code -6.
The driver had already retained its three selected physical method chains.
The [failed attempt inventory](hidden-switch-compiled-validation/2026-09-07/clrmd-attempt-1/manifest.json)
is committed at `baeb2eb06bc1445fcd8b90516019216e436c6ae5`.
This failure is neither a DAC-method refusal nor evidence of unavailable
extents. The original source acceptance concerned the explicit thirteen-file
ClrMD transitive roster, separately from the F# executable dependency closure;
this actual startup exposed the missing language-runtime asset.

I read the complete three-file repair at
`c1cf790218d0584330743cf0178f9dc75772c439` and verified current bytes match
that commit. The helper project now references the existing central
`FSharp.Core` package pin 10.1.400. The installed netstandard2.1 DLL is exactly
2,405,712 bytes, SHA-256
`454275e6f64f26c19f989cc0e0c43a2eaf41705fc0f456097faa1da445139394`,
which I independently verified. Before any dump read, the helper identifies
`typeof<unit>.Assembly`, checks that actual file's bytes and emits its assembly
name/location as a separate executable-language dependency. The thirteen-file
ClrMD manifest remains byte-identical.

The driver now includes DLLs in the helper output's child directories. I
verified 31 module/config files, including thirteen FSharp.Core locale-resource
DLLs, under its unchanged 32-file bound. This is finite file custody in the
stable owned output tree, not evidence that all of those assemblies loaded or
that all framework loads are covered. The source changes no query, cleanup,
physical-range or extent-admission rule.

The corrected project is 3,170 bytes, SHA-256
`8eac0c22c0a5ad54c8bd6cdc213548bd108dd04ba314e3ab19ae087df8643dd6`;
`Program.fs` is 21,905 bytes, SHA-256
`45bed1604aae38f04934dfc17274780ae3b0a0a40ae2b862b10469141e9267c9`;
the driver is 15,595 bytes, SHA-256
`eedf077672fa08eaa08741b49a100314ff976eaa1176def72bbd3d8b110f6d86`.

The native author's build completed in 2.41 seconds with zero warnings/errors;
23 bounded Python instrument fixtures and Ruff passed. I read those logs.
The separately retained no-argument executable startup finished at
2026-09-07T22:26:30.098526Z: PID 85961 returned the expected usage-refusal
exit code 2, with the exact usage stderr and no dump-query argument. It reports
zero dump queries, unchanged input/copy identities and no cleanup failures.
I read the invocation/outcome/stderr and independently verified all 31 original
and copied module/config identities. This is a successful loading regression
with an expected nonzero CLI refusal, not a successful metadata query.

No remaining material source issue was found in this repair. I executed no
build, startup, helper, analyzer, dump query, policy or measurement. The parent's
one separately authorized metadata recovery is outside this review's outcome
claim. All body, closure and full runtime admission flags remain false; the
first startup failure and prior SOS refusals remain intact.

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
