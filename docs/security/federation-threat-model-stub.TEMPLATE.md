# Federation threat-model stub

Copy this file to `docs/security/federations/<federation-id>.md` when a
federation is chartered. Fill every field. Validate the machine form with
`src/Core.TypeScript/installer/federation-threat-model-stub.ts` (same
questions as [`USB-IDENTITY-THREAT-MODEL.md`](./USB-IDENTITY-THREAT-MODEL.md)
§3). A stub with no exit path is a fake federation — do not merge it.

**Status:** template (not a live charter)
**Scale:** federation (contracts + exits). Not a cluster.

---

## Identity

- **federationId:** (lowercase kebab slug)
- **displayName:**
- **charterRef:** (path or URL of the constitution)

## §3 questions (self-similar)

| Question | This federation |
|----------|-----------------|
| Who am I? | |
| Who can join? | |
| Who can leave? | (must exist; Universal Exit Principle) |
| What is secret? | |
| What is enforceable? | (contracts only — not cluster relationships) |

## Exit paths

At least one. Name the cost if any.

1.

## Custody policy

Who holds treasury / sealed vaults; HW vs SW mix.

## Installer implication

What USB / zflash / ClusterNode bringup must **not** claim until this
charter is installer-wired. Default: GitHub self-register PR is
cluster-shaped, not Lodge membership.
