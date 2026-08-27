#!/usr/bin/env bun
// cross-verify-roster.ts — the `cross-verify` floor, one named check-run per audit.
//
// ── THE DEFECT THIS SPLITS ────────────────────────────────────────────────────────
//
// `cross-verify (trust-core oracles + ace suite)` ran 31 distinct audits under ONE
// check name. When it went red it named none of them: the checks list said
// `cross-verify` failed, and finding out WHICH audit convicted meant opening the job
// log and scrolling 35 steps. Measured 2026-08-26: a red here was one audit
// (`task-zetaid-resolves`) convicting on a work-item filed under `docs/backlog/P1/`
// while that audit indexes only `workitems/` — a false positive that held the entire
// floor closed and looked, from the outside, like the byte-lock oracles had broken.
//
// One red standing for 31 audits is the same defect class as a log that does not name
// its failing step, relocated into the gate's structure. It is also a blast-radius
// problem: a false positive in ANY of the 31 blocks all 31, so the cheapest audit on
// the floor can hold the most expensive one hostage.
//
// Aaron, 2026-08-26: *"if it's a shared gate we want to reduce those to smaller
// individual ones rather than widening one that's monolithic already, we are trying to
// split our monolith bit by bit."*
//
// ── WHY THIS FILE EXISTS RATHER THAN 31 YAML STEPS ────────────────────────────────
//
// The split is a matrix leg per audit, and a matrix needs a roster. A roster that is
// hand-written in one place and consumed in another diverges the moment somebody adds
// an audit — that exact defect shipped twice in this repo (`audit-dep-currency.ts`'s
// single hardcoded path hid a root flake for months; the proof-lineage binary audit's
// allowlist drifted from its runner).
//
// The first version of this file answered that with TWO hand-maintained lists and a
// parity check between them. That was the wrong answer, and Aaron named it while
// reviewing the first change that had to edit both (#15666): *"this design seems a bit
// flakey, are we going to be fixing this all the time, can we automate this fix … or
// redesign this so it's different and less brittle?"* Automating the repair of two
// hand-maintained lists keeps the brittleness and adds machinery to it. Two lists that
// must agree IS the defect.
//
// So there is now ONE list — the entries below — and `gate.yml`'s matrix is a GENERATED
// REGION emitted from it (`--derive [--write]`, the shape `ace/build-graph.ts` already
// uses). The same command is the check and the fix, so the two cannot disagree with each
// other; adding or removing an audit is a roster edit plus one command. Every leg runs
// `--derive` before its own audit, so a hand-edit inside the generated region survives at
// most one CI run.
//
// A DYNAMIC matrix (`fromJSON` of a roster job's output) would have removed the second
// file entirely, and it is still rejected on purpose: the leg names would then not exist
// until a roster job succeeded, so a hiccup in that job produces ZERO legs — and once
// any of these names is promoted into `required_status_checks`, a required context that
// never reports does not fail the PR, it WEDGES it, silently and forever. A static
// matrix cannot do that. The names are also greppable in `gate.yml`, which is what the
// ruleset promotion and the merge-queue coverage lint both need. Generation is what
// makes a static list affordable: it is static in the workflow and derived at edit time,
// which is the combination that has neither failure mode.
//
// ── WHAT IS DELIBERATELY UNCHANGED ────────────────────────────────────────────────
//
// The aggregate verdict, and it is preserved by SHAPE rather than by a new mechanism.
// `gate-required.needs:` still names `cross-verify` and is byte-identical, because the
// matrix job keeps that id — GitHub collapses a matrix into one `needs.<job>.result`
// that is `success` only when every leg succeeded. A decomposition that quietly made 31
// audits non-blocking would be a silent floor removal, the worst available outcome and
// an easy one to reach by accident, so `cross-verify-roster.test.ts` §"the floor is not
// weakened" runs `gate-skip-verdict.ts`'s real logic against the real gate.yml for every
// result GitHub can produce.
//
// Nothing here promotes any name into `required_status_checks`. That is a ruleset edit
// and a gated-class call; the strings this file produces are listed in
// `docs/ci/CROSS-VERIFY-CHECK-NAMES.md` for whoever makes it.
//
// ── USAGE ─────────────────────────────────────────────────────────────────────────
//
//   bun cross-verify-roster.ts --list            # ids, one per line
//   bun cross-verify-roster.ts --json            # the roster as JSON
//   bun cross-verify-roster.ts --derive          # gate.yml matches the roster? exit 1 on drift
//   bun cross-verify-roster.ts --derive --write  # ...and this is the fix for that exit 1
//   bun cross-verify-roster.ts --run <id>        # --derive, then that one audit
//
// `--run` is what every matrix leg invokes. It takes the id from `$1` rather than
// interpolating `${{ matrix.audit }}` into a `run:` block, so the split adds no
// template-injection surface.

import { readFileSync, writeFileSync } from "node:fs";

/** One audit: one matrix leg, one check-run named `cross-verify (<id>)`. */
export interface CrossVerifyAudit {
  /**
   * The check-name suffix, and the matrix value in `gate.yml`. STABLE — a ruleset may
   * come to reference `cross-verify (<id>)`, and renaming one then silently drops a
   * required context. Kebab-case, no spaces, no parentheses.
   */
  readonly id: string;
  /** The sentence the step used to carry. Printed by the leg; not part of the check name. */
  readonly title: string;
  /** Run under `bash -euo pipefail -c`, from the repo root unless `cwd` says otherwise. */
  readonly command: string;
  /** Relative to the repo root. */
  readonly cwd?: string;
  /**
   * Restrict the audit to these `github.event_name` values. Absent means every event.
   * A leg whose event does not match reports NOT APPLICABLE and exits 0 — the same
   * outcome the step-level `if:` produced before the split, said out loud instead of
   * rendered as a silently grey step.
   */
  readonly events?: readonly string[];
}

/**
 * The roster — the single source of truth for the `cross-verify` legs.
 *
 * Order here is the order `gate.yml`'s matrix declares and the order the checks list
 * renders, because the matrix is generated from this array in this order. It is grouped
 * rather than sorted on purpose (see `renderMatrixRegion`). Each entry carries, verbatim,
 * the comment the step it replaced carried —
 * that prose is the only record of why several of these audits sit on the floor at all,
 * and moving the step without moving the reason would have been the expensive half of
 * this change.
 */
