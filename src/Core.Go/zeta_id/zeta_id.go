package zeta_id

import (
	"errors"
	"fmt"
	"math/big"
)

type AuthorityType string

const (
	AuthorityHumanVerified AuthorityType = "HumanVerified"
	AuthorityTrustedAgent  AuthorityType = "TrustedAgent"
	AuthorityStandard      AuthorityType = "Standard"
	AuthorityBestEffort    AuthorityType = "BestEffort"
	AuthoritySimulated     AuthorityType = "Simulated"
	AuthorityRaw           AuthorityType = "Raw"
)

type Authority struct {
	Type  AuthorityType
	Value uint8
}

type MomentumType string

const (
	MomentumBackground MomentumType = "Background"
	MomentumNormal     MomentumType = "Normal"
	MomentumElevated   MomentumType = "Elevated"
	MomentumHigh       MomentumType = "High"
	MomentumCritical   MomentumType = "Critical"
	MomentumRaw        MomentumType = "Raw"
)

type Momentum struct {
	Type  MomentumType
	Value uint8
}

type ZetaObservation struct {
	Version    uint8
	Timestamp  uint64
	Chromosome uint8
	Category   uint8
	Firefly    uint8
	Authority  Authority
	Persona    uint8
	Momentum   Momentum
	Location   uint8
}

var AuthorityValues = map[AuthorityType]uint8{
	AuthoritySimulated:     3,
	AuthorityBestEffort:    8,
	AuthorityStandard:      15,
	AuthorityTrustedAgent:  20,
	AuthorityHumanVerified: 31,
}

var MomentumValues = map[MomentumType]uint8{
	MomentumBackground: 32,
	MomentumNormal:     96,
	MomentumElevated:   160,
	MomentumHigh:       224,
	MomentumCritical:   248,
}

func isNamedAuthorityByte(val uint8) bool {
	for _, v := range AuthorityValues {
		if v == val {
			return true
		}
	}
	return false
}

func isNamedMomentumByte(val uint8) bool {
	for _, v := range MomentumValues {
		if v == val {
			return true
		}
	}
	return false
}

func AuthorityToByte(a Authority) (uint8, error) {
	if a.Type == AuthorityRaw {
		if a.Value > 31 {
			return 0, fmt.Errorf("Authority.Raw value %d must be 0..31", a.Value)
		}
		if isNamedAuthorityByte(a.Value) {
			return 0, fmt.Errorf("Authority.Raw value %d aliases a named case", a.Value)
		}
		return a.Value, nil
	}
	v, ok := AuthorityValues[a.Type]
	if !ok {
		return 0, fmt.Errorf("unknown authority type %s", a.Type)
	}
	return v, nil
}

func AuthorityFromByte(v uint8) Authority {
	for t, val := range AuthorityValues {
		if val == v {
			return Authority{Type: t, Value: v}
		}
	}
	return Authority{Type: AuthorityRaw, Value: v}
}

func MomentumToByte(m Momentum) (uint8, error) {
	if m.Type == MomentumRaw {
		if isNamedMomentumByte(m.Value) {
			return 0, fmt.Errorf("Momentum.Raw value %d aliases a named case", m.Value)
		}
		return m.Value, nil
	}
	v, ok := MomentumValues[m.Type]
	if !ok {
		return 0, fmt.Errorf("unknown momentum type %s", m.Type)
	}
	return v, nil
}

func MomentumFromByte(v uint8) Momentum {
	for t, val := range MomentumValues {
		if val == v {
			return Momentum{Type: t, Value: v}
		}
	}
	return Momentum{Type: MomentumRaw, Value: v}
}

type SimulationEnvironment interface {
	NextInt64() int64
}

type DeterministicEnv struct{}

func (d DeterministicEnv) NextInt64() int64 {
	return 0
}

type BitField struct {
	Offset uint
	Width  uint
}

