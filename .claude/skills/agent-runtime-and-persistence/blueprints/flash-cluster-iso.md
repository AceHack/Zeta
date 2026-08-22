---
name: flash-cluster-iso
description: Flash Zeta cluster installer ISO to USB from macOS via zflash + Touch ID; operator-only and agent-driven paths.
record_source: "operator-agent zflash flow, 2026-05-25 session"
load_datetime: "2026-05-25"
last_updated: "2026-06-01"
status: active
---

# Flash a Zeta cluster installer ISO to USB

Capability skill. No persona. Wear this hat when:

- Operator says "flash the USB" / "burn the cluster installer" / "make a boot stick"
- Operator already downloaded `~/Downloads/zeta-installer-*.iso`
- Target machine is **macOS** (Linux + Windows scopes filed at 081KSE6WT0008QG0R003BG8M6J + 081KSE6WT0008QG0R0025170CV; not in this skill)

## Two paths — pick by who's driving

### Path A — operator-only (fastest after first-time setup)

Operator runs everything; agent observes. ~3 keystrokes after setup.

1. **One-time** (per Mac): `bun full-ai-cluster/tools/zflash-setup.ts --install-alias`
   - Installs `pam_tid.so` at top of `/etc/pam.d/sudo` (Touch ID for sudo)
   - Installs `zflash` shell alias in `~/.zshrc`
   - Prompts for password ONCE; never again on this Mac
2. **Plug USB in**
3. `zflash` (or `bun full-ai-cluster/tools/zflash.ts`)
   - Wrapper auto-discovers newest `~/Downloads/zeta-installer-*.iso`
   - Auto-detects single USB candidate
   - Prints device details + current contents (see "Pre-flash display" below)
   - Prints a random `yes <4-hex>` challenge — type it back EXACTLY
   - `sudo dd` runs; PAM fires Touch ID prompt; touch the trackpad
   - Eject is automatic on success

### Path C — `--agent` flag (RECOMMENDED; native auto-type; supersedes Path B for most cases)

