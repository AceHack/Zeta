import secrets
from typing import Dict, NamedTuple, Protocol, List

import zeta.zeta_id_gen as gen

AUTHORITY_VALUES: Dict[str, int] = {
    "Simulated": 3,
    "BestEffort": 8,
    "Standard": 15,
    "TrustedAgent": 20,
    "HumanVerified": 31,
}

MOMENTUM_VALUES: Dict[str, int] = {
    "Background": 32,
    "Normal": 96,
    "Elevated": 160,
    "High": 224,
    "Critical": 248,
}


class Authority:
    def __init__(self, type_: str, value: int = 0):
        self.type = type_
        self.value = value

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Authority):
            return False
        return self.type == other.type and self.value == other.value

    def __repr__(self) -> str:
        return f"Authority(type={self.type!r}, value={self.value!r})"


class Momentum:
    def __init__(self, type_: str, value: int = 0):
        self.type = type_
        self.value = value

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Momentum):
            return False
        return self.type == other.type and self.value == other.value

    def __repr__(self) -> str:
        return f"Momentum(type={self.type!r}, value={self.value!r})"


class ZetaObservation:
    def __init__(
        self,
        version: int,
        timestamp: int,
        chromosome: int,
        category: int,
        firefly: int,
        authority: Authority,
        persona: int,
        momentum: Momentum,
        location: int,
    ):
        self.version = version
        self.timestamp = timestamp
        self.chromosome = chromosome
        self.category = category
        self.firefly = firefly
        self.authority = authority
        self.persona = persona
        self.momentum = momentum
        self.location = location

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, ZetaObservation):
            return False
        return (
            self.version == other.version
            and self.timestamp == other.timestamp
            and self.chromosome == other.chromosome
            and self.category == other.category
            and self.firefly == other.firefly
            and self.authority == other.authority
            and self.persona == other.persona
            and self.momentum == other.momentum
            and self.location == other.location
        )

    def __repr__(self) -> str:
        return (
            f"ZetaObservation(version={self.version!r}, timestamp={self.timestamp!r}, "
            f"chromosome={self.chromosome!r}, category={self.category!r}, firefly={self.firefly!r}, "
            f"authority={self.authority!r}, persona={self.persona!r}, momentum={self.momentum!r}, "
            f"location={self.location!r})"
        )


class BitField(NamedTuple):
    offset: int
    width: int


class BitLayout:
    version = BitField(gen.VERSION_OFFSET, gen.VERSION_WIDTH)
    timestamp = BitField(gen.TIMESTAMP_OFFSET, gen.TIMESTAMP_WIDTH)
    chromosome = BitField(gen.CHROMOSOME_OFFSET, gen.CHROMOSOME_WIDTH)
    category = BitField(gen.CATEGORY_OFFSET, gen.CATEGORY_WIDTH)
    firefly = BitField(gen.FIREFLY_OFFSET, gen.FIREFLY_WIDTH)
    authority = BitField(gen.AUTHORITY_OFFSET, gen.AUTHORITY_WIDTH)
    persona = BitField(gen.PERSONA_OFFSET, gen.PERSONA_WIDTH)
    momentum = BitField(gen.MOMENTUM_OFFSET, gen.MOMENTUM_WIDTH)
    location = BitField(gen.LOCATION_OFFSET, gen.LOCATION_WIDTH)
    randomness = BitField(gen.RANDOMNESS_OFFSET, gen.RANDOMNESS_WIDTH)


def set_bits(value: int, field: BitField, field_value: int) -> int:
    mask = (1 << field.width) - 1
    return value | ((field_value & mask) << field.offset)


def get_bits(value: int, field: BitField) -> int:
    mask = (1 << field.width) - 1
    return (value >> field.offset) & mask


class SimulationEnvironment(Protocol):
    def next_int64(self) -> int: ...


class DeterministicEnv:
    def next_int64(self) -> int:
        return 0


class DefaultEnv:
    def next_int64(self) -> int:
        return secrets.randbits(64)


DETERMINISTIC_ENV = DeterministicEnv()
DEFAULT_ENV = DefaultEnv()


