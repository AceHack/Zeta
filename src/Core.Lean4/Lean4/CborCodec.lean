import Lean4.DynamicValue

/-!
# CBOR Codec Formalization Boundaries

**CRITICAL: THIS IS A SIMPLIFIED MODEL AND NOT AN RFC 8949 COMPLIANT WIRE CODEC.**

Per Riven's adversarial review (2026-06-16):
1. **Simplified Header Encoding**: Uses `[major, arg]` (fixed two-byte headers mapped to Nat lists) rather than RFC 8949's bit-packed variable-length header format.
2. **Simplified String Encoding**: Maps characters directly to their `Nat` code points via `Char.toNat` instead of compiling a proper UTF-8 byte stream.
3. **Float Stubs**: Floats are marked as unrepresentable (`IsRepresentableInCbor .float _ = False`), with the encoder defaulting to `[7, 0]` and decoder blindly emitting `0.0`.
4. **No Key Sorting**: Map keys are serialized in insertion order rather than RFC 8949 §4.2.1 lexicographical sorted byte order.

This model is intended to prove structural round-trip bijections of the nested value-tree abstraction using a fuel-based recursion model. Cross-language byte parity and RFC compliance for the 7 production engines are verified via differential testing against shared golden vectors, not by this proof.
-/



/-- Convert a character to its Nat code point. -/
def charToNat (c : Char) : Nat :=
  c.toNat

/-- Convert a Nat code point back to a character. -/
def natToChar (n : Nat) : Char :=
  Char.ofNat n

@[simp] theorem char_ofNat_toNat (c : Char) : Char.ofNat c.toNat = c :=
  Char.ofNat_toNat c

@[simp] theorem natToChar_charToNat_eq : natToChar ∘ charToNat = id := by
  funext c
  simp [natToChar, charToNat, Char.ofNat_toNat]

/-- Convert a string to its Nat code points (simplified byte representation). -/
def stringToBytes (s : String) : List Nat :=
  s.toList.map charToNat

/-- Convert a list of Nat code points back to a string. -/
def bytesToString (l : List Nat) : String :=
  String.ofList (l.map natToChar)

theorem bytesToString_stringToBytes (s : String) : bytesToString (stringToBytes s) = s := by
  unfold bytesToString stringToBytes
  simp [String.ofList_toList]

mutual
  /-- Predicate characterizing DynamicValues representable in our CBOR formalization (Float deferred). -/
  def IsRepresentableInCbor : DynamicValue → Prop
    | .null => True
    | .bool _ => True
    | .int _ => True
    | .float _ => False
    | .string _ => True
    | .bytes _ => True
    | .array l => IsRepresentableCborList l
    | .object l => IsRepresentableCborPairs l

  /-- Predicate characterizing lists of DynamicValues representable in our CBOR formalization. -/
  def IsRepresentableCborList : List DynamicValue → Prop
    | [] => True
    | x :: xs => IsRepresentableInCbor x ∧ IsRepresentableCborList xs

  /-- Predicate characterizing association lists representable in our CBOR formalization. -/
  def IsRepresentableCborPairs : List (String × DynamicValue) → Prop
    | [] => True
    | pair :: xs => IsRepresentableInCbor pair.2 ∧ IsRepresentableCborPairs xs
end

/-- Encode header with major type and Nat argument. -/
def encodeHeader (major : Nat) (arg : Nat) : List Nat :=
  [major, arg]

/-- Decode header, returning major type, Nat argument, and remaining bytes. -/
def decodeHeader : List Nat → Option (Nat × Nat × List Nat)
  | b1 :: b2 :: xs => some (b1, b2, xs)
  | _ => none

mutual
  /-- Convert a DynamicValue to its CBOR Nat-stream counterpart. -/
  def toCbor : DynamicValue → List Nat
    | .null => [246]
    | .bool true => [245]
    | .bool false => [244]
    | .int i =>
        if i >= 0 then
          encodeHeader 0 i.natAbs
        else
          encodeHeader 1 (i + 1).natAbs
    | .float _ => [7, 0]
    | .string s =>
        let bytes := stringToBytes s
        encodeHeader 3 bytes.length ++ bytes
    | .bytes bytes =>
        let nats := bytes.map (fun b => b.toNat)
        encodeHeader 2 nats.length ++ nats
    | .array l =>
        encodeHeader 4 l.length ++ toCborList l
    | .object l =>
        encodeHeader 5 l.length ++ toCborPairs l

  /-- Helper to encode a list of DynamicValues. -/
  def toCborList : List DynamicValue → List Nat
    | [] => []
    | x :: xs => toCbor x ++ toCborList xs

  /-- Helper to encode object key-value pairs. -/
  def toCborPairs : List (String × DynamicValue) → List Nat
    | [] => []
    | (k, v) :: xs => toCbor (.string k) ++ toCbor v ++ toCborPairs xs
end

