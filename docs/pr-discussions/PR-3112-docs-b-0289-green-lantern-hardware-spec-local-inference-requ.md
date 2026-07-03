---
pr_number: 3112
title: "docs(b-0289): Green Lantern hardware spec \u2014 local inference requirements"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T07:52:17Z"
merged_at: "2026-05-14T08:02:37Z"
closed_at: "2026-05-14T08:02:37Z"
head_ref: "feat/b-0289-hardware-spec-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T08:12:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3112: docs(b-0289): Green Lantern hardware spec — local inference requirements

## PR description

## Summary

- Adds research doc comparing 4 hardware candidates for the Genesis Seed local inference stack (081KR2E4K0008QG0R001SWEPNV)
- Establishes the two-tier architecture: ESP32-S3 ring MCU + RPi 5 8GB inference gateway
- Includes power/compute/connectivity matrix and 5 open questions feeding 081KR2E4K0008QG0R003MJ4JK0 and follow-on slices
- Updates backlog item with pre-start checklist proof, claim, and research doc pointer

## What changed

| File | Change |
|------|--------|
| `docs/research/2026-05-14-b0289-green-lantern-hardware-spec-local-inference.md` | New — hardware spec research doc |
| `docs/backlog/P1/081KR2E4K0008QG0R001SWEPNV-green-lantern-hardware-spec-2026-05-08.md` | Updated — pre-start checklist + research doc pointer, status → in-progress |

## Candidates compared

| # | Device | Tier | LLM class | Tok/s (3B Q4) | Power |
|---|--------|------|-----------|---------------|-------|
| A | Jetson Orin Nano 8GB | Gateway (best) | 7B–8B Q4 | ~70 | 10–15 W |
| B | RPi 5 8GB | Gateway (recommended) | 3B–7B Q4 | ~15 | 8–12 W |
| C | RPi 5 4GB | Gateway (budget) | 1B–3B Q4 | ~15 | 8–11 W |
| D | ESP32-S3 | Ring MCU | micro/none | N/A | <33 mW |

**Recommended starting config:** ESP32-S3 ring MCU + RPi 5 8GB gateway running Llama 3.2 3B Q4_K_M via llama.cpp.

## Checks

- `dotnet build -c Release`: 0 warnings, 0 errors (no source changes; verified clean before work)
- No prior hardware spec doc found (prior-art search documented in backlog item)
- Claim: `otto-cli`, `feat/b-0289-hardware-spec-2026-05-14`
- operative-authorization: aaron 2026-05-13: "Cooling period: TBD. The memory file IS the durable record"

## Open questions (081KR2E4K0008QG0R003MJ4JK0 + follow-on)

1. Ring MCU ↔ gateway mutual auth protocol (KSK-signed BLE challenge?)
2. Cold-start latency: persistent daemon vs wake-on-BLE
3. Reticulum LoRa channel budget for heartbeat + receipt traffic
4. Ring form-factor PCB feasibility (ESP32-S3-WROOM-1 is 18×20 mm)
5. Gateway firewall / KSK access policy for local WiFi exposure

Closes 081KR2E4K0008QG0R001SWEPNV.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T07:53:45Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `a1860d9bd6`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T07:54:22Z)

## Pull request overview

Docs-only PR delivering the research deliverable for 081KR2E4K0008QG0R001SWEPNV: a hardware spec evaluating local-inference candidates for the Green Lantern ring. Recommends a two-tier architecture (ESP32-S3 ring MCU + RPi 5 8GB inference gateway running Llama 3.2 3B Q4_K_M), with a Jetson Orin Nano upgrade path. Backlog row is updated with the pre-start checklist and a pointer to the research doc.

**Changes:**

