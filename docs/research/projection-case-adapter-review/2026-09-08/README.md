# Independent case-adapter custody

Operational status: research-grade

The [signed review](../../2026-09-08-projection-case-adapter-independent-review.md)
is the entry point. [audit.py](audit.py) reads the exact adapter AST literals
and compares the target rows with the frozen contract. It also verifies
all 14 archive records and five source identities without importing the
adapter, rendering inputs or running any numerical service.

The [observation](audit-observation.json) retains the static 40-ID/88-slot
plan, source identities, all archived record identities and original check
outputs. These planned slots are not actual returned calls. The executed
audit source and observation are bound by [identities](audit-identities.json).
The original source-owned archive remains at the exact reviewed commit.
