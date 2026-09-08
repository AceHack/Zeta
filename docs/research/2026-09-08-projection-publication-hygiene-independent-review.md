# Projection publication hygiene: independent qualification

Date: 2026-09-08 UTC
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade independent review addendum
Disposition: accepted with the corrected unit-execution description
Work item: 081M1Z63YMC087G0R003N5FH9X

This addendum accepts the bounded hygiene change
`809bc57bafe847d58e8387b9a4858c52300271f5` and its corrected explanation at
`3cfa22d9a9e904dfa64fb65664338745f55664eb`. It supplements the
[frozen registered-run review](2026-09-08-projection-registered-independent-review.md);
it does not reassign that experiment to the later checkout.

## Exact source and retained validation

The complete source diff is eight files: one explicit Ruff
`tool.ruff.lint.isort.known-first-party = ["zeta_interp"]` table, plus one
import-separating blank line in each of seven projection test files. Independent
AST comparison finds all seven Python syntax trees identical. Parsing TOML and
removing the sole added Ruff table exactly reproduces the previous configuration.
No dependency, solver, launcher, driver, native code or lint-rule selection was
edited. All 39 other manifest source rows remain byte-identical, and the five
declared direct native files still match their frozen identities.

All 135 regular members of the publication-hygiene archive match their declared
length/hash and complete original local bytes. Complete single-member gzip
framing and the exact member roster pass without extraction. The archive is
693,866 bytes, SHA256
`1313EA5CB4C6E2305985BB19778935C6887C12ABC0FABBFECB5AC8413FC6BF92`.
Its 47 before-snapshots equal the original manifest, source commit
`f33ac42959388344fc3c82058f165764954fa22d` and hygiene parent; all 47 after-snapshots
equal the hygiene commit and the inspected later files.

The complete 997,561-byte CI job log retains **2,286 passed, one warning**, then
seven I001 failures and job exit one. The initial local package-cwd reproduction
also retains seven errors and exit one. The initial unsuccessful log retrieval
retains its empty stdout and explicit terminal-escape refusal; the second raw
retrieval remains byte-exact, including escape sequences.

The later recorded root-cwd and package-cwd Ruff checks both exit zero.
Package format checking reports 114 files already formatted; mypy reports no
issues in 113 source files. The seven component test files report **340 passed
in 6.95 seconds**. Actual argv, cwd, selected import root, timestamps, exits and
stdout/stderr agree with these claims. These are existing validation observations;
this reviewer did not rerun lint, tests, numerical services or the registered run.

## Retained finding and correction

The original hygiene README asserted: "No solver, native numerical producer or
registered driver workload was rerun." The first clause was too broad. The
recorded component suite includes actual `reference_root` calls through its
test helper and interval exponential evaluation in
`test_default_noncenter_encloses_stationarity_without_zero_shortcut`.

The coordinator accepted this finding and corrected the statement at
`3cfa22d9a9e904dfa64fb65664338745f55664eb`: numerical routines were exercised on
unit fixtures; the registered 40-ID/88-call driver workload and native numerical
producer were not rerun. The original and corrected README bytes are retained
in the [review custody index](projection-hygiene-independent-review/2026-09-08/README.md).
The correction changes prose only. The source, original experiment archive,
implementation capsule and hygiene archive remain unchanged across that correction.

## Historical manifest boundary

Registered-1 remains bound to executed commit
`4937d7468446599e966adc65c0ca1e9be54472aa` and manifest SHA256
`FE1F5BDF732FA6B08092887210552BA9CEF68D724E519C77958A282366A348E7`.
That manifest describes the original eight file identities, so it must refuse
the later hygiene checkout. The original full-gate and numerical observations
are not evidence that the edited files were executed earlier. The amended
implementation, result and run documentation explicitly retains this distinction.

This acceptance concerns publication hygiene and accurate source attribution.
It adds no experiment, numerical success, runtime-closure claim or permission
for another registered invocation.

Signed: Vera, OpenAI Codex using GPT-6 Astra.
