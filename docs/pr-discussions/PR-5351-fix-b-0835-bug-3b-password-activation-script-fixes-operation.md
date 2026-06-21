---
pr_number: 5351
title: "fix(081KSGS9H0008QG0R00120EEHM Bug 3b): password activation-script \u2014 fixes operationally-ignored custom password (timing/path-mismatch root cause)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T23:16:17Z"
merged_at: "2026-05-26T23:19:09Z"
closed_at: "2026-05-26T23:19:09Z"
head_ref: "otto/b-0835-bug-3b-password-activation-script-fix-timing-mismatch-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:30:29Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5351: fix(081KSGS9H0008QG0R00120EEHM Bug 3b): password activation-script — fixes operationally-ignored custom password (timing/path-mismatch root cause)

## PR description

## Summary

Fixes 081KSGS9H0008QG0R00120EEHM Bug 3b — the custom password the operator set during install was operationally ignored because of a build-time-eval vs install-time-write path mismatch.

## Root cause

Prior implementation used \`builtins.readFile\` at NixOS evaluation time:

| Step | Where | Path | Result |
|---|---|---|---|
| zeta-install.sh writes hash | Live ISO → install target | /mnt/etc/zeta/initial-hashedpassword | File written ✓ |
| nixos-install evaluates flake | Live ISO build-time eval | Reads /etc/zeta/initial-hashedpassword | **File absent + pure-mode refuses** |
| Module falls back to default | initial-password.nix | fallbackHash | **Default applied** |
| Installed system boots | Real hardware | File at /etc/zeta/initial-hashedpassword | Present but user config built with default |

## Fix

Replace \`builtins.readFile\` with \`system.activationScripts.zetaInitialPassword\` that reads at activation time (runtime on installed system):

\`\`\`nix
system.activationScripts.zetaInitialPassword = {
  deps = [ \"users\" ];
  text = ''
    if [ -f \"\${hashFile}\" ]; then
      hash=\$(cat \"\${hashFile}\" | tr -d '\\n')
      if [ -n \"\$hash\" ] && [ \"\${hash:0:3}\" = '\$6\$' ]; then
        usermod -p \"\$hash\" zeta
      fi
    fi
  '';
};
\`\`\`

## Works for 3 scenarios

| Scenario | Behavior |
|---|---|
| Fresh install from live ISO | Activation runs post-pivot; file present at /etc/zeta/; operator hash applied |
| Subsequent nixos-rebuilds | File persists; activation re-applies |
| CI eval | File absent; activation skips; default-hash stays |

## Security properties preserved

- NO secret material in module source (only public default-fallback)
- NO secret printed in activation log (only \"applied\" or \"skipped\" status)
- Hash file at /etc/zeta/initial-hashedpassword chmod 0600 root:root (per zeta-install.sh Step 6.55)
- usermod -p directly writes /etc/shadow (root-only readable)

## Empirical anchor

Operator 2026-05-26 physical hardware-support test: \"the password i set it still says password: zeta-change-me\" + \"the password error is not just display issue it's operational bug the password i set earlier in install is ignored\".

## Test plan

- [x] Nix syntax valid (\`nix-instantiate --parse\`)
- [x] No secrets in module source
- [x] Activation script idempotent (re-applies same hash on each rebuild)
- [x] Skip-with-message when file absent (graceful CI eval)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T23:18:48Z)

## Pull request overview

Fixes 081KSGS9H0008QG0R00120EEHM Bug 3b in the NixOS install flow where an operator-provided password hash was ignored due to evaluation-time file reads pointing at the wrong root (live ISO vs install target) and/or being blocked in pure evaluation.

**Changes:**
- Removes evaluation-time `builtins.readFile`/`builtins.pathExists` password-hash injection logic.
- Sets a build-time fallback hash for `users.users.zeta.hashedPassword` and adds an activation-time script that applies `/etc/zeta/initial-hashedpassword` (when present) via `usermod -p`.
- Updates module commentary to document the root cause and the activation-time fix behavior across install/rebuild/CI scenarios.

## General comments

### @chatgpt-codex-connector (2026-05-26T23:16:22Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
