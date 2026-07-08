-- --guardedness: infective from cubical v0.9 (see ProvidedView.Hello) — every
-- importer must enable it or Agda rejects the import ([InfectiveImport]).
{-# OPTIONS --cubical --guardedness #-}

-- ProvidedView.Univalence — the real proof leg for the provided-view /
-- univalence obligation (docs/letters/to-soraya-provided-view-univalence-
-- obligation.md, routed (b)-scoped by docs/letters/from-soraya-univalence-
-- lane-routing.md). Discharges the three items of the obligation on the
-- cubical lane wired by workitem 081KX1VE:
--
--   (1) Univalence ⇒ equality  — an equivalence of provided views PRODUCES a
--       path (ua), not merely asserts equality.
--   (2) Deformation is the path — a rotor (a Clifford/Spin deformation), viewed
--       as an equivalence, IS the univalent path: ua and pathToEquiv are
--       mutually inverse, so "isomorphic-therefore-equal" and "deformable-into-
--       each-other" coincide (Joyal–Street isotopy = HoTT path). Descoped to a
--       CONCRETE rotor instance on the 𝔽₂ byte-bit chart (Bool); general
--       Spin(n) is a named residual (no Clifford/Spin in the cubical library).
--   (3) Transport coherence — transport along that path carries proofs across
--       AND computes (uaβ). This is the payoff: prove once, deform, get it free
--       on every isomorphic rendering — the univalence dividend.
--
-- WHY CUBICAL, NOT LEAN (the load-bearing boundary, from Soraya's routing):
-- Lean-4's Eq is Prop-valued with definitional proof irrelevance ⇒ UIP, which
-- makes the transport-coherence rule `transport (ua f) = f` of items (2)/(3)
-- INCONSISTENT to even axiomatize (ua not vs refl are proof-irrelevantly
-- equal ⇒ cast(ua not)=id ⇒ not=id ⇒ False). So these statements are non-
-- vacuous ONLY in a theory where univalence computes. Here they typecheck and
-- REDUCE (rotorTransport is refl-provable); in Lean they would be false-green.
--
-- Scope honesty (from the obligation's own boundary): this proves exactly the
-- three items — NOT "the substrate is a homotopy type" or "F# is HoTT". F#
-- carries the runtime (the deforming provided views); this is the CONTRACT the
-- F# fork's deformed-HKT / type-provider design targets, discharged in the
-- proof assistant where univalence lives.

module ProvidedView.Univalence where

open import Cubical.Foundations.Prelude
open import Cubical.Foundations.Equiv       using (_≃_; equivFun; idEquiv)
open import Cubical.Foundations.Univalence  using (ua; uaβ; pathToEquiv; pathToEquiv-ua; ua-pathToEquiv)
open import Cubical.Data.Bool.Base          using (Bool; true; false; not)
open import Cubical.Data.Bool.Properties    using (notEquiv)

private
  variable
    ℓ : Level
    A B : Type ℓ

------------------------------------------------------------------------
-- (1) Univalence ⇒ equality: the equivalence PRODUCES the path.
--     `A ≃ B → A ≡ B` is `ua` itself — the univalence map, computing.
------------------------------------------------------------------------

providedViewPath : A ≃ B → A ≡ B
providedViewPath = ua

------------------------------------------------------------------------
-- (3) Transport coherence, and it COMPUTES: transport along the univalent
--     path of an equivalence agrees with applying the equivalence.
--     This is uaβ — the computation rule Lean's UIP makes inconsistent.
------------------------------------------------------------------------

transportCoherence : (e : A ≃ B) (a : A) → transport (ua e) a ≡ equivFun e a
transportCoherence = uaβ

------------------------------------------------------------------------
-- (2) Deformation IS the path — the concrete rotor instance.
--
-- `rotor` is `not : Bool ≃ Bool`, the order-2 element of the Spin/rotor
-- family (a half-turn: R(0)=id, R(1)=R★, R★²=1) acting on the single 𝔽₂ bit
-- (the minimal byte-chart). It is a genuine non-identity deformation.
------------------------------------------------------------------------

rotor : Bool ≃ Bool
rotor = notEquiv

-- (2a) The rotor's induced action on a view element transports the bit to its
-- flip — and REDUCES to it (uaβ gives `≡ not true`, which is `false` def-eq).
-- This is item (3) made concrete on the rotor: the deformation carries data.
rotorTransport : transport (ua rotor) true ≡ false
rotorTransport = uaβ rotor true

-- (2b) The univalent path RECOVERS exactly the rotor: pathToEquiv (ua f) ≡ f.
-- "The Clifford deformation and the univalent path are the same path" — the
-- equivalence-to-path map and its inverse compose to the identity on the rotor.
rotorIsThePath : pathToEquiv (ua rotor) ≡ rotor
rotorIsThePath = pathToEquiv-ua rotor

-- (2c) …and conversely, every path in the universe comes from its equivalence
-- (ua ∘ pathToEquiv ≡ id): the two constructions are mutually inverse, so
-- "isomorphic-therefore-equal" (ua) and "the deformation path" (pathToEquiv)
-- are the SAME construction — the heart of item (2), stated for any path.
pathIsADeformation : (p : A ≡ B) → ua (pathToEquiv p) ≡ p
pathIsADeformation = ua-pathToEquiv

------------------------------------------------------------------------
-- Named residual (NOT proven here — honest boundary):
--   General Spin(n): a one-parameter rotor family R : I → Spin(n) with the
--   full Clifford action, and the identification of its transport path with
--   the univalent path for arbitrary n. The cubical library has no
--   Clifford/Spin algebra, so this stays an open residual (routed to Lumen's
--   Clifford/Spin interpretation-functor obligation, later). What IS proven
--   above is the univalence heart on a concrete rotor; the general family is
--   the same shape scaled up, not a different theorem.
------------------------------------------------------------------------