export const CROSS_VERIFY_AUDITS: readonly CrossVerifyAudit[] = [
  {
    id: "ace-suite",
    title: "Ace package-manager suite",
    command: "bun test src/Core.TypeScript/ace/",
  },

  {
    id: "qsharp-oracles",
    title: "Q# source-owned reference oracles",
    command: [
      "bun test \\",
      "  src/Core.QSharp.ReferenceOracle/qsharp-golden.test.ts \\",
      "  src/Core.QSharp.ReferenceOracle/quantum-circuit.test.ts \\",
      "  src/Core.QSharp.ReferenceOracle/dbsp-operators.test.ts \\",
      "  src/Core.QSharp.ReferenceOracle/heat-signals.test.ts",
    ].join("\n"),
  },

  {
    id: "byte-lock-oracles",
    title: "Cross-language byte-lock + golden-vector oracles",
    command: "bun src/Core.TypeScript/ci/cross-verify-all.ts",
  },

  // The `.claude/rules/no-binary-in-proof-lineage.md` exception, enforced rather than
  // asserted. `src/wasm-dla/bytelock/` holds six committed `.wasm` substrate modules; they
  // are the artifact UNDER TEST, not golden vectors, and the rule now says so — but a
  // documented exception with no scope is a licence. This derives the allowed set from the
  // byte-lock runner's own roster and the build script's own declared outputs, so a new
  // binary in that directory is red until it is wired into both.
  //
  // Two of its checks are here rather than in `bytelock.yml` on purpose. That workflow is
  // `push: main` — POST-MERGE by construction — so the malformed-artefact guard that would
  // have caught `dla-canonical-zig.wasm` shipping as an `ar` archive could only ever fire
  // after the fact, and it did, for two weeks. The header check and the golden-vector text
  // check need no toolchain, so they belong on the pre-merge floor.
  {
    id: "proof-lineage-binaries",
    title: "Proof-lineage binary exception (no-binary-in-proof-lineage.md)",
    command: "bun src/Core.TypeScript/hygiene/audit-proof-lineage-binaries.ts",
  },

  // Stage-0 minimization ratchet (081M0X2553J087G0R001VH0K64). `mise` installs `bun`, so
  // whatever installs `mise` cannot be written in `bun` — stage-0 shell is ESSENTIAL and
  // this check never argues with it. What it prices is the number of DOORS: shell files
  // that something outside the shell graph has to name. Internal helpers cost zero, so the
  // metric creates no pressure to merge scripts that split for a bootstrap-ordering reason.
  //
  // It is HERE and not in `lint (bash retirement inventory ...)` deliberately. That job is
  // not in `gate-required.needs`, so everything it runs blocks nothing — the existing shell
  // allowlist has been advisory the whole time it has been read as a guard. A ratchet that
  // cannot fail a merge is a number, not a ratchet, so it goes on the floor.
  {
    id: "stage0-independence",
    title: "Stage-0 independence ratchet (doors, not file count)",
    command: "bun run hygiene:stage0-independence",
  },

  // THE VACUITY CLASS, INVERTED — a step that can never SUCCEED.
  //
  // `${{ steps.X.outputs.Y }}` with no writer interpolates to the empty string silently.
  // A step guarding on that value fails every run forever, and its error names the
  // PRODUCER, so the fault reads as a defect in that step. Live instance the day this
  // landed: `agent-heartbeat.yml`'s flush returned success on two paths without declaring
  // `skip`, so every backpressured tick — a HEALTHY outcome — reported as a broken flush.
  // Three agents diagnosed it as an auto-merge token-scope fault; that call was never
  // reached. The second of the two paths was found by this check, not by hand.
  {
    id: "step-output-writers",
    title: "Step outputs have writers (a step that cannot succeed)",
    command: "bun src/Core.TypeScript/hygiene/audit-workflow-step-output-has-writer.ts",
  },

  // A REAL SHA THAT NOBODY CHOSE.
  //
  // Every third-party action is pinned to a SHA, which reads as supply-chain discipline
  // until you ask who checked the SHA. A 40-hex string is indistinguishable from a
  // fabricated one by shape, and two sites can pin one action at two SHAs indefinitely
  // while every review of either looks clean. Both happened here on 2026-08-25: an agent
  // nearly shipped an invented SHA for an action this repo does not use, and
  // `ruleset-apply.yml` landed `actions/upload-artifact` at a SHA a YEAR older than the
  // ten other sites. The roster makes the pin a value someone committed, not remembered.
  {
    id: "action-sha-roster",
    title: "Third-party actions match the SHA roster (AH007)",
    command: "bun src/Core.TypeScript/hygiene/audit-action-sha-roster.ts",
  },

  // A TASK ID THAT IS WELL-FORMED AND IDENTIFIES NOTHING.
  //
  // The AgencySignature gate validates `Task:` for placeholder-ness and SHAPE, never
  // existence — so an invented-but-well-formed ZetaId passes silently, and it is harder
  // to spot than a placeholder because it looks exactly right. The legacy `B-NNNN`
  // scheme has had this guard since `b-ref-resolve.ts`; the ZetaId scheme that REPLACED
  // it never got one, so the newer mandatory key was the less-checked one.
  //
  // Live instance the day this landed: `Task: 081M0X0JQGY087G0R000EBCPQ3`, written by
  // hand instead of minted, caught only because its author re-read his own trailer.
  // WORKFLOW CONDITION CARRIED OVER VERBATIM: `if: github.event_name == 'pull_request'` — now `events` below.
  {
    id: "task-zetaid-resolves",
    title: "Task ZetaIds resolve to work-items (AH006)",
    command: "printf '%s' \"$PR_BODY\" | bun src/Core.TypeScript/hygiene/audit-task-zetaid-resolves.ts --stdin",
    events: ["pull_request"],
  },

  // THE FALSIFIER FOR CREDENTIAL-ROLE COLLAPSE (AH003, 2026-08-25).
  //
  // `docs/security/2026-08-17-society-heartbeat-token-boundary-and-gate-start-failure.md`
  // names THREE credential roles with three secrets: dispatch, branch-push, PR-create. A
  // `${{ secrets.A || secrets.B || secrets.GITHUB_TOKEN }}` expression erases that table at
  // the point of use -- `||` selects on the left secret being EMPTY, so an absent scoped
  // credential is silently replaced by one with DIFFERENT authority and the step then fails
  // somewhere downstream naming the wrong subject. 25 such chains across 12 workflows had
  // accumulated behind per-step comments that described the ladder as the SAFE half.
  //
  // It is the SILENT selection this refuses, never the degradation itself: a probe + an
  // explicit `::warning` naming the secret and scope inside a `run:` block is good design
  // and is untouched (agent-heartbeat.yml keeps three of them).
  //
  // Distinct from `audit-workflow-write-token-consistency.ts` above, which asks whether a
  // forge-write step reaches A PAT. This asks whether it reaches THE RIGHT ONE, and only
  // that one. A step can satisfy that audit and still be a role collapse -- all 25 sites
  // did, which is why one check does not subsume the other.
  //
  // Offline (reads only committed workflow text, no sockets), so it belongs on the
  // pre-merge floor rather than post-merge.
  {
    id: "credential-role-separation",
    title: "Workflow credential role separation (one role, one secret)",
    command: "bun src/Core.TypeScript/hygiene/audit-workflow-credential-role-separation.ts",
  },

  // AH005 — a committed identity that GitHub resolves to somebody who is not us.
  //
  // `<username>@users.noreply.github.com` is the LEGACY plain noreply form and GitHub
  // resolves it DIRECTLY to whoever owns that username today. Two of our personas
  // shipped under it (15 commits and 2 commits), and both local-parts are live accounts
  // belonging to uninvolved private individuals. They are rendered in this repository's
  // Contributors sidebar, which aggregates trailer co-authors — note the REST
  // `/contributors` endpoint does NOT, which is why an earlier check of that endpoint
  // came back clean and under-reported the problem.
  //
  // The audit scans the SOURCES THAT GENERATE identities, never git history. The
  // offending commits are on `main` and correcting them would mean force-pushing the
  // default branch, so they stay. An audit pointed at history would be permanently red
  // over commits nobody may fix, and a check that can never go green gets disabled.
  //
  // HERE on the cross-verify floor because it is offline (reads only committed text, no
  // sockets, no DNS — the fabricated-namespace list is a closed enumeration rather than
  // a resolver for exactly that reason). Measured: ~1.4 s warm over 2,028 generator
  // files. Proven able to fail before it was wired: run against the pre-fix contents of
  // the same seven files it reports 7 findings and exits 1.
  {
    id: "coauthor-identity-collision",
    title: "Co-author identity collision (AH005 — plain-username GitHub noreply form)",
    command: "bun src/Core.TypeScript/hygiene/audit-coauthor-identity-collides.ts",
  },

  // THE FALSIFIER FOR THE PR-ARCHIVE COVERAGE COLLAPSE (2026-08-25).
  //
  // `agent-heartbeat.yml`'s auto-merge steps hardcoded `secrets.GITHUB_TOKEN` while every
  // other credentialed step in that file used the PAT fallback chain. A merge armed with
  // GITHUB_TOKEN lands as `github-actions[bot]`; GitHub suppresses workflow triggers for
  // GITHUB_TOKEN-driven events, so `pull_request: closed` never fires and
  // pr-archive-on-merge.yml never runs — with NO failure anywhere, which is why it was
  // misdiagnosed as a credential problem several times. Measured 2026-08-21..25: 747 of
  // 765 (97.6%) eligible unarchived PRs were bot-merged; 530 of 539 (98.3%) archived ones
  // were user-merged.
  //
  // The defect is the INCONSISTENCY, not the instance — one step out of nine disagreeing
  // with its neighbours, which prose cannot hold. Offline (reads only committed workflow
  // text, no sockets), so it belongs on the pre-merge floor rather than post-merge.
  {
    id: "write-token-consistency",
    title: "Workflow write-token consistency (forge writes must reach the PAT)",
    command: "bun src/Core.TypeScript/hygiene/audit-workflow-write-token-consistency.ts",
  },

  // The falsifier for the PR-free heartbeat lane. Design:
  // docs/research/2026-08-25-pr-free-heartbeat-lane-attestation-instead-of-gate.md
  //
  // The lane's proposal is that a bypass actor on ruleset `CI Gate` (16134995) pushes
  // telemetry straight to `main`, skipping `gate (required)`, and that the lane verifies
  // ITSELF. A bypass actor is a permanent hole, so that self-verification has to be a
  // checkable fact rather than a claim -- this is the check. For every commit the lane
  // produced it requires a content-bound attestation (`Verification-Subject` is the
  // commit's own tree sha, so a COPIED attestation fails), a path allowlist, and a
  // change-mode check in which `append-only` means the pre-image is a byte PREFIX of the
  // post-image -- NOT `deletions == 0`, which `docs/github/prs/manifest.jsonl` satisfies
  // 13 times in 40 while inserting its rows in sorted order.
  //
  // HERE on the cross-verify floor because it is offline (no sockets, reads only committed
  // git objects) and because a bypass-lane guard must run on exactly the lane a path filter
  // would exclude. Collection is two-phase for CORRECTNESS, not speed: this job checks out
  // at fetch-depth 1, where the tip has no parent, so `git show --name-status` would report
  // the entire 45k-file tree as added and `<sha>^` would not resolve. Metadata alone decides
  // NOT-LANE, so a commit the audit does not judge never enters that path -- and where the
  // parent genuinely is unreachable it exits 2 rather than reading a missing object as a
  // violation. Measured on a full clone: 6.9 s for a 300-commit metadata-only window.
  //
  // HONEST STATE, so nobody quotes a green run as evidence: `cutoverIso` in the registry
  // is 2099-01-01 and the lane identity does not exist yet, so TODAY this returns clean
  // over 300 commits with all 300 classified NOT-LANE -- armed, and vacuous until step 4
  // of the design doc's section 12. It was proven able to fail against real history
  // first: with the cutover moved back and the current flush identity registered it
  // reports 290 violations of 300. The unit tests below are what keep it non-vacuous in
  // the meantime.
  {
    id: "heartbeat-lane-attestations",
    title: "PR-free heartbeat lane attestations (armed; vacuous until the lane exists)",
    command: "bun src/Core.TypeScript/hygiene/audit-heartbeat-lane-attestations.ts --max 300",
  },

  {
    id: "heartbeat-lane-audit-tests",
    title: "Heartbeat-lane audit unit tests (a check that cannot fail is not a check)",
    command: "bun test src/Core.TypeScript/hygiene/audit-heartbeat-lane-attestations.test.ts",
  },

  // Two commit-back-lane audits, both of which existed as code and NEITHER of which any
  // workflow invoked. `audit-push-without-rebase.ts` (AH001) shipped 2026-08-10 with a
  // named live instance and zero callers — the guard against a lane erasing its own
  // commit had never once executed in CI. An audit nothing runs is the vacuity class in
  // its purest form: it reads as protection and constrains nothing, which is exactly the
  // property both of these audits exist to refuse in other people's code.
  //
  // AH002 is the newer half. The `[skip ci]` refusal already lived inside
  // `flush-via-staging.ts`, where it protects every lane that ALREADY adopted the safe
  // route and is invisible to every lane that did not — so `lockfile-healer` pushed a
  // skip-token commit at `main` for eleven days while reporting 40/40 green, because its
  // `Commit and push` step is gated on drift being detected and no drift occurred. The
  // load-bearing path had never run under ruleset "CI Gate".
  {
    id: "push-without-rebase",
    title: "Commit-back lane can re-express its work (AH001)",
    command: "bun src/Core.TypeScript/hygiene/audit-push-without-rebase.ts",
  },

  {
    id: "skip-token-cannot-land",
    title: "Commit-back lane can actually land (AH002)",
    command: "bun src/Core.TypeScript/hygiene/audit-skip-token-cannot-land.ts",
  },

  // AH003 — the archive lane's record actually reached `main` — USED TO BE AN ENTRY HERE.
  // It now runs in `.github/workflows/archive-strand-alarm.yml`, and this note is the
  // record of why, because the reasoning it replaces was good and is still true.
  //
  // WHAT IT IS, UNCHANGED. `audit-orphaned-archive-refs.ts` takes REFS as input and asks
  // the only question that is the point: is the record ON MAIN? Its sibling
  // `audit-archive-pr-lane.ts` takes `gh pr list` as input and is structurally blind to a
  // ref that never had a PR at all — which is what 1,290 `automation/pr-archive-*` refs
  // were. The audit is real, valuable, and still fatal where it now lives.
  //
  // WHY IT CANNOT BE FATAL *HERE*. Its verdict is a repo-wide, time-varying number read
  // from `git ls-remote` against the live remote. On 2026-08-25 it blocked PR #15308 — a
  // vectorisation change adding only new files — because FOUR REFS WERE STRANDED
  // REPO-WIDE. That PR re-ran green with zero code change. And the blocking placement was
  // not buying enforcement: the only remedy available to that author was "press re-run
  // until it passes", the exact reflex that lets a genuine red be clicked away. A check
  // that clears itself on re-run is already flake.
  //
  // This is not a new policy. `registry/uncompensatable-floor.yaml` already says the floor
  // "never blocks on pre-existing whole-repo drift (Vera review, #9601 P1)", and `gate.yml`
  // already states the principle for a neighbouring case in its own words — the ArgoCD
  // chart check is OFFLINE against a committed snapshot, "which is the only reason a
  // resolvability check survives past its first outage." AH003 was never admitted to that
  // registry; it arrived as an extra step inside a floor job and became a leg in the split.
  //
  // NOT DEMOTED TO A TOLERATED WARNING. The comment this replaces was right that "a lane
  // that leaked because one failure was tolerated does not get its falsifier installed as
  // another tolerated failure". The alarm workflow FAILS on the audit's own exit code and
  // raises a deduplicated tracking issue — the two-surface pattern heartbeat-liveness.yml
  // uses. What blocks a PR here instead is the audit's OWN falsifiers
  // (`audit-orphaned-archive-refs.test.ts`), which run offline and deterministically in
  // `test-typescript-hermetic` on every PR, so the tool cannot regress unnoticed.
  //
  // The guard against this recurring is `src/Core.TypeScript/ci/floor-live-remote-queries.ts`,
  // whose falsifier runs in the same hermetic suite: it derives `gate-required`'s closure
  // and refuses any live POPULATION query (ls-remote / `gh pr list` / `gh run list`) inside
  // it. It resolves THROUGH this file — the split put a dispatcher between `gate.yml` and
  // the audits, and a one-hop guard would see nothing.

  // The .NET SDK version is declared in TWO files and, until 2026-08-23, nothing checked
  // that they agreed: `global.json` carried `rollForward: latestPatch` (which reads like
  // automatic security uptake and is not — it only selects among ALREADY-INSTALLED SDKs)
  // while `.mise.toml`, the file that actually acquires the SDK, pinned it exactly. A
  // reader of one believed a property only the other could grant. `.mise.toml` is now the
  // single declared source and `global.json` a checked restatement, so the two can no
  // longer disagree silently. Text-only and offline — it runs where no SDK is installed,
  // unlike its runtime sibling `audit-codeanalysis-sdk-match.ts`, which reads the SDK's
  // own `csc -version` in the build job.
  {
    id: "dotnet-pin-parity",
    title: ".NET SDK pin declared once (.mise.toml canonical, global.json restates)",
    command: "bun src/Core.TypeScript/hygiene/audit-dotnet-pin-parity.ts",
  },

  // The `.mise.toml` pins that OTHER files silently depend on. Two couplings, both of
  // which fail by being quiet: a stale `~/.rustup/toolchains/<v>-*` cache glob degrades
  // the offline path to a CDN fetch, a stale `.mise.full.toml` gives full-tier hosts a
  // different compiler from slim ones, and a zig bump leaves the COMMITTED byte-lock
  // `.wasm` unchanged — so the byte-lock still passes while the artifact stops being
  // reproducible from the pinned toolchain. Neither is reachable by a Dependabot
  // `ignore:`: `.mise.toml` is a manifest of no supported ecosystem, so an `ignore:`
  // naming them would suppress nothing while reading as protection. The site list is
  // discovered from the operative surfaces, so a new workflow with a stale glob is
  // caught the day it lands.
  {
    id: "mise-toolchain-couplings",
    title: "mise toolchain couplings (rust restatements · zig byte-lock provenance)",
    command: "bun src/Core.TypeScript/hygiene/audit-mise-toolchain-couplings.ts",
  },

  // Every zflash host arm must reach the ISO integrity gate before it writes to a block
  // device. Measured on main 2026-08-21: the manifest check existed in the macOS arm and
  // NOWHERE ELSE, so flash-usb-linux.ts and flash-usb-windows.ts wrote an image with no
  // integrity verification at all (081M0HG7X7B087G0R002A05DAP). A missing check is
  // invisible to a test suite — the arms that have one stay green, and the arms that lack
  // one have nothing to test — so only something that reads the call sites can see it.
  //
  // HERE rather than in build-ai-cluster-iso.yml on purpose, and this is the placement
  // that workflow's own note asked for. The ISO lane runs on a subset of pushes, and when
  // this step lived there and referenced a script that did not exist it silently killed
  // ISO production for every run (#13102). On the cross-verify floor it blocks every PR,
  // beside the other audits whose subject is "a check that did not run must never look
  // like a check that passed".
  {
    id: "flash-entrypoint-parity",
    title: "zflash host-arm parity (every arm verifies the ISO before writing)",
    command: "bun src/Core.TypeScript/hygiene/audit-flash-entrypoint-parity.ts",
  },

  // Every ArgoCD `targetRevision` must name a chart version upstream actually published.
  // Measured on main 2026-08-20: applications/oz pins ziti-controller at 1.4.5, a version
  // OpenZiti never shipped (their 1.x line ends at 1.3.4), so that Application can never
  // sync — invisible because `oz` is one of 26 of 45 Applications no CI lane exercises, so
  // nothing ever asked the registry for the chart (081M0JVD5YG087G0R002QDFR9H, #13313).
  //
  // OFFLINE. It resolves every coordinate against the checked-in snapshot
  // `published-chart-versions.json` and opens no socket, so this step cannot redden a PR
  // because a third-party registry is down — which is the only reason a resolvability
  // check survives past its first outage. The network half is `--refresh`, and it runs on
  // a schedule in chart-version-refresh.yml where it is allowed to fail loudly.
  {
    id: "chart-target-revisions",
    title: "ArgoCD chart targetRevisions resolve (offline, against the committed snapshot)",
    command: "bun src/Core.TypeScript/hygiene/audit-chart-target-revisions.ts",
  },

  // NO MANIFEST IN THE PUBLIC TREE MAY REFERENCE AN IMAGE NOBODY OUTSIDE CAN PULL.
  // `applications/platform/blueprints-flowdent.yaml` shipped here for months naming
  // ghcr.io/flowdent/cloudservice and ghcr.io/flowdent/fd-webclient -- images out of
  // Flowdent/fd-core (private) and Flowdent/fd-webclient (internal), in an org with
  // public_repos: 0. An agent wrote to the wrong repository in a multi-repo setup and
  // nothing caught it; it took months and a partitioner that could not MEASURE the images
  // to surface it, and a human to remove it (#14250). This is that accident as a red check.
  //
  // Aaron 2026-08-23: "zeta should not have any private repo dependencies." The invariant is
  // ONE-WAY: Flowdent (closed) may depend on Zeta (open); Zeta may never depend on Flowdent.
  //
  // HERE, on the floor that runs on EVERY PR, rather than in k8s-lane-partition.yml: that
  // workflow's path filter watches full-ai-cluster/k8s only, and this check's scope is every
  // tracked YAML outside docs/references/.github -- infra/k8s, agentic-organization/deploy,
  // samples/, and whatever directory the next multi-repo accident lands in. A path filter is
  // exactly the wrong shape for a check whose whole job is to notice a manifest somewhere
  // nobody declared.
  //
  // OFFLINE. It resolves every reference against the committed measurement
  // `full-ai-cluster/k8s/image-source-provenance.json` and opens no socket; the network half
  // is `--refresh` and it runs weekly in chart-version-refresh.yml. MEASURED 2026-08-23:
  // 0.43s, 49 files parsed of 209 scanned.
  {
    id: "image-source-provenance",
    title: "No private-source image dependencies (offline, against the committed provenance)",
    command: "bun src/Core.TypeScript/cluster/image-source-provenance.ts",
  },

  // The check above is only worth its slot if it can go red. The suite reconstructs the two
  // FlowDent Blueprints in a throwaway git tree and asserts they are refused with the REMOVE
  // remedy, asserts bitnami/weaviate/ich777/postgres/kubevirt are NOT tripped, and asserts an
  // unresolvable package with no source label is refused rather than admitted. 35 cases;
  // 16 targeted mutants applied and byte-`cmp` verified before reading each result -- 15
  // landed and were all killed, and the 16th reported PATTERN NOT FOUND rather than a
  // result, which is the discipline working.
  {
    id: "image-source-provenance-tests",
    title: "Private-source image dependencies — falsifiers (proves it goes red)",
    command: "bun test src/Core.TypeScript/cluster/image-source-provenance.test.ts",
  },

  // ARE THE DEFERRAL REASONS STILL TRUE? Every reasoned-exclusion registry in the cluster
  // tree was audited for a reason being PRESENT and naming a lift condition, and by nothing
  // for the reason being TRUE. Measured twice on 2026-08-21: `temporal`'s reason cited a
  // baseline acknowledgement that had been deleted forty minutes earlier (#13472 -> #13483),
  // and `oz`'s cited a chart pin the tree had already corrected (#13313 -> #13471). Both
  // audits stayed green through both, because a false sentence with a `LIFTS WHEN:` clause
  // has every mechanical property those checks look for.
  //
  // HERE rather than in k8s-argocd-health-test.yml, and the placement is the point: this
  // checker resolves citations into `.github/workflows/` (a CI job a reason names) and into
  // the chart roster, so a PR that renames a job would never trigger a path-filtered cluster
  // workflow and would silently strand the reason that cites it. The cross-verify floor runs
  // on every PR. OFFLINE, ~1s, no sockets -- it reads the committed baseline, the committed
  // render snapshot and the committed roster.
  {
    id: "reason-truth",
    title: "ArgoCD deferral reasons — every cited anchor still holds (offline)",
    command: "bun src/Core.TypeScript/cluster/reason-truth.ts",
  },

  // A tracked source file holding a raw 0x00 byte reads as BINARY to grep/rg, so every
  // text audit silently skips it -- a check that did not run, looking exactly like one
  // that passed. `rg 'foldChain' key-epoch-ledger.ts` printed "binary file matches" and
  // exit 0 while ten real matches were invisible, in the revocation ledger of all files.
  // The \u0000 escape is byte-identical at runtime and keeps the file searchable, so the
  // rule is total and needs no allowlist. Ten tracked files failed this when written.
  {
    id: "no-raw-nul-in-source",
    title: "No raw NUL in tracked source (an audit must be able to read the file)",
    command: "bun src/Core.TypeScript/hygiene/audit-no-raw-nul-in-source.ts",
  },

  // Addison Cooper's Genesis concept vocabulary is published as a static page that is
  // hand-copied into a DIFFERENT repository (lucent-financial-group.github.io) — no build
  // step, no CI, nothing connecting it back here. It drifted exactly as you would expect:
  // four society-identity terms landed in docs/GLOSSARY.md on 2026-07-31 and never reached
  // the page, and nobody found out until Aaron asked.
  //
  // docs/CONCEPT-REGISTRY.md is now the single list. This step is what keeps it honest —
  // it fails when the registry and the page disagree in EITHER direction, including a
  // silently reworded definition, which is the case a term-name-only check would miss.
  {
    id: "concept-registry-drift",
    title: "Concept registry vs published page (docs/CONCEPT-REGISTRY.md)",
    command: "bun src/Core.TypeScript/hygiene/audit-concept-registry-drift.ts",
  },

  // docs/TECH-RADAR.md is 100+ rows of PROSE asserting facts about this repo, and prose
  // rots silently -- which is the whole reason it drifted. Soraya found two on 2026-08-22
  // and both were the same defect: a row asserted something, the repo moved, nothing could
  // notice. `fast-check` was pinned and imported by five test files with NO ROW AT ALL, so
  // the only property-testing row ("FsCheck 3 | Adopt") -- which is .NET -- silently stood
  // in for a TypeScript tool at a different maturity. And two rows cited paths that had
  // moved (tools/alloy/alloy.jar, tools/invariant-substrates/tally.ts).
  //
  // Two mechanically-decidable subclasses, both derived rather than hand-listed:
  //   A. every backticked repo path the radar cites must exist (`(planned)` opts a
  //      proposed artifact out);
  //   B. every root package.json devDependency statically imported by a tracked
  //      *.test.ts must be named in the radar. devDependencies is the MANIFEST's own
  //      declaration of "tooling not product"; "imported by a test" is the proxy for
  //      "part of how we verify". Runtime `dependencies` are deliberately out of scope --
  //      the radar is an evaluation register, not an SBOM, and a check that demanded a row
  //      for `pg` is one somebody disables.
  //
  // HERE on the cross-verify floor because it is offline (~1s, no sockets, reads only
  // committed files) and because the radar is edited by every lane -- a path-filtered
  // workflow would miss the PR that moves the file a row cites. Went red on main when
  // written -- 7 findings: 4 dead paths (specs/Spine.als, tools/alloy/alloy.jar,
  // docs/research/scratch-zeta-parity.md, tools/invariant-substrates/tally.ts) and 3
  // unringed devDependencies (fast-check, quantum-circuit, semver). Green after the
  // corrections, so no baseline file exists (AUDIT-LIFECYCLE.md's cleanup-to-zero path
  // -- the surface is a mutable markdown doc, so the residue was editable).
  //
  // STATED LIMIT: neither check can tell you a RING is wrong. TLA+ sat at Adopt with a
  // dark lane for seven weeks and this audit would have stayed green throughout. Lane
  // liveness is a different measurement.
  {
    id: "tech-radar-claims",
    title: "Tech radar claims the repo can still support (paths resolve, in-use tools ringed)",
    command: "bun src/Core.TypeScript/hygiene/audit-tech-radar-claims.ts",
  },

  {
    id: "tech-radar-audit-tests",
    title: "Tech-radar audit unit tests (a check that cannot fail is not a check)",
    command: "bun test src/Core.TypeScript/hygiene/audit-tech-radar-claims.test.ts",
  },

  // A filesystem EXISTENCE test whose result gates a later operation on the same
  // path. Check-then-use; TOCTOU; CWE-367. THREE instances landed on 2026-08-20, in
  // one day, from three INDEPENDENT agents, all in code that had already been
  // written and reviewed: cluster/restricted-namespace-workloads.test.ts
  // (readdir + statSync().isDirectory() + readFileSync),
  // cluster/storage-profiles.ts (existsSync -> readFileSync), and
  // hygiene/audit-chart-target-revisions.ts (three sites in one file). Each was
  // found by CodeQL one at a time, AFTER merge, because nothing in the tree looked
  // for the shape. The pattern READS as defensive and prevents nothing.
  //
  // HERE rather than in codeql.yml on purpose. CodeQL runs on a schedule and
  // reports into the security tab, so its verdict arrives after the merge that
  // caused it -- which is how all three shipped. This step is offline, needs no
  // database build, and blocks the PR.
  //
  // --baseline grandfathers the 288 pre-existing instances measured on main when
  // this landed (AUDIT-LIFECYCLE.md step 5: the gate has to be landable without a
  // 288-file cleanup first). NEW instances fail, and so does an edit that renames
  // the path expression at a grandfathered site. --min-files is the scan floor: an
  // audit that inspected nothing must not report success.
  {
    id: "check-then-use-races",
    title: "No check-then-use filesystem races (TOCTOU, CWE-367)",
    command: [
      "bun src/Core.TypeScript/hygiene/lint-check-then-use-file-races.ts \\",
      "  src/Core.TypeScript \\",
      "  --min-files 1500 \\",
      "  --baseline src/Core.TypeScript/hygiene/lint-check-then-use-file-races.baseline.json",
    ].join("\n"),
  },

  // Executes mumps_zeta_id.m (subset interpreter). compare.ts already pins
  // the committed JSON; this step runs the routine so a layout edit in the
  // .m file cannot hide behind a stale mumps-output.json.
  {
    id: "mumps-zeta-id",
    title: "Execute MUMPS zeta-id packer",
    command: "bun run-mumps.ts",
    cwd: "tests/cross-verification/zeta-id",
  },

  // The six GENERATED bit-layout files vs docs/zeta-id-v1-layout.yaml, which the
  // zeta-id README named as an open hole: "There is no CI gate verifying the .gen
  // files match the YAML, so an edit without regeneration fails nowhere until a
  // codec stops compiling."
  //
  // The oracles above do not close it. compare.ts pins each oracle's COMMITTED
  // output to vectors.yaml, and CI independently re-executes five of the seven
  // (TS `bun test`, F#/C# `dotnet test`, Python `pytest`, MUMPS the step above).
  // Go and Rust are re-executed NOWHERE — this workflow runs only
  // `go test ./algebra/` and `cargo test … Core.Rust.Observe`. So a wrong constant
  // in zeta_id.gen.go or bit_layout.gen.rs sat behind a stale-but-agreeing output
  // JSON with every job green. This step is the independent reproduction for that
  // pair, and for the other four at no extra cost.
  {
    id: "zeta-id-gen-layout-drift",
    title: "zeta-id generated layouts vs the layout YAML",
    command: "bun tests/cross-verification/zeta-id/gen-layout-drift.ts",
  },

  // Algebra-tower drift-check: the generated law-property tests must be
  // regenerable-identical from their IRs (codegen-law-drift), and the
  // generated laws must hold against the TS oracle instances. Covers the
  // semiring → ring → kleene tower (+ the orthogonal star-ring branch).
  // Pure bun/arithmetic — no go/python spawns (the cross-language law
  // cross-verify is a separate, local/toolchain-heavy lane).
  {
    id: "algebra-tower-drift",
    title: "Algebra-tower drift-check (semiring→ring→kleene + star-ring)",
    command: [
      "bun test \\",
      "  tests/cross-verification/_harness/codegen-law-drift.test.ts \\",
      "  tests/cross-verification/_harness/generated-semiring-laws.test.ts \\",
      "  tests/cross-verification/_harness/generated-ring-laws.test.ts \\",
      "  tests/cross-verification/_harness/generated-star-ring-laws.test.ts \\",
      "  tests/cross-verification/_harness/generated-kleene-laws.test.ts",
    ].join("\n"),
  },
];

