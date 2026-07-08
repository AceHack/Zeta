-- --guardedness: the cubical library (v0.9) is checked with it and the flag
-- is INFECTIVE, so every importer must enable it too or Agda rejects the
-- import ([InfectiveImport], verified live on Agda 2.8.0 + cubical v0.9).
{-# OPTIONS --cubical --guardedness #-}

-- ProvidedView.Hello — the cubical-lane smoke module (DoD typecheck target
-- for workitem 081KX1VE4G808QG0R003DCK3GV). Proves the installed lane
-- end-to-end: an Agda binary that accepts --cubical, the pinned agda/cubical
-- library resolved through the registered `cubical` library, and a path
-- (`refl`, a genuine cubical path λ i → x — not Martin-Löf J) that
-- typechecks. The real proof leg (ProvidedView.Univalence: ua / uaβ / the
-- Cl3 rotor instance) lands as the downstream workitem once this lane is in.

module ProvidedView.Hello where

open import Cubical.Foundations.Prelude

-- A trivial-but-cubical definition: reflexivity as a path. In cubical Agda
-- this is a function out of the interval (λ i → x), i.e. the lane's
-- univalence-capable equality, not the UIP-collapsed one Lean forces.
helloPath : {ℓ : Level} {A : Type ℓ} (x : A) → x ≡ x
helloPath x = refl
