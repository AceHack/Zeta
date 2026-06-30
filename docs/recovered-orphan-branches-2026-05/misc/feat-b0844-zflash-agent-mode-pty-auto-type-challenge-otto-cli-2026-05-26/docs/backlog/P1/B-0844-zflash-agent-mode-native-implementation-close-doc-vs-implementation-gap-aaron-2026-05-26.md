---
id: B-0844
priority: P1
status: open
title: zflash --agent flag — native agent-driven auto-type challenge implementation closing the docstring-vs-actual-implementation gap; empirical anchor from 2026-05-26 USB-re-flash session (Aaron 2026-05-26)
effort: S
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on: []
composes_with:
  - B-0789
tags: [zflash, agent-driven, auto-type-challenge, pty, child-process-spawn, doc-implementation-gap, substrate-honest-disclosure, ux-improvement, touch-id-pam-preserved]
---

## Problem

Empirical anchor 2026-05-26 (3rd USB re-flash session): operator authorized agent-driven zflash with Touch ID approval. Agent ran `bun full-ai-cluster/tools/zflash.ts | tail -50` which:

1. Generated random nonce + printed "type: yes 649d" challenge
2. Touch ID PAM gate fired (operator approved)
3. **`readline.question("> ")` returned empty string immediately** (stdin closed by `| tail` pipeline)
4. Flash-usb.ts bailed silently (the bail error was swallowed by `| tail -50` filter)
5. zflash.ts caught the non-zero exit + called process.exit(status)
6. BUT — iter-4.2 inject phase ran on the PRE-EXISTING USB ESP (NOT a freshly-flashed one), masking the failure
7. Operator saw "iter-4.2: wrote pubkey... USB ejected." — believed flash succeeded
8. Operator reported "i got the fingerprint but it didn't format" after attempting to boot

The flash actually didn't happen. Operator + agent both observed the failure-mode disguised as success.

### Root cause

The zflash.ts docstring promises (line 56-63):

> "Agent-driven mode: When the runner is an authorized agent acting on the operator's behalf per the flash-usb.ts authorship contract, the agent auto-types the `yes <nonce>` challenge. The Touch ID PAM gate still fires on the operator's Mac — that's the consent floor for the destructive operation."

But the IMPLEMENTATION uses `execFileSync("bun", flashUsbArgs, { stdio: "inherit" })` (line 955) which inherits parent stdio. If the parent has piped stdin (e.g., `| tail`), the child reads empty stdin → readline returns "" → bail.

**The agent-driven mechanism is in the docstring; not in the code.**

Per `.claude/rules/substrate-or-it-didnt-happen.md` — "A directive that lives only in a conversation is not a directive. It is weather. Substrate or it didn't happen." Same applies to feature promises in docstrings without backing implementation. The agent-driven mode WAS WEATHER. This row makes it SUBSTRATE.

### The empirical workaround (used in 2026-05-26 session)

External `expect` wrapper works as workaround:

```bash
expect <<'EOF'
set timeout 600
spawn bun full-ai-cluster/tools/zflash.ts
expect -re {  yes ([0-9a-f]{4})}
set nonce $expect_out(1,string)
expect "> "
send "yes $nonce\r"
expect "safe to remove USB"
EOF
```

This works but:

- Requires `expect` (BSD or GNU; on macOS by default, not always on minimal Linux)
- Requires the agent to know to wrap with expect (undocumented)
- The agent-driven mode IS PROMISED in the docstring — should be native

## Target

Add `--agent` flag to zflash.ts that switches from `execFileSync({stdio: "inherit"})` to `spawn` with piped stdin/stdout — read stdout for the `yes <nonce>` line, auto-type the response back to stdin, then pass everything through (stdout + stderr) so the operator can still see dd progress + Touch ID PAM prompt context.

### Implementation sketch

