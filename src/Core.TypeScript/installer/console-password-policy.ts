/**
 * src/Core.TypeScript/installer/console-password-policy.ts
 *
 * docs/ops/INSTALL-TIME-CONFIG.md row 19. What the installed node's `zeta` CONSOLE password is
 * when NO password was typed at the installer prompt.
 *
 *   default  (the repo default, the owner's decision) the well-known `zeta-change-me`. Not locked,
 *            not minted; the installer prints a loud banner and the first-boot reminder stays until
 *            the password changes. Anyone with console access is root via sudo: a physical-access
 *            threat model, not for exposed hardware.
 *   mint     a random one-time password for THIS install, shown once on the console; the account is
 *            LOCKED if nobody saw it. The safe choice for anyone else.
 *
 * A password TYPED at the installer prompt wins over both. SSH password login is untouched by this
 * setting (`PasswordAuthentication = false` stays in common.nix).
 *
 * Carried exactly like `--lb-pool`: zflash `--console-password default|mint` ->
 * `ZETA_CONSOLE_PASSWORD_POLICY='<value>'` on the ESP `/zeta-firstboot.conf` -> exported by
 * zeta-first-boot.sh -> the `ZETA-CONSOLE-PW-POLICY` block of zeta-install.sh (this file's shell
 * twin, parity-tested). It is NEVER baked into the ISO's own conf, so an explicit `mint` on the ESP
 * is the only way the policy changes from the ISO's behaviour.
 *
 * Pure functions, no IO.
 */

/** ESP-conf / environment name. The shell twin reads exactly this. */
export const CONSOLE_PASSWORD_POLICY_ENV = "ZETA_CONSOLE_PASSWORD_POLICY";

export const CONSOLE_PASSWORD_POLICIES = ["default", "mint"] as const;
export type ConsolePasswordPolicy = (typeof CONSOLE_PASSWORD_POLICIES)[number];

/** What an unset value means. The owner's decision; `mint` is the explicit opt-in. */
export const DEFAULT_CONSOLE_PASSWORD_POLICY: ConsolePasswordPolicy = "default";

export type ConsolePasswordPolicyPlan =
  | { readonly ok: true; readonly value: ConsolePasswordPolicy | null }
  | { readonly ok: false; readonly error: string };

/** Parse an optional `--console-password` value. Anything but `default` / `mint` is refused. */
export function planConsolePasswordPolicy(raw: string | undefined): ConsolePasswordPolicyPlan {
  if (raw === undefined) return { ok: true, value: null };
  if (raw === "default" || raw === "mint") return { ok: true, value: raw };
  return {
    ok: false,
    error: `--console-password ${JSON.stringify(raw)} is neither "default" nor "mint"`,
  };
}

/** The line appended to the ESP `/zeta-firstboot.conf`. The validator admits nothing needing escape. */
export function renderConsolePasswordPolicyConfLine(policy: ConsolePasswordPolicy): string {
  return `${CONSOLE_PASSWORD_POLICY_ENV}='${policy}'\n`;
}
