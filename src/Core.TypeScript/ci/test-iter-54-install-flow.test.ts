// tools/ci/test-iter-54-install-flow.test.ts
//
// Layer 2a (structural-behavioral) of the 4-layer CI testing approach for
// the iter-5.4 substrate (per 081KSGS9H0008QG0R0011BC7T2 cascade #6 + 081KSGS9H0008QG0R003JNSVR5 interactive-login
// tension). Layer 1 (audit-installer-substrate.ts) verifies that specific
// sentinel substrings are present in zeta-install.sh; this layer verifies
// LOGICAL RELATIONSHIPS between substrings — that they appear in the right
// scope, with the right gating, and in the right order.
//
// What this layer catches that Layer 1 doesn't:
//   - `gh auth setup-git` is called inside the SUCCESS branch of
//     `if gh auth login; then` (Bug 2a regression: if setup-git ends up
//     OUTSIDE the success branch, it'd run on auth failure too)
//   - `SSH_KEY_ERR_FILE` is opened AS stderr redirect to `gh ssh-key list`
//     (Bug 2b regression: if the file is created but not used as stderr,
//     scope-error discrimination silently fails)
//   - 3 distinct WARN paths exist (scope-error, empty-no-keys, pipe-broke)
//   - iter-5.4.1 is gated on `GH_AUTH_OK = 1` (Bug 4 cascade-discipline)
//   - iter-5.4.1 subshell uses `set +e` + `|| true` (Copilot finding on
//     #5352: outer set -euo pipefail would propagate subshell failure)
//
// What this layer does NOT catch (Layer 2b — defer to future PR):
//   - Actual `gh` invocation behavior with mock shim on PATH
//   - Actual `git push` credential helper resolution
//   - Actual YAML emission (parsed by `yq` against the ClusterNode schema)
//
// Why structural-behavioral instead of true mock-shim execution:
//   - True mock-shim requires refactoring iter-5.4.0 / iter-5.4.1 into a
//     sourceable bash function (so we can source it without triggering the
//     install side-effects like disk mounts). That's a bigger PR.
//   - Structural-behavioral tests the SAME failure mode (logical breakage
//     of the flow) at much lower cost.
//
// Exit codes:
//   0 — all assertions pass
//   1 — one or more assertions failed (regression detected)
//
// Run via `bun test tools/ci/test-iter-54-install-flow.test.ts` (CI) or
// `bun tools/ci/test-iter-54-install-flow.test.ts` (local manual).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const ROOT = resolve(import.meta.dir, "../../..");
const SCRIPT_PATH = resolve(
  ROOT,
  "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
);
const INSTALL_SCRIPT_PATH = resolve(ROOT, "tools/setup/install.sh");

// Cache the script content — read once, asserted many times.
const SCRIPT = readFileSync(SCRIPT_PATH, "utf8");
const INSTALL_SCRIPT = readFileSync(INSTALL_SCRIPT_PATH, "utf8");

// Helper: extract the body of an iter-N block from the script. The blocks
// are delimited by `Step 6.N` comment headers. Returns the substring from
// the start of the named step to the start of the next step (or EOF if
// last). Throws if the step header isn't found.
function extractStep(stepHeader: string, nextStepHeader: string | null): string {
  const startIdx = SCRIPT.indexOf(stepHeader);
  if (startIdx < 0) {
    throw new Error(`step header not found in installer script: ${stepHeader}`);
  }
  const endIdx = nextStepHeader
    ? SCRIPT.indexOf(nextStepHeader, startIdx + stepHeader.length)
    : SCRIPT.length;
  if (nextStepHeader && endIdx < 0) {
    throw new Error(
      `next step header not found after ${stepHeader}: ${nextStepHeader}`,
    );
  }
  return SCRIPT.slice(startIdx, endIdx);
}

const ITER_540_BLOCK = extractStep(
  "Step 6.8: iter-5.4.0 homelab gh-auth + operator pubkey copy",
  "Step 6.9: iter-5.4.1 self-registration commit+push",
);

