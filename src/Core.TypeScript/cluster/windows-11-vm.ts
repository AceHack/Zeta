#!/usr/bin/env bun
/**
 * windows-11-vm.ts -- look at, and poke, a Windows 11 guest from the cluster side, with only `kubectl`.
 *
 *   bun src/Core.TypeScript/cluster/windows-11-vm.ts screenshot win11-desktop [--out shot.png]
 *   bun src/Core.TypeScript/cluster/windows-11-vm.ts key win11-desktop KEY_SPACE [--repeat 40]
 *   bun src/Core.TypeScript/cluster/windows-11-vm.ts status
 *
 * WHY. `virtctl vnc` is the way to WATCH a guest, but an install that no one is sitting in front of still
 * needs (1) a picture of what the console shows and (2) ONE key press: the Windows ISO's UEFI boot prints
 * "Press any key to boot from CD or DVD..." and, with a blank disk first in the boot order, nothing presses
 * it. Both are libvirt calls in the virt-launcher pod (`virsh screenshot`, `virsh send-key`), which this runs
 * through `kubectl exec` -- no virtctl, no VNC client. Measured 2026-10-03 on a Linux guest: both work in the
 * `compute` container of this cluster's virt-launcher pods.
 *
 * WHAT IT WILL NOT DO: type text (so it can never type a password), run an arbitrary command in the guest or
 * the pod, or touch any VM that is not one of the two Windows 11 guests. `key` takes libvirt key names
 * (KEY_SPACE, KEY_ENTER, ...) and nothing else.
 *
 * Exit codes: 0 ok, 1 kubectl failed, 2 refusal / usage.
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

export const NAMESPACE = "windows-vms";
export const VMS = ["win11-ci", "win11-desktop"] as const;
export type Vm = (typeof VMS)[number];

export function isVm(text: string | undefined): text is Vm {
  return (VMS as readonly string[]).includes(text ?? "");
}

export function isKeyName(text: string): boolean {
  return /^KEY_[A-Z0-9_]{1,24}$/.test(text);
}

/** libvirt's name for the domain of a VM: `<namespace>_<vm>`. */
export function domainName(vm: Vm): string {
  return `${NAMESPACE}_${vm}`;
}

/** The shell loop run inside the launcher: send the keys, `repeat` times, one second apart. Pure; inputs are validated by the caller. */
export function keyLoopScript(vm: Vm, keys: readonly string[], repeat: number): string {
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 300) throw new Error("refused: --repeat must be an integer from 1 to 300");
  if (keys.length < 1 || keys.length > 4 || !keys.every(isKeyName)) throw new Error("refused: give 1 to 4 libvirt key names such as KEY_SPACE");
  return `for i in $(seq 1 ${repeat}); do virsh send-key ${domainName(vm)} ${keys.join(" ")} >/dev/null 2>&1; sleep 1; done`;
}

function kubectl(args: string[]): { code: number; out: string; err: string } {
  const r = spawnSync("kubectl", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function launcherPod(vm: Vm): string | null {
  const r = kubectl(["-n", NAMESPACE, "get", "pod", "-l", `kubevirt.io/domain=${vm}`, "-o", "jsonpath={.items[0].metadata.name}"]);
  return r.code === 0 && r.out.trim() !== "" ? r.out.trim() : null;
}

function main(argv: string[]): number {
  const [cmd, vmArg, ...rest] = argv;
  if (cmd === "status") {
    const r = kubectl(["-n", NAMESPACE, "get", "vm,vmi,dv,pvc", "-o", "wide"]);
    process.stdout.write(r.out);
    process.stderr.write(r.err);
    return r.code === 0 ? 0 : 1;
  }
  if ((cmd !== "screenshot" && cmd !== "key") || !isVm(vmArg)) {
    console.error(`usage: windows-11-vm.ts screenshot <vm> [--out file.png] | key <vm> KEY_NAME [KEY_NAME...] [--repeat N] | status      (<vm>: ${VMS.join(" | ")})`);
    return 2;
  }
  const pod = launcherPod(vmArg);
  if (pod === null) {
    console.error(`${vmArg} is not running (no virt-launcher pod). Start it first: virtctl start ${vmArg} -n ${NAMESPACE}`);
    return 1;
  }
  if (cmd === "screenshot") {
    let out = `${vmArg}-screen.png`;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--out" && rest[i + 1] !== undefined) out = rest[++i]!;
      else {
        console.error(`unknown argument ${rest[i]}`);
        return 2;
      }
    }
    const remote = "/tmp/zeta-screen.png";
    const shot = kubectl(["-n", NAMESPACE, "exec", pod, "-c", "compute", "--", "virsh", "screenshot", domainName(vmArg), remote]);
    if (shot.code !== 0) {
      console.error(`virsh screenshot failed: ${shot.err.trim()}`);
      return 1;
    }
    const b64 = kubectl(["-n", NAMESPACE, "exec", pod, "-c", "compute", "--", "base64", "-w0", remote]);
    if (b64.code !== 0 || b64.out.trim() === "") {
      console.error(`could not read the screenshot back: ${b64.err.trim()}`);
      return 1;
    }
    writeFileSync(out, Buffer.from(b64.out.trim(), "base64"));
    console.log(`wrote ${out}`);
    return 0;
  }
  // key
  const keys: string[] = [];
  let repeat = 1;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--repeat" && rest[i + 1] !== undefined) repeat = Number(rest[++i]);
    else keys.push(rest[i]!);
  }
  let script: string;
  try {
    script = keyLoopScript(vmArg, keys, repeat);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const r = kubectl(["-n", NAMESPACE, "exec", pod, "-c", "compute", "--", "sh", "-c", script]);
  if (r.code !== 0) {
    console.error(`send-key failed: ${r.err.trim()}`);
    return 1;
  }
  console.log(`sent ${keys.join(" ")} to ${vmArg} x${repeat}`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
