---
id: 081M1ZAGKTV087G0R001SB2DCC
type: bug
state: backlog
priority: P1
slug: k3s-preflight-tests-must-not-inherit-ambient-process-env
title: "K3s preflight tests must not inherit ambient process.env"
created: 2026-09-08T01:35:54.715Z
depends_on: []
composes_with: []
---

# K3s preflight tests must not inherit ambient process.env

`test (TS hermetic)` on `origin/main` SHA `c9c3b94cb`
(`archive(pr-reviews): PR #16995 on merge` #16997) failed
`gate (required)` on one assertion:

`the refusal offers BOTH ways forward, including founding
on purpose` expected `/nixos-rebuild switch --impure/`
in `full-ai-cluster/nixos/modules/k3s-join-intent-preflight.sh`
stdout. Isolated reruns of
`src/Core.TypeScript/hygiene/lint-k3s-join-intent-preflight.test.ts`
pass on Bun 1.3.13 and 1.3.14. The script still prints that
line. The sibling test that only asks for `--impure` and
`pathExists` passed in the same job.

Bun's hermetic suite runs files concurrently in one process.
`run()` spreads `process.env` into bash, so a sibling file
that sets `BASH_ENV` / `ENV` / `SHELLOPTS` / a hijacked
`PATH` becomes an input to this spawn. Firstboot consume
tests already pass only `PATH`. Close the k3s preflight
spawns the same way.

## Pre-start checklist

- Substrate-drift: the script and the assertion have been
  paired since `daa7657ff` (#15842). The red is the spawn
  env, not a missing remediation string.
- Prior-art: `src/Core.TypeScript/zflash/firstboot-bao-env.test.ts`
  spawn env is `{ PATH: process.env.PATH }`.
  `docs/PRIOR-ART-LIST.md` scanned; this is factory test
  isolation, not an external PKCS#11 image.
  `references/prior-art/` not searched recursively.
- Depends on nothing in-flight. Does not depend on live ISO
  wiring or `seal "pkcs11"`.

## Kill

- `seal "pkcs11"` in Application.yaml.
- Defaulting missing effects to `realProbeEffects`.
- Calling overlay joins from
  `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
- Changing ISO bun JSON `probe` away from null.
- Mutating `process.env.BASH_ENV` in this test to poison
  sibling files.
- Spreading `process.env` into the preflight spawn.