- New research doc comparing 4 hardware candidates (Jetson Orin Nano 8GB, RPi 5 8GB, RPi 5 4GB, ESP32-S3) across compute, power, and connectivity, plus a recommended starting config and 5 open questions feeding 081KR2E4K0008QG0R003MJ4JK0.
- Backlog row flipped to `status: in-progress`, `last_updated` bumped, `pr: pending` added, and pre-start checklist + research-doc pointer appended.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| `docs/research/2026-05-14-b0289-green-lantern-hardware-spec-local-inference.md` | New research doc: candidates A–D, matrix, recommended config, open questions, prior-art log. |
| `docs/backlog/P1/081KR2E4K0008QG0R001SWEPNV-green-lantern-hardware-spec-2026-05-08.md` | Status → in-progress; adds pre-start checklist, claim ref, and research-doc pointer. |

### COMMENTED — @AceHack (2026-05-14T07:59:46Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-14T07:59:50Z)

_(no body)_

### COMMENTED — @chatgpt-codex-connector (2026-05-14T08:03:06Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `d27f2eacb0`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: docs/research/2026-05-14-b0289-green-lantern-hardware-spec-local-inference.md:278 (resolved)

**@chatgpt-codex-connector** (2026-05-14T07:53:46Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Remove impossible NVMe requirement from ring MCU spec**

This requirement is not implementable on the stated ring hardware: an ESP32-S3 module has SPI flash/PSRAM but no NVMe interface or PCIe lane, so specifying policy cache storage in an NVMe partition makes the recommended Tier-1 design physically inconsistent and blocks downstream firmware/storage planning. Please replace this with a storage target the ESP32-S3 can actually host (for example encrypted SPI flash/FRAM) or move NVMe-backed cache responsibility to the gateway tier.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-14T07:59:46Z):

Fixed. Replaced the impossible NVMe partition reference with encrypted SPI flash — ESP32-S3 has only SPI flash/PSRAM and no NVMe/PCIe interface. Both occurrences corrected: `On-ring functions` list (line 227) and `Recommended initial configuration` block (line 278). Committed as d27f2eac.

### Thread 2: docs/research/2026-05-14-b0289-green-lantern-hardware-spec-local-inference.md:210 (resolved)

**@chatgpt-codex-connector** (2026-05-14T07:53:46Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Fix ESP32 inference table to avoid impossible model fit**

The table claims TinyLlama 1.1B Q2_K can run with an ESP32-S3 configuration that has only 8 MB PSRAM, but even ideal 2-bit weights alone for a 1.1B model are hundreds of MB before runtime buffers, so this benchmark line is physically unattainable and can misdirect hardware and latency expectations for 081KR2E4K0008QG0R003MJ4JK0 follow-on work. The MCU section should use model sizes that can actually fit within the documented memory envelope.

Useful? React with 👍 / 👎.

**@AceHack** (2026-05-14T07:59:50Z):

Fixed. Replaced the impossible TinyLlama 1.1B Q2_K benchmark with an accurate memory-envelope analysis: at 2-bit quantization, 1.1B params requires ~275 MB for weights alone — 34× the ESP32-S3 PSRAM budget. The inference table now lists purpose-built MCU micro-models (TFLite Micro / Edge Impulse keyword detection < 200 KB; fixed-intent LSTM < 500 KB) that actually fit. The conclusion (ESP32-S3 is ring MCU tier, not inference tier) is unchanged. Committed as d27f2eac.

### Thread 3: docs/research/2026-05-14-b0289-green-lantern-hardware-spec-local-inference.md:225 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T08:03:06Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Remove unsupported Ed25519 hardware-acceleration claim**

This line states that ESP32-S3 receipt signing is `Ed25519` with hardware acceleration via ESP-IDF mbedTLS, but on ESP32-S3 the hardware signature peripheral accelerates RSA-based signing while Ed25519 runs in software. That mismatch can materially skew ring-side CPU, latency, and battery budgeting if downstream work assumes signing is hardware-offloaded; please reword this as software Ed25519 (or switch the algorithm claim to one the hardware actually accelerates).

Useful? React with 👍 / 👎.
