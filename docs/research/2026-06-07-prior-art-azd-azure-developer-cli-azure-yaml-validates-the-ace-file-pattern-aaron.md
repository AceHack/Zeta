# Prior art: azd (Azure Developer CLI) + az validate the Ace CLI/file pattern (Aaron, 2026-06-07)

A Beacon prior-art anchor for the Ace CLI/`.ace`-file design (#6957–#6962). Aaron:

> *"I think azd is like this, or az — I forget."*

Both exist; **azd is the close analog**, and naming the prior art is the anchor-to-human-prior-art discipline.

## The two tools (disambiguated)

- **`az` — Azure CLI.** Granular **control-plane**, **verb-noun** commands per resource (`az group create`,
  `az vm create`): "designed around granular commands for specific administrative tasks." → the analog of the
  **`zeta <seam> <verb> <noun>`** CLI grammar (#6957) / `kubectl`.
- **`azd` — Azure Developer CLI.** The one Aaron means: a **declarative `azure.yaml`** file defines the
  services + Azure resources + infra (often via **Bicep/Terraform** IaC) + hooks + CI/CD; lifecycle verbs
  (`azd up` / `provision` / `deploy`) realize it. High-level developer workflow, file-driven. → the analog of
  the **`.ace` file** (#6960) + `ace ensure`/up.

So: **az ≈ the Ace verb-noun CLI; azd ≈ the declarative `.ace`-file-drives-setup pattern.** azd is real,
shipping prior art that the Ace-file direction is sound (declarative project file + lifecycle CLI is a proven
shape).

## What Ace adds beyond azd (the honest differentiators)

azd validates the *pattern*; Ace **generalizes** it on the Zeta substrate. Ace is not "azd but ours":

- **Universal, not Azure-bound.** azd targets Azure (azure.yaml → Azure resources via Bicep/Terraform). Ace is
  cross-OS + cross-ecosystem (OS/app/cluster, #6939/#6941) with **cross-OS patch sets** from one file (#6960).
- **Content-addressed per-layer caching** in the Zeta FS (#6960; BLAKE3/ContentStore) — dedup across builds/OSes;
  azd has no content-addressed layer cache of its own.
- **Homoiconic CLI ≡ file ≡ DynamicValue/IDL** (#6962) — a command *is* a one-line file *is* data. azure.yaml is
  a config file distinct from the `azd`/`az` command syntax; Ace unifies them.
- **Idempotent `ensure` + DU/workflow-fenced non-idempotence** (#6959); **OCI image output** (#6961);
  **DST `test` seam** (#6958). azd provisions imperatively-ish via IaC; Ace bakes idempotency, OCI, and
  deterministic simulation into the model.
- **Seams composable as Ace files** (#6961) — azd has no equivalent self-describing plane abstraction.

So the honest read: **azd (and Terraform/Pulumi/kubectl/gh) prove the declarative-file + lifecycle-CLI shape
works; Ace's contribution is generalizing it to a universal, content-addressed, homoiconic, OCI-emitting,
DST-able substrate** — the union (#6960) rather than an Azure-specific tool.

## Honest scope / peel

- A **prior-art anchor**, not new design. It situates Ace in its lineage (anchor-to-human-prior-art) and answers
  "is this like azd?" — yes for the pattern, with named differentiators.
- Don't overclaim novelty: the declarative-file-drives-setup idea is well-established (azd, Terraform, Pulumi,
  Nix, Ansible, Docker Compose, devcontainers). Ace's novelty is the *combination* on the Zeta substrate
  (content-addressed + homoiconic + cross-OS + OCI + DST + idempotent), per #6960/#6962 — each individually
  prior-art, the synthesis the contribution.

## Ties

- **Ace CLI grammar (#6957)** ← az. · **`.ace` file (#6960)** ← azure.yaml/azd. · **homoiconic CLI≡file (#6962)**
  (Ace's differentiator over azd's separate config). · **OCI (#6961)**, **idempotent ensure (#6959)**, **test
  seam (#6958)**, **closure/cross-OS (#6939/#6941)** — the differentiators.
- **anchor-to-human-prior-art rule** — this is that discipline (name the prior art for the pattern).

## Beacon anchors

- **Azure Developer CLI (`azd`)** — declarative `azure.yaml` + lifecycle verbs (`azd up`/provision/deploy), IaC
  via Bicep/Terraform. Sources: [azd vs az overview](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/azure-developer-cli-vs-azure-cli) ·
  [azure.yaml schema](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/azd-schema) ·
  [azd overview](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/overview). ·
  **Azure CLI (`az`)** — granular control-plane verb-noun commands. · Adjacent prior art for the
  declarative-file + lifecycle-CLI shape: **Terraform / Pulumi** (desired-state IaC), **Docker Compose /
  devcontainers**, **Nix**, **Ansible**, **kubectl apply**. Honest novelty: none in the pattern (azd/Terraform/
  etc. prove it); Ace's contribution is the **synthesis on the Zeta substrate** — universal, content-addressed,
  homoiconic (CLI≡file≡data), OCI-emitting, DST-able, idempotent — generalizing the azd shape beyond one cloud.
