// GeneratorRegistry content-address (idOf) cross-verification oracle.
//
// Delegates to the shared N-way byte-diff harness: every present language oracle
// must agree with each other AND with the canonical `result` values in
// vectors.yaml. The value is `idOf name version` — the deterministic, content-
// addressed ZetaId a generator earns from its stable name@version
// (src/Core/GeneratorRegistry.fs). Byte-lock here proves the "treaty over
// generators": the same generator name yields the SAME id on every oracle, which
// is what lets a `generated-from-ir` oracle reference its generator by id and have
// every node resolve it identically (it cannot float apart).
import { runNWayDiff } from "../_harness/nway-diff.ts";

process.exit(await runNWayDiff({ dir: import.meta.dir }));
