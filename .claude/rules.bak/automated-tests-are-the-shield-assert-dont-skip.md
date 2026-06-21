# Automated tests are the shield, not the script — assert, don't skip

Carved sentence (Aaron 2026-05-30):

> A shield with a hole is worse than a known gap, because it reads
> as covered.

## Operational content

Two composing claims, both Aaron 2026-05-30, surfaced over the
install.sh cross-OS Docker test matrix (NixOS/Ubuntu/mac):

### 1. The shield is the automated tests, not the artifact they guard

*"it's impossible to keep all the install surfaces in your mind at
once — only automation can be sure a nixos change didn't break ubuntu
or mac and vice versa. trying to manually make sure everything is a
losing game to entropy."* → *"the automated tests around install.sh —
that's the shield."*

`install.sh` is the **lever** (bare machine → substrate). It cannot
certify itself, and no human holds all install surfaces in working
memory at once — so a change on one surface silently regresses
another. Only the **automated cross-surface test matrix** can assert
"this change to surface A didn't break surface B." The script is what
the shield guards; the tests are the shield.

Generalizes past install.sh: any artifact whose correctness spans
more surfaces than one mind can hold (multi-OS, multi-arch, multi-
tenant, multi-version) is shielded by its test matrix, not by careful
authoring.

### 2. A shield only covers the surface it actually exercises — assert, don't skip

A test that passes **by not exercising the thing** is a hole in the
shield. The failure class — "control that reports OK without
exercising what it's supposed to guarantee":

| Surface | The hole |
|---|---|
| CI test | skips-to-green (graceful skip, `xfail`, early-return on missing dep) |
| Monitor / alert | no data flowing through the alert path |
| Security control | report-only / audit mode, never enforcing |
| Type check | `any`-cast / suppression on the hard case |
| Audit | samples the easy 95%, never the risky tail |

A **known gap shows up on the map**; a **false-green erases itself
from the map** — it reads as covered. That is why it is worse.

**The discriminator — graceful vs assert by layer:**

- An **installer / runtime** step *should* be graceful (warn + exit 0
  on a missing *optional* dep — don't brick a machine over a probe).
- The **test** that wraps it *must not* inherit that grace — its job
  is to catch exactly the skipped case. Keep the grace in the
  artifact; strip it in the test's validation step. Conflating the two
  produces false-green, which is indistinguishable from coverage.

## Empirical anchor

2026-05-30: `docker-nixos-install-sh-test` went **green** while the
local-LLM primitive was **non-functional on the primary OS** —
`common/local-llm.sh` downloads the generic ollama binary (won't run
on non-FHS NixOS), skips gracefully, install.sh runs clean, build
passes. Green-by-skip on the OS that boots the real hardware. Tracked
as **081KSV2WD0008QG0R0004C8WV8** (NixOS-native ollama — close the hole in the shield):
fix is (1) make it actually work (nixpkgs-native ollama) AND (2) make
the test **assert** it works and fail if absent.

> Note: the install.sh local-LLM matrix + 081KSV2WD0008QG0R0028NY0MV/081KSV2WD0008QG0R0004C8WV8 are currently
> off-leash on `accelerator/pr-less-git-monster` (pending harvest to
> main); refs are plain-text, not links, until that substrate lands on
> main. The *principle* this rule carries is general and stands alone.

## Operational discipline

When authoring or reviewing a test / monitor / control:

1. Ask **"can this pass without exercising the thing it guarantees?"**
   If yes, it's a candidate hole — make it assert the positive, not
   merely tolerate the negative.
2. Keep graceful-degradation in the **artifact**, not the **test**.
3. A green check on a surface you never exercised is a **false-green**
   — treat it as a gap, not as coverage, until the test asserts.
4. For multi-surface artifacts, trust the **matrix**, not your memory
   — you cannot hold all surfaces at once; that's what the matrix is
   for.

## Composes with

- `.claude/rules/asymmetric-critic-with-clarity-first.md` — false-green
  as "the most dangerous CI state" (indistinguishable from coverage);
  substrate-check applied to your own test results
- `.claude/rules/blocked-green-ci-investigate-threads.md` — green-CI is
  not always done-state; investigate before trusting
- `.claude/rules/dep-pin-search-first-authority.md` — declarative
  manifests (e.g. `manifests/local-llm`) as the single cross-surface
  source of truth the matrix validates against
- 081KSV2WD0008QG0R0028NY0MV (NixOS-primary / Ubuntu-value evaluation) + 081KSV2WD0008QG0R0004C8WV8 (the
  empirical hole this rule was carved from)
- The Docker NixOS+Ubuntu install.sh test matrix (the shield itself)

## Why this rule auto-loads

Per `.claude/rules/wake-time-substrate.md`: load-bearing test-design
discipline needs cold-boot landing. The false-green failure mode fires
at test-authoring time (and at the moment of trusting a green check) —
auto-load makes the discriminator available to every agent before they
write the skip-able test or trust the green-by-skip.

## Full reasoning

Aaron 2026-05-30, over the install.sh cross-OS Docker test matrix:
*"a shield with a hole is worse than a known gap, because it reads as
covered."* Carved from the 081KSV2WD0008QG0R0004C8WV8 empirical anchor (NixOS local-LLM
green-by-skip). install.sh is the entropy lever; the automated tests
around it are the entropy shield; a test that skips-to-green is a hole
in that shield.
