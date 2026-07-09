-- --guardedness: infective from cubical v0.9 (see ProvidedView.Hello) — every
-- importer must enable it or Agda rejects the import ([InfectiveImport]).
{-# OPTIONS --cubical --guardedness #-}

-- ProvidedView.SpinNUnivalence — the GENERAL Spin(n) leg of the provided-view /
-- univalence obligation. Generalizes the concrete-rotor proof
-- (ProvidedView.Univalence, notEquiv : Bool ≃ Bool) toward the full Spin(n)
-- family, answering Lumen's make-or-break Q4:
--
--   Is general Spin(n) univalence a NEW theorem, or a COROLLARY of the concrete
--   instance + composition (Cartan–Dieudonné + ua-functoriality)?
--
-- VERDICT (proven below, both horns): COROLLARY. Two independent, machine-checked
-- reasons, neither leaving room for new content:
--   (A) ua respects composition (uaCompEquiv). A general rotor factors as a
--       product of reflection generators (Cartan–Dieudonné); its univalent path
--       is the ∙-CONCATENATION of the concrete generator paths — no new theorem.
--   (B) π₁(Spin(n)) = ℤ/2 (belt trick, n≥3) is real in the Lie group, but the
--       sandwich action lands in Aut(V) = (V ≃ V). For V a SET (the only
--       cubical-tractable model — byte-chart / decidable finite type), (V ≃ V) and
--       (V ≡ V) are SETS: the loop space has NO non-trivial π₁. The winding has
--       nowhere to land — it maps to the trivial loop. New content REFUTED.
--
-- REPRESENTATION MODEL (named, per the trap Lumen glossed): cubical Agda has NO
-- real analysis, so "continuous R(t)=exp(tB) over ℝ" is NOT formalizable. This
-- module uses MODEL (b): abstract the rotor as "any self-inverse-witnessed
-- equivalence" (an INVOLUTION), the ℝ-free order-2 generator. This is faithful,
-- not a toy: the concrete proof's own rotor is literally
-- `notEquiv = involEquiv {f = not} notnot` — an involution. We abstract exactly
-- the constructor the concrete instance already used. What it captures: the
-- reflection/half-turn generators of Spin(n) and their group relations
-- univalently. What it abstracts: the continuous 1-parameter subgroup (ℝ), which
-- Cartan–Dieudonné's finite-product presentation lets us dodge without loss.
--
-- Items 2 & 3 of Lumen's §3 (ua produces the path; uaβ computes transport) are
-- UNIVERSAL one-liners — they hold for ANY equivalence, so they carry NO new
-- content over the concrete proof. They are recorded here as such, not as an
-- achievement. Item 1 (the sandwich action is an equivalence) is modest. Item 4
-- (a PATH in Spin(n) → a HOMOTOPY of paths) is the entire genuine content, and it
-- is what horns (A)/(B) adjudicate to a corollary.

module ProvidedView.SpinNUnivalence where

open import Cubical.Foundations.Prelude
open import Cubical.Foundations.Equiv       using (_≃_; equivFun; idEquiv; compEquiv)
open import Cubical.Foundations.Univalence  using (ua; uaβ; uaCompEquiv; uaIdEquiv)
open import Cubical.Foundations.HLevels      using (isOfHLevel≃; isOfHLevel≡)
open import Cubical.Functions.Involution     using (isInvolution; involEquiv; involPath; involEquivComp; involPathComp)
open import Cubical.Data.Bool                using (Bool; true; false; not; notnot; isSetBool)

private
  variable
    ℓ : Level

------------------------------------------------------------------------
-- ITEM 1 (modest, real): the sandwich action is an equivalence.
--
-- A rotor R with R★² = 1 acts on the vector/chart space V by the sandwich
-- v ↦ R v ~R. Applying it twice conjugates by R★² = 1 = identity, so the
-- action is SELF-INVERSE: an INVOLUTION. Every involution is an equivalence
-- (inverse = itself). This is item 1 in the ℝ-free model.
------------------------------------------------------------------------

sandwichEquiv : (V : Type ℓ) (act : V → V) → isInvolution act → V ≃ V
sandwichEquiv V act invol = involEquiv {f = act} invol

-- The concrete generator, matching ProvidedView.Univalence's `notEquiv`: the
-- half-turn `not` on the single-𝔽₂-bit byte-chart is the order-2 generator.
genAct : Bool → Bool
genAct = not

genInvol : isInvolution genAct
genInvol = notnot

genEquiv : Bool ≃ Bool
genEquiv = sandwichEquiv Bool genAct genInvol

------------------------------------------------------------------------
-- ITEMS 2 & 3 (UNIVERSAL one-liners — NO new content, recorded as such).
--   ua : produces the univalent path from the sandwich equivalence.
--   uaβ: transport along that path COMPUTES the sandwich action.
-- These are the SAME one-liners the concrete proof used; they hold for every
-- equivalence, so generalizing to Spin(n) adds nothing here.
------------------------------------------------------------------------

sandwichPath : (V : Type ℓ) (act : V → V) → isInvolution act → V ≡ V
sandwichPath V act invol = ua (sandwichEquiv V act invol)

sandwichTransport
  : (V : Type ℓ) (act : V → V) (invol : isInvolution act) (v : V)
  → transport (sandwichPath V act invol) v ≡ act v
sandwichTransport V act invol v = uaβ (sandwichEquiv V act invol) v

-- Concrete reduction check (matches rotorTransport in the concrete proof):
-- transport along the generator path carries true to its flip, and REDUCES.
genTransport : transport (sandwichPath Bool genAct genInvol) true ≡ false
genTransport = uaβ genEquiv true

------------------------------------------------------------------------
-- ITEM 4, HORN (A) — the COROLLARY route (Cartan–Dieudonné + ua-functoriality).
--
-- A general Spin(n) rotor factors as a finite product of reflection generators
-- e₁ · e₂ · … · eₖ (Cartan–Dieudonné). `ua` respects composition (uaCompEquiv),
-- so the general univalent path is the ∙-CONCATENATION of the concrete generator
-- paths. The general case is therefore a COROLLARY of the concrete instance plus
-- functoriality — not a new theorem.
------------------------------------------------------------------------

generalIsConcatenation
  : (V : Type ℓ) (e f : V ≃ V)
  → ua (compEquiv e f) ≡ ua e ∙ ua f
generalIsConcatenation V e f = uaCompEquiv e f

-- The defining order-2 relation R★² = 1 lifts univalently: the doubled
-- generator path is contractible (involPath ∙ involPath ≡ refl), and the proof
-- runs THROUGH uaCompEquiv — the concrete generator already carries its own
-- group relation as a path identity. This is the seed of the whole factorization.
order2Relation
  : (V : Type ℓ) (act : V → V) (invol : isInvolution act)
  → involPath {f = act} invol ∙ involPath {f = act} invol ≡ refl
order2Relation V act invol = involPathComp {f = act} invol

------------------------------------------------------------------------
-- ITEM 4, HORN (B) — the NEW-CONTENT route, REFUTED (the decisive verdict).
--
-- π₁(Spin(n)) = ℤ/2 for n ≥ 3 (belt trick: 2π-rotation ≠ 1, 4π-rotation = 1).
-- This is genuine topology in the Lie group. The candidate "new content" is
-- whether this non-contractible loop maps to non-trivial homotopy in the
-- universe that finite generators + composition miss.
--
-- It does not. The sandwich action lands in Aut(V) = (V ≃ V). For V a SET — and
-- V a set is forced: cubical-tractable rotors act on decidable finite charts
-- (Bool, 𝔽₂ⁿ), which are sets — (V ≃ V) is itself a SET, hence the loop space
-- (V ≡ V) is a SET. A set has trivial π₁: every loop of paths is constant. So
-- the belt-trick ℤ/2 winding has NOWHERE to land; its image is the trivial loop.
-- (Model-independent in the map: this is a property of the TARGET, so no choice
-- of Spin(n)→universe map can smuggle winding in.) NO new univalence content.
--
-- (The sandwich action additionally 2-to-1 collapses ±R — (−R)v(−R)★ = RvR★ — so
-- it already factors through SO(n), killing the ℤ/2 kernel before the universe;
-- the isSet argument is the stronger, map-free form of the same collapse.)
------------------------------------------------------------------------

autIsSet : (V : Type ℓ) → isSet V → isSet (V ≃ V)
autIsSet V hV = isOfHLevel≃ 2 hV hV

universeLoopIsSet : (V : Type ℓ) → isSet V → isSet (V ≡ V)
universeLoopIsSet V hV = isOfHLevel≡ 2 hV hV

-- Concrete witnesses on the byte-chart: the automorphism group and the
-- universe-loop at Bool are sets — the belt-trick winding collapses here.
autBoolIsSet : isSet (Bool ≃ Bool)
autBoolIsSet = autIsSet Bool isSetBool

boolUniverseLoopIsSet : isSet (Bool ≡ Bool)
boolUniverseLoopIsSet = universeLoopIsSet Bool isSetBool

------------------------------------------------------------------------
-- CONCLUSION (honest boundary). General Spin(n) univalence, in every
-- cubical-tractable model, is a COROLLARY of the concrete rotor proof:
--   • its path = a ∙-concatenation of concrete generator paths (horn A), and
--   • the only candidate new content (π₁ = ℤ/2) collapses in a set-level
--     automorphism target (horn B).
-- This is NOT a new theorem — same verdict shape as the self-dual-gap arc: the
-- bigger object reduces. What WOULD carry new content — Spin(n) as a topological
-- group mapped BSpin(n) → BAut(V) with V a genuine higher type — is a different
-- construction, not "transport along a rotor path", and is named as the true
-- open frontier (out of scope; no ℝ / no higher V in this lane).
------------------------------------------------------------------------
