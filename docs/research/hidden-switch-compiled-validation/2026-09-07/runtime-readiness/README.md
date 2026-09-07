# Runtime readiness evidence

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XXWTTF087G0R000X1HMD0
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Scope: metadata/source inspection only; no runtime admission or experiment

The [review](../../../2026-09-07-hidden-switch-compiled-runtime-readiness-review.md)
states the provenance distinction and pending graph obligations. The
[manifest](manifest.json) binds all thirteen retained evidence files.

- [Runtime identities](identities.json), [runtime report](dotnet-info.txt)
  and [installed version](installed-version.txt).
- [LLDB path](lldb-path.txt), [LLDB version](lldb-version.txt),
  [macOS version](sw-vers.txt) and [kernel/architecture](uname.txt).
- [Public tag response](runtime-tag.txt) and the installed-commit lookup's
  [HTTP status](runtimehandles-installed-commit-http.txt) and
  [response body](runtimehandles-installed-commit-response.txt).
- [Executed source-verification script](verify-public-source.py),
  [structured result](public-source-verification.json) and
  [output](public-source-verification.log).

The initial commands were `dotnet --info`, `xcrun --find lldb`,
`xcrun lldb --version`, file hashing, `git ls-remote` for the named public
tag and the displayed raw-source lookup. Their outputs are retained;
there is no claim of a retained original command script. The later
source-verification script is retained exactly as executed. It re-fetches
public source and reads metadata; it does not execute task logic.

The two public C++ source bodies are represented by exact URL/length/hash,
not bundled here. The public source tag and installed version report name
different commits. Neither these identities nor an installed debugger
establish code provenance, complete graph coverage or a runtime theorem.