const ITER_541_BLOCK = extractStep(
  "Step 6.9: iter-5.4.1 self-registration commit+push",
  // The next step is the 081KSGS9H0008QG0R00120EEHM Bug 1 symlink section. Match the actual
  // comment in the script.
  "081KSGS9H0008QG0R00120EEHM Bug 1 fix: pre-stage per-file symlinks",
);

const ITER_42_BLOCK = extractStep(
  "Step 6.5: iter-4.2 probe boot USB for operator SSH pubkey",
  "Step 6.56: 081KSKBP80008QG0R003AX2A69.3b cred-blob passphrase prompt",
);

const ITER_595_BLOCK = extractStep(
  "Step 6.95: iter-5.5.0",
  "Step 7: print initial credentials",
);

describe("iter-5.4.0 — gh auth + ssh-key flow (081KSGS9H0008QG0R00120EEHM Bug 2a + 2b)", () => {
  test("the gh auth login branch is gated on user opt-in", () => {
    // Operator must answer Y/y to GH_AUTH_REPLY. Opt-out path (n) skips.
    expect(ITER_540_BLOCK).toContain("GH_AUTH_REPLY");
    expect(ITER_540_BLOCK).toMatch(/if \[\[ "\$GH_AUTH_REPLY" =~ \^\[Yy\]\$ \]\]; then/);
  });

  test("gh auth login is invoked", () => {
    expect(ITER_540_BLOCK).toContain("if gh auth login; then");
  });

  test("081KSGS9H0008QG0R00120EEHM Bug 2a fix: gh auth setup-git is inside the auth-success branch", () => {
    // The bug: if `gh auth login` succeeds but `gh auth setup-git` is
    // never called, subsequent `git push` prompts for HTTPS basic-auth.
    // The fix: setup-git must be in the success-of-login branch.
    //
    // Extract the success-branch body — everything between
    // `if gh auth login; then` and the matching `else` of THAT if.
    // The block is also nested inside `if command -v gh >/dev/null`,
    // so we need to find the inner if's success-body specifically.
    const successBranchMatch = ITER_540_BLOCK.match(
      /if gh auth login; then\n([\s\S]*?)\n {4}else\n {6}echo\n {6}echo "\[iter-5\.4\.0\] {3}gh auth login FAILED/,
    );
    expect(successBranchMatch).not.toBeNull();
    const successBranch = successBranchMatch![1];
    expect(successBranch).toContain("gh auth setup-git");
    // Failure-message preserved
    expect(successBranch).toContain("subsequent git push may prompt for password");
  });

  test("081KSGS9H0008QG0R00120EEHM Bug 2a fix: setup-git is called BEFORE ssh-key fetch", () => {
    const setupGitIdx = ITER_540_BLOCK.indexOf("gh auth setup-git");
    const sshKeyListIdx = ITER_540_BLOCK.indexOf("gh ssh-key list");
    expect(setupGitIdx).toBeGreaterThan(0);
    expect(sshKeyListIdx).toBeGreaterThan(0);
    // setup-git must come before ssh-key fetch (so the git-credential
    // helper is wired before any subsequent git push attempts).
    expect(setupGitIdx).toBeLessThan(sshKeyListIdx);
  });

  test("081KSGS9H0008QG0R00120EEHM Bug 2b fix: SSH_KEY_ERR_FILE is created via mktemp", () => {
    expect(ITER_540_BLOCK).toMatch(
      /SSH_KEY_ERR_FILE=\$\(mktemp [^)]+\)/,
    );
  });

  test("081KSGS9H0008QG0R00120EEHM Bug 2b fix: SSH_KEY_ERR_FILE is used as stderr redirect on gh ssh-key list", () => {
    // The fix: stderr must be captured so we can discriminate scope-error
    // from empty-list. If the redirect goes to /dev/null instead, the
    // discrimination silently fails.
    expect(ITER_540_BLOCK).toMatch(
      /gh ssh-key list --json [^ ]+ 2>"\$SSH_KEY_ERR_FILE"/,
    );
  });

  test("081KSGS9H0008QG0R00120EEHM Bug 2b fix: discriminates scope-error from empty-list", () => {
    // The discriminator: grep the stderr file for scope/insufficient/
    // admin:public_key/read:public_key keywords.
    expect(ITER_540_BLOCK).toMatch(
      /grep -qE "\(scope\|insufficient\|admin:public_key\|read:public_key\)" "\$SSH_KEY_ERR_FILE"/,
    );
  });

  test("081KSGS9H0008QG0R00120EEHM Bug 2b fix: scope-error branch tells operator how to recover", () => {
    // The substrate-honest WARN must include the actual command to run.
    expect(ITER_540_BLOCK).toContain("gh auth refresh -s admin:public_key");
    expect(ITER_540_BLOCK).toContain("nixos-rebuild switch");
  });

  test("081KSGS9H0008QG0R00120EEHM Bug 2b fix: empty-no-error branch points to settings/keys", () => {
    expect(ITER_540_BLOCK).toContain(
      "https://github.com/settings/keys",
    );
  });

  test("081KSGS9H0008QG0R00120EEHM Bug 2b fix: cleans up SSH_KEY_ERR_FILE temp file", () => {
    // Trap-style cleanup or explicit rm -f. The current implementation uses
    // explicit rm -f at end of the block.
    expect(ITER_540_BLOCK).toMatch(
      /rm -f "\$SSH_KEY_ERR_FILE" 2>\/dev\/null \|\| true/,
    );
  });

  test("GH_AUTH_OK=1 is set ONLY in the success branch of gh auth login", () => {
    // Critical for iter-5.4.1 cascade-skip: if GH_AUTH_OK is set elsewhere,
    // self-registration could fire without valid auth → push fails.
    const setOccurrences = ITER_540_BLOCK.match(/GH_AUTH_OK=1/g) ?? [];
    // Should appear EXACTLY ONCE in the iter-5.4.0 block (the assignment
    // inside the success branch). Other references should be reads.
    expect(setOccurrences.length).toBe(1);
  });
});

