# The four measured instances, as they stood before their fixes

These are **verbatim copies** of four `Application.yaml` files at the commit
_before_ the commit that repaired each one. They are the falsifiers for
`inert-valuesobject-keys.ts`: a guard that cannot catch the four cases that
motivated it has not been demonstrated to work, and a guard demonstrated only
against cases invented after the fact has been demonstrated against nothing.

| fixture                      | copied from (`git show <sha>:<path>`)      | repaired by                                     |
| ---------------------------- | ------------------------------------------ | ----------------------------------------------- |
| `hindsight.Application.yaml` | `5e74c2939f6e4749a5e457d64091ec53e29efd61` | `f332a61ae` (#13457), then `337f0c664` (#13524) |
| `nats.Application.yaml`      | `5e74c2939f6e4749a5e457d64091ec53e29efd61` | `f332a61ae` (#13457)                            |
| `oz.Application.yaml`        | `c4d78f2da4316c7fb8d8350789aec3c2d259ba86` | `e162ecd3e` (#13471)                            |
| `headscale.Application.yaml` | `006b58ab7b2f666537adbd4305ec1704dde824d3` | `d5a602713` (#13550)                            |

`inert-valuesobject-keys.test.ts` re-verifies the first column against the
second with `git show` when the objects are reachable, so a fixture edited to
make a test pass is caught by the repository itself rather than trusted. In a
shallow clone the objects are absent and the test says so out loud instead of
passing quietly.

## What each one is pinned against, and the one place this is not literal

`hindsight`, `nats` and `headscale` are checked against the schema of the chart
at the pin the manifest itself names — 0.3.0, 1.2.7 and 0.4.0, all still the
tree's current pins, all in `inert-valuesobject-keys.schema.json`.

**`oz` is the exception and it is stated rather than smoothed over.** Its
pre-fix manifest named `ziti-controller` **1.4.5**, a version no registry has
ever served, so no schema for it exists to check anything against. That is
itself a defect and this guard reports it as one (`chart-unavailable`, which
counts toward the exit code) — but reporting "the pin is broken" would not
demonstrate that the guard finds `adminSecret:`. So the test does **both**:

1. the fixture at its own pin, which must be REFUSED as `chart-unavailable`;
2. the same `valuesObject` against `ziti-controller@3.1.1` — a version that
   exists, and the one the repair moved to — which must be REFUSED with
   `adminSecret` named as inert.

Only the second demonstrates the key-set comparison, and saying which is which
is the difference between a proof and a green tick.
