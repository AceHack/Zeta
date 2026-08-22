-- Library root for the `Lean4` lean_lib declared in
-- `lakefile.toml`. Imports the machine-checked proof files so
-- `lake build` walks them transitively.
import Lean4.DbspChainRule
import Lean4.DbspOperators
import Lean4.MalamentHogarthBoundedTick
import Lean4.EntropyFloorLift
import Lean4.EntropyMeasureTheoretic
import Lean4.FinShannonEntropy
import Lean4.FinConditionalEntropy
import Lean4.FinMutualInfoNonneg
import Lean4.FinDataProcessing
import Lean4.DecorrelationDpi
import Lean4.GenGenFixpoint
import Lean4.GenSelfApplication
import Lean4.CostRecurrence
import Lean4.LandauerFloor
import Lean4.LightTimeAsymmetry
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
import Lean4.MenoMonoidalHexagons
import Lean4.MenoBalancedTwist
import Lean4.MenoTwistCentrality
import Lean4.VonNeumannTraceWitness
