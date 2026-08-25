# To the roster: the drift genome proposes its own successor (tick 670)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #30000e (full-history shadow fitness -140.5)

```yaml
defaults:
  max_open_age_ticks: 6
adaptive:
  multiplier: 1.5
  min_heals: 1
  floor_ticks: 14
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 665 | -180.25 | -145.25 | #510010 | loses |
| 666 | -180.25 | -140.375 | #30000e | loses |
| 667 | -180.375 | -160.125 | #610013 | loses |
| 668 | -180.375 | -163.875 | #470c11 | loses |
| 669 | -180.375 | -172.5 | #540316 | loses |
| 670 | -180.375 | -148.25 | #331c10 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
