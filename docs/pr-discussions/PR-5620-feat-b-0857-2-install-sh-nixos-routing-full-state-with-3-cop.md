---
pr_number: 5620
title: "feat(b-0857.2): install.sh NixOS routing \u2014 full state with 3 Copilot findings addressed (supersedes #5606)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T19:41:52Z"
merged_at: "2026-05-27T19:47:17Z"
closed_at: "2026-05-27T19:47:17Z"
head_ref: "feat/b-0857-2-install-sh-nixos-routing-resubmit-with-3-copilot-fixes-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T20:03:55Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5620: feat(b-0857.2): install.sh NixOS routing — full state with 3 Copilot findings addressed (supersedes #5606)

## PR description

## Summary

Supersedes [#5606](https://github.com/Lucent-Financial-Group/Zeta/pull/5606) (which had 3 valid Copilot findings + 1 false-positive). Fresh branch off origin/main; no force-push (policy-respected new-branch path per the autonomous-loop force-push discipline).

PR #5606 will be closed with cross-reference to this PR.

## Routing matrix (unchanged from #5606)

| Environment | Detection | Routes to |
|---|---|---|
| macOS | \`uname -s = Darwin\` | \`setup/macos.sh\` |
| Linux non-NixOS | no \`/etc/NIXOS\` | \`setup/linux.sh\` |
| NixOS installed | \`/etc/NIXOS\` + no \`/.dockerenv\` + no \`/iso\` + no \`/run/initramfs\` | \`setup/linux.sh\` |
| NixOS docker test harness | \`/etc/NIXOS\` + \`/.dockerenv\` (081KSKBP80008QG0R000E3RKPK harness) | \`setup/linux.sh\` (discriminator-2 short-circuit) |
| NixOS live-USB | \`/etc/NIXOS\` + (\`/iso\` OR \`/run/initramfs\`) | \`exit 2\` + message pointing to \`zeta-install.sh\` |

## Copilot findings addressed (from PR #5606)

### Finding 1 (P1, line 16) — exit-code contract reconciled

**Was**: \"Exit 0 on success. Any failure is a dev-experience bug\" but live-USB branch intentionally exit 2.

**Fixed**: expanded exit-code documentation to 3 codes (0 success; 1 error; 2 intentional routing guard for NixOS live-USB — NOT a dev-experience bug). Clarified that CI \`gate.yml\` asserts exit 0 in its tested environments (none of which are NixOS live-USB).

### Finding 2 (P1, line 36) — name attribution

**Was**: \"Per 081KSKBP80008QG0R002J03WGA operator framing (Aaron 2026-05-27):\"

**Fixed**: \"Per 081KSKBP80008QG0R002J03WGA operator framing (2026-05-27):\" per name-attribution convention.

### Finding 3 (P1, line 111) — relative path

**Was**: \"sudo bash full-ai-cluster/usb-nixos-installer/zeta-install.sh\" (relative; fails if user not in repo root).

**Fixed**: resolves \`\$REPO_ROOT\`-rooted absolute path before printing the message; also resolves \`\$INJECTION_POINTS_ABS\` absolute path; both paths now work regardless of caller cwd.

### Finding 4 (P0, line 114) — FALSE POSITIVE

Copilot flagged \"\`full-ai-cluster/INJECTION-POINTS.md\` does not exist in the repo\" but the file DID land on origin/main at \`976b3521a\` (PR #5601, merged before PR #5606 CI ran). Verified via \`git ls-tree origin/main full-ai-cluster/INJECTION-POINTS.md\`. Copilot's review-base predated #5601 merge.

## Local validation

- \`bash -n\` syntax PASS
- \`bash tools/setup/install.sh\` on Darwin: routes to \`setup/macos.sh\` as expected
- \`bun tools/ci/docker-nixos-install-sh-test.ts\`: SUCCESS in 108s — 081KSKBP80008QG0R000E3RKPK docker harness validates the \`/.dockerenv\` discriminator-2 short-circuit preserves existing harness behavior

## Why new-branch path (not force-push)

Per autonomous-loop force-push discipline: force-push requires explicit operator authorization. Earlier rebase rewrote PR #5606's branch SHAs locally; pushing those would have required force-push. The policy-respected alternative is the new-branch path (this PR).

## Test plan

- [x] Branch guard checked before commit
- [x] Tree-count canary 61 (no corruption)
- [x] Local docker harness PASS in 108s
- [x] All 3 valid Copilot findings addressed
- [x] False-positive (line 114) confirmed via direct \`git ls-tree origin/main\` inspection
- [ ] CI: build-ai-cluster-iso (triggered on merge by tools/setup/** path)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T19:42:42Z)

## Pull request overview

Adds NixOS-aware environment routing to `tools/setup/install.sh`, distinguishing macOS, non-NixOS Linux, NixOS installed, NixOS docker test harness, and NixOS live-USB. Live-USB now exits 2 with a guidance message pointing to the existing `zeta-install.sh`. Supersedes #5606 with three Copilot findings addressed (exit-code contract, name attribution, absolute paths).

**Changes:**

- New `detect_linux_flavor` helper with 4-step discriminator (NIXOS marker → docker → live-USB markers → installed default).
- Linux case dispatches by flavor; live-USB prints an absolute-path-rooted message and exits 2.
- Header documents 3 exit codes and the 081KSKBP80008QG0R002J03WGA.2 routing matrix.

## General comments

### @chatgpt-codex-connector (2026-05-27T19:41:58Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
