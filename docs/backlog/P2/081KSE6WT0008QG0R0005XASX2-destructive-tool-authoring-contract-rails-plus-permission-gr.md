---
id: 081KSE6WT0008QG0R0005XASX2
priority: P2
status: open
title: "Destructive-tool authoring contract — safety rails + permission-grants-INVOCATION-not-absolution + runtime-acceptance gate with nonce; canonical pattern landed in flash-usb.ts"
created: 2026-05-25
last_updated: 2026-05-25
classification: convention-codify
decomposition: atomic
type: tooling-substrate
discovered_by: aaron
owners: [aaron, maintainer]
composes_with:
  - full-ai-cluster/tools/flash-usb.ts
  - full-ai-cluster/tools/README-flash-usb.md
  - .claude/settings.json
---

# 081KSE6WT0008QG0R0005XASX2 — Destructive-tool authoring contract

## Carved blade

> Every destructive CLI tool in the repo follows the same three-part shape: hard safety rails refuse known bad inputs; the `.claude/settings.json` permission rule grants INVOCATION not absolution; a runtime-acceptance gate (per-run nonce + explicit `accept-<verb>` phrase) shifts responsibility to the runner who completes it. Flash-usb.ts is the canonical reference. New destructive tools follow it.

## Origin

Aaron 2026-05-25, after landing the flash-usb hardening (PR #4974 — runtime nonce + `accept-destroy` phrase + responsibility-acceptance language + permission rule):

> *"this is a good flow now that addison and max are on the project i dont mind thinking about safety more"*

Then on the convention-codify question:

> *"sure sounds good"*

The flow we landed for flash-usb.ts is general — works for any destructive operation that might enter the repo later. Codifying it as a CONTRACT means the next destructive-tool author (whether Aaron, Max, Addison, future contributor, or an agent) has the template ready instead of re-deriving the pattern under pressure.

## Why this shape now (and not earlier)

Single-maintainer + single-trusted-agent: ceremony costs more than it pays back. Trust-by-proximity covers the gaps.

Team + multiple agents + new-to-CLI / new-to-K8s contributors: every safety rail is a contract everyone can AUDIT, not trust-by-proximity. Addison is new to terminal; Max is new to K8s. Future contributors will have their own gaps. The script-with-rails shape protects ALL participants — including the script author — from the failure modes of the participants who don't have full intuition for the destructive surface yet.

Aaron's framing: *"every safety rail you bake in is a contract everyone can audit, not just trust-by-proximity."*

## The contract (three parts)

### Part 1 — Hard safety rails

The tool refuses known bad inputs BEFORE any destructive action. Each refusal exits with a clear class:

- exit 2 = safety check failed (bad input, wrong device class, ambiguous target)
- exit 1 = user aborted (acceptance gate mismatch, interrupted)
- exit 0 = success

For flash-usb.ts the rails are:

- platform check (macOS only)
- ISO file exists + `.iso` extension + sane size [200 MiB, 8 GiB]
- exactly one USB device found (0 or 2+ refuses)
- USB / USB-C protocol (refuses non-USB)
- not Internal (refuses internal disks reporting as USB-connected)
- not the boot disk (refuses if device IS the current `/` mount)
- size in [4 GiB, 256 GiB] (refuses external SSDs that pass the USB filter)

For other destructive tools, the rails are different but the SHAPE is the same: enumerate the known bad-input classes, refuse early with an actionable error, exit with a class code.

### Part 2 — Permission rule grants INVOCATION, not absolution

The `.claude/settings.json` permission rule is the AGENT-INVOCATION grant — it tells the classifier "this specific script is pre-vetted for agent invocation." Pattern:

```json
"permissions": {
  "allow": [
    "Bash(bun full-ai-cluster/tools/<your-script>.ts *)"
  ]
}
```

Discipline:

- The rule MUST be a path-scoped rule, not a wildcard. `Bash(bun *)` matches but doesn't tell the classifier "this specific path is pre-vetted."
- The rule's PR description MUST explain that this permission grants invocation, not absolution. The safety logic lives in the script.
- The rule MUST be reviewed alongside the script in the same PR. Permission rules without their target script in the same review are unsafe — the reviewer can't see what's being permitted.

### Part 3 — Runtime acceptance gate with per-run nonce

The tool prompts the runner to type an exact phrase BEFORE the destructive action. The phrase contains:

- The verb `accept-<action>` (e.g., `accept-destroy`, `accept-wipe`, `accept-rotate`)
- The TARGET (e.g., device path, cluster name, key ID)
- A fresh random nonce printed at THIS run

Example from flash-usb.ts:

```
*** ALL DATA ON /dev/disk4 WILL BE DESTROYED ***

By completing the confirmation prompt below, the runner
(human OR agent acting on their behalf) accepts responsibility
for the contents of the destination device.

To proceed, type EXACTLY (case-sensitive, single line):

  accept-destroy /dev/disk4 a3f9c1d2

>
```

Why each piece matters:

- **`accept-<verb>`** — explicit signing language. The runner ISN'T just verifying a name; they're SIGNING acceptance. Typing the phrase IS the signature.
- **TARGET** — the runner has to OBSERVE + REPRODUCE the target. Catches typos + wrong-target selection.
- **Per-run nonce** — fresh `randomBytes(4).toString("hex")` each invocation. An agent cannot pre-bake the answer; the runner has to OBSERVE the displayed value at THIS run. Stops naive automation of bypass.
- **`yes`/`y` REJECTED** — short-form confirmations don't prove the runner looked at the device.
- **Exact match required** — any mismatch (typo, wrong case, wrong nonce, wrong target) refuses with a clear error showing expected vs got.

## Liability framing (document this in the tool + the PR)

Document somewhere in the script header AND the README AND the PR body:

> By completing the runtime confirmation prompt, the runner (whether human OR agent acting on a runner's behalf) accepts responsibility for the [TARGET] contents. The maintainer who committed this script + the permission rule has no liability for a downstream runner who accepts responsibility at the runtime gate.

Per the framework's autonomy-first-class + NCI disciplines: agents act on their owner's behalf; the owner is responsible for their agent's actions; you are not responsible for what another maintainer's agent decides to do with substrate you provided in good faith.

Operationally:

- If an agent pipes input to bypass the gate → bypasser's responsibility, not yours
- If the runner accepts the gate by typing the phrase AND the destructive action destroys something valuable that passed every safety rail → runner accepted the risk; script worked as designed
- If the safety rails missed a class of input that shouldn't be destructive-targeted → file a backlog row to fix the rails; that's substrate everyone benefits from, not a liability claim

## TypeScript template

Future destructive-tool authors can adapt this skeleton:

```typescript
#!/usr/bin/env bun
// full-ai-cluster/tools/<my-destructive-tool>.ts
//
// [Tool description, exit codes, usage, authorization rule, liability framing]

import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

function bail(code: number, msg: string): never {
  process.stderr.write(`my-tool: ${msg}\n`);
  process.exit(code);
}

async function main() {
  // ── 1. Parse args; refuse on bad input shape (exit 2) ──
  // ── 2. Hard safety rails — refuse known bad targets (exit 2) ──
  // ── 3. Display target summary ──
  // ── 4. Runtime acceptance gate ──
  const target = /* the resolved target after gates */;
  const nonce = randomBytes(4).toString("hex");
  const phrase = `accept-<verb> ${target} ${nonce}`;

  process.stdout.write(`\n*** [destructive consequence of action on ${target}] ***\n\n`);
  process.stdout.write(
    "By completing the confirmation prompt below, the runner\n" +
      "(human OR agent acting on their behalf) accepts responsibility\n" +
      "for [TARGET's contents/state/etc].\n\n",
  );
  process.stdout.write("To proceed, type EXACTLY (case-sensitive, single line):\n\n");
  process.stdout.write(`  ${phrase}\n\n`);

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const typed = (await rl.question("> ")).trim();
  rl.close();

  if (typed !== phrase) {
    bail(1,
      `confirmation mismatch — runner did NOT accept responsibility.\n` +
      `  expected: ${phrase}\n` +
      `  got:      ${typed || "(empty)"}\n` +
      `Aborted.`,
    );
  }

  // ── 5. The destructive action ──
  // ── 6. Cleanup + report ──
}

main().catch((err) => {
  bail(1, err instanceof Error ? err.message : String(err));
});
```

## Acceptance

- [ ] `full-ai-cluster/tools/README-destructive-tool-pattern.md` written, documenting the 3-part contract with code template + worked example pointing at flash-usb.ts
- [ ] `flash-usb.ts` README cross-links to the pattern doc as "this tool follows the destructive-tool authoring contract"
- [ ] Mention in `CONTRIBUTING.md` (or equivalent) — "destructive tools follow `full-ai-cluster/tools/README-destructive-tool-pattern.md`"
- [ ] Optional: a `.claude/rules/destructive-tool-authoring-contract.md` that future-Otto / future-Max / future-Addison reads at cold-boot — so when an agent is asked to author a destructive tool, the agent inherits the discipline

## Why P2 not P3

The pattern is CHEAP to codify NOW (single doc + cross-links + maybe a rule file), and EVERY destructive tool added after this benefits. Codifying after the second or third destructive tool means re-justifying the same rationale each time. Becomes P1 if a destructive tool gets authored WITHOUT following the contract — that's a substrate hygiene fix that should happen before the divergent tool ships.

## Composition with shipped substrate

- **PR #4974 flash-usb.ts hardening** — canonical reference implementation; this row codifies the pattern it demonstrates
- **`.claude/settings.json`** — permission-rule convention
- **`.claude/rules/`** — optional auto-loaded rule for agent-side discipline at cold-boot
- **Hat-system (PR #4930)** — destructive-tool-author could be a hat with elevated authority + quorum + cooldown; future composition
- **NCI floor** — runtime acceptance gate IS consent-at-action-time; perfectly aligned

## Future destructive-tool candidates this contract would govern

(Not building any of these now; just naming the surface so it's clear why the contract pays off)

- `tools/wipe-cluster.ts` — `accept-wipe <cluster-name> <nonce>`
- `tools/restore-from-backup.ts` — `accept-overwrite <restore-target> <nonce>`
- `tools/rotate-master-keys.ts` — `accept-rotate <key-id> <nonce>`
- `tools/delete-pvc.ts` — `accept-delete <pvc-name> <nonce>`
- `tools/drop-database.ts` — `accept-drop <db-name> <nonce>`
- `tools/force-merge.ts` (force-push, force-rebase, etc.) — `accept-force <branch> <nonce>`

Each of these would follow the same shape — different rails, same gate.

## Not in scope (separate considerations)

- **Non-destructive tools** — no acceptance gate needed; the cost is unjustified for safe operations
- **Read-only tools** — even ones that touch sensitive data; different threat model
- **Tools authored OUTSIDE the repo** (third-party CLIs the cluster runs) — out of scope; we can't impose this on external tooling
- **Auditing past destructive tools** — if there are any pre-existing destructive tools in the repo that don't follow this contract, a sweep + retrofit is a separate row

## References

- PR #4974 (flash-usb.ts hardening — the canonical implementation)
- `full-ai-cluster/tools/flash-usb.ts` (the reference)
- `full-ai-cluster/tools/README-flash-usb.md` (the documented liability framing)
- `.claude/settings.json` permissions.allow (the permission-rule convention)
- Framework rules: `.claude/rules/non-coercion-invariant.md` (NCI floor at gate-acceptance scope), `.claude/rules/no-directives.md` (autonomy-first-class)

## Substrate-honest framing

This row is small but high-leverage. Codifying a 3-part pattern as a contract takes one doc + a few cross-links; benefits compound across every destructive tool authored after this point. Without codification, each tool gets re-derived from intuition by whoever's authoring under time pressure — and intuition lacks the rails the previous tool taught us we need.

Per Aaron's reflection: *"this is a good flow now that addison and max are on the project i dont mind thinking about safety more."* The flow exists; the convention writes it down so the team doesn't have to remember.
