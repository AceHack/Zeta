# Hidden-switch publication integration: independent review

Date: 2026-09-07
Operational status: research-grade
Lifecycle: active
Work item: 081M1XK02XM087G0R00043EW05
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, independent protocol-review agent
Disposition: accepted within the recorded integration scope

This final read-only pass examined root commit
`b3b120a8f5dfcd885fc48dc223554cf2f73e3988` and its pending validation-index
and continuation-handoff additions. It extends the completed study's
publication review; it creates no claim, reopens no released claim and
adds no scientific work. The [earlier scientific review](2026-09-07-hidden-switch-result-review.md)
remains separately scoped. No tests, builds, model checks, replay or
scientific measurements were rerun by this reviewer.

No material factual, mixed-source or scope finding remained:

- Commit `15579ffb556f45235729a9f44175f22b44b1b61a` retains the original
  publication failures and public-roster review. The
  [initial check snapshot](hidden-switch-validation/2026-09-07/root-ci-initial-checks.json)
  reconciles to 86 successes, four skips and six failures at
  `f52b00065eb8055a32aea4bd93628df7537f4949`. All six failed-job logs match
  their compressed and decompressed byte lengths/hashes. The two TypeScript
  findings, corresponding hermetic failures, macOS fixture failure,
  aggregate failure and historical drift advisory remain failed and
  distinguished. The pinned workflow marks macOS nonblocking; that does
  not turn its failure into a pass.
- The CodeQL disposition correctly identifies a test consumer of
  `ref.PANELS`, while production replay retains its separately authored
  roster. The targeted test's source and log hashes match the unchanged
  original publication head. This pass did not execute that test again.
- Root merge `76d2a5826822a54bb11cc38d33eb1a50ef44f074` preserves the
  reviewed tooling corrections through source-owner integration
  `4b4d9a237b23e53a4b297af72eb2053f3c51c8b6`. The independently checked
  owner's full gate remains its own 7,539 passes and six skips, including
  all 52 gate-tier model cases and eighteen other runner cases. The older
  root gate's 7,552 passes is a different recorded execution.
- All 103 selected [root prelaunch input hashes](hidden-switch-validation/2026-09-07/root-publication-integration-attempt-1.json)
  match current files and committed `b3b120a8f`. Comparison with the owner's
  source gives exactly one differing file: the six additional hidden-switch
  source/test Compile entries in `Tests.FSharp.fsproj`. The retained diff
  matches that actual comparison. This is selected-input correspondence,
  not whole-tree identity or a complete dependency proof.
- The fresh mapped F# test-project build log reports zero warnings/errors
  and 77.86 seconds. Its two execution logs, compressed TRX and losslessly
  decompressed original match the [integration result inventory](hidden-switch-validation/2026-09-07/root-publication-integration-results.json).
  Parsing individual TRX rows gives sixteen passing `HiddenSwitchTests`
  and no other outcomes. Root's full formal catalog was not rerun, and no
  new combined full-suite count is inferred. The completed quick log also
  records all sixteen checks passing.
- All nineteen scientific files match implementation archive
  `4fc82b611012bd2620a26e02afe6baba491fe553`; all eighteen original
  [result-manifest records](hidden-switch-results/2026-09-07/records-manifest.json)
  match their original hashes, lengths and `f52b00065` committed bytes.
  Later build artifacts are not substituted into the original measured
  receipts or presented as binaries used by that earlier run.
- The [continuation handoff](../handoffs/2026-09-06-vera-unattended-research-continuation.md)
  distinguishes the pending old-study publication from new task
  `081M1XXWTTF087G0R000X1HMD0`. Its registration tag's live object
  `52cfa5665c2e21cdfc2be6a08b4b159c1048bb04` and peeled commit
  `8710ae4f4e37b727ccc8bb79e212a7bed433bbd0` match. The linked protocol in
  that archived tree is 43,162 bytes with SHA256
  `8bbdfe44a0844dd8ce4f6c5dd77b060a56e5b84ea94ea7a6fdbb482aec9d738a`.
  Its prior-study main prerequisite, separate certificate/runtime admission
  and both ordinary-panel half-cost conditions are retained. Model
  identification remains unregistered; no learning result is implied.

The root integration result inventory reviewed here has SHA256
`dd3baafac8d2ebdc8e40573e01afa7a723ca0a23399128fa74637179f9b2359a`.
This attributed record preserves a read-only source/hash/log/XML audit,
not a new execution of the scientific methods. Corrected tooling PR #16925
main integration, final publication-head CI and ancestry remain subsequent
publication requirements; this review does not certify their completion.

Signed: Vera, OpenAI Codex using GPT-6 Astra, independent reviewer.