describe("081KSNY2Z0008QG0R0008PN7RQ retained zflash credential preseed", () => {
  test("iter-4.2 copies the zflash-baked blob to target ESP before USB unmount", () => {
    expect(ITER_42_BLOCK).toContain(
      'BOOT_USB_CREDS_BLOB="$(dirname "$PUBKEY_FILE")/zeta-creds.enc"',
    );
    expect(ITER_42_BLOCK).toContain(
      'sudo install -m 0600 "$BOOT_USB_CREDS_BLOB" /mnt/boot/zeta-creds.enc',
    );
    expect(ITER_42_BLOCK).toContain("BOOT_USB_CREDS_PRESEEDED=1");

    const sourceIdx = ITER_42_BLOCK.indexOf("BOOT_USB_CREDS_BLOB=");
    const copyIdx = ITER_42_BLOCK.indexOf(
      'sudo install -m 0600 "$BOOT_USB_CREDS_BLOB" /mnt/boot/zeta-creds.enc',
    );
    const unmountIdx = ITER_42_BLOCK.indexOf(
      'sudo umount "$PROBE_MOUNT"',
      copyIdx,
    );
    expect(sourceIdx).toBeGreaterThan(0);
    expect(copyIdx).toBeGreaterThan(sourceIdx);
    expect(unmountIdx).toBeGreaterThan(copyIdx);
  });

  test("Step 6.95 skips picker when a retained blob already exists", () => {
    expect(SCRIPT).toMatch(
      /if \[ "\$\{BOOT_USB_CREDS_PRESEEDED:-0\}" = "1" \] && \[ -f \/mnt\/boot\/zeta-creds\.enc \]; then\n\s+PICKER_OPT_OUT=1/,
    );
    expect(SCRIPT).toContain(
      "/mnt/boot/zeta-creds.enc already present from zflash retention preseed",
    );
  });
});

