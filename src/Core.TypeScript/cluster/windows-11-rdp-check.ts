#!/usr/bin/env bun
/**
 * windows-11-rdp-check.ts -- prove a real RDP LOGIN against `win11-desktop` from inside the cluster, without
 * ever printing, logging or writing the password.
 *
 *   bun src/Core.TypeScript/cluster/windows-11-rdp-check.ts                  # NLA login, then delete the helper pod
 *   bun src/Core.TypeScript/cluster/windows-11-rdp-check.ts --sec tls        # is a non-NLA (TLS-only) connection refused?
 *   bun src/Core.TypeScript/cluster/windows-11-rdp-check.ts --sec rdp        # ... and the legacy standard RDP security layer?
 *   bun src/Core.TypeScript/cluster/windows-11-rdp-check.ts --keep           # leave the helper pod for the next run
 *
 * HOW. A short-lived pod in namespace `windows-vms` (the CiliumNetworkPolicy admits a pod in its own namespace)
 * runs FreeRDP 2.x with `/auth-only`: it performs the whole connection sequence up to and including the
 * credential check, opens no session, and exits 0 on success. The password is read in THIS process's memory
 * from Secret `win11-desktop-unattend` (the one place it lives), and goes to FreeRDP over `kubectl exec -i`'s
 * STDIN with `/from-stdin:force` -- never argv (not ours, not the pod's), never an environment variable, never
 * a file, never a second Secret. Everything FreeRDP prints is scrubbed of the password before it is shown.
 *
 * WHAT IT PROVES: the desktop accepts a real login for `zetaadmin` on the security layer you named. What it
 * cannot prove: what the screen looks like, whether the clipboard or audio work, what the resolution is. Those
 * need a human at a real client (docs/ops/WINDOWS-11-VMS.md, "Using the desktop").
 *
 * Exit codes: 0 login accepted, 1 login or cluster call failed, 2 refusal / usage.
 */

import { spawnSync } from "node:child_process";
import { NAMESPACE } from "./windows-11-vm.ts";

export const SECRET = "win11-desktop-unattend";
export const POD = "rdp-check";
export const RDP_HOST = "win11-desktop-rdp";
export const ADMIN = "zetaadmin";
export const SECURITY_LAYERS = ["nla", "tls", "rdp"] as const;
export type SecurityLayer = (typeof SECURITY_LAYERS)[number];

export function isSecurityLayer(text: string | undefined): text is SecurityLayer {
  return (SECURITY_LAYERS as readonly string[]).includes(text ?? "");
}

function xmlUnescape(text: string): string {
  return text.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&");
}

/** The local administrator's password out of the rendered answer file: the first <Value> inside <Password>. Pure; null when absent. */
export function extractAdminPassword(autounattendXml: string): string | null {
  const m = /<Password>\s*<Value>([\s\S]*?)<\/Value>/.exec(autounattendXml);
  if (m === null || m[1] === undefined || m[1] === "") return null;
  return xmlUnescape(m[1]);
}

/** Remove every occurrence of the secret (raw and XML-escaped) from text that is about to be shown. Pure. */
export function redact(text: string, secret: string): string {
  if (secret === "") return text;
  const escaped = secret.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return text.split(secret).join("[REDACTED]").split(escaped).join("[REDACTED]");
}

/** FreeRDP argv for the check. The password is NOT in it: it arrives on stdin (`/from-stdin:force`). Pure. */
export function freerdpArgs(host: string, sec: SecurityLayer): string[] {
  if (!/^[a-z0-9-]+$/.test(host)) throw new Error("refused: the host must be a Service name");
  return ["xfreerdp", "/auth-only", "/cert:ignore", `/v:${host}`, `/u:${ADMIN}`, `/sec:${sec}`, "/from-stdin:force"];
}

/** xfreerdp is an X11 client and opens a display even for /auth-only, so the pod runs a virtual one (Xvfb, no TCP listener). */
export const DISPLAY = ":99";
/** Installs FreeRDP and Xvfb once (idempotent) and fails loudly when either is missing. */
export const PREPARE_SCRIPT = "{ command -v xfreerdp >/dev/null && command -v Xvfb >/dev/null; } || apk add --no-cache freerdp xvfb >&2; command -v xfreerdp >/dev/null && command -v Xvfb >/dev/null";

/**
 * The one shell command run in the pod: a private Xvfb for the life of this exec (a daemon started by an earlier exec dies
 * with that exec), then FreeRDP with the password on stdin. The password is not in this string. Pure.
 */
