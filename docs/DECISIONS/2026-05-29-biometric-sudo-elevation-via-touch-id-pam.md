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
* **Option 2: Biometric Sudo Elevation via Touch ID PAM (`pam_tid.so`)** — Enable macOS Touch ID PAM integration (`pam_tid.so`) inside `/etc/pam.d/sudo`. Regular users run setup scripts in user-space, and individual commands requiring privileges call `sudo` which elevates cleanly via a quick biometric Touch ID press rather than password input, while avoiding permission ownership leaks.

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

## Decision Outcome

* **Chosen Option:** Option 2: Biometric Sudo Elevation via Touch ID PAM, because it maintains absolute file-system permission sanity (user-owned files) while providing an extremely high-security, low-friction biometric consent gate.

### Implementation Details

To enable this on a macOS development machine:

1. **Configure PAM Sudo:**
   Add `auth sufficient pam_tid.so` to the top of `/etc/pam.d/sudo`.
   ```bash
   # Add the module at the top of the file
   sudo sed -i '' '2i\
   auth sufficient pam_tid.so
   ' /etc/pam.d/sudo
   ```
2. **Terminal Integration:**
   Ensure terminal apps (like iTerm2 or VS Code) allow Touch ID PAM elevation.
   - For iTerm2: Preferences → Advanced → "Allow programs on this computer to monitor your keyboard" (if using specific keyboard shortcuts) or simply ensuring pam_tid is not blocked.
   - For VS Code: No extra setup usually needed.

3. **Background Daemon Boundary:**
   If a background process / agent requires passwordless elevation for standard non-destructive tasks, use specific `NOPASSWD` lines in `/etc/sudoers` targeted to single safe commands rather than the entire script, protecting security integrity.
