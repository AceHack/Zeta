# Zeta Society Heartbeat GitHub App

This is the desired-state manifest for the **private** GitHub App used by the Identity Space browser control to dispatch the scheduled `society-heartbeat.yml` workflow.

## Boundary

| Property | Required state |
|---|---|
| Visibility | Private |
| Repository installation | `Lucent-Financial-Group/Zeta` only |
| Repository permission | `Actions: write` only |
| Webhooks | Disabled |
| Event subscriptions | None |
| Credential location | Protected authorization harness only; never GitHub Pages or browser storage |

The protected harness creates a dynamic equivalent of this manifest so it can preserve the GitHub Pages popup return origin through GitHub's manifest callback. Its unit test asserts the rendered manifest retains this same permission boundary.

> The App is an automation credential, not a general GitHub identity. It may only create a fresh, short-lived installation token constrained to the Zeta repository and then dispatch `society-heartbeat.yml` on `main`.