export function checkScript(host: string, sec: SecurityLayer): string {
  const args = freerdpArgs(host, sec).join(" ");
  return `Xvfb ${DISPLAY} -nolisten tcp </dev/null >/dev/null 2>&1 & XPID=$!; sleep 2; DISPLAY=${DISPLAY} ${args}; RC=$?; kill $XPID 2>/dev/null; exit $RC`;
}

/** The helper pod. Limits and requests are set because the namespace quota refuses a pod that declares none; the image is Alpine from Docker Hub. Pure. */
export function helperPodManifest(): Record<string, unknown> {
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: { name: POD, namespace: NAMESPACE, labels: { "app.kubernetes.io/name": POD, "zeta.io/throwaway": "true" } },
    spec: {
      restartPolicy: "Never",
      automountServiceAccountToken: false,
      containers: [
        {
          name: "freerdp",
          image: "docker.io/library/alpine:3.21",
          command: ["sleep", "900"],
          // root with a small capability set: `apk add` needs to chown. `baseline` admits it; `restricted` only warns.
          securityContext: { allowPrivilegeEscalation: false, capabilities: { drop: ["ALL"], add: ["CHOWN", "DAC_OVERRIDE", "FOWNER", "SETGID", "SETUID"] } },
          resources: { requests: { cpu: "50m", memory: "128Mi", "ephemeral-storage": "256Mi" }, limits: { memory: "512Mi", "ephemeral-storage": "1Gi" } },
        },
      ],
    },
  };
}

function kubectl(args: string[], input?: string): { code: number; out: string; err: string } {
  const r = spawnSync("kubectl", args, { encoding: "utf8", input, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function main(argv: string[]): number {
  let sec: SecurityLayer = "nla";
  let keep = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keep") keep = true;
    else if (a === "--sec" && isSecurityLayer(argv[i + 1])) sec = argv[++i] as SecurityLayer;
    else {
      console.error("usage: windows-11-rdp-check.ts [--sec nla|tls|rdp] [--keep]");
      return 2;
    }
  }
  // `-o json`, not a jsonpath with an escaped dot: that backslash does not survive every platform's argv quoting.
  const secret = kubectl(["-n", NAMESPACE, "get", "secret", SECRET, "-o", "json"]);
  if (secret.code !== 0) {
    console.error(`could not read Secret ${SECRET}: ${secret.err.trim()}`);
    return 1;
  }
  const encoded = (JSON.parse(secret.out) as { data?: Record<string, string> }).data?.["Autounattend.xml"] ?? "";
  const password = extractAdminPassword(Buffer.from(encoded, "base64").toString("utf8"));
  if (password === null) {
    console.error(`Secret ${SECRET} carries no <Password><Value>: nothing to check`);
    return 1;
  }
  const exists = kubectl(["-n", NAMESPACE, "get", "pod", POD, "-o", "name"]).code === 0;
  try {
    if (!exists) {
      const made = kubectl(["apply", "-f", "-"], JSON.stringify(helperPodManifest()));
      if (made.code !== 0) {
        console.error(`could not create the helper pod: ${made.err.trim()}`);
        return 1;
      }
    }
    const ready = kubectl(["-n", NAMESPACE, "wait", `pod/${POD}`, "--for=condition=Ready", "--timeout=180s"]);
    if (ready.code !== 0) {
      console.error(`the helper pod did not become Ready: ${ready.err.trim()}`);
      return 1;
    }
    const installed = kubectl(["-n", NAMESPACE, "exec", POD, "--", "sh", "-c", PREPARE_SCRIPT]);
    if (installed.code !== 0) {
      console.error(`FreeRDP could not be prepared in the helper pod (does the pod reach the Alpine mirrors?): ${installed.err.trim()}`);
      return 1;
    }
    const run = kubectl(["-n", NAMESPACE, "exec", "-i", POD, "--", "sh", "-c", checkScript(RDP_HOST, sec)], `${password}\n`);
    const shown = redact(`${run.out}${run.err}`, password).trim();
    console.log(shown);
    console.log(`\nsecurity layer ${sec}: xfreerdp exit ${run.code} (${run.code === 0 ? "login ACCEPTED" : "login or connection REFUSED"})`);
    return run.code === 0 ? 0 : 1;
  } finally {
    if (!keep) kubectl(["-n", NAMESPACE, "delete", "pod", POD, "--ignore-not-found", "--wait=false"]);
  }
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
