---
pr_number: 5027
title: "feat(zflash): show USB partition contents + vendor/serial before consent prompt + flash-cluster-iso skill"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T23:11:15Z"
merged_at: "2026-05-25T23:54:20Z"
closed_at: "2026-05-25T23:54:20Z"
head_ref: "otto-cli/zflash-detail-richer-display-skill-2026-05-25"
base_ref: "main"
archived_at: "2026-05-25T23:57:31Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5027: feat(zflash): show USB partition contents + vendor/serial before consent prompt + flash-cluster-iso skill

## PR description

## Summary

Two improvements emerged from the 2026-05-25 USB-flash session with the human maintainer:

### 1. `flash-usb.ts` — show what's on the USB BEFORE the consent prompt

The existing rails showed device/model/size. Now also shows what's currently on the stick so the runner sees what they're about to destroy:

```text
USB device identified:
  Device:      /dev/disk6
  Model:       USB 3.2.1 FD
  Vendor:      SanDisk                ← NEW
  IORegName:   SanDisk Ultra          ← NEW
  Serial:      4C53010005...          ← NEW
  Size:        115.46 GiB
  Protocol:    USB
  Removable:   true
  Writable:    yes                    ← NEW
  Part. table: FDisk_partition_scheme ← NEW
  Boot disk:   disk3  (target is not boot disk)

Currently on /dev/disk6 (will be DESTROYED):      ← NEW SECTION
  /dev/disk6s1   EFI System    3.1 MB   (none) — mounted at /Volumes/EFI

*** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
```

Operator's verbatim ask: *"show me the usb device somehow and some stats abuout it and details before i fingerprint"*

Per-partition fields come from `diskutil info -plist` on each partition: filesystem, volume name, mount point, used-space. Best-effort — any field that diskutil omits prints as `?` or `(none)`; the script does NOT fail on missing fields.

### 2. `.claude/skills/flash-cluster-iso/SKILL.md` — new skill

Captures the end-to-end zflash flow as substrate so future agent cold-boots inherit it. Two paths documented:

- **Path A — operator-only**: `zflash` → type `yes <4-hex>` → Touch ID
- **Path B — agent-driven**: agent drives via `expect` (auto-reads nonce from stdout, writes it back to stdin); operator's Touch ID still gates the `sudo dd` as the physical-presence floor

Empirical anchor for Path B: this session's successful agent-driven flash via the included expect script.

## Composes with

- 081KSE6WT0008QG0R003WZAQKV — zflash + Touch ID PAM + short challenge (the substrate this enhances)
- 081KSE6WT0008QG0R003WW3YJQ — "I execute, you fingerprint" desktop admin consent pattern (the rule this skill instantiates)
- 081KSE6WT0008QG0R0005XASX2 — destructive-tool authoring contract (the safety floor preserved)
- 081KSE6WT0008QG0R003BG8M6J / 081KSE6WT0008QG0R0025170CV — Linux + Windows extensions (not in scope here)

## Test plan

- [x] Edits made in isolated worktree (`/private/tmp/zeta-zflash-detail-2026-05-25`) off fresh `origin/main` per 081KSE6WT0008QG0R003YYC9PV (agents don't touch the operator's primary checkout)
- [x] `bun full-ai-cluster/tools/flash-usb.ts --help` parses (no TS syntax errors)
- [x] Skill SKILL.md frontmatter valid; shows up in skill router listing
- [ ] CI green

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T23:13:30Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `a5e4c5e9c6`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T23:16:27Z)

## Pull request overview

Enhances the macOS USB flashing workflow by expanding the pre-consent device/partition visibility in `flash-usb.ts`, and adds a new `.claude` skill documenting the end-to-end cluster ISO flashing flow (including operator-only vs agent-driven execution patterns).

**Changes:**
- Extend `flash-usb.ts` to print vendor/serial/writability/partition-table details and enumerate current partitions (filesystem/volume/mount/used-space best-effort) before the destructive consent prompt.
- Add a new `flash-cluster-iso` skill capturing the operational procedure (including Touch ID + short nonce challenge and an `expect`-driven path).

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 8 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/tools/flash-usb.ts | Adds richer device metadata and a “currently on this USB” partition listing before the confirmation gate. |
| .claude/skills/flash-cluster-iso/SKILL.md | New skill documenting the operator + agent-driven zflash/flash-usb workflow and safety rails. |

