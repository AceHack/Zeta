-- Library root for the `Lean4` lean_lib declared in
-- `lakefile.toml`. Imports the machine-checked proof files so
-- `lake build` walks them transitively.
import Lean4.DbspChainRule
import Lean4.DbspOperators
import Lean4.EntropyFloorLift
import Lean4.EntropyMeasureTheoretic
import Lean4.FinShannonEntropy
import Lean4.FinConditionalEntropy
import Lean4.FinMutualInfoNonneg
import Lean4.FinDataProcessing
import Lean4.DecorrelationDpi
import Lean4.GenGenFixpoint
import Lean4.CostRecurrence
import Lean4.LandauerFloor
import Lean4.CayleyDicksonDoublyEven
import Lean4.BridgeFunctor
import Lean4.NormalizerCorrect
import Lean4.CanonicalizerCorrect
import Lean4.SchemaEvolution
import Lean4.DynamicValue
import Lean4.JsonCodec
import Lean4.CborCodec
import Lean4.YamlCodec
import Lean4.Bonsai
import Lean4.AdjCtlOrthogonality
import Lean4.CliffordReflectionE8
import Lean4.MenoBraidedRMatrix

-- KNOWINGLY EXCLUDED, and said out loud so the omission is visible:
--   Lean4.GenSelfApplication — does NOT compile.
--     `Lean4/GenSelfApplication.lean:107:47: Unknown identifier 'selfCode'`
--   `selfCode` is bound existentially at :99 and then referenced as a free
--   definition at :107; no `def selfCode` exists. The file's own footer claims
--   "SORRY-FREE ... Expected: NO warnings, NO errors = oracle passes" — it has
--   never been run. It entered via #8883 (2026-06-21, "recover orphaned session
--   artifacts") and has sat outside every check since, exactly like the
--   ImaginaryStack incident recorded in lakefile.toml.
--   Importing it here would redden the build, so it stays out UNTIL someone
--   supplies the missing `selfCode` term — but it stays out NAMED, not silently.
