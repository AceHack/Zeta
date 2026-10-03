#!/usr/bin/env bun
/**
 * windows-11-unattend-secrets.ts -- render the unattended-install Secrets for the two Windows 11 guests.
 *
 *   read -rs WINDOWS_ADMIN_PASSWORD && export WINDOWS_ADMIN_PASSWORD      # YOU type it; it never leaves your shell
 *   bun src/Core.TypeScript/cluster/windows-11-unattend-secrets.ts | kubectl apply -f -
 *   unset WINDOWS_ADMIN_PASSWORD
 *
 * Output is TWO `v1/Secret`s in namespace `windows-vms` -- `win11-ci-unattend` and `win11-desktop-unattend` --
 * each carrying `Autounattend.xml` (the evaluation-ISO install, with the password and the computer name filled
 * in) and `Unattend.xml` (the generalized-image path; no password). `ci` or `desktop` as the single argument
 * renders just that one. The same password goes in both: it is the local `zetaadmin` account on each guest.
 *
 * WHY A SCRIPT. An unattended Windows install needs the local administrator's password in the answer file.
 * That password must not live in git, so the file in the repo carries `@ADMIN_PASSWORD@` and `@COMPUTER_NAME@`
 * and this renders them into Secrets the VMs mount as their `sysprep` CD-ROM. Same design, and the same
 * refusals, as windows-runner-unattend-secret.ts (the Windows Server runner), whose password policy it reuses.
 *
 * WHAT IT REFUSES
 *   * a password from argv (it would sit in shell history and `ps`): environment only;
 *   * a weak one (policy shared with the Server renderer) or one containing the account name `zetaadmin`
 *     (Windows complexity rules refuse a password that contains the user name);
 *   * a template that does not carry each placeholder exactly once (a silently-unfilled password).
 * The password is never printed anywhere but inside the Secret manifests on stdout.
 *
 * Exit codes: 0 rendered, 2 usage / refusal.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { passwordProblem, PASSWORD_PLACEHOLDER, xmlEscape } from "./windows-runner-unattend-secret.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const UNATTEND_DIR = join(REPO_ROOT, "full-ai-cluster/k8s/examples/windows-11/windows-11-unattend");

export const COMPUTER_NAME_PLACEHOLDER = "@COMPUTER_NAME@";
export const NAMESPACE = "windows-vms";
export const ADMIN_USER = "zetaadmin";

export interface Guest {
  readonly key: "ci" | "desktop";
  readonly secretName: string;
  /** NetBIOS computer name: at most 15 characters, upper-case letters, digits and hyphen. */
  readonly computerName: string;
}

export const GUESTS: readonly Guest[] = [
  { key: "ci", secretName: "win11-ci-unattend", computerName: "WIN11-CI" },
  { key: "desktop", secretName: "win11-desktop-unattend", computerName: "WIN11-DESK" },
];

/** Why a password would be refused for these guests, or null. Pure. */
export function win11PasswordProblem(password: string): string | null {
  const base = passwordProblem(password);
  if (base !== null) return base;
  if (password.toLowerCase().includes(ADMIN_USER)) return `must not contain the account name ${ADMIN_USER}`;
  return null;
}

export interface RenderInput {
  readonly password: string;
  readonly autounattend: string;
  readonly unattend: string;
  readonly guests?: readonly Guest[];
}

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** Render the Secret manifests (one YAML document per guest). Throws with a refusal; never returns a half-filled Secret. */
export function renderWindows11Secrets(input: RenderInput): string {
  const problem = win11PasswordProblem(input.password);
  if (problem !== null) throw new Error(`refused: the administrator password ${problem}`);
  for (const placeholder of [PASSWORD_PLACEHOLDER, COMPUTER_NAME_PLACEHOLDER]) {
    const n = occurrences(input.autounattend, placeholder);
    if (n !== 1) throw new Error(`refused: Autounattend.xml must carry ${placeholder} exactly once (found ${n})`);
  }
  for (const placeholder of [PASSWORD_PLACEHOLDER, COMPUTER_NAME_PLACEHOLDER]) {
    if (input.unattend.includes(placeholder)) throw new Error(`refused: Unattend.xml must not carry ${placeholder}`);
  }
  const guests = input.guests ?? GUESTS;
  if (guests.length === 0) throw new Error("refused: no guest selected");
  return guests
    .map((g) => {
      // split/join, never String.replace: a password containing `$&` or `$1` must not be re-interpreted.
      const filled = input.autounattend.split(PASSWORD_PLACEHOLDER).join(xmlEscape(input.password)).split(COMPUTER_NAME_PLACEHOLDER).join(g.computerName);
      return stringifyYaml({
        apiVersion: "v1",
        kind: "Secret",
        metadata: { name: g.secretName, namespace: NAMESPACE, labels: { "zeta.io/windows-role": g.key === "ci" ? "ci-runner" : "desktop" } },
        type: "Opaque",
        stringData: { "Autounattend.xml": filled, "Unattend.xml": input.unattend },
      });
    })
    .join("---\n");
}

function main(argv: string[]): number {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== "ci" && argv[0] !== "desktop")) {
    console.error("usage: WINDOWS_ADMIN_PASSWORD=... bun windows-11-unattend-secrets.ts [ci|desktop] | kubectl apply -f -   (the password is never taken from argv)");
    return 2;
  }
  const password = process.env["WINDOWS_ADMIN_PASSWORD"];
  if (password === undefined || password === "") {
    console.error("refused: set WINDOWS_ADMIN_PASSWORD in the environment (and keep it out of shell history, e.g. `read -rs WINDOWS_ADMIN_PASSWORD; export WINDOWS_ADMIN_PASSWORD`)");
    return 2;
  }
  try {
    const only = argv[0];
    process.stdout.write(
      renderWindows11Secrets({
        password,
        autounattend: readFileSync(join(UNATTEND_DIR, "Autounattend.xml"), "utf8"),
        unattend: readFileSync(join(UNATTEND_DIR, "Unattend.xml"), "utf8"),
        guests: only === undefined ? GUESTS : GUESTS.filter((g) => g.key === only),
      }),
    );
    return 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