## Review threads

### Thread 1: .claude/skills/flash-cluster-iso/SKILL.md:114 (resolved)

**@chatgpt-codex-connector** (2026-05-25T23:13:30Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fix incorrect multi-USB fallback instruction**

This instruction is inaccurate: `flash-usb.ts` does not support explicit device selection, and it hard-fails when more than one USB candidate is present. The script only accepts `[--short] <path-to-iso>` and then exits in the `usbCandidates.length > 1` branch with a refusal message, so following this guidance will still fail and can push operators toward unsafe manual workarounds. Update the skill text to match current behavior (or add explicit device-selection support in code first).

Useful? React with 👍 / 👎.

### Thread 2: full-ai-cluster/tools/flash-usb.ts:364 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:16:25Z):

`diskutil info` is invoked for partition device identifiers without any of the script’s usual device-shape validation. Since this is still feeding an OS command (even via argv-array form), it would be more consistent with the tool’s safety posture to whitelist the expected partition identifier pattern (e.g., `/dev/disk\d+s\d+`) before calling `diskutilInfo(partDev)` or to add a dedicated `assertSafePartitionPath` helper.

### Thread 3: .claude/skills/flash-cluster-iso/SKILL.md:3 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:16:26Z):

The skill frontmatter `description` is far longer than the carved-sentence routing budget target used across the skill catalog (see 081KR50HA0008QG0R002ZNFQBZ: prefer <120 chars; hard target <150). This one is long enough that it’s likely to be truncated/dropped in skill listings, hurting routing. Suggest carving it down to a single short routing sentence and moving the detailed path/Touch ID/expect discussion into the body.

### Thread 4: .claude/skills/flash-cluster-iso/SKILL.md:123 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:16:26Z):

This skill introduces named-human attribution ("Aaron") in current-state skill prose. Per the repo’s naming convention, skills should use role-refs (e.g., "the operator" / "the human maintainer") rather than personal names outside the allowed history surfaces. Please rewrite these to role-refs.

### Thread 5: .claude/skills/flash-cluster-iso/SKILL.md:130 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:16:26Z):

The rule cross-reference `.claude/rules/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md` appears to point to a file that doesn’t exist in `.claude/rules/`. This will become a dead link for future readers; either add the missing rule file in this PR or update the reference to the correct existing rule path/name.

### Thread 6: .claude/skills/flash-cluster-iso/SKILL.md:97 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:16:26Z):

The markdown table is written with a double leading pipe (`|| Rail | ...`), which renders as an extra empty first column and is inconsistent with the rest of the repo’s table formatting. Use a normal table header row starting with a single `|` (and matching separator row) so the table renders as intended.

### Thread 7: .claude/skills/flash-cluster-iso/SKILL.md:142 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:16:26Z):

Another markdown table has the same double-leading-pipe issue (`|| Path | Role |`), producing an extra empty column. Adjust to a standard `| Path | Role |` header row (and separator) for correct rendering and consistent linting.

### Thread 8: .claude/skills/flash-cluster-iso/SKILL.md:131 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:16:27Z):

This bullet includes named-human attribution ("per Aaron 2026-05-25") in a current-state skill file. Please rewrite to a role-ref (e.g., "per the operator") or drop the attribution entirely; the actionable part is whether the permission exists, not who asserted it.

### Thread 9: .claude/skills/flash-cluster-iso/SKILL.md:114 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T23:16:27Z):

This section says the long-form `bun full-ai-cluster/tools/flash-usb.ts <iso-path>` “forces explicit device choice”, but `flash-usb.ts` still refuses to proceed when 2+ USB candidates are connected (it does not offer a device picker). The long-form challenge makes the device explicit in the consent phrase, but it doesn’t allow choosing among multiple devices—please adjust the wording to match the actual tool behavior.

## General comments

### @chatgpt-codex-connector (2026-05-25T23:51:31Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
