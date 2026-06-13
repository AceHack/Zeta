# tools/inventory/

Reusable utilities for inventory + asset tracking.

## amazon-orders-extract.ts

Extraction of personal Amazon order history into local JSON files.
**Run by a human-actor — not agent-invocable** (agent-driven scraping
of authenticated personal accounts is blocked by the safety classifier
per the B-0582 destructive-verb-refusal-gate principle).

Outputs go to `~/.local/share/zeta-inventory/amazon/<year>/`:

- `amazon-items-full.json` — title + URL + date + price per item
  (personal financial data; never appropriate for git commit by default)
- `amazon-items-hardware-filtered.json` — hardware-keyword subset
  (review then optionally commit to Zeta as B-0590 hardware inventory
  substrate, with PII stripped if desired)
- `amazon-items-partial.json` — per-page checkpoint (v2.3+; written
  after every page; lets a crashed run resume from where it died)

### Usage

```bash
bun tools/inventory/amazon-orders-extract.ts            # current year
bun tools/inventory/amazon-orders-extract.ts 2025       # specific year
bun tools/inventory/amazon-orders-extract.ts 2025 --restart   # ignore partial
```

First run auto-installs `playwright` + the chromium binary.

The script launches Playwright in headed mode and pauses for a
press-Enter confirmation after the orders page loads. Complete sign-in
in the opened browser window if prompted; press Enter in the terminal
when ready; extraction then walks each pagination page.

### Resume from partial

If a page-22 crash leaves `amazon-items-partial.json` with pages 1-21
recorded, the next run reads that file, skips the completed pages, and
resumes at page 22. Pass `--restart` to ignore the partial and start
fresh.

### Output files are gitignored

`amazon-items-full.json`, `amazon-items-hardware-filtered.json`, and
`amazon-items-partial.json` are listed in the repo's `.gitignore`. They
contain personal financial data + adjacent-party purchase info; never
appropriate for git commit by default. The hardware-only subset MAY be
committed after manual review strips PII (dates / prices / order IDs /
household-orbit items).

### Reusable for other accounts

The script is generic — anyone can run it on their own Amazon account.
No hardcoded credentials, no operator-specific paths. Future extension
(per the human maintainer's 2026-05-16 framing): multi-account /
multi-vendor consolidation for assets the operator is authorized to
query.

### Composes with

- [B-0582](../../docs/backlog/P1/B-0582-destructive-verb-refusal-gate-substrate-level-2026-05-16.md)
  — destructive-verb refusal gate; agent-driven scraping of authenticated
  personal accounts is appropriately refused at the classifier layer;
  human-driven script is the legitimate path
- [B-0590](../../docs/backlog/P2/B-0590-fleet-replication-20-machines-bare-metal-os-install-kvm-mini-pcs-2026-05-16.md)
  — fleet replication + hardware inventory substrate; this script's
  hardware-filtered output feeds that row's inventory section
- Future B-NNNN — multi-account consolidation (the human maintainer's
  2026-05-16 "killer feature" framing)
