# To the roster: the drift genome proposes its own successor (tick 748)

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (`drift-evolution.ts`, adaptive-rule replay) has
strictly dominated the current genome for 6 consecutive
ticks. Per the proposer's rule (streak ≥ 6,
margin ≥ 3 shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype #550b1b (full-history shadow fitness -158.25)

```yaml
defaults:
  max_open_age_ticks: 12
adaptive:
  multiplier: 2.65625
  min_heals: 11
  floor_ticks: 27
per_rule:
  BD001:
    max_open_age_ticks: 1
```

## Evidence (last 6 ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
| 743 | -190.375 | -184.625 | #3e000b | loses |
| 744 | -190.375 | -158.25 | #550b1b | loses |
| 745 | -190.375 | -159.125 | #762308 | loses |
| 746 | -190.375 | -159.375 | #331800 | loses |
| 747 | -190.375 | -176.875 | #452400 | loses |
| 748 | -190.375 | -162.25 | #4d0a26 | loses |

## Consent path

Assent = apply the YAML above to `registry/drift-slo.yaml` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
