# updates/ — Zeta + equipment update artifacts & process, at root

`updates/` holds the **update process + artifacts** — how Zeta (and the managed equipment, e.g. the home
crypto-mining fleet + the MyNode nodes) **update themselves**. A root-level folder. Fired by `triggers/`
(the **Zeta update trigger**) and realized by the finalizer-runtime (**ReKick = merge-to-main → next wave**),
so an update is a bounded, DST-replayable tick — not an ad-hoc push.

- **Zeta self-update** — pull/merge the new wave (the ReKick recursion edge over git); declarative
  desired-state (close-over-the-deps), so an update converges the machine to the new state.
- **Equipment update** — the home-mining fleet + MyNode nodes (td5/td6) update via the same trigger →
  update flow (e.g. re-flash the USB image, pull new node software). See
  `.claude/skills/home-crypto-mining/blueprint-mynode-nodes.md`.

## Security by clarity (our own PKI), not obscurity

- Update **artifacts, recipes, and config live in the repo, in the open** (clarity = security). Any secret
  in an update is **sealed by our own keyring/PKI** (the encrypted null) and committed — not hidden.
- **Signing/attestation** uses **our own PKI** (the persona keyring + cert-manager/Let's Encrypt on the
  zetacluster; GitHub+FIDO trust root; SLSA over our keys) — we are our own authority, not an external gate.
- The live **act** (flashing a USB, ArgoCD sync) is a human/automated step, but its **recipe + desired-state
  are repo** (GitOps; `install.sh`/ArgoCD realize declared state).

## Pointers

- `triggers/` — the Zeta update trigger that fires updates. · `src/Core/FinalizerRuntime.fs` (ReKick = the
  update advance). · `hats/home-crypto-miner/` + the home-crypto-mining skill group.
