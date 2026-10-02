#!/usr/bin/env bun
/**
 * windows-runner-unattend-secret.ts -- render Secret `windows-runner-unattend` for the Windows GitLab runner VM.
 *
 *   WINDOWS_ADMIN_PASSWORD='<a strong password you choose>' \
 *     bun src/Core.TypeScript/cluster/windows-runner-unattend-secret.ts | kubectl apply -f -
 *
 * WHY A SCRIPT. The evaluation-ISO install is unattended, and an unattended Windows install needs the
 * built-in Administrator's password in Autounattend.xml. That password must not live in git, so the file
 * in the repo carries the placeholder `@ADMIN_PASSWORD@` and this renders it, XML-escaped, into a Secret
 * the VM mounts as its `sysprep` CD-ROM (examples/kubevirt-windows-gitlab-runner.yaml).
 *
 * WHAT IT REFUSES
 *   * a password from argv (it would sit in shell history and `ps`): it is read from the environment only;
 *   * a weak one: <12 characters, fewer than 3 of {lower, upper, digit, symbol}, containing the account
 *     name, or any control character (Windows Server enforces complexity and a refused password stops the
 *     unattended install at a screen nobody is watching);
 *   * a template that does not carry the placeholder exactly once (a silently-unfilled password).
 * The password is never printed anywhere but inside the Secret manifest on stdout.
 *
 * Output is a `v1/Secret` with `stringData`, keys `Autounattend.xml` (the evaluation-ISO install) and
 * `Unattend.xml` (the generalized-image path, no password). Exit codes: 0 rendered, 2 usage / refusal.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const UNATTEND_DIR = join(REPO_ROOT, "full-ai-cluster/k8s/examples/windows-runner-unattend");

export const PASSWORD_PLACEHOLDER = "@ADMIN_PASSWORD@";
export const SECRET_NAME = "windows-runner-unattend";
export const SECRET_NAMESPACE = "gitlab";

/** Why a password would be refused, or null if it is acceptable. Pure. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "must be at least 12 characters";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(password)) return "must not contain control characters (including a newline)";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) return "must contain at least 3 of: lowercase, uppercase, digit, symbol (Windows complexity rules)";
  if (password.toLowerCase().includes("administrator")) return "must not contain the account name";
  return null;
}

/** XML text-node escaping: the password lands inside <Value>. */
export function xmlEscape(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export interface RenderInput {
  readonly password: string;
  readonly autounattend: string;
  readonly unattend: string;
}

/** Render the Secret manifest. Throws with a refusal message; never returns a half-filled Secret. */
export function renderUnattendSecret(input: RenderInput): string {
  const problem = passwordProblem(input.password);
  if (problem !== null) throw new Error(`refused: the Administrator password ${problem}`);
  const occurrences = input.autounattend.split(PASSWORD_PLACEHOLDER).length - 1;
  if (occurrences !== 1) throw new Error(`refused: Autounattend.xml must carry ${PASSWORD_PLACEHOLDER} exactly once (found ${occurrences})`);
  if (input.unattend.includes(PASSWORD_PLACEHOLDER)) throw new Error("refused: Unattend.xml must not carry a password placeholder");
  // split/join, never String.replace: a password containing `$&` or `$1` must not be re-interpreted.
  const filled = input.autounattend.split(PASSWORD_PLACEHOLDER).join(xmlEscape(input.password));
  return stringifyYaml({
    apiVersion: "v1",
    kind: "Secret",
    metadata: { name: SECRET_NAME, namespace: SECRET_NAMESPACE },
    type: "Opaque",
    stringData: { "Autounattend.xml": filled, "Unattend.xml": input.unattend },
  });
}

function main(): number {
  if (process.argv.length > 2) {
    console.error("usage: WINDOWS_ADMIN_PASSWORD=... bun windows-runner-unattend-secret.ts | kubectl apply -f -   (no arguments: the password is never taken from argv)");
    return 2;
  }
  const password = process.env["WINDOWS_ADMIN_PASSWORD"];
  if (password === undefined || password === "") {
    console.error("refused: set WINDOWS_ADMIN_PASSWORD in the environment (and keep it out of shell history, e.g. `read -rs WINDOWS_ADMIN_PASSWORD; export WINDOWS_ADMIN_PASSWORD`)");
    return 2;
  }
  try {
    process.stdout.write(
      renderUnattendSecret({
        password,
        autounattend: readFileSync(join(UNATTEND_DIR, "Autounattend.xml"), "utf8"),
        unattend: readFileSync(join(UNATTEND_DIR, "Unattend.xml"), "utf8"),
      }),
    );
    return 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
}

if (import.meta.main) {
  process.exit(main());
}
