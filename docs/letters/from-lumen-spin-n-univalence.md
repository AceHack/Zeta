# From Lumen — The Map: General Spin(n) Univalence

*To Otto (the shadow) / Aaron, 2026-07-08.*
*Routing: Lumen (physics map) → Soraya (formal prover leg). Discharging the named residual from `Univalence.agda` and the research note.*

We have a proven, machine-checked result in `Univalence.agda`: for a concrete rotor (the order-2 half-turn on $\mathbb{F}_2$), the Clifford deformation *is* the univalent path. `ua` and `pathToEquiv` are mutually inverse on it.

This maps the named residual: generalizing that single concrete proof into the full continuous $Spin(n)$ family. This is the **Clifford/Spin interpretation-functor** mapped into the HoTT equality theory.

## 1. The Physics Map: $Spin(n)$ as a Univalent Path Family

In Clifford geometric algebra $Cl(n,0)$, a rotor $R$ is an element of the even subalgebra satisfying $R \tilde{R} = 1$. The group of all such rotors is $Spin(n)$, the double cover of $SO(n)$.

A continuous rotor deformation is a one-parameter subgroup:
$$R(t) = \exp(t B)$$
where $B$ is a bivector and $t \in [0,1]$. 

This path in $Spin(n)$ induces a continuous deformation of the vector space (or any multivector) via the sandwich product:
$$v \mapsto R(t) v \tilde{R}(t)$$

**The HoTT / Univalence Translation:**
In Homotopy Type Theory, a path $p : A \equiv B$ between types is equivalent to an equivalence $A \simeq B$ via univalence. 
If we view the vector space $V$ as our type $A$, then for any fixed $t$, the sandwich product $v \mapsto R(t) v \tilde{R}(t)$ is an invertible linear map, hence an equivalence $e_t : V \simeq V$.

By univalence, this equivalence induces a path in the universe:
$$p_t = ua(e_t) : V \equiv V$$

The physics map is the assertion that **the continuous rotor path $R(t)$ in $Spin(n)$ IS EXACTLY the univalent homotopy path $p_t$ in the universe.** The geometric deformation of the space and the type-theoretic equality path are the same object, viewed through different interpretation functors.

## 2. The Generalization from the Concrete Proof

In `Univalence.agda`, we proved:
1. `rotorTransport`: transporting along $ua(rotor)$ computes the exact action of the rotor.
2. `rotorIsThePath`: `pathToEquiv (ua rotor) ≡ rotor`.
3. `pathIsADeformation`: `ua (pathToEquiv p) ≡ p`.

These were proven for the discrete boolean flip (`notEquiv`). The generalization requires proving this for the continuous $Spin(n)$ action on a vector space $V$.

Because $Spin(n)$ acts by equivalences, the map $R \mapsto (v \mapsto R v \tilde{R})$ is a homomorphism from $Spin(n)$ into $Aut(V)$. Univalence upgrades $Aut(V)$ to $\Omega(Universe, V)$ (the loop space of the universe at $V$).

Therefore, the sandwich action defines a map:
$$\Phi : Spin(n) \to (V \equiv V)$$

The claim is that $\Phi$ is exactly the univalence map $ua$ composed with the sandwich action, and that continuous paths in $Spin(n)$ map functorially to homotopies (paths of paths) in the universe.

## 3. Proof Obligation (For Soraya)

**Status:** `conjecture-pending-proof`

**The Obligation:**
Formalize the general $Spin(n)$ univalence family. Since the standard cubical library lacks Clifford algebras, you must define the minimal structure required to state the theorem.

1. **Define the Rotor Action as an Equivalence:** Define a type representing a vector space $V$, a type for $Spin(n)$ rotors, and the sandwich action $R \cdot v = R v \tilde{R}$. Prove this action is an equivalence $V \simeq V$ for any rotor $R$.
2. **The Univalent Path:** Use `ua` to construct the path $p_R : V \equiv V$ from the rotor equivalence.
3. **Transport Coherence (The Generalization):** Prove that transport along $p_R$ computes the exact sandwich action: `transport p_R v ≡ R v \tilde{R}`.
4. **Functoriality of the Path (Optional but desired):** If $R(t)$ is a path between $R_0$ and $R_1$ in $Spin(n)$, prove that `ua` maps this to a homotopy between the paths $p_{R_0}$ and $p_{R_1}$ in the universe.

**Suggested Tool Class:**
**Cubical Agda**. This is a direct generalization of `Univalence.agda`. Lean 4 is still excluded for the exact same reason as the concrete case: UIP makes transport coherence inconsistent to even axiomatize. You must use the cubical lane wired by workitem `081KX1VE`.

---
*Handoff complete. Awaiting Soraya's execution on the general Spin(n) cubical proof.*
