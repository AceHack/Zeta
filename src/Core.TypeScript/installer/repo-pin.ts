#!/usr/bin/env bun
/**
 * src/Core.TypeScript/installer/repo-pin.ts
 *
 * 081M35C7NJR087G0R002S4R654 (WP21) — the decision behind zeta-install.sh's
 * install-time repo pin, and the TypeScript oracle its shell twin
 * (the ZETA-REPO-PIN block in zeta-install.sh) is compared against in
 * repo-pin-shell-parity.test.ts.
 *
 * THE DEFECT THIS CLOSES
 * -----------------------
 * `zeta-install.sh` used to `git clone "$REPO_URL" /mnt/etc/zeta` with NO
 * ref, then `nixos-install --flake /mnt/etc/zeta/full-ai-cluster#$HOST`. The
 * installed system was therefore ALWAYS built from the remote's default
 * branch HEAD at INSTALL time, never the commit the ISO (or a zflash-
 * prepared medium) was actually built from and tested against:
 *
 *   - A PR's NixOS-module changes could never be exercised by the real
 *     install path before merge — the QEMU full-install lane always
 *     installed main's copy of every module, regardless of which branch
 *     built the ISO under test.
 *   - In the field, a USB flashed on day X installs whatever `main` happens
 *     to be on day Y.
 *
 * The fix: embed the commit the ISO was built from at build time
 * (`/etc/zeta-iso-provenance`, written by full-ai-cluster/flake.nix from
 * `self.rev`), let a zflash ESP write override it (`/zeta-repo-pin`,
 * src/Core.TypeScript/zflash/lib.ts), and have zeta-install.sh check out
 * that exact commit after cloning. This module is the pure decision core of
 * that checkout: format validation, and what to do when a present pin
 * cannot be honoured. It has NO IO — no git, no filesystem — so it is
 * unit-testable with nothing on disk, and its shell twin's structure is
 * checked to agree with it over every input class.
 *
 * FAIL CLOSED BY DEFAULT. An installer that silently installs a different
 * tree than the one it was tested from is exactly the defect class this
 * closes, so a pin that is present but cannot be honoured (junk format, or a
 * checkout that fails) aborts the install unless the operator names the
 * exact override literal (`ZETA_ALLOW_REPO_DRIFT=1`). A pin that is simply
 * ABSENT (hand-built ISO, no ESP override) is not a failure at all — it is
 * today's behaviour, unchanged.
 */

/**
 * Whether `value` is a full, unabbreviated git commit sha: exactly 40 hex
 * characters. A function rather than an exported `RegExp` constant on
 * purpose — the regex itself is an implementation detail callers never need
 * to hold onto, and every prior cross-module `IMPORTED_REGEX.test(x)` call
 * site in this repo is exactly the shape CodeQL's JS/TS dataflow flags as
 * "the base expression of this property access is always undefined" for a
 * relative import resolved through an explicit `.ts` specifier. Exporting
 * the check as a function sidesteps that false-positive class entirely
 * rather than working around it per call site.
 */
export function isFullGitCommitSha(value: string): boolean {
  return /^[0-9a-fA-F]{40}$/.test(value);
}

/** The exact literal that arms the drift override. Anything else is refused. */
export const REPO_PIN_ALLOW_DRIFT_TOKEN = "1";

export type RepoPinValidation = "empty" | "invalid-format" | "valid";

/**
 * Classify a raw `ZETA_ISO_COMMIT` value. Pure string check — no IO.
 *
 *   - `""` (unset, or sourced from a conf that never set it) → `"empty"`:
 *     nothing to honour, today's unpinned behaviour.
 *   - anything that is not exactly 40 hex characters → `"invalid-format"`:
 *     something is present but is not a commit sha, refused rather than
 *     silently ignored.
 *   - a full 40-hex sha → `"valid"`: attempt the checkout.
 */
export function validateRepoPin(raw: string): RepoPinValidation {
  if (raw.length === 0) {
    return "empty";
  }
  return isFullGitCommitSha(raw) ? "valid" : "invalid-format";
}

export type RepoPinFailureDecision = "override-proceed" | "fail-closed";

/**
 * What to do when a present pin could not be honoured — the checkout
 * failed, or the format was junk to begin with. Fails closed unless
 * `allowDrift` is exactly {@link REPO_PIN_ALLOW_DRIFT_TOKEN}; any other
 * value (unset, "true", "yes", "0", …) is treated as no override at all,
 * same "exact literal, not a truthy value" posture as force-reformat.ts's
 * `FORCE_REFORMAT_TOKEN`.
 */
export function decideRepoPinOnFailure(allowDrift: string): RepoPinFailureDecision {
  return allowDrift === REPO_PIN_ALLOW_DRIFT_TOKEN ? "override-proceed" : "fail-closed";
}

/**
 * The end-to-end outcome label zeta-install.sh writes into its provenance
 * line and the installed system's ClusterNode annotations. Not itself part
 * of the decision (it also depends on whether the `git fetch`/`checkout`
 * actually succeeded, which only the shell side can know), but named here
 * so both sides agree on the vocabulary.
 */
export type RepoPinOutcome = "no-pin" | "honoured" | "overridden" | "overridden-invalid-format";
