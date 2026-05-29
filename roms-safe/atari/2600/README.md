# Safe Atari 2600 ROMs

This directory holds Atari 2600 (VCS) ROMs identified as safe to redistribute
under their public-domain, freeware, or permissive-homebrew licenses.

See the tree-root explainer at [`roms-safe/README.md`](../../README.md) for how
the safe/unsafe split works, and the source policy at
[`roms/README.md`](../../../roms/README.md) for the license-safety gate. The
source testbed for this system is [`roms/atari/2600/`](../../../roms/atari/2600/README.md).

The authoritative list lives in
[`tools/roms/manifests/atari-2600-allowlist`](../../../tools/roms/manifests/atari-2600-allowlist)
(no extension, per the repo's declarative-manifest convention). That manifest
carries the per-ROM license citation above each entry;
[`tools/roms/split-by-license.ts`](../../../tools/roms/split-by-license.ts)
classifies ROMs against it (report-only by default, `--apply` to move).

## ROMs in this safe set

Each entry is a homebrew release whose author explicitly permits free
redistribution. Canonical filenames match the manifest exactly.

| Canonical name                              | Author           | License class     | Citation                                                                |
| ------------------------------------------- | ---------------- | ----------------- | ----------------------------------------------------------------------- |
| `Halo 2600 (2010) (Ed Fries).bin`           | Ed Fries         | Freeware homebrew | [AtariAge](https://atariage.com/software_page.php?SoftwareLabelID=2008) |
| `Anguna (2012) (Nathan Tolbert).bin`        | Nathan Tolbert   | Free homebrew     | [bytesizedgames.com](https://www.bytesizedgames.com/anguna2600.html)    |
| `Thrust (2000) (Thomas Jentzsch).bin`       | Thomas Jentzsch  | Free homebrew     | [AtariAge](https://atariage.com/software_page.php?SoftwareLabelID=921)  |
| `Sheep It Up! (2012) (Dr. Ludos).bin`       | Dr. Ludos        | Free homebrew     | [itch.io](https://drludos.itch.io/sheep-it-up)                          |
| `Duck Attack! (2010) (Will Nicholes).bin`   | Will Nicholes    | Free homebrew     | [willnicholes.com](https://www.willnicholes.com/duckattack/)            |
| `Jammed (2009) (Chris Read).bin`            | Chris Read       | Free homebrew     | [AtariAge](https://atariage.com/software_page.php?SoftwareLabelID=2168) |
| `Star Battle (2006) (Scott Williamson).bin` | Scott Williamson | Free homebrew     | [AtariAge](https://atariage.com/software_page.php?SoftwareLabelID=1486) |
