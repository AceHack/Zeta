# Hidden-switch: final recovery and publication evidence review

Date: 2026-09-07
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Disposition: accepted within the recorded evidence scope

This independent read-only pass reviewed the final validation records and
publication text at root `1bf88fb2392164a76d6c70d3a05207d2aa5829d6`, then
verified their documentation-only integration at
`412e0185c92cb57afbaba0fa48cc5c24873b45a8`. The native gate's tested source
remains **`4d7b13947bef9b53a65c043885971ceefa168e87`**. These different
heads are not presented as one tested tree. No build, test, scientific
replay, experiment, guard computation or runtime modification was performed
by this reviewer; the completed study's released claim was not reopened.

No material finding remains within this pass:

- All seven [recovery TRX archives](hidden-switch-validation/2026-09-07/root-main-gate-attempt-2-result.json)
  match their retained compressed lengths/hashes and their losslessly
  decompressed originals. Independently parsing individual outcomes gives
  **7,568 Passed, six NotExecuted and no failures**, 7,574 total. All seven
  ResultSummary values are Completed. The six skipped cases are identified
  in the original TRX; summary counters do not replace individual outcomes.
- The 52 passing TLC model IDs equal the current gate-tier registry roster
  exactly, with no missing or duplicate ID. Eighteen other TLC
  synthetic/metadata cases and all sixteen hidden-switch cases passed.
  The BFT case completed in `00:04:38.0723168`. Its
  [live invocation/runtime snapshot](hidden-switch-validation/2026-09-07/root-main-attempt-2-bft-observation.json)
  matches its recorded hashes, selected runner DLL, runtime executable,
  registry, jar, two runner sources and all 89 copied input identities.
  It retains C1, one worker, no per-model timeout and the unchanged
  4,665,495-state expectation. The TRX supplies completion; the live
  snapshot alone does not. No TLC attempt directory remained at inspection.
- All 1,955 [selected native/build/TLC inputs](hidden-switch-validation/2026-09-07/root-main-gate-attempt-1.json)
  match both current bytes and committed `4d7b1394` blobs. All 81 selected
  test DLLs match the [recovery prelaunch fingerprints](hidden-switch-validation/2026-09-07/root-main-gate-attempt-2.json).
  The [completion record](hidden-switch-validation/2026-09-07/root-main-gate-attempt-2-completion.json)
  reports exit zero and no selected input or DLL changes. The current F#
  runtime configuration matches its retained crash-review copy.
- The mapped Release build records zero warnings/errors and
  `00:01:36.29` elapsed. Comparing the two recorded full-solution test
  commands finds only the TRX prefix change. The recovery remained
  `--no-build`; neither launcher introduces a GC/JVM/runtime-policy
  change. These selected source, command, configuration and binary checks
  do not prove complete process-environment equality, transitive dependency
  closure or correspondence between source and generated machine code.
- The [failed first-attempt inventory](hidden-switch-validation/2026-09-07/root-main-gate-attempt-1-result.json)
  and all seven first-attempt TRX archives remain byte-identical to the
  preceding independent review. Its F# summary remains Failed: 1,204
  passing individual F# outcomes and 990 other passes do not establish a
  complete suite. The original command exit 1 and test-host exit 139 remain
  distinct from the successful recovery. The report's bounded crash
  location, absent causal proof and local-only custody of raw process
  memory remain explicit; recovery does not erase or explain the failure.
- All nineteen scientific files match implementation archive
  `4fc82b611012bd2620a26e02afe6baba491fe553`. All eighteen original result
  records match their original lengths/hashes and committed result archive
  `900c0f57a51bfb79d7e9a7b8156ef367d97824f8`. The original study's source,
  criteria and emitted evidence therefore remain unchanged by this
  validation/publication work.
- All seven [descriptive-figure files](hidden-switch-results/2026-09-07/descriptive-figure/README.md)
  match original artifact commit `58a3999765766f117f6c6ab46dc436cb9a92397a`.
  Its manifest still binds the three original input receipts, plotting
  script, requirements and generated outputs. The previously inspected
  PNG is unchanged. The figure remains explicitly post hoc, retains all
  twenty chronological rows, and introduces no experiment or inference.

The recovery result index has SHA256
`8b9a63b5feb1bb90c75b8cd22eac4d1478999ec867121ead12d387c665963c5d`;
the completion record has SHA256
`63fb001ea1a3dc7fccc2e72f8f6beced06b66f9d56c8b606b55f6307b1b0f5ee`.
The [prior-head CI review](hidden-switch-validation/2026-09-07/pr-16928-a2bf4225-review/README.md)
remains separately scoped to `a2bf4225`, including its failed advisory.
Current publication-head CI, review state and eventual main ancestry
require their own subsequent verification; this acceptance does not
certify them in advance.

Signed: Vera, OpenAI Codex using GPT-6 Astra, independent reviewer.