var BitLayout = struct {
	Version    BitField
	Timestamp  BitField
	Chromosome BitField
	Category   BitField
	Firefly    BitField
	Authority  BitField
	Persona    BitField
	Momentum   BitField
	Location   BitField
	Randomness BitField
}{
	Version:    BitField{Offset: 123, Width: 5},
	Timestamp:  BitField{Offset: 75, Width: 48},
	Chromosome: BitField{Offset: 70, Width: 5},
	Category:   BitField{Offset: 65, Width: 4},
	Firefly:    BitField{Offset: 64, Width: 1},
	Authority:  BitField{Offset: 59, Width: 5},
	Persona:    BitField{Offset: 51, Width: 8},
	Momentum:   BitField{Offset: 43, Width: 8},
	Location:   BitField{Offset: 35, Width: 8},
	Randomness: BitField{Offset: 0, Width: 32},
}

func setBits(target *big.Int, field BitField, val uint64) {
	valBig := new(big.Int).SetUint64(val)
	mask := new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), field.Width), big.NewInt(1))
	valBig.And(valBig, mask)
	valBig.Lsh(valBig, field.Offset)
	target.Or(target, valBig)
}

func getBits(target *big.Int, field BitField) uint64 {
	valBig := new(big.Int).Rsh(target, field.Offset)
	mask := new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), field.Width), big.NewInt(1))
	valBig.And(valBig, mask)
	return valBig.Uint64()
}

func Pack(obs ZetaObservation, env SimulationEnvironment) (*big.Int, error) {
	if obs.Timestamp > ((1 << 48) - 1) {
		return nil, fmt.Errorf("timestamp %d exceeds 48-bit range", obs.Timestamp)
	}
	if obs.Version > 31 {
		return nil, fmt.Errorf("version %d exceeds 5-bit range", obs.Version)
	}
	if obs.Chromosome > 31 {
		return nil, fmt.Errorf("chromosome %d exceeds 5-bit range", obs.Chromosome)
	}
	if obs.Category > 15 {
		return nil, fmt.Errorf("category %d exceeds 4-bit range", obs.Category)
	}
	if obs.Category >= 9 {
		return nil, errors.New("ZetaObservation.Category must be < 9")
	}
	if obs.Firefly > 1 {
		return nil, fmt.Errorf("firefly %d exceeds 1-bit range", obs.Firefly)
	}

	authByte, err := AuthorityToByte(obs.Authority)
	if err != nil {
		return nil, err
	}
	momByte, err := MomentumToByte(obs.Momentum)
	if err != nil {
		return nil, err
	}

	id := new(big.Int)
	setBits(id, BitLayout.Version, uint64(obs.Version))
	setBits(id, BitLayout.Timestamp, obs.Timestamp)
	setBits(id, BitLayout.Chromosome, uint64(obs.Chromosome))
	setBits(id, BitLayout.Category, uint64(obs.Category))
	setBits(id, BitLayout.Firefly, uint64(obs.Firefly))
	setBits(id, BitLayout.Authority, uint64(authByte))
	setBits(id, BitLayout.Persona, uint64(obs.Persona))
	setBits(id, BitLayout.Momentum, uint64(momByte))
	setBits(id, BitLayout.Location, uint64(obs.Location))

	rand32 := uint64(env.NextInt64() & 0xffffffff)
	setBits(id, BitLayout.Randomness, rand32)

	return id, nil
}

func Unpack(id *big.Int) ZetaObservation {
	version := uint8(getBits(id, BitLayout.Version))
	timestamp := getBits(id, BitLayout.Timestamp)
	chromosome := uint8(getBits(id, BitLayout.Chromosome))
	category := uint8(getBits(id, BitLayout.Category))
	firefly := uint8(getBits(id, BitLayout.Firefly))
	authByte := uint8(getBits(id, BitLayout.Authority))
	persona := uint8(getBits(id, BitLayout.Persona))
	momByte := uint8(getBits(id, BitLayout.Momentum))
	location := uint8(getBits(id, BitLayout.Location))

	return ZetaObservation{
		Version:    version,
		Timestamp:  timestamp,
		Chromosome: chromosome,
		Category:   category,
		Firefly:    firefly,
		Authority:  AuthorityFromByte(authByte),
		Persona:    persona,
		Momentum:   MomentumFromByte(momByte),
		Location:   location,
	}
}

func ToHex(id *big.Int) string {
	hexStr := fmt.Sprintf("%x", id)
	for len(hexStr) < 32 {
		hexStr = "0" + hexStr
	}
	return hexStr
}