describe("iter-5.5.0 target runtime bootstrap uses canonical install.sh", () => {
  test("install.sh exposes an explicit installed-NixOS override for target bootstrap", () => {
    expect(INSTALL_SCRIPT).toContain("ZETA_INSTALL_NIXOS_MODE");
    expect(INSTALL_SCRIPT).toContain("installed|nixos-installed)");
    expect(INSTALL_SCRIPT).toContain("live|nixos-live)");
    expect(INSTALL_SCRIPT).toContain("invalid ZETA_INSTALL_NIXOS_MODE");
  });

  test("zeta-install calls install.sh as installed target, with full declarative CLI graph", () => {
    expect(ITER_595_BLOCK).toContain("tools/setup/install.sh");
    expect(ITER_595_BLOCK).toContain("ZETA_INSTALL_NIXOS_MODE=installed");
    expect(ITER_595_BLOCK).toContain("ZETA_INSTALL_FULL=1");
    expect(ITER_595_BLOCK).toContain("BUN_INSTALL=\"$ZETA_HOME/.bun\"");
  });

  test("6.95-picker sudo trusts the cloned .mise.toml (same as wifi / iSerial / keyfile)", () => {
    // Measured QEMU picker bind (run 32647553460): wifi/iSerial/keyfile sudo -u
    // lines already pass MISE_TRUSTED_CONFIG_PATHS="$ZETA_HOME/Zeta" (PR #10226);
    // 6.95-picker is a separate sudo and did not inherit install.sh's export.
    // `mise activate` then died: "Config files in ~/Zeta/.mise.toml are not trusted".
    const pickerIdx = ITER_595_BLOCK.lastIndexOf("zeta-creds-picker.ts");
    expect(pickerIdx).toBeGreaterThan(-1);
    const window = ITER_595_BLOCK.slice(Math.max(0, pickerIdx - 800), pickerIdx);
    expect(window).toContain('MISE_TRUSTED_CONFIG_PATHS="$ZETA_HOME/Zeta"');
  });

  test("6.95-picker passes --defer-all on non-TTY / QEMU passphrase file (no bake hang)", () => {
    // QEMU restore (run 32724820159): picker started, then hung on
    // readline.question for [b]/[d]/[s] until the 1800s phase-1 timeout.
    expect(ITER_595_BLOCK).toContain('PICKER_DEFER="--defer-all"');
    expect(ITER_595_BLOCK).toContain("$PICKER_DEFER");
    expect(ITER_595_BLOCK).toContain("[ ! -t 0 ]");
  });

  test("6.95-picker persist sudo-installs onto ESP (zeta uid cannot write /mnt/boot)", () => {
    // Run 32804383505: --defer-all worked; persist EACCES on
    // /mnt/boot/zeta-creds.enc. Keyfile already writes /tmp then sudo cp.
    expect(ITER_595_BLOCK).toContain("PICKER_TMP=/tmp/zeta-creds.enc");
    expect(ITER_595_BLOCK).toContain("--output $PICKER_TMP");
    expect(ITER_595_BLOCK).not.toContain("--output /mnt/boot/zeta-creds.enc");
    expect(ITER_595_BLOCK).toContain('sudo install -m 0600 "$PICKER_TMP" /mnt/boot/zeta-creds.enc');
    expect(ITER_595_BLOCK).toContain(
      'sudo install -m 0600 "$PICKER_TMP_FACTOR" /mnt/boot/zeta-creds.factor',
    );
  });

  test("agent CLI package installs are not duplicated in zeta-install.sh", () => {
    expect(ITER_595_BLOCK).toContain("tools/setup/manifests/from-bun-global");
    expect(ITER_595_BLOCK).toContain("tools/setup/manifests/from-installer");
    expect(ITER_595_BLOCK).not.toContain(
      "bun install --global @anthropic-ai/claude-code",
    );
    expect(ITER_595_BLOCK).not.toContain(
      "bun install --global @google/gemini-cli",
    );
    expect(ITER_595_BLOCK).not.toContain("bun install --global @openai/codex");
  });
});