mutual
  /-- Decode CBOR Nat-stream back to DynamicValue using a fuel parameter for termination. -/
  def fromCbor (fuel : Nat) : List Nat → Option (DynamicValue × List Nat)
    | [] => none
    | b :: xs =>
        match fuel with
        | 0 => none
        | fuel' + 1 =>
            if b == 246 then
              some (.null, xs)
            else if b == 245 then
              some (.bool true, xs)
            else if b == 244 then
              some (.bool false, xs)
            else if b == 7 then
              match xs with
              | [] => none
              | _ :: tail => some (.float 0.0, tail)
            else
              match decodeHeader (b :: xs) with
              | some (0, arg, tail) => some (.int (Int.ofNat arg), tail)
              | some (1, arg, tail) => some (.int (-1 - Int.ofNat arg), tail)
              | some (2, arg, tail) =>
                  let nats := tail.take arg
                  let rest := tail.drop arg
                  if nats.length == arg then
                    some (.bytes (nats.map (fun n => n.toUInt8)), rest)
                  else none
              | some (3, arg, tail) =>
                  let bytes := tail.take arg
                  let rest := tail.drop arg
                  if bytes.length == arg then
                    some (.string (bytesToString bytes), rest)
                  else none
              | some (4, arg, tail) =>
                  match fromCborList fuel' arg tail with
                  | some (items, rest) => some (.array items, rest)
                  | none => none
              | some (5, arg, tail) =>
                  match fromCborPairs fuel' arg tail with
                  | some (pairs, rest) => some (.object pairs, rest)
                  | none => none
              | _ => none

  /-- Helper to decode a list of DynamicValues. -/
  def fromCborList (fuel : Nat) : Nat → List Nat → Option (List DynamicValue × List Nat)
    | 0, xs => some ([], xs)
    | n + 1, xs =>
        match fuel with
        | 0 => none
        | fuel' + 1 =>
            match fromCbor fuel' xs with
            | some (item, tail) =>
                match fromCborList fuel' n tail with
                | some (items, rest) => some (item :: items, rest)
                | none => none
            | none => none

  /-- Helper to decode object key-value pairs. -/
  def fromCborPairs (fuel : Nat) : Nat → List Nat → Option (List (String × DynamicValue) × List Nat)
    | 0, xs => some ([], xs)
    | n + 1, xs =>
        match fuel with
        | 0 => none
        | fuel' + 1 =>
            match fromCbor fuel' xs with
            | some (.string k, tail) =>
                match fromCbor fuel' tail with
                | some (v, tail2) =>
                    match fromCborPairs fuel' n tail2 with
                    | some (pairs, rest) => some ((k, v) :: pairs, rest)
                    | none => none
                | none => none
            | _ => none
end

/-! ## List lemmas -/

theorem List.take_append_self {α : Type} (l : List α) (tail : List α) :
    (l ++ tail).take l.length = l := by
  induction l with
  | nil => rfl
  | cons x xs ih =>
      show (x :: (xs ++ tail)).take (xs.length + 1) = x :: xs
      simp [ih]

theorem List.drop_append_self {α : Type} (l : List α) (tail : List α) :
    (l ++ tail).drop l.length = tail := by
  induction l with
  | nil => rfl
  | cons x xs ih =>
      show (x :: (xs ++ tail)).drop (xs.length + 1) = tail
      simp [ih]

@[simp] theorem List.map_comp_toNat_toUInt8 (l : List UInt8) :
    List.map ((fun n => UInt8.ofNat n) ∘ (fun b => b.toNat)) l = l := by
  induction l with
  | nil => rfl
  | cons x xs ih =>
      dsimp
      simp [ih, UInt8.ofNat_toNat]

/-! ## Round-trip verification -/

