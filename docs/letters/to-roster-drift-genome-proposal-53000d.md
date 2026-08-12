# To the roster: the drift genome proposes its own successor (tick 184)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #53000d (full-history shadow fitness -55.5)

```yaml
defaults:
  max_open_age_ticks: 1
adaptive:
  multiplier: 2.59375
  min_heals: 1
  floor_ticks: 13
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 179 | -112 | -66.125 | #41031e | loses |
| 180 | -112 | -55.5 | #53000d | loses |
| 181 | -112 | -61.5 | #5c1f16 | loses |
| 182 | -112 | -62.25 | #49000f | loses |
| 183 | -112 | -56.375 | #5a000b | loses |
| 184 | -112 | -58.125 | #65010c | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
