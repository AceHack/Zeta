---
id: 081M3JG8ZRN087G0R00001RG0J
type: bug
state: backlog
priority: P2
slug: usb-installer-reinstall-scenarios-3-4-killed-mid-install-bar
title: "USB installer reinstall scenarios 3+4 killed mid-install: bare 'panic' failure marker matches nixos-install store path unit-panic-on-fail.service.drv"
created: 2026-09-27T22:37:52.277Z
depends_on: []
composes_with: []
---

# USB installer reinstall scenarios 3+4 killed mid-install: bare 'panic' failure marker matches nixos-install store path unit-panic-on-fail.service.drv

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3JG8ZRN087G0R00001RG0J-*.md` glob. -->

## Evidence

Run 36333822934, job 108660735337: scenario 3 (reformat-with-retention) and scenario 4
(path-fork) both failed at `initial-install-from-iso-with-disk` with
`failure marker observed in serial log: panic` after ~4.5 min. Both serial logs end mid
`nixos-install` (copying from cache.nixos.org). The only `panic` in either log is line 619,
`/nix/store/...-unit-panic-on-fail.service.drv` in nixos-install's "derivations will be built"
list (a stock nixpkgs 26.05 systemd unit).

Not #17691's per-marker terminal suppression: the stop came from the plain `failureMarkers`
scan (`RETENTION_FAILURE_SERIAL_MARKERS`), not `terminalFailureMarkerToStopOn`.

## Fix

`RETENTION_FAILURE_SERIAL_MARKERS`: `"panic"` -> `"Kernel panic"`, matching
`ci/qemu-full-install-test.ts` FAILURE_MARKERS, which already fixed the same false positive.
Falsifier: the store-path fixture in `zflash/test-harness/qemu-state.test.ts`.

## Not done

`"bail"` is still suspect in both lanes (the installer's `bail()` prints `ERROR: ...`, never
the word) and was left alone, as it is in the sibling lane.
