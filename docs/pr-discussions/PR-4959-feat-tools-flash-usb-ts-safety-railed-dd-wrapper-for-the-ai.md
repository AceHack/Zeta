---
pr_number: 4959
title: "feat(tools): flash-usb.ts \u2014 safety-railed dd wrapper for the AI-cluster ISO"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T17:20:21Z"
merged_at: "2026-05-25T17:22:51Z"
closed_at: "2026-05-25T17:22:52Z"
head_ref: "feat/flash-usb-safety-rail-script-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-27T19:50:03Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4959: feat(tools): flash-usb.ts — safety-railed dd wrapper for the AI-cluster ISO

## PR description

## Summary

TypeScript script (per Rule 0) at `full-ai-cluster/tools/flash-usb.ts` that wraps `dd` with hard-coded safety guards so picking the wrong device is structurally impossible. Built so the maintainer (and any agent the maintainer authorizes) can flash the AI-cluster installer ISO without `dd if=*.iso of=/dev/disk<typo>` blast-radius risk.

## Hard refusals (exit 2)

- Not running on macOS (Linux is TODO; doc lists manual fallback)
- ISO arg missing, not a file, or not `*.iso`
- ISO size outside [200 MiB, 8 GiB]
- Zero or 2+ USB devices found (ambiguous)
- Candidate is not USB/USB-C protocol
- Candidate reports as Internal
- Candidate IS the current boot disk
- Candidate size outside [4 GiB, 256 GiB]

## Confirmation gate (exit 1)

- Operator must type the FULL device path (e.g. `/dev/disk4`) exactly
- Typing `yes`/`y` is REJECTED — typed-path IS the visual verification

## Flow

`unmount → sudo dd to /dev/rdiskN (raw, ~10x faster) with bs=4m conv=sync status=progress → eject`

## Implementation

- All subprocess calls use `execFileSync` (argv-array, no shell interpolation, no injection risk)
- `assertSafeDevicePath` whitelists `/dev/disk\d+$` — belt-and-suspenders even though `diskutil` produces the strings itself
- Parses `diskutil`'s plist output via `plutil -convert json` for structured access vs string-scraping (stable across macOS versions)

## Agent authorization (after merge)

The classifier blocks ad-hoc `dd` + `diskutil list` as composite high-blast-radius operations. To allow an autonomous agent to run THIS script (which has its own gates baked in), the maintainer can add:

```json
"permissions": { "allow": [
  "Bash(bun full-ai-cluster/tools/flash-usb.ts *)"
] }
```

The safety rails are what makes that permission grant reasonable.

## Test plan

- [ ] `bun tools/flash-usb.ts` (no args) prints usage + exits 2
- [ ] `bun tools/flash-usb.ts /tmp/nonexistent.iso` exits 2 with "does not exist"
- [ ] `bun tools/flash-usb.ts /tmp/tiny.iso` (file <200MiB) exits 2 with size complaint
- [ ] With one USB plugged in + valid ISO: shows device summary; rejects `yes`; accepts the typed path; flashes
- [ ] With two USBs plugged in: refuses (exit 2) and lists both
- [ ] Without any USB: refuses (exit 2) with re-plug suggestion

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-25T17:23:36Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `fe466f8b85`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: full-ai-cluster/tools/flash-usb.ts:263 (unresolved)

**@chatgpt-codex-connector** (2026-05-25T17:23:36Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Revalidate device identity before launching dd**

The script writes to a previously captured `/dev/diskN` node without re-checking that it still maps to the same physical device at write time. On macOS, disk identifiers are volatile across detach/attach events, so if the target is unplugged/replugged (or another device appears) between confirmation and `dd`, the same path can point at different hardware and the script can overwrite the wrong disk despite the typed-path gate. Add a final identity check (e.g., stable UUID/serial from `diskutil info -plist`) immediately before spawning `dd`.

Useful? React with 👍 / 👎.