describe("iter-5.4.1 — self-registration commit+push flow (081KSGS9H0008QG0R0037H3W4T)", () => {
  test("iter-5.4.1 is gated on iter-5.4.0 success (GH_AUTH_OK = 1)", () => {
    // Cascade-skip: if gh auth login failed or was skipped, self-reg cannot
    // run (no token for the push). The discipline is explicit.
    expect(ITER_541_BLOCK).toMatch(/if \[ "\$GH_AUTH_OK" = 1 \]; then/);
  });

  test("Copilot finding on #5352: subshell uses set +e + || true defense", () => {
    // The outer `set -euo pipefail` would propagate subshell failure out
    // of the install. Step 6.9 is documented as warning-only/skippable.
    // The fix: `set +e` inside the subshell + `|| true` on the subshell.
    expect(ITER_541_BLOCK).toContain("set +e");
    expect(ITER_541_BLOCK).toMatch(/\) \|\| true/);
  });

  test("ClusterNode YAML matches 081KSGS9H0008QG0R002K93MWX schema: spec.roles is array", () => {
    // Copilot finding on #5352: spec.role was scalar; the 081KSGS9H0008QG0R002K93MWX CRD
    // requires spec.roles[] (array). The fix: emit `roles:\n    - $HOST`.
    expect(ITER_541_BLOCK).toContain("  roles:\n    - $HOST");
    expect(ITER_541_BLOCK).not.toMatch(/^\s+role: /m);
  });

  test("ClusterNode YAML matches 081KSGS9H0008QG0R002K93MWX schema: spec.registration block", () => {
    // Copilot finding on #5352: maintainer was at spec.maintainer (flat);
    // schema requires spec.registration.maintainer (nested block).
    expect(ITER_541_BLOCK).toMatch(
      /^ {2}registration:\n {4}maintainer: \$MAINTAINER/m,
    );
  });

  test("ClusterNode YAML matches 081KSGS9H0008QG0R002K93MWX schema: spec.hardware.storage nested", () => {
    // Copilot finding on #5352: storage was sibling of hardware (`spec.storage`);
    // schema requires storage nested under hardware (`spec.hardware.storage`).
    expect(ITER_541_BLOCK).toContain("  hardware:");
    expect(ITER_541_BLOCK).toMatch(/storage:\n\$STORAGE_LINES/);
    // Storage line indentation = 6 spaces (under hardware.storage list).
    expect(ITER_541_BLOCK).toContain('"      - \\"/dev/" $1 " " $2 "\\""');
  });

  test("Copilot finding on #5352: MAC parses field AFTER link/ether (not before)", () => {
    // Prior bug: `$(NF-2)` extracted `brd` not the MAC. Fix: loop until
    // `link/ether` found, then print field $(i+1).
    expect(ITER_541_BLOCK).toMatch(
      /for\(i=1;i<=NF;i\+\+\) if\(\$i=="link\/ether"\)\{print \$\(i\+1\); exit\}/,
    );
  });

  test("Self-reg branch name includes hostname + UTC timestamp", () => {
    // Convention: register-<NODE_HOSTNAME>-<YYYYMMDDTHHMMSSZ>. Catches
    // regression if someone changes the branch shape (would break the
    // cluster-side ArgoCD pattern that watches register-* branches).
    expect(ITER_541_BLOCK).toMatch(
      /REG_BRANCH="register-\$\{NODE_HOSTNAME\}-\$\(date -u \+%Y%m%dT%H%M%SZ\)"/,
    );
  });

  test("PR-create URL detection uses SELF_REG_PR_URL + writes /tmp marker", () => {
    // The marker file lets the outer subshell read the URL after the
    // inner subshell exits. Critical: the outer must check /tmp/zeta-self-reg-pr-url
    // existence, not rely on subshell exports (subshells don't propagate
    // env to parent).
    expect(ITER_541_BLOCK).toContain("/tmp/zeta-self-reg-pr-url");
    expect(ITER_541_BLOCK).toMatch(
      /if \[ -s \/tmp\/zeta-self-reg-pr-url \]; then/,
    );
  });

  test("cleanup: temp WORK_DIR + PR URL marker are removed", () => {
    expect(ITER_541_BLOCK).toMatch(
      /rm -rf "\$WORK_DIR" \/tmp\/zeta-self-reg-pr-url 2>\/dev\/null \|\| true/,
    );
  });
});

