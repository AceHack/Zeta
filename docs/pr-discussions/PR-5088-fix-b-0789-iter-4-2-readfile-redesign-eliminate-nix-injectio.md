---
pr_number: 5088
title: "fix(081KSGS9H0008QG0R002T3BJ2R iter-4.2): readFile redesign \u2014 eliminate Nix-injection class entirely (closes residual ${...} antiquotation vector from #5086)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T04:32:42Z"
merged_at: "2026-05-26T04:36:18Z"
closed_at: "2026-05-26T04:36:18Z"
head_ref: "otto-cli/iter42-fixfwd-5-copilot-findings-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:44:40Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5088: fix(081KSGS9H0008QG0R002T3BJ2R iter-4.2): readFile redesign — eliminate Nix-injection class entirely (closes residual ${...} antiquotation vector from #5086)

## PR description

## Summary

Per the maintainer's 2026-05-26 *"take your time with the security fix"* + *"you can do whatever you think is best"* signals. PR #5086 (already merged at `0b9f5ea`) shipped the minimal sed-escape that the Copilot finding asked for — but on second review I found it MISSES Nix's `${expr}` antiquotation. If a pubkey comment contains `${anything}`, it'd evaluate at install time — same Nix-injection class, different vector.

Adding `$` to the sed pipeline would fix that specific vector but the underlying problem stays: untrusted USB content going through a Nix string parser is whack-a-mole.

**This PR eliminates the class entirely** — pubkey content never goes through the Nix string parser.

## Redesign

- `operator-ssh-keys.nix` reads pubkey list from a sibling `operator-ssh-keys.txt` file via `builtins.readFile` + `lib.splitString "\n"` + `builtins.filter` (skip blank + comment lines). **Untrusted content is data, never code.**
- `operator-ssh-keys.txt` (new file): stub in repo with comment header; populated by `zeta-install.sh` during install.
- `zeta-install.sh`: simplified to `sudo cat $PUBKEY_FILE | sudo tee operator-ssh-keys.txt` (with header lines). The sed-escape + Nix-string-generation code from #5086 is REMOVED — replaced with the simpler tee write.
- Manual edit path unchanged: operator edits `operator-ssh-keys.txt` directly + `nixos-rebuild`.

## Threat-model after redesign

| Attack vector | Pre-#5086 | Post-#5086 (current main) | Post-this-PR |
|---|---|---|---|
| `"` in pubkey comment | Invalid Nix | Escaped → safe | Data → safe |
| `\` in pubkey comment | Invalid Nix | Escaped → safe | Data → safe |
| `${...}` antiquotation | **CODE EXEC** | **CODE EXEC** (sed missed `$`) | Data → safe |
| `''${...}''` indented-string antiquotation | N/A | N/A | Data → safe |
| Any future Nix escape syntax | Class | Whack-a-mole | Class eliminated |

## Files

- `full-ai-cluster/nixos/modules/operator-ssh-keys.nix`: switch from inline keys to `builtins.readFile ./operator-ssh-keys.txt` + filter
- `full-ai-cluster/nixos/modules/operator-ssh-keys.txt`: new stub file with comment header
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh`: simplified inject block (tee replaces sed-escape Nix-gen)

## Composes with

- PR #5083 (iter-4.2 substrate that #5086 fix-forwarded; this PR is the second-pass thorough fix)
- PR #5086 (sed-escape fix-forward for `\` + `"` + the other 4 findings; this PR supersedes the Nix-string-gen part of that PR with the readFile design)

## Test plan

- [x] shellcheck clean on zeta-install.sh
- [x] readFile design uses standard NixOS lib functions (`lib.splitString`, `lib.hasPrefix`, `builtins.filter`, `builtins.readFile`, `builtins.pathExists`)
- [ ] CI passes (gate workflow + CodeQL)
- [ ] Maintainer's next iter-4.2 flash uses this design — first end-to-end test

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T04:36:33Z)

## Pull request overview

This PR redesigns the iter-4.2 SSH-key injection path to eliminate Nix string-parsing of USB-supplied pubkey material by switching from generating a `.nix` file with embedded strings to writing a plain `.txt` file that is read via `builtins.readFile`.

**Changes:**

- Update the NixOS module to read authorized keys from a sibling `operator-ssh-keys.txt` file instead of inline Nix string literals.
- Add `operator-ssh-keys.txt` stub file to the repo as the canonical editable key list.
- Simplify `zeta-install.sh` to write the detected USB pubkey file directly into `operator-ssh-keys.txt` during install, and broaden `zflash.ts` pubkey validation/`~/` expansion behavior.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 4 comments.

| File | Description |
| ---- | ----------- |
| full-ai-cluster/usb-nixos-installer/zeta-install.sh | Writes probed pubkey content to `operator-ssh-keys.txt` instead of generating a Nix file. |
| full-ai-cluster/tools/zflash.ts | Broadens pubkey type validation and expands `~/` in `--ssh-key` paths. |
| full-ai-cluster/nixos/modules/operator-ssh-keys.txt | New stub file that holds operator SSH pubkeys as data. |
| full-ai-cluster/nixos/modules/operator-ssh-keys.nix | Reads and filters key lines from `operator-ssh-keys.txt` via `builtins.readFile`. |

## Review threads

### Thread 1: full-ai-cluster/usb-nixos-installer/zeta-install.sh:322 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:36:32Z):

`PUBKEY_LINE_COUNT` is computed via a `sudo cat | grep` pipeline. With `set -euo pipefail`, this is more brittle than it needs to be (and can yield an empty/non-numeric value if the pipeline produces no output, causing `[ "$PUBKEY_LINE_COUNT" -gt 0 ]` to error and abort the install). Prefer computing the count via a single `sudo grep -Ec` (or similar) and ensure the variable always defaults to `0`.

### Thread 2: full-ai-cluster/usb-nixos-installer/zeta-install.sh:325 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:36:32Z):

These warning strings still refer to `operator-ssh-keys.nix`, but the probe now writes `operator-ssh-keys.txt` and the module reads from that file. The message should be updated (and ideally the later fallback instructions in this script too) to avoid sending operators to edit the wrong file.

### Thread 3: full-ai-cluster/nixos/modules/operator-ssh-keys.nix:50 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:36:33Z):

`rawLines` calls `builtins.readFile keysFile` unconditionally, so the later `builtins.pathExists keysFile` check doesn't prevent an evaluation error if the file is missing. Also, the current “trim” only strips a single leading/trailing space, so whitespace-only lines (or indented `#` comments / CRLF `\r`) can slip through and become authorizedKeys entries. Consider guarding the `readFile` behind `pathExists` and using a proper trim + comment/blank filter (and optionally stripping `\r`).

### Thread 4: full-ai-cluster/nixos/modules/operator-ssh-keys.nix:31 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T04:36:33Z):

This module comment references `maintainers/aaron/legal-entities/inventory.md`, which is a maintainer-specific path/name leaking into a reusable module comment. If you need a pointer, prefer a stable doc/backlog reference (e.g., the relevant 081KSGS9H0008QG0R002T3BJ2R backlog entry) rather than a person-specific path.

## General comments

### @chatgpt-codex-connector (2026-05-26T04:32:45Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