Per 081KSGS9H0008QG0R001EZKNCB (landed 2026-05-25; PR #5374 docs): `zflash` now has a native `--agent` flag that handles the auto-type challenge internally via piped stdin + stdout-tail challenge match. Cleaner than the `expect`-script approach.

Use when operator says "drive it" / "you flash" / "do the USB" and they're at the machine to fingerprint.

1. **Preconditions** (same as Path B): operator already ran `zflash-setup --install-alias`; USB plugged in; ISO at `~/Downloads/zeta-installer-*.iso`.
2. **Drive via `--agent`** — agent invokes zflash directly with the native flag:

   ```bash
   bun full-ai-cluster/tools/zflash.ts --agent 2>&1 | tail -100
   ```

3. **What the `--agent` flag does internally**:
   - Reads the `yes <nonce>` challenge from stdout as it appears
   - Writes the matched response back via stdin without external tooling
   - Emits glass-halo line `[agent-mode: auto-typing 'yes XXXX']` so operator sees the consent-token being typed
   - Touch ID prompt STILL fires on the operator's Mac for `sudo dd` (physical-presence gate preserved per 081KSE6WT0008QG0R003WW3YJQ)
4. **Default behavior unchanged**: zflash without `--agent` runs operator-only Path A flow. Agent-mode is explicit opt-in.

### Path B — agent-driven via `expect` (legacy; use Path C instead)

Pre-081KSGS9H0008QG0R001EZKNCB substrate; preserved for cases where the native `--agent` flag isn't available (older zflash builds) or for diagnostic / debugging scenarios where seeing the expect-script behavior is useful.

Use when operator says "drive it" / "you flash" / "do the USB" and they're at the machine to fingerprint.

1. **Preconditions** (verify before driving): operator already ran `zflash-setup --install-alias` (`grep pam_tid /etc/pam.d/sudo` succeeds); USB is plugged in (`diskutil list external` shows it); ISO exists (`ls ~/Downloads/zeta-installer-*.iso`).
2. **Drive via `expect`** — the agent reads the nonce from zflash's stdout and writes it back to the same process's stdin:

   ```bash
   expect -c '
   set timeout 600
   spawn bun full-ai-cluster/tools/zflash.ts
   expect {
     -re {type EXACTLY[^\n]*\n\s*\n\s*(yes [0-9a-f]+)} {
       set answer $expect_out(1,string)
       send "$answer\r"
       puts "\n>>> agent auto-typed: $answer"
       puts ">>> Touch ID prompt should fire on your Mac for the sudo dd"
       exp_continue
     }
     -re {Flash complete} { exit 0 }
     -re {flash-usb: } { exp_continue }
     eof { exit 1 }
     timeout { puts ">>> timeout"; exit 2 }
   }
   '
   ```

3. **What still requires the operator**: Touch ID. The agent's auto-typed `yes <nonce>` is the *consent-token* gate; the *physical-presence* gate is the operator's actual finger on the actual trackpad. The agent cannot bypass that even if it wanted to — the PAM stack reads the Touch ID sensor directly. This is the "I execute, you fingerprint" pattern (081KSE6WT0008QG0R003WW3YJQ rule).

### Future-state: `--bake-cred` flag (NOT YET IMPLEMENTED; tracked at 081KSNY2Z0008QG0R0011XCT94 + 081KSKBP80008QG0R003AX2A69.3b)

Per the zflash next-steps plan (`docs/research/2026-05-28-zflash-and-usb-credential-substrate-next-steps-plan.md` Track B), a future `--bake-cred <id>=<source>` flag will let agents bake operator credentials (GitHub PAT, AI vendor tokens, etc.) into the USB's encrypted blob at flash time. This composes 081KSGS9H0008QG0R001EZKNCB's `--agent` with 081KSKBP80008QG0R003AX2A69's USB-bound credential substrate.

Status as of 2026-05-28: row filed at 081KSNY2Z0008QG0R0011XCT94 (P1 ASAP); CLI flag is sketch-only in 081KSKBP80008QG0R003AX2A69.3b; not yet shipped in `zflash.ts`. Do NOT promise this capability today — operator demos use the install-time picker (Step 6.94/6.95-picker) for cred-baking instead. When `--bake-cred` lands, this skill section gets the canonical invocation pattern.

## Pre-flash display — what `zflash` shows BEFORE the prompt

After 2026-05-25 enhancement (081KSE6WT0008QG0R003WZAQKV follow-up):

```text
USB device identified:
  Device:      /dev/disk6
  Model:       USB 3.2.1 FD
  Vendor:      SanDisk
  IORegName:   SanDisk Ultra
  Serial:      4C530100050818119174
  Size:        115.46 GiB
  Protocol:    USB
  Removable:   true
  Writable:    yes
  Part. table: FDisk_partition_scheme
  Boot disk:   disk3  (target is not boot disk)

Currently on /dev/disk6 (will be DESTROYED):
  /dev/disk6s1   EFI System              3.1 MB   (none) — mounted at /Volumes/EFI

*** ALL DATA ON /dev/disk6 WILL BE DESTROYED ***
```

Read this output carefully BEFORE typing back the challenge. If the partition list contains an unfamiliar volume name with significant used-space, ABORT (Ctrl-C) and ask the operator before proceeding.

## Safety rails the script enforces (do not bypass)

Per 081KSE6WT0008QG0R0005XASX2 destructive-tool authoring contract:

| Rail | What it catches |
|---|---|
| Platform = macOS | Won't run on Linux/Windows (use manual `dd` flow there) |
| ISO extension + size 100MB–8GB | Catches wrong-file-as-ISO |
| Bus protocol = USB / USB-C | Won't flash external SSDs or internal disks |
| `Internal === false` | Won't flash internal storage |
| Size 1GB–512GB | Won't flash an external 4TB SSD by mistake |
| Boot-disk identifier check | Won't overwrite the OS disk if user is mid-recovery |
| Random per-run 4-hex nonce | Agent can't pre-bake the consent token |
| Strict flag allowlist (`--short`, `-h/--help` only) | Won't silently accept `--dry-run` typo and proceed anyway |
| Touch ID PAM gate on sudo | Physical-presence proof at flash time |

If any rail trips, the tool exits non-zero with a specific message. Do NOT add `--force` flags or sudo-bypass wrappers. If a rail is wrong for a legitimate case, fix the rail logic — don't disable it.

## Common questions

### "I have multiple USBs plugged in"

Both zflash and the long-form `bun full-ai-cluster/tools/flash-usb.ts <iso-path>` refuse (`refusing to pick one. Unplug all but the target USB and re-run`). The long-form's `accept-destroy <device> <8-hex>` challenge ties consent to a specific device path, but device-set ambiguity is rejected upstream of that prompt regardless of challenge format. Unplug everything except the target USB before running either form. Manual `sudo dd if=<iso> of=/dev/rdiskN bs=4m` is the documented escape hatch when single-USB-isolation isn't physically possible.

### "Touch ID didn't fire — I got a password prompt"

`zflash-setup --install-alias` wasn't run, OR the PAM line was reverted by a macOS update. Re-run setup; verify with `grep pam_tid /etc/pam.d/sudo`.

### "The operator isn't at the Mac — flash anyway?"

No. The Touch ID gate is by design — physical-presence is what the destructive-tool consent floor requires. If the operator is genuinely remote and the flash needs to happen, ask them to (a) come to the Mac for 5 seconds, OR (b) authorize a different flow explicitly (e.g., they run zflash themselves).

### "Linux / Windows version?"

Not in this skill. 081KSE6WT0008QG0R003BG8M6J (Linux: `pam_fprintd` / fingerprint readers) + 081KSE6WT0008QG0R0025170CV (Windows: Windows Hello) cover the cross-platform extension. For now on those platforms, fall back to documented manual `dd` / Rufus flow.

## Composes with

- 081KSE6WT0008QG0R003WW3YJQ — "I execute, you fingerprint" design pattern (rule + backlog row landing via PR #5006; cross-reference will resolve once it merges)
- `.claude/rules.bak/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` — the operator pushes `.claude/settings.json` edits themselves; the `Bash(bun full-ai-cluster/tools/flash-usb.ts *)` permission must be in settings already (operator-authorized for this skill's scope)
- 081KSE6WT0008QG0R003WZAQKV — zflash + Touch ID PAM + short challenge empirical anchor
- 081KSE6WT0008QG0R0005XASX2 — destructive-tool authoring contract
- 081KSE6WT0008QG0R003BG8M6J — Linux extension (planned)
- 081KSE6WT0008QG0R0025170CV — Windows extension (planned)

## Files

| Path | Role |
|---|---|
| `full-ai-cluster/tools/zflash.ts` | Operator-facing wrapper; auto-discovers ISO + invokes flash-usb with `--short` |
| `full-ai-cluster/tools/zflash-setup.ts` | One-time idempotent installer for PAM Touch ID + zsh alias |
| `src/Core.TypeScript/zflash/flash-usb.ts` | Core flasher with all safety rails, per-run nonce, sudo dd + diskutil orchestration |
| `full-ai-cluster/tools/README-flash-usb.md` | Long-form documentation |
