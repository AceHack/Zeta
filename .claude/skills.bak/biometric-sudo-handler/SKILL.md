---
name: biometric-sudo-handler
description: Handles macOS sudo, password, and Touch ID prompts in background runs; avoids leaks and root-owned workspaces.
---

# Biometric Sudo Handler

Understand and resolve password prompts, privilege elevations, and biometric gates on macOS without breaking permission boundaries.

## When to use

Use this skill when:

- A background runner (like the loop daemon or test suite) hangs or times out on standard commands, potentially waiting for a `sudo` password.
- The setup or installation scripts (`install.sh`) require admin privileges.
- You need to explain to the operator how to configure biometric authentication for frictionless passwordless execution of host tasks.
- A user or agent proposes running execution commands under `sudo` directly inside the workspace directory.

## Core Rules & Workflow

### 1. Never Run Workspace Scripts under Root `sudo`

Running entire scripts (like `install.sh`, `dotnet build`, or `npm install`) as `sudo` is a critical permission failure mode.
It changes file ownership inside `.venv/`, `node_modules/`, `bin/`, or standard cache directories to `root:wheel`. This corrupts the local user's workspace, leading to subsequent permission denied errors for all normal operations.

- **Enforce User-Space Execution:** Always execute workspace and repository commands under the regular developer account (`acehack:staff`).
- **Targeted Sudo ONLY:** If a specific command (like mounting partitions or editing system PAM configs) requires elevation, invoke `sudo` specifically for that single call rather than the enclosing script.

### 2. Detect Headless Sudo Hangs

Background agents cannot interactively type passwords. If a command runs and does not return within its expected window:

- Check command output logs for prompts like `Password:` or biometric challenges.
- In headless loops, avoid calling `sudo` interactively. Use `sudo -n` (non-interactive) to fail-closed immediately instead of hanging the agent runner.

### 3. Advise Touch ID PAM Integration

To allow the operator to elevate privileges seamlessly without typing passwords and without introducing security bypasses:

- Advise enabling the macOS Touch ID PAM module (`pam_tid.so`) inside `/etc/pam.d/sudo`.
- This maps `sudo` elevation directly to the trackpad/keyboard fingerprint reader on the developer's Mac.
- The Secure Enclave handles authentication; no credentials flow through terminal streams, and physical presence is verified.

## Biometric Sudo Setup Verification

To check if the biometric PAM gate is active:

```bash
# Check if pam_tid.so is configured in the pam.d sudo layout
grep "pam_tid.so" /etc/pam.d/sudo
```

If it is missing, instruct the operator to add it:

```bash
# Append to the top of /etc/pam.d/sudo (under the initial comment)
sudo sed -i '' '2i\
auth sufficient pam_tid.so
' /etc/pam.d/sudo
```

## Failure Modes

- **Workspace Corruption:** Running `sudo build` or `sudo install` because a file wouldn't edit. Fix: restore correct permissions using `sudo chown -R $(whoami) .` and configure localized targets instead.
- **Background Loop Stalls:** Running interactive `sudo` in the background loop causing it to block. Fix: run loop scripts strictly under user space and use non-interactive commands.