/** This file's own path, as other audits name it. */
export const CROSS_VERIFY_ROSTER_PATH = "src/Core.TypeScript/ci/cross-verify-roster.ts";

/**
 * The `gate.yml` job whose `audit:` matrix must equal the roster's ids.
 *
 * It is also the job id `gate-required.needs:` names, and that is not a coincidence: the
 * matrix job KEEPS the floor's id, so the floor list is byte-identical across the split
 * and `needs.cross-verify.result` — which GitHub collapses to `success` only when every
 * leg succeeded — is the aggregate verdict. No roll-up job exists to fail open.
 */
export const MATRIX_JOB_ID = "cross-verify";

/** The check-run name a given id produces, and the string a ruleset would reference. */
export function checkName(id: string): string {
  return `cross-verify (${id})`;
}

/**
 * The `audit:` values declared under `<MATRIX_JOB_ID>.strategy.matrix` in a workflow.
 *
 * Hand-parsed rather than routed through a YAML library, for the same reason
 * `gate-blocking-floor.ts` hand-parses: this runs in a job with nothing installed but
 * Bun and the checkout, and a parse that needs a dependency is a parse that can fail
 * for a reason unrelated to its subject.
 *
 * Returns `null` when the job or its matrix cannot be found. Null is the fail-closed
 * answer — `assertGateParity` then refuses rather than reporting agreement it could not
 * check, which is the vacuity this whole change is about.
 */
