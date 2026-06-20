import Lean4.DynamicValue

namespace Lean4

inductive BinOp where
  | add
  | sub
  | mul
  | eq
  | lt
  | and
  | or
  deriving Repr

inductive ConstValue where
  | int (val : Int)
  | string (val : String)
  | bool (val : Bool)
  | null
  deriving Repr

inductive Expr where
  | const (val : ConstValue)
  | param (name : String)
  | lambda (params : List String) (body : Expr)
  | binary (op : BinOp) (left : Expr) (right : Expr)
  | call (fn : String) (args : List Expr)
  | cond (test : Expr) (thenBranch : Expr) (elseBranch : Expr)
  deriving Repr

def binOpToString : BinOp → String
  | .add => "add"
  | .sub => "sub"
  | .mul => "mul"
  | .eq => "eq"
  | .lt => "lt"
  | .and => "and"
  | .or => "or"

def binOpOfString : String → Option BinOp
  | "add" => some .add
  | "sub" => some .sub
  | "mul" => some .mul
  | "eq" => some .eq
  | "lt" => some .lt
  | "and" => some .and
  | "or" => some .or
  | _ => none

theorem binOp_roundtrip (op : BinOp) : binOpOfString (binOpToString op) = some op := by
  cases op <;> rfl

def reifyConst : ConstValue → DynamicValue
  | .int i => .object [("t", .string "int"), ("v", .int i)]
  | .string s => .object [("t", .string "str"), ("v", .string s)]
  | .bool b => .object [("t", .string "bool"), ("v", .bool b)]
  | .null => .object [("t", .string "null")]

def applyConst : DynamicValue → Option ConstValue
  | .object [("t", .string "int"), ("v", .int i)] => some (.int i)
  | .object [("t", .string "str"), ("v", .string s)] => some (.string s)
  | .object [("t", .string "bool"), ("v", .bool b)] => some (.bool b)
  | .object [("t", .string "null")] => some .null
  | _ => none

theorem applyConst_reifyConst (c : ConstValue) : applyConst (reifyConst c) = some c := by
  cases c <;> rfl

def parseParams : List DynamicValue → Option (List String)
  | [] => some []
  | .string s :: rest => parseParams rest >>= fun ss => some (s :: ss)
  | _ => none

theorem parseParams_map_string (ps : List String) : parseParams (ps.map .string) = some ps := by
  induction ps with
  | nil => rfl
  | cons p ps ih =>
    simp [List.map, parseParams]
    rw [ih]
    rfl

mutual
  def apply : DynamicValue → Option Expr
    | .object [("kind", .string "const"), ("value", valDv)] =>
      applyConst valDv >>= fun c => some (.const c)
    | .object [("kind", .string "param"), ("name", .string name)] =>
      some (.param name)
    | .object [("kind", .string "lambda"), ("params", .array psDv), ("body", bodyDv)] =>
      parseParams psDv >>= fun ps =>
      apply bodyDv >>= fun body =>
      some (.lambda ps body)
    | .object [("kind", .string "binary"), ("op", .string opStr), ("left", lDv), ("right", rDv)] =>
      binOpOfString opStr >>= fun op =>
      apply lDv >>= fun l =>
      apply rDv >>= fun r =>
      some (.binary op l r)
    | .object [("kind", .string "call"), ("fn", .string fn), ("args", .array argsDv)] =>
      parseArgs argsDv >>= fun args =>
      some (.call fn args)
    | .object [("kind", .string "cond"), ("test", tDv), ("then", thDv), ("else", elDv)] =>
      apply tDv >>= fun t =>
      apply thDv >>= fun th =>
      apply elDv >>= fun el =>
      some (.cond t th el)
    | _ => none

  def parseArgs : List DynamicValue → Option (List Expr)
    | [] => some []
    | aDv :: rest =>
      apply aDv >>= fun a =>
      parseArgs rest >>= fun as =>
      some (a :: as)
end

def reify : Expr → DynamicValue
  | .const c => .object [("kind", .string "const"), ("value", reifyConst c)]
  | .param name => .object [("kind", .string "param"), ("name", .string name)]
  | .lambda ps body => .object [("kind", .string "lambda"), ("params", .array (ps.map .string)), ("body", reify body)]
  | .binary op l r => .object [("kind", .string "binary"), ("op", .string (binOpToString op)), ("left", reify l), ("right", reify r)]
  | .call fn args => .object [("kind", .string "call"), ("fn", .string fn), ("args", .array (args.map reify))]
  | .cond t th el => .object [("kind", .string "cond"), ("test", reify t), ("then", reify th), ("else", reify el)]

mutual
  def Expr.size : Expr → Nat
    | .const _ => 1
    | .param _ => 1
    | .lambda _ body => body.size + 1
    | .binary _ l r => l.size + r.size + 1
    | .call _ args => argsSize args + 1
    | .cond t th el => t.size + th.size + el.size + 1

  def argsSize : List Expr → Nat
    | [] => 0
    | a :: rest => a.size + argsSize rest
end

theorem parseArgs_map_reify (args : List Expr) (n : Nat) (ih : ∀ e : Expr, e.size < n → apply (reify e) = some e)
    (h_sz : argsSize args < n) : parseArgs (args.map reify) = some args := by
  induction args with
  | nil => rfl
  | cons a args ih_list =>
    simp [List.map, parseArgs]
    have h_a : a.size < n := by
      simp [argsSize] at h_sz
      omega
    rw [ih a h_a]
    simp
    have h_args : argsSize args < n := by
      simp [argsSize] at h_sz
      omega
    rw [ih_list h_args]
    rfl

theorem apply_reify_eq_self (e : Expr) : apply (reify e) = some e := by
  have h : ∀ n, ∀ e : Expr, e.size < n → apply (reify e) = some e := by
    intro n
    induction n with
    | zero =>
      intro e he
      omega
    | succ n ih =>
      intro e he
      cases e with
      | const c =>
        simp [reify, apply, applyConst_reifyConst]
      | param name =>
        simp [reify, apply]
      | lambda ps body =>
        simp [reify, apply, parseParams_map_string]
        have h_body : body.size < n := by
          simp [Expr.size] at he
          omega
        rw [ih body h_body]
        rfl
      | binary op l r =>
        simp [reify, apply, binOp_roundtrip]
        have h_l : l.size < n := by
          simp [Expr.size] at he
          omega
        have h_r : r.size < n := by
          simp [Expr.size] at he
          omega
        rw [ih l h_l]
        simp
        rw [ih r h_r]
        rfl
      | call fn args =>
        simp [reify, apply]
        have h_sz : argsSize args < n := by
          simp [Expr.size] at he
          omega
        rw [parseArgs_map_reify args n ih h_sz]
        rfl
      | cond t th el =>
        simp [reify, apply]
        have h_t : t.size < n := by
          simp [Expr.size] at he
          omega
        have h_th : th.size < n := by
          simp [Expr.size] at he
          omega
        have h_el : el.size < n := by
          simp [Expr.size] at he
          omega
        rw [ih t h_t]
        simp
        rw [ih th h_th]
        simp
        rw [ih el h_el]
        rfl
  exact h (e.size + 1) e (by omega)

end Lean4
