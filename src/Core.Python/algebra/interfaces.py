"""
src/Core.Python/algebra/interfaces.py — the full algebraic interface stack.

GCF principle: richest shared structure. Python uses Protocol (structural typing)
for compile-time checking and ABC for runtime enforcement. TypeVar for generics.

Same interfaces as TS/C#/Rust/Go — one algebra, seven syntaxes.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from typing import TypeVar, Generic, Protocol

T = TypeVar("T")
A = TypeVar("A", contravariant=True)
B = TypeVar("B", covariant=True)


# ─── ISemiring ───────────────────────────────────────────────────────────


class Semiring(ABC, Generic[T]):
    """Semiring (rig): Zero/One/Add/Mul — the FREE tier for DBSP weights.

    Deliberately no additive inverse: lawful semirings (tropical min-plus)
    provably cannot always supply one (idempotent => zerosumfree; Vandiver
    1934, Golan 1999). Retraction-capable algebras implement Ring
    (081KWG9JQ9H)."""

    @property
    @abstractmethod
    def zero(self) -> T: ...

    @property
    @abstractmethod
    def one(self) -> T: ...

    @abstractmethod
    def add(self, a: T, b: T) -> T: ...

    @abstractmethod
    def mul(self, a: T, b: T) -> T: ...


# ─── IRing ───────────────────────────────────────────────────────────────


class Ring(Semiring[T]):
    """Ring: the earned quotient over Semiring — adds the additive inverse
    (add(a, negate(a)) == zero), which retraction requires (081KWG9JQ9H)."""

    @abstractmethod
    def negate(self, a: T) -> T: ...


# ─── IStarRing ───────────────────────────────────────────────────────────


class StarRing(Ring[T]):
    """Star-ring: Ring + Conj (involution star, not Kleene star).
    Cayley-Dickson tower floor."""

    @abstractmethod
    def conj(self, a: T) -> T: ...


# ─── IGroup ──────────────────────────────────────────────────────────────


class Group(ABC, Generic[T]):
    """Group: identity + combine + inverse. Minimal structure for undo/retract."""

    @property
    @abstractmethod
    def identity(self) -> T: ...

    @abstractmethod
    def combine(self, a: T, b: T) -> T: ...

    @abstractmethod
    def inverse(self, a: T) -> T: ...


# ─── IMonoid ─────────────────────────────────────────────────────────────


class Monoid(ABC, Generic[T]):
    """Monoid: identity + combine. No inverse. The CRDT merge floor."""

    @property
    @abstractmethod
    def identity(self) -> T: ...

    @abstractmethod
    def combine(self, a: T, b: T) -> T: ...


# ─── ILattice ────────────────────────────────────────────────────────────


class JoinSemilattice(ABC, Generic[T]):
    """Join-semilattice: idempotent, commutative, associative. Monotone growth."""

    @abstractmethod
    def join(self, a: T, b: T) -> T: ...


class Lattice(JoinSemilattice[T]):
    """Full lattice: join (LUB) + meet (GLB)."""

    @abstractmethod
    def meet(self, a: T, b: T) -> T: ...


# ─── ICodec ──────────────────────────────────────────────────────────────


class Codec(ABC, Generic[T]):
    """Codec: encode/decode pair. The serialization contract."""

    # Note: Python can't express co/contravariance on class methods directly,
    # but the Protocol version below can.

    @abstractmethod
    def encode(self, a: T) -> bytes: ...

    @abstractmethod
    def decode(self, b: bytes) -> T: ...


# ─── IPort ───────────────────────────────────────────────────────────────


class ReadPort(Protocol[T]):
    """Read-only port (covariant — can widen output)."""

    def read(self) -> T: ...


class WritePort(Protocol[T]):
    """Write-only port (contravariant — can narrow input)."""

    def write(self, value: T) -> None: ...


class Port(ABC, Generic[T]):
    """Hexagonal port: read + write. Invariant on T."""

    @abstractmethod
    def read(self) -> T: ...

    @abstractmethod
    def write(self, value: T) -> None: ...


# ─── Instances ───────────────────────────────────────────────────────────


class RealSemiring(Ring[float]):
    """Float semiring (standard arithmetic)."""

    @property
    def zero(self) -> float:
        return 0.0

    @property
    def one(self) -> float:
        return 1.0

    def add(self, a: float, b: float) -> float:
        return a + b

    def mul(self, a: float, b: float) -> float:
        return a * b

    def negate(self, a: float) -> float:
        return -a


class RealStarRing(StarRing[float]):
    """Float star-ring (conj = identity on reals)."""

    @property
    def zero(self) -> float:
        return 0.0

    @property
    def one(self) -> float:
        return 1.0

    def add(self, a: float, b: float) -> float:
        return a + b

    def mul(self, a: float, b: float) -> float:
        return a * b

    def negate(self, a: float) -> float:
        return -a

    def conj(self, a: float) -> float:
        return a  # identity on reals


class AdditiveGroup(Group[float]):
    """Additive group over floats."""

    @property
    def identity(self) -> float:
        return 0.0

    def combine(self, a: float, b: float) -> float:
        return a + b

    def inverse(self, a: float) -> float:
        return -a


class MaxSemilattice(JoinSemilattice[float]):
    """Max join-semilattice."""

    def join(self, a: float, b: float) -> float:
        return max(a, b)


# Singletons
real_semiring = RealSemiring()
real_star_ring = RealStarRing()
additive_group = AdditiveGroup()
max_semilattice = MaxSemilattice()
