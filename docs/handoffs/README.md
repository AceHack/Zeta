# docs/handoffs — hand-off packages live IN THE REPO, never only on a desktop

Aaron 2026-06-14: "stuff on my desktop/clipboard is DARK for Addison and Max." Correct — a
hand-off that lives on one person's desktop is invisible to every other traveler (the red-light
law applied to hand-offs: who can see this, and is that visible?). Packages assembled for
external ferries (Vera's Q# verification package, Kestrel's shape-validation bundle, future ones)
are committed HERE — text, diffable, visible to all — and copied to a clipboard/desktop only as
the LAST hop of a ferry, never as the home.

Current:

- [`../trajectories/own-ai-harness/RESUME.md`](../trajectories/own-ai-harness/RESUME.md)
  — Own harness: account logins for grok/claude/openai/manus/gemini/codex/kiro
  + GitHub tokens without `gh`. Slice 0 is `zeta-login`. Next:
  AuthProviders (`081M100RH29087G0R0031HHGJ0`) and ForgeHost without `gh`
  (`081M100RB9Z087G0R000GWY1MM`).
- [`2026-08-24-riven-usb-zflash-qemu-restore-next.md`](./2026-08-24-riven-usb-zflash-qemu-restore-next.md)
  — Riven USB/zflash QEMU restore: mise-trust and picker `--defer-all` are
  on `main`; next slice is sibling dispatch `if: always()` so a restore
  red does not skip wifi/write/picker (live hang was
  [run 32724820159](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/32724820159)).
- `vera-qsharp-verification-package.txt` — the Q# verification hand-off (brief REVISION 2 +
  claim-bearing sources + known-answer table). Vera's verdict lines remain hers to write.
- `kestrel-shape-validation-bundle.txt` — the faithful-renderer port bundle (sources + cartridges
  - known-answer checks).