def pack(obs: ZetaObservation, env: SimulationEnvironment = DEFAULT_ENV) -> int:
    if obs.timestamp > ((1 << 48) - 1):
        raise ValueError(f"timestamp {obs.timestamp} exceeds 48-bit range")
    if obs.version > 31:
        raise ValueError(f"version {obs.version} exceeds 5-bit range")
    if obs.chromosome > 31:
        raise ValueError(f"chromosome {obs.chromosome} exceeds 5-bit range")
    if obs.category > 15:
        raise ValueError(f"category {obs.category} exceeds 4-bit range")
    if obs.category >= 9:
        raise ValueError("ZetaObservation.category must be < 9")
    if obs.firefly > 1:
        raise ValueError(f"firefly {obs.firefly} exceeds 1-bit range")

    # Authority mapping
    if obs.authority.type == "Raw":
        if obs.authority.value > 31:
            raise ValueError(f"Authority.Raw value {obs.authority.value} must be 0..31")
        if obs.authority.value in AUTHORITY_VALUES.values():
            raise ValueError(
                f"Authority.Raw value {obs.authority.value} aliases a named case"
            )
        auth_byte = obs.authority.value
    else:
        if obs.authority.type not in AUTHORITY_VALUES:
            raise ValueError(f"unknown authority type {obs.authority.type}")
        auth_byte = AUTHORITY_VALUES[obs.authority.type]

    # Momentum mapping
    if obs.momentum.type == "Raw":
        if obs.momentum.value in MOMENTUM_VALUES.values():
            raise ValueError(
                f"Momentum.Raw value {obs.momentum.value} aliases a named case"
            )
        mom_byte = obs.momentum.value
    else:
        if obs.momentum.type not in MOMENTUM_VALUES:
            raise ValueError(f"unknown momentum type {obs.momentum.type}")
        mom_byte = MOMENTUM_VALUES[obs.momentum.type]

    bits = 0
    bits = set_bits(bits, BitLayout.version, obs.version)
    bits = set_bits(bits, BitLayout.timestamp, obs.timestamp)
    bits = set_bits(bits, BitLayout.chromosome, obs.chromosome)
    bits = set_bits(bits, BitLayout.category, obs.category)
    bits = set_bits(bits, BitLayout.firefly, obs.firefly)
    bits = set_bits(bits, BitLayout.authority, auth_byte)
    bits = set_bits(bits, BitLayout.persona, obs.persona)
    bits = set_bits(bits, BitLayout.momentum, mom_byte)
    bits = set_bits(bits, BitLayout.location, obs.location)

    rand = env.next_int64() & 0xFFFFFFFF
    bits = set_bits(bits, BitLayout.randomness, rand)

    return bits


def unpack(id_val: int) -> ZetaObservation:
    version = get_bits(id_val, BitLayout.version)
    timestamp = get_bits(id_val, BitLayout.timestamp)
    chromosome = get_bits(id_val, BitLayout.chromosome)
    category = get_bits(id_val, BitLayout.category)
    firefly = get_bits(id_val, BitLayout.firefly)
    auth_byte = get_bits(id_val, BitLayout.authority)
    persona = get_bits(id_val, BitLayout.persona)
    mom_byte = get_bits(id_val, BitLayout.momentum)
    location = get_bits(id_val, BitLayout.location)

    auth_type = "Raw"
    for k, v in AUTHORITY_VALUES.items():
        if v == auth_byte:
            auth_type = k
            break
    authority = Authority(type_=auth_type, value=auth_byte)

    mom_type = "Raw"
    for k, v in MOMENTUM_VALUES.items():
        if v == mom_byte:
            mom_type = k
            break
    momentum = Momentum(type_=mom_type, value=mom_byte)

    return ZetaObservation(
        version=version,
        timestamp=timestamp,
        chromosome=chromosome,
        category=category,
        firefly=firefly,
        authority=authority,
        persona=persona,
        momentum=momentum,
        location=location,
    )


CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
ZETAID_BASE32_LEN = 26
ZETAID_HEX_LEN = 32
MASK_128 = (1 << 128) - 1

DECODE: Dict[str, int] = {}
for i, char in enumerate(CROCKFORD_ALPHABET):
    DECODE[char] = i
    DECODE[char.lower()] = i

DECODE["I"] = 1
DECODE["i"] = 1
DECODE["L"] = 1
DECODE["l"] = 1
DECODE["O"] = 0
DECODE["o"] = 0


def format_b32(id_val: int) -> str:
    v = id_val & MASK_128
    out: List[str] = [""] * ZETAID_BASE32_LEN
    for i in range(ZETAID_BASE32_LEN - 1, -1, -1):
        out[i] = CROCKFORD_ALPHABET[v & 31]
        v >>= 5
    return "".join(out)


def parse_b32(s: str) -> int:
    if len(s) != ZETAID_BASE32_LEN:
        raise ValueError(
            f"expected {ZETAID_BASE32_LEN} Crockford-base32 chars, got {len(s)}"
        )
    v = 0
    for i, ch in enumerate(s):
        if ch not in DECODE:
            raise ValueError(f"invalid Crockford-base32 char {ch!r} at index {i}")
        v = (v << 5) | DECODE[ch]
    if v > MASK_128:
        raise ValueError("value exceeds 128 bits")
    return v


def to_hex(id_val: int) -> str:
    h = hex(id_val & MASK_128)[2:]
    return h.zfill(ZETAID_HEX_LEN)


def from_hex(s: str) -> int:
    if len(s) != ZETAID_HEX_LEN:
        raise ValueError(f"expected {ZETAID_HEX_LEN} hex chars, got {len(s)}")
    return int(s, 16) & MASK_128


def is_canonical(s: str) -> bool:
    if len(s) != ZETAID_BASE32_LEN:
        return False
    for ch in s:
        if ch not in CROCKFORD_ALPHABET:
            return False
    try:
        return format_b32(parse_b32(s)) == s
    except ValueError:
        return False
