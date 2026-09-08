# Post-experiment publication hygiene: stable import grouping

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade validation record
Status: correction independently accepted; subsequent complete CI pending

PR 17051's first interpretability lane passed 2,286 tests, with one warning,
then refused seven import blocks in projection tests. CI runs Ruff from
`src/Interp.Python`; the earlier local checks ran from the repository root.
With no explicit first-party classification, these working directories treated
`zeta_interp` differently. The exact complete CI log and first unsuccessful
terminal-escape-protected retrieval are retained in the archive.

The correction adds only `known-first-party = ["zeta_interp"]` under the
project's Ruff isort configuration and one import-separating blank line to each
of the seven projection test files. No lint rule is disabled or newly selected.
The [exact changed identities](changed-identities.json) retain before/after
bytes and hashes. All seven Python syntax trees are identical, and removing
newline bytes makes each before/after pair identical. Parsing the project TOML
and removing the added Ruff table reproduces the original project configuration.
Dependencies, module code, numerical rules and native artifacts are unchanged.

Both root-cwd and package-cwd whole-lane Ruff checks now pass. Whole-lane format
checking passes; mypy reports no issues in 113 source files. The seven corrected
component test files pass all 340 cases in 6.95 seconds. Each command has its
actual argv, cwd, selected import root, timestamps, exit status and original
stdout/stderr. The first locally reproduced package-cwd refusal is retained.
The component suite exercised numerical routines, including reference roots
and interval operations, on its unit fixtures. The registered 40-ID/88-call
driver workload and native numerical producer were not rerun.

The [manifest](manifest.json) binds all 135 regular members of the
[custody archive](custody.tar.gz), verified without extraction. It includes
all 47 source-roster files before and after the correction, actual command
records, the correction helper, Ruff discovery diagnostics and CI retrievals.
The archive is 693,866 bytes, SHA256
`1313EA5CB4C6E2305985BB19778935C6887C12ABC0FABBFECB5AC8413FC6BF92`.
Thirty-nine roster files are byte-identical; only the project lint configuration
and seven test separators changed. The unused dependency lock stayed unchanged.

## Experiment identity remains historical

The [registered-1 record](../registered-1/README.md) remains bound to its original
manifest FE1F5BDF732FA6B08092887210552BA9CEF68D724E519C77958A282366A348E7 and
executed source 4937d7468, with source bytes archived at f33ac42959388344fc3c82058f165764954fa22d.
Its original source archive and invocation were not regenerated or reassigned
to this edited checkout. A historical-manifest invocation against the later
checkout should refuse the eight changed identities. Reproducing that exact
attempt requires its frozen sources and declared direct native artifacts;
a new source cut needs its own admitted manifest and separately named attempt.
The subsequent hygiene evidence supports unchanged production semantics, not
a claim that the original full gate or experiment ran these edited bytes.

The [independent hygiene review](../../../2026-09-08-projection-publication-hygiene-independent-review.md)
accepts the exact eight-file correction, retained first failures and corrected
unit-execution wording. The original numerical source and native-role bindings
remain unchanged in their historical archives.
