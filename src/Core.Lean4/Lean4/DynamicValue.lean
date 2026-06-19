/-
  DynamicValue — the universal self-describing-payload primitive.
  Formalized in Lean 4 to match the canonical F# definition in src/Core/DynamicValue.fs.
-/

/-- The runtime type tag of a `DynamicValue`. -/
inductive DynamicValueType where
  | null
  | bool
  | int
  | float
  | string
  | bytes
  | array
  | object
  deriving DecidableEq, Repr

/-- **DynamicValue — the universal self-describing-payload primitive.** -/
inductive DynamicValue where
  | null
  | bool (val : Bool)
  | int (val : Int)
  | float (val : Float)
  | string (val : String)
  | bytes (val : List UInt8)
  | array (val : List DynamicValue)
  | object (val : List (String × DynamicValue))
  deriving Repr

/-- Returns the runtime type tag of a `DynamicValue`. -/
def typeOf : DynamicValue → DynamicValueType
  | .null => .null
  | .bool _ => .bool
  | .int _ => .int
  | .float _ => .float
  | .string _ => .string
  | .bytes _ => .bytes
  | .array _ => .array
  | .object _ => .object

/-! ## Structural Invariants and Tag Lemmas -/

/-- If the type tag is null, the value must be the null constructor. -/
theorem eq_null_of_typeOf_eq_null {x : DynamicValue} (h : typeOf x = .null) : x = .null := by
  cases x
  · rfl
  · contradiction
  · contradiction
  · contradiction
  · contradiction
  · contradiction
  · contradiction
  · contradiction

/-- If the type tag is bool, the value is a bool constructor. -/
theorem eq_bool_of_typeOf_eq_bool {x : DynamicValue} (h : typeOf x = .bool) : ∃ b : Bool, x = .bool b := by
  cases x
  · contradiction
  · exact ⟨_, rfl⟩
  · contradiction
  · contradiction
  · contradiction
  · contradiction
  · contradiction
  · contradiction

/-- If the type tag is int, the value is an int constructor. -/
theorem eq_int_of_typeOf_eq_int {x : DynamicValue} (h : typeOf x = .int) : ∃ i : Int, x = .int i := by
  cases x
  · contradiction
  · contradiction
  · exact ⟨_, rfl⟩
  · contradiction
  · contradiction
  · contradiction
  · contradiction
  · contradiction

/-- If the type tag is string, the value is a string constructor. -/
theorem eq_string_of_typeOf_eq_string {x : DynamicValue} (h : typeOf x = .string) : ∃ s : String, x = .string s := by
  cases x
  · contradiction
  · contradiction
  · contradiction
  · contradiction
  · exact ⟨_, rfl⟩
  · contradiction
  · contradiction
  · contradiction

/-- Tag injectivity: two values with distinct tags must be structurally distinct. -/
theorem distinct_values_of_distinct_tags {x y : DynamicValue} (h : typeOf x ≠ typeOf y) : x ≠ y := by
  intro heq
  rw [heq] at h
  exact h rfl
