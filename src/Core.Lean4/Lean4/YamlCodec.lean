import Lean4.DynamicValue

/-!
# YAML Codec Formalization Boundaries

**CRITICAL: THIS IS A SIMPLIFIED MODEL AND NOT AN RFC-COMPLIANT PARSER/SERIALIZER.**

Following similar boundaries as JSON and CBOR:
1. **Simplified AST and Predicates**: Focuses on the 6 always YAML-representable shapes of `DynamicValue` v1. Bytes are excluded, and floats are excluded until the finite canonical-decimal runtime contract is modeled in Lean.
2. **No Text Serialization**: The proof verifies the bijection between the `DynamicValue` AST and the simplified `Yaml` AST. It does not handle text-level parsing/formatting.
3. **Key Ordering**: Assumes simple insertion-order preservation.

This model is intended to prove structural round-trip bijections of the nested value-tree abstraction. Actual text-level RFC compliance and cross-language byte parity are verified using differential test suites against golden vectors.
-/

/-- Simplified YAML AST covering the YAML value shapes used by DynamicValue v1. -/
inductive Yaml where
  | null
  | bool (b : Bool)
  | int (i : Int)
  | float (f : Float)
  | string (s : String)
  | array (l : List Yaml)
  | object (kv : List (String × Yaml))
  deriving Repr

mutual
  /-- Predicate characterizing DynamicValues representable in plain YAML (Bytes and Float deferred). -/
  def IsRepresentableInYaml : DynamicValue → Prop
    | .null => True
    | .bool _ => True
    | .int _ => True
    | .float _ => False
    | .string _ => True
    | .bytes _ => False
    | .array l => IsRepresentableYamlList l
    | .object l => IsRepresentableYamlPairs l

  /-- Predicate characterizing lists of DynamicValues representable in plain YAML. -/
  def IsRepresentableYamlList : List DynamicValue → Prop
    | [] => True
    | x :: xs => IsRepresentableInYaml x ∧ IsRepresentableYamlList xs

  /-- Predicate characterizing association lists representable in plain YAML. -/
  def IsRepresentableYamlPairs : List (String × DynamicValue) → Prop
    | [] => True
    | pair :: xs => IsRepresentableInYaml pair.2 ∧ IsRepresentableYamlPairs xs
end

mutual
  /-- Convert a DynamicValue to its YAML AST counterpart. Returns none for Bytes and Float. -/
  def toYaml : DynamicValue → Option Yaml
    | .null => some .null
    | .bool b => some (.bool b)
    | .int i => some (.int i)
    | .float _ => none
    | .string s => some (.string s)
    | .bytes _ => none
    | .array l => (toYamlList l).map .array
    | .object l => (toYamlPairs l).map .object

  /-- Helper to convert a list of DynamicValues to a list of YAML AST nodes. -/
  def toYamlList : List DynamicValue → Option (List Yaml)
    | [] => some []
    | x :: xs =>
        match toYaml x, toYamlList xs with
        | some y, some ys => some (y :: ys)
        | _, _ => none

  /-- Helper to convert a list of key-value pairs to YAML object key-value pairs. -/
  def toYamlPairs : List (String × DynamicValue) → Option (List (String × Yaml))
    | [] => some []
    | (k, v) :: xs =>
        match toYaml v, toYamlPairs xs with
        | some y, some ys => some ((k, y) :: ys)
        | _, _ => none
end

mutual
  /-- Convert YAML AST back to DynamicValue. -/
  def fromYaml : Yaml → DynamicValue
    | .null => .null
    | .bool b => .bool b
    | .int i => .int i
    | .float f => .float f
    | .string s => .string s
    | .array l => .array (fromYamlList l)
    | .object l => .object (fromYamlPairs l)

  /-- Helper to convert a list of YAML nodes back to DynamicValues. -/
  def fromYamlList : List Yaml → List DynamicValue
    | [] => []
    | y :: ys => fromYaml y :: fromYamlList ys

  /-- Helper to convert YAML object key-value pairs back to F# style association list. -/
  def fromYamlPairs : List (String × Yaml) → List (String × DynamicValue)
    | [] => []
    | (k, y) :: ys => (k, fromYaml y) :: fromYamlPairs ys
end

/-! ## Round-trip verification -/

mutual
  /-- **YAML Round-Trip Theorem.** For any representable DynamicValue,
      toYaml succeeds and fromYaml is a perfect inverse. -/
  theorem yaml_roundtrip : (v : DynamicValue) → IsRepresentableInYaml v → ∃ y : Yaml, toYaml v = some y ∧ fromYaml y = v
    | .null, _ => ⟨.null, rfl, rfl⟩
    | .bool b, _ => ⟨.bool b, rfl, rfl⟩
    | .int i, _ => ⟨.int i, rfl, rfl⟩
    | .float _, h => False.elim h
    | .string s, _ => ⟨.string s, rfl, rfl⟩
    | .bytes _, h => False.elim h
    | .array l, h =>
        match toYamlList_roundtrip l h with
        | ⟨ys, h1, h2⟩ => ⟨.array ys, by simp [toYaml, h1], by simp [fromYaml, h2]⟩
    | .object l, h =>
        match toYamlPairs_roundtrip l h with
        | ⟨ys, h1, h2⟩ => ⟨.object ys, by simp [toYaml, h1], by simp [fromYaml, h2]⟩

  /-- Auxiliary helper theorem for lists of representable values. -/
  theorem toYamlList_roundtrip : (l : List DynamicValue) → IsRepresentableYamlList l → ∃ ys : List Yaml, toYamlList l = some ys ∧ fromYamlList ys = l
    | [], _ => ⟨[], rfl, rfl⟩
    | x :: xs, h =>
        match yaml_roundtrip x h.1, toYamlList_roundtrip xs h.2 with
        | ⟨yx, hyx, hdec_x⟩, ⟨yxs, hyxs, hdec_xs⟩ =>
            ⟨yx :: yxs, by simp [toYamlList, hyx, hyxs], by simp [fromYamlList, hdec_x, hdec_xs]⟩

  /-- Auxiliary helper theorem for representable object key-value pairs. -/
  theorem toYamlPairs_roundtrip : (l : List (String × DynamicValue)) → IsRepresentableYamlPairs l → ∃ ys : List (String × Yaml), toYamlPairs l = some ys ∧ fromYamlPairs ys = l
    | [], _ => ⟨[], rfl, rfl⟩
    | (k, v) :: xs, h =>
        match yaml_roundtrip v h.1, toYamlPairs_roundtrip xs h.2 with
        | ⟨yv, hyv, hdec_v⟩, ⟨yxs, hyxs, hdec_xs⟩ =>
            ⟨(k, yv) :: yxs, by simp [toYamlPairs, hyv, hyxs], by simp [fromYamlPairs, hdec_v, hdec_xs]⟩
end
