# Iris root-site design sources

These `*.dc.html` files are the editable authoring originals for the Iris
root-site handoff. They are preserved here so the design language is source-owned
by Zeta instead of stranded in a scratchpad.

The deployable static bundle is the separate org Pages repository,
`Lucent-Financial-Group/lucent-financial-group.github.io`. Do not ship these
source files to the Pages repo. The static pages are already exported as plain
HTML, CSS, images, data JSON, and PWA assets in that repo.

File map:

- `Zeta Home.dc.html` -> `index.html`
- `Settlement.dc.html` -> `settlement.html`
- `DORA.dc.html` -> `dora.html`
- `Observatory Vault.dc.html` -> `vault.html`
- `Dark Hall.dc.html` -> `hall.html`
- `LLMTV.dc.html` -> `llmtv.html`
- `Git Pull.dc.html` -> `gitpull.html`
- `Genesis Concepts.dc.html` -> `concepts.html`
- `Vaults.dc.html` -> `vaults.html`
- `The Aperture Lodge.dc.html` -> `lodge.html`
- `Hidden Track.dc.html` -> `track00.html`
- `Hidden Track v2.dc.html` -> `track00b.html`

When editing the root-site design, update the `.dc.html` source here first, then
export the deployable static file into the org Pages repo. Keep live data ledgers
such as `data/metrics*.json` in the Pages repo; those are runtime evidence, not
design source.
