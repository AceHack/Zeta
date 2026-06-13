package triboolean

import (
	"errors"
	"fmt"
	"math"
)

type State string

const (
	T State = "T"
	F State = "F"
	N State = "N"
)

type Tri struct {
	S State `json:"s"`
}

func FromBool(b bool) Tri {
	if b {
		return Tri{S: T}
	}
	return Tri{S: F}
}

func Held() Tri {
	return Tri{S: N}
}

func (t Tri) IsLiving() bool {
	return t.S == N
}

func (t Tri) IsCertain() bool {
	return t.S != N
}

func Cooperate(t Tri) Tri {
	return t
}

type MeasureFeedback struct {
	Reason string `json:"reason"`
}

type MeasureResult struct {
	Ok       bool             `json:"ok"`
	Value    bool             `json:"value,omitempty"`
	Feedback *MeasureFeedback `json:"feedback,omitempty"`
}

func Measure(t Tri) (bool, error) {
	switch t.S {
	case T:
		return true, nil
	case F:
		return false, nil
	default:
		return false, errors.New("collapsed-living-uncertainty")
	}
}

func MapTri(t Tri, fn func(bool) bool) Tri {
	switch t.S {
	case T:
		return FromBool(fn(true))
	case F:
		return FromBool(fn(false))
	default:
		return Tri{S: N}
	}
}

func BindTri(t Tri, fn func(bool) Tri) Tri {
	switch t.S {
	case T:
		return fn(true)
	case F:
		return fn(false)
	default:
		return Tri{S: N}
	}
}

func NotTri(t Tri) Tri {
	switch t.S {
	case T:
		return Tri{S: F}
	case F:
		return Tri{S: T}
	default:
		return Tri{S: N}
	}
}

func AndTri(a, b Tri) Tri {
	if a.S == F || b.S == F {
		return Tri{S: F}
	}
	if a.S == N || b.S == N {
		return Tri{S: N}
	}
	return Tri{S: T}
}

func OrTri(a, b Tri) Tri {
	if a.S == T || b.S == T {
		return Tri{S: T}
	}
	if a.S == N || b.S == N {
		return Tri{S: N}
	}
	return Tri{S: F}
}

type FloatShape struct {
	HighWidth    int `json:"highWidth"`
	DecoderWidth int `json:"decoderWidth"`
	LowWidth     int `json:"lowWidth"`
}

var DefaultShape = FloatShape{HighWidth: 4, DecoderWidth: 3, LowWidth: 4}

type TriFloat struct {
	Shape   FloatShape `json:"shape"`
	High    []Tri      `json:"high"`
	Decoder []Tri      `json:"decoder"`
	Low     []Tri      `json:"low"`
}

func IntOf(trits []Tri) (int, bool) {
	v := 0
	for _, t := range trits {
		if t.S == N {
			return 0, false
		}
		v = v * 2
		if t.S == T {
			v += 1
		}
	}
	return v, true
}

func IntToTrits(v int, width int) []Tri {
	out := make([]Tri, width)
	for i := width - 1; i >= 0; i-- {
		var state = F
		if ((v >> i) & 1) == 1 {
			state = T
		}
		out[width-1-i] = Tri{S: state}
	}
	return out
}

type FloatFeedback struct {
	Reason string `json:"reason"`
}

type DecodeResult struct {
	Ok       bool           `json:"ok"`
	Value    float64        `json:"value"`
	Feedback *FloatFeedback `json:"feedback,omitempty"`
}

func Decode(f TriFloat) DecodeResult {
	mode, ok := IntOf(f.Decoder)
	if !ok {
		return DecodeResult{Ok: false, Feedback: &FloatFeedback{Reason: "interpretation-superposed"}}
	}
	allTrits := append([]Tri{}, f.High...)
	allTrits = append(allTrits, f.Low...)
	v, ok := IntOf(allTrits)
	if !ok {
		return DecodeResult{Ok: false, Feedback: &FloatFeedback{Reason: "value-superposed"}}
	}
	bias := 1 << (f.Shape.DecoderWidth - 1)
	exponent := mode - bias
	return DecodeResult{Ok: true, Value: float64(v) * math.Pow(2, float64(exponent))}
}

type EncodeFeedback struct {
	Reason string `json:"reason"`
	Detail string `json:"detail"`
}

type EncodeResult struct {
	Ok       bool            `json:"ok"`
	Float    *TriFloat       `json:"float,omitempty"`
	Feedback *EncodeFeedback `json:"feedback,omitempty"`
}

func FromValue(value float64, shape FloatShape) EncodeResult {
	if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		return EncodeResult{Ok: false, Feedback: &EncodeFeedback{Reason: "not-representable", Detail: "v0 is unsigned + finite"}}
	}
	valueBits := shape.HighWidth + shape.LowWidth
	maxMode := (1 << shape.DecoderWidth) - 1
	maxV := 1 << valueBits
	bias := 1 << (shape.DecoderWidth - 1)

	for mode := 0; mode <= maxMode; mode++ {
		scaled := value / math.Pow(2, float64(mode-bias))
		if scaled == math.Floor(scaled) && scaled >= 0 && scaled < float64(maxV) {
			bits := IntToTrits(int(scaled), valueBits)
			return EncodeResult{
				Ok: true,
				Float: &TriFloat{
					Shape:   shape,
					High:    bits[:shape.HighWidth],
					Decoder: IntToTrits(mode, shape.DecoderWidth),
					Low:     bits[shape.HighWidth:],
				},
			}
		}
	}
	return EncodeResult{
		Ok: false,
		Feedback: &EncodeFeedback{
			Reason: "not-representable",
			Detail: fmt.Sprintf("no (mode,V) with mode<=%d and V<%d represents %v", maxMode, maxV, value),
		},
	}
}

func FromTrits(high []Tri, decoder []Tri, low []Tri) TriFloat {
	return TriFloat{
		Shape:   FloatShape{HighWidth: len(high), DecoderWidth: len(decoder), LowWidth: len(low)},
		High:    high,
		Decoder: decoder,
		Low:     low,
	}
}
