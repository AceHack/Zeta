# ADR: Biometric Sudo Elevation via Touch ID PAM

**Status:** accepted
**Date:** 2026-05-29
**Backlog:** 081KSE6WT0008QG0R003WZAQKV / 081KSNY2Z0008QG0R000ZNRFCE (follow-up)

## Context & Problem Statement

Zflash, setup scripts (`install.sh`), and various privileged macOS host tasks require administrative privileges (`root`).
Historically, developer toolchains or setup scripts have solved this by either:

1. Asking the operator to run `sudo tools/setup/install.sh` directly. This runs the entire toolchain script under `root:wheel` ownership, causing any newly generated tool outputs, virtual environments (e.g., `.venv`), cache files, or mise dependencies to be owned by `root`, resulting in subsequent permission denied errors for non-root commands.
2. Interactively prompting for the sudo password. However, this disrupts the agentic workflow, as background runners (e.g., background loop ticks) cannot interactively provide passwords and will hang indefinitely.

How do we grant necessary execution privileges to system commands in macOS securely and non-invasively, without breaking permission boundaries or requiring interactive password input during agent-driven or human-driven runs?

## Considered Options

* **Option 1: Require `sudo` wrapper for the whole script (Status Quo)** — Run entire installation or build tasks with `sudo command`.
* **Option 2: Biometric Sudo Elevation via Touch ID PAM (`pam_tid.so`)** — Enable macOS Touch ID PAM integration (`pam_tid.so`) via `/etc/pam.d/sudo_local` (see the 2026-08-24 correction below; this originally read `/etc/pam.d/sudo`, which OS updates replace). Regular users run setup scripts in user-space, and individual commands requiring privileges call `sudo` which elevates cleanly via a quick biometric Touch ID press rather than password input, while avoiding permission ownership leaks.

## Pros & Cons of the Options

### Option 1: Require `sudo` wrapper for the whole script

* **Pros:** Standard approach; no special macOS PAM configuration needed.
* **Cons:** Overwrites file ownership to `root:wheel`, causing cognitive load and execution friction when normal files cannot be edited by the user; hangs background runners when a password is required.

### Option 2: Biometric Sudo Elevation via Touch ID PAM

* **Pros:**
  - **Zero Permission Leaks:** The script runs in user-space, so all generated files, virtual environments, and mise caches are correctly owned by the developer (`acehack:staff`). Only specific commands run under `sudo`.
  - **Frictionless Human Experience:** Sudo tasks prompt for a simple Touch ID press on the trackpad or keyboard rather than typing passwords.
  - **Security-Honest Consent:** Biometric proof of physical presence is required for active execution, ensuring no hidden background privilege escalation.
* **Cons:**
  - **Headless Limits:** Headless terminals or background cron agents cannot supply Touch ID physical presence. Headless runners must use focused NOPASSWD limits in `/etc/sudoers` or run entirely inside user-space.

> **Correction, 2026-08-17 (work-item `081M06DSQ0Q087G0R000H91391`).** The "Security-Honest
> Consent" pro above over-states what this option delivers, and the over-statement was copied
> into the code that implements it. `auth sufficient pam_tid.so` is added to the **top** of a
> chain that continues `auth sufficient pam_smartcard.so` / `auth required pam_opendirectory.so`,
> and `man pam.conf(5)` is explicit that a failed `sufficient` module falls through: *"If it
> fails, the rest of the chain still runs, but the final result will be failure unless a later
> module succeeds."* `sudo` reports only its own exit status and never names the module that
> satisfied PAM. So on the stock chain this option gives **operator authentication**, not
> **biometric proof** — a smart-card PIN or the account password produces the same exit code.
> `tools/setup/persona-keys/biometric.ts` now reports that distinction (`factor:
> "unattributed"` vs `"biometric"`, `claimsBiometric()`); observing the biometric itself needs
> `LocalAuthentication`/`LAContext` and is tracked as `081M06KM523087G0R002ANKAZJ`.

## Decision Outcome

* **Chosen Option:** Option 2: Biometric Sudo Elevation via Touch ID PAM, because it maintains absolute file-system permission sanity (user-owned files) while providing an extremely high-security, low-friction biometric consent gate.

### Implementation Details

To enable this on a macOS development machine:

1. **Configure PAM Sudo:**

   ```bash
   bun tools/setup/touchid-sudo.ts --apply     # writes /etc/pam.d/sudo_local
   bun tools/setup/touchid-sudo.ts --verify    # read-only; raises no prompt
   ```

   > **Correction, 2026-08-24 (Dejan).** This step used to prescribe
   > `sudo sed -i '' '2i\ auth sufficient pam_tid.so' /etc/pam.d/sudo` — editing
   > `/etc/pam.d/sudo` **directly**. That instruction is the origin of the defect
   > measured on the fleet Mac the same day: `grep -c pam_tid /etc/pam.d/sudo`
   > returned 1 while `/etc/pam.d/sudo_local` did not exist.
   >
   > **macOS replaces `/etc/pam.d/sudo` on OS updates.** Apple ships
   > `/etc/pam.d/sudo_local.template` for exactly this reason; its own first line
   > reads *"local config file which survives system update"*, and the stock
   > `/etc/pam.d/sudo` already carries `auth include sudo_local`. So the direct
   > edit reverts to password-only at some future update, silently and with no
   > announcement — the house failure mode, a protection that stops applying
   > without saying so.
   >
   > The tool above writes `sudo_local` and never touches `/etc/pam.d/sudo`. It
   > is idempotent (re-running is a no-op), and `--verify` is the standing check
   > for the revert; `tools/setup/doctor.sh` runs it on every doctor pass.
   >
   > **`pam_reattach`** is handled by the same tool: without it the Touch ID
   > prompt does not appear inside `tmux`/`screen`, which is where agent work
   > usually runs. `brew install pam-reattach`, then re-run `--apply`.
2. **Terminal Integration:**
   Ensure terminal apps (like iTerm2 or VS Code) allow Touch ID PAM elevation.
   - For iTerm2: Preferences → Advanced → "Allow programs on this computer to monitor your keyboard" (if using specific keyboard shortcuts) or simply ensuring pam_tid is not blocked.
   - For VS Code: No extra setup usually needed.

3. **Background Daemon Boundary:**
   If a background process / agent requires passwordless elevation for standard non-destructive tasks, use specific `NOPASSWD` lines in `/etc/sudoers` targeted to single safe commands rather than the entire script, protecting security integrity.