describe("iter-5.4 substrate-honest framing (defense-in-depth assertions)", () => {
  test("iter-5.4.0 prints 'iter-4.2 static keys' fallback hint", () => {
    // When operator skips gh auth login, the WARN should point to the
    // iter-4.2 static-keys fallback path. Documented operator-UX.
    expect(ITER_540_BLOCK).toContain("iter-4.2 static keys");
  });

  test("iter-5.4.0 prints WARN when gh binary not on PATH", () => {
    // Defense: if gh isn't in the ISO image (gh missing from
    // environment.systemPackages), the script should WARN substrate-honestly
    // about that specific cause rather than silently skipping.
    expect(ITER_540_BLOCK).toContain("WARN: gh binary not on PATH");
    expect(ITER_540_BLOCK).toContain("environment.systemPackages");
  });

  test("iter-5.4.1 names operator-overridable mock-cluster cleanup path", () => {
    // The skip branch should explicitly name where the manual re-run path
    // lives (post-install operator can re-run via tools/cluster/register-node.ts).
    expect(ITER_541_BLOCK).toContain(
      "tools/cluster/register-node.ts",
    );
  });
});

describe("iter-5.1 hardware-configuration copy (081KSNY2Z0008QG0R0008PN7RQ phase-2 initrd)", () => {
  test("nixos-generate-config output is copied into flake host tree before nixos-install", () => {
    const genIdx = SCRIPT.indexOf("nixos-generate-config --root /mnt");
    const copyIdx = SCRIPT.indexOf("installing probe-generated hardware-configuration.nix");
    const installIdx = SCRIPT.indexOf("nixos-install --flake");
    expect(genIdx).toBeGreaterThan(0);
    expect(copyIdx).toBeGreaterThan(genIdx);
    expect(installIdx).toBeGreaterThan(copyIdx);
    // 081M0JK4R26087G0R002SVJ5VW: the destination is still host-scoped, but it
    // is now built in two steps -- HOST_DIR is needed on its own to decide
    // whether the selected host imports a hardware-configuration.nix at all.
    expect(SCRIPT).toContain(
      'HOST_DIR="/mnt/etc/zeta/full-ai-cluster/nixos/hosts/${HOST}"',
    );
    expect(SCRIPT).toContain('HW_DST="${HOST_DIR}/hardware-configuration.nix"');
  });

  test("a failed capture REFUSES; it does not warn and install the placeholder", () => {
    // 081M0JK4R26087G0R002SVJ5VW. This block used to read
    //   else echo "[iter-5.1] WARN: hardware-configuration not copied ..." >&2
    // so a failed capture printed one stderr line and the install continued with
    // the committed /-and-/boot placeholder -- leaving the longhorn{1..N}
    // partitions this script had just mounted with no `fileSystems` entry, and
    // leaving the boot-time Longhorn preflight (which derives its required set
    // from the host's own fileSystems) with an EMPTY set to check.
    //
    // Compare EXECUTABLE lines only: zeta-install.sh's own header quotes the old
    // fallback verbatim, and the account of why a fix exists must survive.
    const code = SCRIPT.split("\n")
      .filter((l) => !/^\s*#/.test(l) && l.trim() !== "")
      .join("\n");
    expect(code).not.toContain("WARN: hardware-configuration not copied");
    expect(SCRIPT).toContain("WARN: hardware-configuration not copied");

    // The copy is gated on a verdict, and the RESULT is content-checked against
    // the mountpoints this install actually mounted -- not on cp's exit code.
    expect(code).toContain('HW_PLAN="$(zeta_hwcap_plan "$HW_SRC" "$HOST_DIR" "$HW_DST")"');
    expect(code).toContain('HW_MISSING="$(zeta_hwcap_verify "$HW_DST" "${LONGHORN_MOUNTS[@]}")"');

    // Every REFUSE verdict the decision function can emit reaches a bail.
    const verdicts = [...code.matchAll(/echo "(REFUSE [a-z-]+)"/g)].map((m) => m[1]);
    expect(verdicts.length).toBeGreaterThanOrEqual(3);
    for (const verdict of verdicts) {
      const arm = code.indexOf(`"${verdict}")`);
      expect(arm).toBeGreaterThan(-1);
      expect(code.slice(arm, code.indexOf(";;", arm))).toContain("bail ");
    }
  });
});
