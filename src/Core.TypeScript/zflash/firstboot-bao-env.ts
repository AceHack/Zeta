#!/usr/bin/env bun
/**
 * src/Core.TypeScript/zflash/firstboot-bao-env.ts
 *
 * First-boot bun consume of sourced bao names. Bash `.` sources
 * `/zeta-firstboot.conf` and exports both keys (or neither);
 * this reads `ZETA_BAO_LOAD_SITE` and `ZETA_BAO_PATH` from the
 * resulting env. After Step 6.95a the installer names
 * `ZETA_BAO_ELF_EPOCH=installer-iso` (literal, not from `/mnt`).
 * Named epoch filters ISO current-system bao from the JSON ask.
 * Named unseal request (`ZETA_UNSEAL_REQUEST`) is reported, not
 * inferred: missing is unmeasured (`requested` null), not `auto`.
 * Named probe is unmeasured (`probe` null), not present. A
 * named PathRequest is not a named probe. Named frost-look
 * keys (`ZETA_FROST_LOOK_OS` / `ZETA_FROST_LOOK_EFFECTS`) are
 * reported as `look`. Missing both keys is unmeasured
 * (`look` null), not `missing-os`. Named `"real"` still
 * leaves `probe` null. `/dev/tpmrm0` is not a probe and not
 * `real`. Does not call `integrateAtSetup`. Does not invent
 * a capture. Does not open files. Does not import the
 * frost-look CLI or the live probe effects module. bun invoke
 * lives in `zeta-install.sh` after Step 6.95a (mise/bun on
 * PATH). bun invoke from `zeta-first-boot.sh` stays
 * forbidden. Does not expand `ZetaFirstbootRole`. Does not
 * land Application.yaml.
 *
 * Usage: bun src/Core.TypeScript/zflash/firstboot-bao-env.ts
 * Exit 0: JSON `{ ok: true, ask, epoch, requested, probe, look }`
 * (ask, epoch, requested, probe, and look may be null).
 * Exit 2: JSON `{ ok: false, reason }`.
 */

import { consumeOptionalFrostLookFromEnv } from "../../../tools/setup/persona-keys/named-frost-look.ts";
import { type NamedHardwareProbe } from "../cluster/host-seal-profile.ts";
import { consumeUnsealRequestFromEnv } from "../cluster/unseal-path.ts";
import { consumeFirstbootBaoElfEnvWithEpoch, type FirstbootBaoElfEnvConsume } from "./firstboot-bao-elf.ts";

export function runFirstbootBaoElfEnvCli(
  env: { readonly [key: string]: string | undefined },
  write: (line: string) => void = (line) => {
    process.stdout.write(line);
  },
): number {
  const request = consumeUnsealRequestFromEnv(env);
  if (!request.ok) {
    write(`${JSON.stringify(request)}\n`);
    return 2;
  }
  const look = consumeOptionalFrostLookFromEnv(env);
  if (!look.ok) {
    write(`${JSON.stringify(look)}\n`);
    return 2;
  }
  const parsed: FirstbootBaoElfEnvConsume = consumeFirstbootBaoElfEnvWithEpoch(env);
  if (!parsed.ok) {
    write(`${JSON.stringify(parsed)}\n`);
    return 2;
  }
  const probe: NamedHardwareProbe | null = null;
  write(
    `${JSON.stringify({
      ok: true,
      ask: parsed.ask,
      epoch: parsed.epoch,
      requested: request.requested,
      probe,
      look: look.look,
    })}\n`,
  );
  return 0;
}

function main(): void {
  process.exit(runFirstbootBaoElfEnvCli(process.env));
}

if (import.meta.main) {
  main();
}