export function parseMatrixAudits(yamlText: string): string[] | null {
  const lines = yamlText.split("\n");
  const jobAt = lines.findIndex((l) => l === `  ${MATRIX_JOB_ID}:`);
  if (jobAt < 0) return null;

  // Walk to the job's `audit:` key, stopping at the next top-level job.
  let listAt = -1;
  for (let i = jobAt + 1; i < lines.length; i++) {
    const l = lines[i]!;
    if (/^  \S/.test(l)) break; // next job at two-space indent
    if (/^\s+audit:\s*$/.test(l)) {
      listAt = i;
      break;
    }
  }
  if (listAt < 0) return null;

  const ids: string[] = [];
  const itemRe = /^(\s+)- ([A-Za-z0-9][A-Za-z0-9-]*)\s*(#.*)?$/;
  let indent: string | null = null;
  for (let i = listAt + 1; i < lines.length; i++) {
    const l = lines[i]!;
    if (l.trim() === "" || l.trim().startsWith("#")) continue;
    const m = itemRe.exec(l);
    if (m === null) break;
    if (indent === null) indent = m[1]!;
    else if (m[1] !== indent) break;
    ids.push(m[2]!);
  }
  return ids.length === 0 ? null : ids;
}

// ── THE GENERATOR — every other view of this list is DERIVED, never maintained ────
//
// Until 2026-08-26 the ids lived in THREE hand-maintained places — `gate.yml`'s matrix,
// the check-name table in `docs/ci/CROSS-VERIFY-CHECK-NAMES.md`, and a `toHaveLength(31)`
// in the test file — with a parity check between the first two. That is the brittleness
// Aaron named while reviewing the first change that had to edit them (#15666): *"this
// design seems a bit flakey, are we going to be fixing this all the time, can we automate
// this fix … or redesign this so it's different and less brittle?"*
//
// Automating the REPAIR of hand-maintained duplicates keeps the brittleness and adds
// machinery to it. Duplicate lists that must agree IS the defect, so the duplicates stop
// being maintained: each is a delimited GENERATED REGION emitted from the roster above,
// and one command is both the drift check and the fix — which is why the two cannot
// disagree with each other. Same shape as `ace/build-graph.ts derive [--write]`.

/**
 * One derived view of the roster: a delimited region inside an otherwise hand-maintained
 * file.
 *
 * A separate generated FILE was the obvious alternative and does not work here. GitHub
 * cannot read a matrix out of a file: the only way to feed one from elsewhere is
 * `fromJSON` of a job output, which is the DYNAMIC matrix rejected below — so for
 * `gate.yml` the region has to live in the workflow, and once one target works that way
 * the doc uses the same mechanism rather than a second one. It also diffs better: a
 * reviewer sees `- an-audit` appear in the workflow they already read, not a line in a
 * generated artifact plus a claim about what consumes it.
 */
export interface GeneratedRegion {
  /** Path from the repo root. */
  readonly path: string;
  /** The line that opens the region, matched TRIMMED so indentation is read from the file. */
  readonly begin: string;
  /** The line that closes it. */
  readonly end: string;
  /** The whole region including both marker lines, at the indentation the begin line had. */
  render(audits: readonly CrossVerifyAudit[], indent: string): string;
}

export const GENERATED_BEGIN = "# ── BEGIN GENERATED · cross-verify matrix legs · do not hand-edit ──";
export const GENERATED_END = "# ── END GENERATED · cross-verify matrix legs ──";
export const DOC_GENERATED_BEGIN = "<!-- BEGIN GENERATED · cross-verify check names · do not hand-edit -->";
export const DOC_GENERATED_END = "<!-- END GENERATED · cross-verify check names -->";

/** The gate.yml the matrix region lives in. */
export const GATE_YML_PATH = ".github/workflows/gate.yml";

/** The ruleset-promotion doc whose table lists the exact check-run strings. */
export const CHECK_NAMES_DOC_PATH = "docs/ci/CROSS-VERIFY-CHECK-NAMES.md";

/** Exits 1 on drift, naming it. What every matrix leg runs before its own audit. */
export const DERIVE_CHECK_COMMAND = `bun ${CROSS_VERIFY_ROSTER_PATH} --derive`;

/** The one line every drift message must carry: the fix, runnable as printed. */
export const DERIVE_FIX_COMMAND = `${DERIVE_CHECK_COMMAND} --write`;

/**
 * The `audit:` matrix region of `gate.yml`.
 *
 * ORDER: the roster's declaration order, not sorted. Order is incidental to
 * CORRECTNESS — `fail-fast: false`, and every leg is independent, so no leg's result
 * depends on any other's position — but it is load-bearing for READING: the roster groups
 * related audits adjacently (`image-source-provenance` beside its `-tests`, the two
 * heartbeat-lane audits, the two tech-radar ones), and sorting would scatter every pair
 * for no gain. Source order is exactly as deterministic as sorted order, which is the
 * property a generator actually needs.
 */
export const GATE_MATRIX_REGION: GeneratedRegion = {
  path: GATE_YML_PATH,
  begin: GENERATED_BEGIN,
  end: GENERATED_END,
  render(audits, indent) {
    const c = (s: string): string => (s === "" ? `${indent}#` : `${indent}# ${s}`);
    return [
      `${indent}${GENERATED_BEGIN}`,
      c(`DERIVED from \`CROSS_VERIFY_AUDITS\` in ${CROSS_VERIFY_ROSTER_PATH}.`),
      c(""),
      c("One command is BOTH the check and the fix, so the two cannot disagree:"),
      c(""),
      c(`  ${DERIVE_CHECK_COMMAND}           # exits 1 on drift, naming it`),
      c(`  ${DERIVE_FIX_COMMAND}   # rewrites this region`),
      c(""),
      c("Every matrix leg runs the check before its own audit, so a hand-edit here survives"),
      c("at most one CI run. Adding or removing an audit is a roster edit plus that one"),
      c("command — never an edit to this list."),
      c(""),
      c("Still STATIC on purpose, and generation is what makes a static list affordable. A"),
      c("DYNAMIC matrix (`fromJSON` of a roster job's output) would delete this list — and"),
      c("would mean these check names do not exist until that job succeeds. Once any of them"),
      c("is a required context, a name that never reports does not FAIL a pull request, it"),
      c("WEDGES it, silently and forever. A generated static list cannot do that, and it"),
      c("keeps the names greppable in this file for the ruleset promotion."),
      `${indent}audit:`,
      ...audits.map((a) => `${indent}  - ${a.id}`),
      `${indent}${GENERATED_END}`,
    ].join("\n");
  },
};

/**
 * The check-name table in the ruleset-promotion doc.
 *
 * Cell padding reproduces prettier's markdown table rule (every cell padded to the
 * column's widest) rather than fighting it. `format:check` runs over this file, so a
 * generator that emitted a differently-padded table would put the FORMATTER and the
 * GENERATOR in a permanent fight — the failure `.prettierignore` names in its own
 * comments. The falsifier is `prettier --check` on the generated file, which CI runs.
 */
export const CHECK_NAMES_DOC_REGION: GeneratedRegion = {
  path: CHECK_NAMES_DOC_PATH,
  begin: DOC_GENERATED_BEGIN,
  end: DOC_GENERATED_END,
  render(audits, indent) {
    const rows: string[][] = [
      ["check-run name", "what it audits"],
      ...audits.map((a) => [`\`${checkName(a.id)}\``, a.title]),
    ];
    const widths = [0, 1].map((col) => Math.max(...rows.map((r) => (r[col] ?? "").length)));
    const line = (cells: readonly string[]): string =>
      `${indent}| ${cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join(" | ")} |`;
    const [header, ...body] = rows;
    return [
      `${indent}${DOC_GENERATED_BEGIN}`,
      "",
      line(header ?? []),
      `${indent}| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`,
      ...body.map(line),
      "",
      `${indent}${DOC_GENERATED_END}`,
    ].join("\n");
  },
};

/** Every derived view. A new one is added here and nowhere else. */
export const GENERATED_REGIONS: readonly GeneratedRegion[] = [GATE_MATRIX_REGION, CHECK_NAMES_DOC_REGION];

/**
 * What a file should contain, given the roster.
 *
 * `ok: false` means the region could not be LOCATED — the fail-closed answer. It never
 * means "in sync"; drift is `next !== <the text you passed in>`, which keeps the check a
 * byte comparison rather than a second opinion about equality.
 */
export type DeriveResult =
  { readonly ok: true; readonly next: string } | { readonly ok: false; readonly problems: readonly string[] };

/** Re-emit one region into the text that carries it. */
export function deriveRegion(
  region: GeneratedRegion,
  text: string,
  audits: readonly CrossVerifyAudit[] = CROSS_VERIFY_AUDITS,
): DeriveResult {
  const lines = text.split("\n");
  const beginAts: number[] = [];
  const endAts: number[] = [];
  for (const [i, l] of lines.entries()) {
    if (l.trim() === region.begin) beginAts.push(i);
    if (l.trim() === region.end) endAts.push(i);
  }
  // Exactly one of each, or refuse. Zero means somebody deleted the markers along with
  // the guard they carry; two means a copy-paste produced a region the generator would
  // silently pick one half of. Neither may read as "no drift".
  if (beginAts.length !== 1 || endAts.length !== 1) {
    return {
      ok: false,
      problems: [
        `${region.path}: expected exactly one generated region and found ` +
          `${String(beginAts.length)} begin marker(s) and ${String(endAts.length)} end marker(s). ` +
          "The markers are the only thing that tells the generator what it owns, so this is " +
          `refused rather than guessed at. Begin marker: ${region.begin}`,
      ],
    };
  }
  const beginAt = beginAts[0] ?? 0;
  const endAt = endAts[0] ?? 0;
  if (endAt <= beginAt) {
    return { ok: false, problems: [`${region.path}: the end marker precedes the begin marker`] };
  }
  const indent = /^(\s*)/.exec(lines[beginAt] ?? "")?.[1] ?? "";
  const rendered = region.render(audits, indent).split("\n");
  return { ok: true, next: [...lines.slice(0, beginAt), ...rendered, ...lines.slice(endAt + 1)].join("\n") };
}

/** The gate.yml the roster implies. Named because it is the one every leg checks. */
export function deriveGateYml(
  yamlText: string,
  audits: readonly CrossVerifyAudit[] = CROSS_VERIFY_AUDITS,
): DeriveResult {
  return deriveRegion(GATE_MATRIX_REGION, yamlText, audits);
}

export interface ParityResult {
  readonly ok: boolean;
  /** One line per problem. Empty exactly when `ok`. */
  readonly problems: readonly string[];
}

/**
 * Roster ids vs the matrix ids, as SEQUENCES.
 *
 * DIAGNOSIS ONLY, since the matrix became generated. The enforcement is
 * `deriveGateYml` + a byte comparison, which subsumes membership, duplication AND order
 * in one test that cannot hold a different opinion from the generator. This function
 * survives because a byte mismatch is not a legible message: it re-reads the workflow
 * with an INDEPENDENT parser and turns "the region's bytes differ" into "leg `x` has no
 * roster entry". It is deliberately never authoritative — nothing passes because this
 * returned `ok`.
 *
 * Order is compared, not just membership, so the workflow reads in the same order as
 * this file and a review diff of one is a review diff of the other.
 */
export function compareRosterToMatrix(rosterIds: readonly string[], matrixIds: readonly string[] | null): ParityResult {
  if (matrixIds === null) {
    return {
      ok: false,
      problems: [
        `could not find the \`audit:\` matrix of job \`${MATRIX_JOB_ID}\` in gate.yml — ` +
          "the roster cannot be shown to match a list it could not read",
      ],
    };
  }
  const problems: string[] = [];
  const rosterSet = new Set(rosterIds);
  const matrixSet = new Set(matrixIds);
  if (rosterSet.size !== rosterIds.length) {
    problems.push("the roster declares a duplicate id");
  }
  for (const id of rosterIds) {
    if (!matrixSet.has(id)) {
      problems.push(
        `roster entry \`${id}\` has no matrix leg in gate.yml — it would never run, and a check ` +
          "that never runs is the vacuity class this floor exists to refuse",
      );
    }
  }
  for (const id of matrixIds) {
    if (!rosterSet.has(id)) {
      problems.push(`gate.yml declares matrix leg \`${id}\` with no roster entry — that leg has nothing to run`);
    }
  }
  if (problems.length === 0 && rosterIds.join(",") !== matrixIds.join(",")) {
    problems.push(
      `the roster and the matrix hold the same ids in a DIFFERENT ORDER — roster [${rosterIds.join(", ")}] ` +
        `vs matrix [${matrixIds.join(", ")}]`,
    );
  }
  return { ok: problems.length === 0, problems };
}

const DEFAULT_GATE_YML = GATE_YML_PATH;

function readGateYml(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * The drift report, at the level a human can act on.
 *
 * Called only after a byte comparison has already failed, so it never decides anything.
 * If the independent id-level parse finds nothing wrong, it says so rather than implying
 * the file is fine — the bytes differ, and comment or indentation drift is a real cause.
 */
function reportDrift(path: string, text: string): void {
  // `parseMatrixAudits` only understands the workflow's list; for any other region the
  // honest report is that the bytes differ and the fix is the same one command.
  const problems =
    parseMatrixAudits(text) === null
      ? []
      : compareRosterToMatrix(
          CROSS_VERIFY_AUDITS.map((a) => a.id),
          parseMatrixAudits(text),
        ).problems;
  if (problems.length === 0) {
    console.log(
      `::error title=cross-verify derived region drift::${path}'s generated region does not match the ` +
        "generator's output byte for byte. Either its content was hand-edited, or the roster changed " +
        "and this region was not regenerated.",
    );
  } else {
    for (const p of problems) console.log(`::error title=cross-verify derived region drift::${p}`);
  }
  console.log(
    `\nThe generated region in ${path} is DERIVED from \`CROSS_VERIFY_AUDITS\` in\n` +
      `${CROSS_VERIFY_ROSTER_PATH}. Edit the roster, never the region, then run:\n\n` +
      `  ${DERIVE_FIX_COMMAND}\n\n` +
      "The same command is the check and the fix, so they cannot disagree. Every matrix leg\n" +
      "runs the check before its own audit, so a hand-edit survives at most one CI run.",
  );
}

/**
 * The workflow matches what the roster generates, or a printed refusal and exit 1.
 *
 * Deliberately NARROWER than `--derive`: a matrix leg checks the region that decides
 * whether it exists at all, and nothing else. Widening it to the check-names doc would
 * turn a stale table into 31 red legs — re-widening the blast radius the 31-way split was
 * built to shrink. The doc's region is checked by `--derive` and by the test suite, both
 * of which run on every pull request.
 */
function assertGateDerived(gateYmlPath: string): boolean {
  const text = readGateYml(gateYmlPath);
  if (text === null) {
    console.log(
      `::error title=cross-verify matrix::could not read ${gateYmlPath}; the matrix cannot be shown ` +
        "to be derived from a file that could not be read.",
    );
    return false;
  }
  const derived = deriveGateYml(text);
  if (!derived.ok) {
    for (const p of derived.problems) console.log(`::error title=cross-verify matrix::${p}`);
    return false;
  }
  if (derived.next === text) return true;
  reportDrift(gateYmlPath, text);
  return false;
}

// ── CLI ────────────────────────────────────────────────────────────────────────────

function flagValue(argv: readonly string[], flag: string, fallback: string): string {
  const at = argv.indexOf(flag);
  return at >= 0 ? (argv[at + 1] ?? fallback) : fallback;
}

async function runAudit(id: string, gateYmlPath: string): Promise<number> {
  if (!assertGateDerived(gateYmlPath)) return 1;

  const audit = CROSS_VERIFY_AUDITS.find((a) => a.id === id);
  if (audit === undefined) {
    console.log(
      `::error title=cross-verify roster::unknown audit id ${JSON.stringify(id)}. Known ids: ` +
        CROSS_VERIFY_AUDITS.map((a) => a.id).join(", "),
    );
    return 1;
  }

  const event = process.env.GITHUB_EVENT_NAME ?? "";
  if (audit.events !== undefined && !audit.events.includes(event)) {
    // NOT the same thing as a pass, and it says so. The step-level `if:` this replaces
    // rendered as a grey step nobody read; this prints the reason and the event.
    console.log(`::notice title=cross-verify (${id})::NOT APPLICABLE on event \`${event || "<unset>"}\`.`);
    console.log(
      `${audit.title}\n` +
        `  This audit declares events [${audit.events.join(", ")}] and the current event is ` +
        `\`${event || "<unset>"}\`, so it examined nothing.\n` +
        "  This is the pre-split behaviour of its step-level `if:`, stated rather than rendered as a grey step.",
    );
    return 0;
  }

  console.log(`── ${audit.title}`);
  console.log(`   $ ${audit.command.split("\n").join("\n     ")}`);
  const proc = Bun.spawn(["bash", "-euo", "pipefail", "-c", audit.command], {
    // `exactOptionalPropertyTypes` refuses an explicit `undefined`, so an absent `cwd`
    // means the key is absent — which is also what "run from the repo root" should look like.
    ...(audit.cwd === undefined ? {} : { cwd: audit.cwd }),
    stdio: ["inherit", "inherit", "inherit"],
  });
  const code = await proc.exited;

  // AN ANNOTATION THAT CARRIES NOTHING IS A CHECK REPORTING ITS OWN EXIT CODE BACK TO YOU.
  //
  // Every other failure path in this function annotates (unknown id, unreadable region,
  // derive drift). A failing AUDIT did not: it returned the child's code and the only
  // annotation on the check-run was Actions' own `Process completed with exit code 1`.
  // That string names no audit, no command, and no leg — and with 31 legs it does not even
  // narrow it to one, because the check-run title is the only thing that does.
  //
  // Measured cost of that gap on 2026-08-27: `cross-verify (ace-suite)` went red on `main`
  // and its annotation said exactly that one sentence. The real cause — two drift-gate
  // tests timing out at 5174/5200 ms against Bun's default 5000 ms cap, with nothing
  // actually drifted — was only readable by downloading the job log, and it was six checks
  // that night whose annotations carried nothing.
  //
  // Deliberately `console.log` of a workflow command and nothing else: no shell, no
  // installed program, no `shell:` key, and it runs in the Bun process already executing.
  // A reporter that needs a toolchain cannot report a toolchain failure.
  if (code !== 0) {
    console.log(
      `::error title=cross-verify (${id})::${audit.title} FAILED (exit ${String(code)}). ` +
        `Command: ${audit.command.split("\n").join(" ")}`,
    );
  }
  return code;
}

/**
 * The drift gate and its own fix, in one function, over every derived region.
 *
 * `--derive` exits 1 on drift; `--derive --write` rewrites the regions. They share the
 * generator, so "what CI demands" and "what the fix produces" are the same bytes by
 * construction rather than by anyone keeping them aligned. Modelled on
 * `ace/build-graph.ts derive [--write]`, including the refusal to rewrite a file that is
 * already current — a no-op write still churns mtimes and invites a spurious diff.
 *
 * Every region is visited even after one drifts, so a single run names all of them.
 */
function runDerive(gateYmlPath: string, write: boolean): number {
  let worst = 0;
  const n = String(CROSS_VERIFY_AUDITS.length);
  for (const region of GENERATED_REGIONS) {
    // `--gate-yml` redirects only the workflow, which is what the tests need to point at
    // a copy. Every other region keeps its own declared path.
    const path = region === GATE_MATRIX_REGION ? gateYmlPath : region.path;
    const text = readGateYml(path);
    if (text === null) {
      console.log(`::error title=cross-verify derived regions::could not read ${path}.`);
      worst = 1;
      continue;
    }
    const derived = deriveRegion(region, text);
    if (!derived.ok) {
      for (const p of derived.problems) console.log(`::error title=cross-verify derived regions::${p}`);
      worst = 1;
      continue;
    }
    if (derived.next === text) {
      console.log(`${path} is derived from the roster's ${n} audits. ✓`);
      continue;
    }
    if (write) {
      writeFileSync(path, derived.next);
      console.log(`${path} updated from the roster (${n} audits).`);
      continue;
    }
    reportDrift(path, text);
    worst = 1;
  }
  return worst;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const gateYmlPath = flagValue(argv, "--gate-yml", DEFAULT_GATE_YML);

  if (argv.includes("--list")) {
    for (const a of CROSS_VERIFY_AUDITS) console.log(a.id);
    return;
  }
  if (argv.includes("--json")) {
    console.log(JSON.stringify(CROSS_VERIFY_AUDITS, null, 2));
    return;
  }
  if (argv.includes("--derive")) {
    process.exitCode = runDerive(gateYmlPath, argv.includes("--write"));
    return;
  }
  const runAt = argv.indexOf("--run");
  if (runAt >= 0) {
    const id = argv[runAt + 1] ?? "";
    process.exitCode = await runAudit(id, gateYmlPath);
    return;
  }

  console.log("usage: cross-verify-roster.ts [--list | --json | --derive [--write] | --run <id>] [--gate-yml <path>]");
  process.exitCode = 2;
}

if (import.meta.main) {
  await main();
}
