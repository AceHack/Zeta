---
id: 081M0X297C1087G0R000HG6ZK2
type: task
state: backlog
priority: P2
slug: stage-0-shell-floor-adversarial-review-of-the-fewest-indepen
title: "Stage-0 shell floor: adversarial review of the 'fewest independent .sh files' minimization premise"
created: 2026-08-25T18:17:53.281Z
depends_on: []
composes_with: []
---

# Stage-0 shell floor: adversarial review of the 'fewest independent .sh files' minimization premise

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0X297C1087G0R000HG6ZK2-*.md` glob. -->

## What this is

Adversarial review (Aminata) of Aaron's 2026-08-25 framing that the stage-0 shell
surface should be driven to "the absolute minimal number of independent `.sh` files."
He asked for the result to hold up under adversarial review; this is that review.

Report: `docs/research/2026-08-25-stage-0-shell-floor-the-adversarial-case-against-fewest-independent-sh-files.md`

## Verdict

The impulse is warranted; the **quantity is wrong**. A file count is gameable four
ways (concatenation, renaming off `.sh`, deleting the archive, inlining into
non-shell carriers), cannot distinguish `keyring.sh` (T4 root-key) from a dead
`smoke-10-toolchains.sh` (T0), and approves of the 3,771-LOC / 195-`sudo`
`zeta-install.sh` monolith because it is one file.

Derived floor: **27 files** that must stay independent, each with a named reason.

Recommended objective instead: minimize **stage-0 shell LOC below the bun
availability boundary, weighted by measured key-exposure tier**, under the standing
constraint that no reduction merges across an availability, privilege, failure, or
measurement-context boundary.

## Findings raised (detail in the report)

- **P0** — `common/curl-fetch.sh`'s "all upstream-installer call sites" claim is
  ornamental: 2 call sites vs 3 bypasses, including a live pipe-to-shell of
  `https://sh.rustup.rs` at `install-rust-wasm32.sh:32`. Windows (`install.ps1`)
  holds the stronger policy than Unix.
- **P0** — `install-zig.sh` installs an **unverified** tarball (no SHA256, no
  `curl_fetch`) into `/usr/local` under three executed `sudo`, incl. `sudo rm -rf`.
- **P1** — `secret-clip.sh:95` puts a credential on `security(1)`'s argv
  (self-declared in the allowlist; sibling `op-token-setup.sh` was fixed by
  conversion — the model to follow).
- **P1** — only `smoke-7-toolchains.sh` is wired to CI (`gate.yml:3245`); its two
  successors covering oracles 8–13 are dead, and `smoke-13` claims CI runs it.
  Overlaps `081M05E39F7087G0R002F00H6Q`.
- **P2** — `grep -c sudo` misranks the tree: `fd-limits.sh` (11 hits) and
  `doctor.sh` (12 hits) execute **zero** privileged operations.

## Follow-ups this suggests (not filed here)

1. Wire `smoke-13-toolchains.sh`, delete `smoke-7` + `smoke-10`. (−2 files, closes a
   coverage gap rather than burying it.)
2. Route `install-rust-wasm32.sh` and `install-zig.sh` through `curl_fetch` + add
   checksum verification, or correct `curl-fetch.sh`'s header claim.
3. Convert `agda-cubical.sh` + `tlaps.sh` — both invoked *by a bun realizer*, so they
   are above the availability boundary and retained by habit.
4. Wire the exposure axis into the inventory (`081M00VVBAN087G0R000XC5MN7` already
   chartered).
