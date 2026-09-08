# Precision-gated experts source and synthetic-math evidence

Date: 2026-09-08 UTC
Operational status: research-grade
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X
Author: Vera, OpenAI Codex using GPT-6 Astra

Parent report:
[source audit and minimal factor-module design](../../2026-09-08-precision-gated-experts-design-and-source-audit.md).
The top-level [manifest](manifest.json) records each retained file's byte
length and SHA256. The manifest does not hash itself. These files contain
source text, repository metadata, small synthetic inputs/results and review
text; they contain no CSV, prediction, trained model or process-dump contents.

## Immutable source custody

`source-capture.json` maps the first fifteen source files plus the complete
GitHub tree response; `source-supplement.json` maps six further source/license/
configuration files. All URLs name upstream
`6c0a4832373b953dc6478aecb3ff1ec55934939d`.
`source-tree-check.json` independently recomputes each of the 21 source
files' Git blob SHA1 and matches it to the retained complete tree. This
binds source bytes to tree metadata, not to executed Julia dispatch.

The raw upstream MIT license is [source-16.txt](source-16.txt), copyright
2026-present BIASlab. It applies to the retained upstream software and
documentation snapshots. The original files are copied without rewriting.

| Record | Original upstream path |
| --- | --- |
| source-00.txt | README.md |
| source-01.txt | Project.toml |
| source-02.txt | src/ProbabilisticEnsembling.jl |
| source-03.txt | src/exp.jl |
| source-04.txt | src/log.jl |
| source-05.txt | src/low_rank_normal.jl |
| source-06.txt | src/low_rank_softdot/mean_field.jl |
| source-07.txt | src/model_zoo/dynamic/univariate.jl |
| source-08.txt | src/model_zoo/dynamic/pipeline.jl |
| source-09.txt | src/model_zoo/dynamic_exp/univariate.jl |
| source-10.txt | src/model_zoo/noisy_experts/univariate.jl |
| source-11.txt | src/model_zoo/shared_pipeline.jl |
| source-12.txt | src/model_zoo/model_specifier.jl |
| source-13.txt | src/model_zoo/features.jl |
| source-14.txt | src/utils.jl |
| source-15.txt | Complete repository-tree API response; metadata only |
| source-16.txt | License |
| source-17.txt | src/neural_ensemble/gating.jl |
| source-18.txt | src/neural_ensemble/neural_pipeline.jl |
| source-19.txt | src/neural_ensemble/neural_ensemble_specifier.jl |
| source-20.txt | sessions/dynamic/vae/dynamic_ETTh1_96.yaml |
| source-21.txt | sessions/neural_ensemble/neural_ensemble_ETTh1_96.yaml |

`zeta-source-pins.json` records Git blob IDs, SHA256 and lengths for the
three current local ports and the frozen architecture contract at
`5a5b909e04a4d543bc93e7f8f7213ae1b67fb294`. Their working-file bytes matched
the pinned blobs when checked. The review is retained verbatim in
`equation-review-at-e074.txt`, bound by `equation-review-pin.json` to
`e07496b870ffea15f7a24235edae7414bbcf8f1d`.

## Numerical commands and provenance distinction

The two `numeric-check-*.py.txt` files contain the exact finite Python
source from the earlier inline calls. The old visible tool outputs are
transcribed in `original-tool-observations.json`; those were not separately
saved stdout files. The original invocation was `python3` with that source
on standard input, from the native writer. Tool chunk IDs and exit results
are retained as conversation-derived observations, not invented raw files.

The preservation replay ran these commands from the writer repository root:

```sh
python3 docs/research/precision-gated-experts-audit/2026-09-08/preserve-checks.py.txt
python3 docs/research/precision-gated-experts-audit/2026-09-08/capture-source.py.txt
python3 docs/research/precision-gated-experts-audit/2026-09-08/capture-source-supplement.py.txt
```

`numerical-replay.json` retains the actual two child argv arrays, timestamps,
Python version/platform, exit codes and source/output hashes. Their actual
new stdout/stderr streams are `check-*-replay.*.txt`. Both child processes
exited zero with empty stderr, and both stdout byte strings matched the
earlier tool-text transcriptions. `python-executable.json` records a later
executable identity; it is not complete runtime or libm provenance.

These scripts are stored as research source text to reproduce the finite
checks. They are not installed Zeta modules, tests of the full learner, or
an invocation of the upstream Julia implementation. The quadrature uses
finite interval [-12,6], two Simpson grids and binary64 arithmetic without
certified tail/discretization/roundoff bounds. Agreement of the grids is
reported, never promoted to a rigorous integral certificate. The independent
review did not run or admit the author's numerical checks.

## Preservation limits

The documentation/evidence change passed all 16 executed quick preflight
checks, final targeted Markdown validation of the three changed Markdown
files, and `git diff --check`. Raw preflight and final Markdown output are
retained with exit metadata in `validation.json`. `verify-evidence.py.txt`
rechecks the complete manifest, all source/tree blob associations and both
numerical replay streams without rerunning arithmetic or making network
requests. This was a documentation-only preservation gate; no learner build
or training result is asserted.

The earlier collaborator's model-header observation had no retained original
bytes or precise path-level transcript. The report attributes that historical
claim and does not promote it to this archive's model evidence. The current
tree inventory contains only file paths, lengths and Git IDs. No model was
opened here to repair that evidence gap.

The source-download scripts are simple bounded research acquisition helpers,
not the earlier study's independently admitted storage protocol. A source
URL failure would stop acquisition; no study or training task is dispatched.
No runtime-closure, benchmark or data-access permission follows from this
archive. The linked report carries the signed research disposition.