mutual
  /-- **CBOR Round-Trip Theorem.** For any representable DynamicValue and any suffix stream tail,
      fromCbor parses the encoding of the value and returns the exact same value
      along with the remaining tail. -/
  theorem cbor_roundtrip : (v : DynamicValue) → IsRepresentableInCbor v → (fuel : Nat) → (h : sizeOf v < fuel) → (tail : List Nat) →
      fromCbor fuel (toCbor v ++ tail) = some (v, tail)
    | .null, _, 0, h, _ => by contradiction
    | .null, _, n + 1, _, _ => by simp [fromCbor, toCbor]
    | .bool true, _, 0, h, _ => by contradiction
    | .bool true, _, n + 1, _, _ => by simp [fromCbor, toCbor]
    | .bool false, _, 0, h, _ => by contradiction
    | .bool false, _, n + 1, _, _ => by simp [fromCbor, toCbor]
    | .int i, _, 0, h, _ => by contradiction
    | .int i, _, n + 1, _, tail => by
        unfold toCbor
        split
        · simp [fromCbor, decodeHeader, encodeHeader]
          omega
        · simp [fromCbor, decodeHeader, encodeHeader]
          omega
    | .float f, h_rep, _, _, _ => False.elim h_rep
    | .string s, _, 0, h, _ => by contradiction
    | .string s, _, n + 1, _, tail => by
        unfold toCbor
        simp [fromCbor, encodeHeader, decodeHeader, bytesToString_stringToBytes]
    | .bytes b, _, 0, h, _ => by contradiction
    | .bytes b, _, n + 1, _, tail => by
        unfold toCbor
        simp [fromCbor, encodeHeader, decodeHeader]
    | .array l, h_rep, 0, h, _ => by contradiction
    | .array l, h_rep, n + 1, h, tail => by
        have h1 : fromCborList n l.length (toCborList l ++ tail) = some (l, tail) := by
          have h_sz : sizeOf l < n := by
            simp at h
            omega
          exact cborList_roundtrip l h_rep n h_sz tail
        unfold toCbor
        simp [fromCbor, encodeHeader, decodeHeader, h1]
    | .object l, h_rep, 0, h, _ => by contradiction
    | .object l, h_rep, n + 1, h, tail => by
        have h1 : fromCborPairs n l.length (toCborPairs l ++ tail) = some (l, tail) := by
          have h_sz : sizeOf l < n := by
            simp at h
            omega
          exact cborPairs_roundtrip l h_rep n h_sz tail
        unfold toCbor
        simp [fromCbor, encodeHeader, decodeHeader, h1]

  /-- Auxiliary helper theorem for lists of DynamicValues. -/
  theorem cborList_roundtrip : (l : List DynamicValue) → IsRepresentableCborList l → (fuel : Nat) → (h : sizeOf l < fuel) → (tail : List Nat) →
      fromCborList fuel l.length (toCborList l ++ tail) = some (l, tail)
    | [], _, 0, h, _ => by contradiction
    | [], _, n + 1, _, _ => by simp [fromCborList, toCborList]
    | x :: xs, h_rep, 0, h, _ => by contradiction
    | x :: xs, h_rep, n + 1, h, tail => by
        have h_x : sizeOf x < n := by
          simp at h
          omega
        have h_xs : sizeOf xs < n := by
          simp at h
          omega
        have h1 : fromCbor n (toCbor x ++ (toCborList xs ++ tail)) = some (x, toCborList xs ++ tail) := cbor_roundtrip x h_rep.1 n h_x (toCborList xs ++ tail)
        have h2 : fromCborList n xs.length (toCborList xs ++ tail) = some (xs, tail) := cborList_roundtrip xs h_rep.2 n h_xs tail
        show fromCborList (n + 1) (x :: xs).length (toCborList (x :: xs) ++ tail) = some (x :: xs, tail)
        unfold toCborList
        dsimp [fromCborList]
        rw [List.append_assoc]
        rw [h1]
        dsimp [fromCborList]
        rw [h2]

  /-- Auxiliary helper theorem for object key-value pairs. -/
  theorem cborPairs_roundtrip : (l : List (String × DynamicValue)) → IsRepresentableCborPairs l → (fuel : Nat) → (h : sizeOf l < fuel) → (tail : List Nat) →
      fromCborPairs fuel l.length (toCborPairs l ++ tail) = some (l, tail)
    | [], _, 0, h, _ => by contradiction
    | [], _, n + 1, _, _ => by simp [fromCborPairs, toCborPairs]
    | (k, v) :: xs, h_rep, 0, h, _ => by contradiction
    | (k, v) :: xs, h_rep, n + 1, h, tail => by
        have h_k : sizeOf (DynamicValue.string k) < n := by
          simp at *
          omega
        have h_v : sizeOf v < n := by
          simp at *
          omega
        have h_xs : sizeOf xs < n := by
          simp at *
          omega
        have h_rep_k : IsRepresentableInCbor (.string k) := True.intro
        have h1 : fromCbor n (toCbor (.string k) ++ (toCbor v ++ (toCborPairs xs ++ tail))) = some (.string k, toCbor v ++ (toCborPairs xs ++ tail)) := cbor_roundtrip (.string k) h_rep_k n h_k (toCbor v ++ (toCborPairs xs ++ tail))
        have h2 : fromCbor n (toCbor v ++ (toCborPairs xs ++ tail)) = some (v, toCborPairs xs ++ tail) := cbor_roundtrip v h_rep.1 n h_v (toCborPairs xs ++ tail)
        have h3 : fromCborPairs n xs.length (toCborPairs xs ++ tail) = some (xs, tail) := cborPairs_roundtrip xs h_rep.2 n h_xs tail
        show fromCborPairs (n + 1) ((k, v) :: xs).length (toCborPairs ((k, v) :: xs) ++ tail) = some ((k, v) :: xs, tail)
        unfold toCborPairs
        dsimp [fromCborPairs]
        rw [List.append_assoc, List.append_assoc]
        rw [h1]
        dsimp [fromCborPairs]
        rw [h2]
        dsimp [fromCborPairs]
        rw [h3]
end