```typescript
// In zflash.ts main(), after parsing args:
if (agentMode) {
  const child = spawn("bun", flashUsbArgs, { stdio: ["pipe", "pipe", "inherit"] });
  let buffer = "";
  let challengeAnswered = false;

  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    process.stdout.write(text);  // pass through to operator's view

    if (!challengeAnswered) {
      buffer += text;
      // Match the "  yes XXXX" challenge format from flash-usb.ts
      const m = buffer.match(/^\s+yes ([0-9a-f]{4})\s*$/m);
      if (m) {
        const nonce = m[1];
        process.stdout.write(`\n[agent-mode: auto-typing 'yes ${nonce}']\n`);
        child.stdin.write(`yes ${nonce}\n`);
        child.stdin.end();
        challengeAnswered = true;
      }
    }
  });

  const exitCode: number = await new Promise((res) =>
    child.on("close", (c) => res(c ?? 1)),
  );
  process.exit(exitCode);
} else {
  // existing default behavior — execFileSync with inherited stdio
  execFileSync("bun", flashUsbArgs, { stdio: "inherit" });
}
```

### What the agent-mode DOES preserve

- **Touch ID PAM gate**: fires on operator's Mac for `sudo dd`; cannot be bypassed by agent
- **Nonce randomness**: random per-run; agent reads from stdout, can't pre-bake
- **Runtime acceptance**: agent typing the EXACT challenge string IS the acceptance signal; this is unchanged
- **Glass-halo transparency**: `[agent-mode: auto-typing 'yes XXXX']` is printed so operator sees what's happening

### What the agent-mode DOESN'T bypass

- **All flash-usb sanity rails** (platform / ISO size / USB protocol / internal-disk / boot-disk / size-range checks) still fire
- **The dd itself** still requires sudo + Touch ID PAM approval
- **iter-4.2 inject** still requires sudo for mount_msdos + Touch ID PAM approval

## Acceptance

- `bun full-ai-cluster/tools/zflash.ts --agent` works end-to-end with stdout filter (`| tail`, `2>&1`, etc.) without breaking the challenge response
- Backward-compatible: default behavior (no `--agent` flag) unchanged
- Glass-halo: operator sees `[agent-mode: auto-typing 'yes XXXX']` line so the flow is transparent
- Test: a full re-flash via `bun zflash.ts --agent 2>&1 | tail -100` completes with "Flash complete." visible
- Touch ID PAM gate fires AS USUAL on operator's Mac (verifies no bypass)

## Substrate-honest framing

P1 priority because:

- Empirical 3rd USB-test session failure mode (operator + agent both saw masked failure)
- The docstring promises agent-driven mode; the implementation must match per `substrate-or-it-didnt-happen.md`
- Bounded scope (~30-line change to zflash.ts; no new deps; backward-compatible)
- Reduces operator-Touch-ID-tax going forward (one approval per flash, not multiple if flash silently fails)
- Documented workaround (expect wrapper) is fine for now but external dependency is fragile

The empirical 2026-05-26 session demonstrated the bug-and-workaround flow. This row lands the substrate-native fix.

## Composes with

- B-0789 (iter-4.2 ssh-pubkey-injection substrate — same zflash codebase)
- `.claude/rules/substrate-or-it-didnt-happen.md` (substrate vs weather; docstring promises must have backing implementation)
- `.claude/rules/glass-halo-bidirectional.md` (operator-visibility of auto-type action via printed `[agent-mode: ...]` line)
- `.claude/rules/non-coercion-invariant.md` HC-8 (operator agency preserved — Touch ID PAM still required)
- `.claude/rules/agent-worktree-hygiene-never-hold-main-never-step-on-operator-cleanup-on-pr-merge.md` (agent-mode reduces friction without bypassing operator gates)
- `.claude/skills/flash-cluster-iso/SKILL.md` (skill body should reference the `--agent` flag once landed)

## Origin

Empirical 2026-05-26 USB re-flash session. Operator: *"i got the fingerprint but it didn't format"* (1st run failed silently due to docstring-vs-implementation gap). Workaround: external `expect` wrapper (worked; substantive). Operator query: *"(no built-in pty helper). should we build it this way instead?"* — this row is the YES.

Per `.claude/rules/honor-those-that-came-before.md` — preserve the existing zflash.ts substrate (iter-4.2 inject, PAM gating, sanity rails); ADD agent-mode as a flag, don't refactor the existing default behavior.

Per "you can always commit backlog rows immediately they get decomposed later" discipline. The implementation can be a follow-up PR; this row creates the substrate anchor + acceptance criteria.
