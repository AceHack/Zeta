# ΔU: 081M005CBQ6087G0R003N21Z9J — write merged prior hints as beliefs, not errors

- **measure:** mergePriorHints computed mergePriorHint(local, hint) and discarded the result: absorbError mapped every hint to severity 'info' (z-score 0.5). The merged Gaussian is now written with replaceDimensionPosterior.
- **ΔU > 0 because:** a hint saying mu = 4 and a hint saying mu = 0 were indistinguishable at the receiver — the peer belief carried zero information through the merge. A peer belief is not an error, and the fold now depends on the hint's content.
- **witnessed by:** ZTC-18 (two hints differing only in mu leave different receiver states). bun test src/Core.TypeScript/discovery/zeta-transport-cell.test.ts
- **lineage:** PR #10781, merged 2026-08-14
