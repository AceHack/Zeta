package main

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"unicode/utf16"
	"zeta/canonical_json"
	"zeta/sha256"
	"zeta/tri_boolean"
	zetayaml "zeta/yaml"
	"zeta/zeta_id"
	"zeta/zset_merkle"

	"gopkg.in/yaml.v3"
)

func findRepoRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "Zeta.sln")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			panic("could not find repo root")
		}
		dir = parent
	}
}

type Sha256Vector struct {
	Id          string  `yaml:"id"`
	InputUtf8   *string `yaml:"input_utf8"`
	InputHex    *string `yaml:"input_hex"`
	ExpectedHex string  `yaml:"expected_hex"`
}

type Sha256Yaml struct {
	Vectors []Sha256Vector `yaml:"vectors"`
}

func TestCrossVerifySha256(t *testing.T) {
	repoRoot := findRepoRoot()
	fixtureDir := filepath.Join(repoRoot, "tests", "cross-verification", "sha256")
	vectorsPath := filepath.Join(fixtureDir, "vectors.yaml")

	data, err := os.ReadFile(vectorsPath)
	if err != nil {
		t.Fatalf("failed to read vectors.yaml: %v", err)
	}

	var y Sha256Yaml
	if err := yaml.Unmarshal(data, &y); err != nil {
		t.Fatalf("failed to unmarshal vectors.yaml: %v", err)
	}

	outMap := make(map[string]string)
	for _, v := range y.Vectors {
		var input []byte
		if v.InputUtf8 != nil {
			input = []byte(*v.InputUtf8)
		} else if v.InputHex != nil {
			dec, err := hex.DecodeString(*v.InputHex)
			if err != nil {
				t.Fatalf("failed to decode hex input for %s: %v", v.Id, err)
			}
			input = dec
		}
		outMap[v.Id] = sha256.HashBytes(input)
	}

	jsonData, err := json.MarshalIndent(outMap, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal JSON: %v", err)
	}

	// Append newline to match prettier/standard JSON formatting
	jsonStr := string(jsonData) + "\n"

	outputPath := filepath.Join(fixtureDir, "go-output.json")
	if err := os.WriteFile(outputPath, []byte(jsonStr), 0644); err != nil {
		t.Fatalf("failed to write go-output.json: %v", err)
	}
}

type TriVector struct {
	Id          string   `yaml:"id"`
	Type        string   `yaml:"type"`
	State       string   `yaml:"state,omitempty"`
	Left        string   `yaml:"left,omitempty"`
	Right       string   `yaml:"right,omitempty"`
	High        string   `yaml:"high,omitempty"`
	Decoder     string   `yaml:"decoder,omitempty"`
	Low         string   `yaml:"low,omitempty"`
	EncodeValue *float64 `yaml:"encode_value,omitempty"`
}

type TriYaml struct {
	Vectors []TriVector `yaml:"vectors"`
}

func parseTri(s string) triboolean.Tri {
	switch s {
	case "T":
		return triboolean.Tri{S: triboolean.T}
	case "F":
		return triboolean.Tri{S: triboolean.F}
	case "N":
		return triboolean.Tri{S: triboolean.N}
	}
	panic("invalid tri state: " + s)
}

func triSliceToString(trits []triboolean.Tri) string {
	res := ""
	for _, t := range trits {
		res += string(t.S)
	}
	return res
}

func TestCrossVerifyTriBoolean(t *testing.T) {
	repoRoot := findRepoRoot()
	fixtureDir := filepath.Join(repoRoot, "tests", "cross-verification", "tri-boolean")
	vectorsPath := filepath.Join(fixtureDir, "vectors.yaml")

	data, err := os.ReadFile(vectorsPath)
	if err != nil {
		t.Fatalf("failed to read vectors.yaml: %v", err)
	}

	var y TriYaml
	if err := yaml.Unmarshal(data, &y); err != nil {
		t.Fatalf("failed to unmarshal vectors.yaml: %v", err)
	}

	outMap := make(map[string]interface{})
	for _, v := range y.Vectors {
		switch v.Type {
		case "unary":
			tr := parseTri(v.State)
			measVal, err := triboolean.Measure(tr)
			measureOk := err == nil
			measureFeedback := ""
			if err != nil {
				measureFeedback = err.Error()
			}

			notVal := triboolean.NotTri(tr)
			coopVal := triboolean.Cooperate(tr)
			mapNotVal := triboolean.MapTri(tr, func(b bool) bool { return !b })
			bindNotVal := triboolean.BindTri(tr, func(b bool) triboolean.Tri { return triboolean.FromBool(!b) })
			bindToTVal := triboolean.BindTri(tr, func(b bool) triboolean.Tri { return triboolean.Tri{S: triboolean.T} })

			outMap[v.Id] = map[string]interface{}{
				"type":            "unary",
				"state":           v.State,
				"isLiving":        tr.IsLiving(),
				"isCertain":       tr.IsCertain(),
				"notState":        string(notVal.S),
				"cooperateState":  string(coopVal.S),
				"measureOk":       measureOk,
				"measureValue":    measVal,
				"measureFeedback": measureFeedback,
				"mapNot":          string(mapNotVal.S),
				"bindNot":         string(bindNotVal.S),
				"bindToT":         string(bindToTVal.S),
			}
		case "binary":
			left := parseTri(v.Left)
			right := parseTri(v.Right)
			andVal := triboolean.AndTri(left, right)
			orVal := triboolean.OrTri(left, right)

			outMap[v.Id] = map[string]interface{}{
				"type":        "binary",
				"left":        v.Left,
				"right":       v.Right,
				"expectedAnd": string(andVal.S),
				"expectedOr":  string(orVal.S),
			}
		case "float":
			var highTrits []triboolean.Tri
			for _, c := range v.High {
				highTrits = append(highTrits, parseTri(string(c)))
			}
			var decoderTrits []triboolean.Tri
			for _, c := range v.Decoder {
				decoderTrits = append(decoderTrits, parseTri(string(c)))
			}
			var lowTrits []triboolean.Tri
			for _, c := range v.Low {
				lowTrits = append(lowTrits, parseTri(string(c)))
			}

			tf := triboolean.FromTrits(highTrits, decoderTrits, lowTrits)
			decResult := triboolean.Decode(tf)

			expectedOk := decResult.Ok
			expectedValue := decResult.Value
			expectedFeedback := ""
			if !decResult.Ok {
				expectedFeedback = decResult.Feedback.Reason
			}

			floatRes := map[string]interface{}{
				"type":             "float",
				"high":             v.High,
				"decoder":          v.Decoder,
				"low":              v.Low,
				"expectedOk":       expectedOk,
				"expectedValue":    expectedValue,
				"expectedFeedback": expectedFeedback,
			}

			if v.EncodeValue != nil {
				val := *v.EncodeValue
				floatRes["encodeValue"] = val
				encResult := triboolean.FromValue(val, tf.Shape)
				floatRes["expectedEncodeOk"] = encResult.Ok
				if encResult.Ok {
					floatRes["expectedEncodeHigh"] = triSliceToString(encResult.Float.High)
					floatRes["expectedEncodeDecoder"] = triSliceToString(encResult.Float.Decoder)
					floatRes["expectedEncodeLow"] = triSliceToString(encResult.Float.Low)
				} else {
					floatRes["expectedEncodeDetail"] = encResult.Feedback.Detail
				}
			}

			outMap[v.Id] = floatRes
		}
	}

	jsonData, err := json.MarshalIndent(outMap, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal JSON: %v", err)
	}

	jsonStr := string(jsonData) + "\n"

	outputPath := filepath.Join(fixtureDir, "go-output.json")
	if err := os.WriteFile(outputPath, []byte(jsonStr), 0644); err != nil {
		t.Fatalf("failed to write go-output.json: %v", err)
	}
}

type ZetaIdVector struct {
	Id                string  `yaml:"id"`
	Type              *string `yaml:"type"`
	InputCrockford    *string `yaml:"input_crockford"`
	Version           uint8   `yaml:"version"`
	Timestamp         uint64  `yaml:"timestamp"`
	Chromosome        uint8   `yaml:"chromosome"`
	Category          uint8   `yaml:"category"`
	Firefly           uint8   `yaml:"firefly"`
	AuthorityType     string  `yaml:"authority_type"`
	AuthorityRaw      *uint8  `yaml:"authority_raw"`
	Persona           uint8   `yaml:"persona"`
	MomentumType      string  `yaml:"momentum_type"`
	MomentumRaw       *uint8  `yaml:"momentum_raw"`
	Location          uint8   `yaml:"location"`
	ExpectedHex       string  `yaml:"expected_hex"`
	ExpectedCrockford string  `yaml:"expected_crockford"`
}

type ZetaIdYaml struct {
	Vectors []ZetaIdVector `yaml:"vectors"`
}

type ZetaIdOutput struct {
	Hex             string `json:"hex"`
	Crockford       string `json:"crockford"`
	RoundtripOk     bool   `json:"roundtripOk"`
	MatchesExpected bool   `json:"matchesExpected"`
}

func observationsEqual(a, b zeta_id.ZetaObservation) bool {
	aAuthVal, _ := zeta_id.AuthorityToByte(a.Authority)
	bAuthVal, _ := zeta_id.AuthorityToByte(b.Authority)
	aMomVal, _ := zeta_id.MomentumToByte(a.Momentum)
	bMomVal, _ := zeta_id.MomentumToByte(b.Momentum)
	return a.Version == b.Version &&
		a.Timestamp == b.Timestamp &&
		a.Chromosome == b.Chromosome &&
		a.Category == b.Category &&
		a.Firefly == b.Firefly &&
		a.Authority.Type == b.Authority.Type &&
		aAuthVal == bAuthVal &&
		a.Persona == b.Persona &&
		a.Momentum.Type == b.Momentum.Type &&
		aMomVal == bMomVal &&
		a.Location == b.Location
}

func TestCrossVerifyZetaId(t *testing.T) {
	repoRoot := findRepoRoot()
	fixtureDir := filepath.Join(repoRoot, "tests", "cross-verification", "zeta-id")
	vectorsPath := filepath.Join(fixtureDir, "vectors.yaml")

	data, err := os.ReadFile(vectorsPath)
	if err != nil {
		t.Fatalf("failed to read vectors.yaml: %v", err)
	}

	var y ZetaIdYaml
	if err := yaml.Unmarshal(data, &y); err != nil {
		t.Fatalf("failed to unmarshal vectors.yaml: %v", err)
	}

	outMap := make(map[string]ZetaIdOutput)
	for _, v := range y.Vectors {
		var hexVal string
		var crockfordVal string
		var roundtripOk bool
		var matchesExpected bool

		if v.Type != nil && *v.Type == "parse-reject" {
			_, parseErr := zeta_id.Parse(v.ExpectedCrockford)
			parseFailed := parseErr != nil
			canonicalOk := zeta_id.IsCanonical(v.ExpectedCrockford)

			hexVal = "rejected"
			crockfordVal = "rejected"
			roundtripOk = parseFailed && !canonicalOk
			matchesExpected = v.ExpectedHex == "rejected"
		} else if v.Type != nil && *v.Type == "max-128" {
			maxVal := new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 128), big.NewInt(1))
			hexVal = fmt.Sprintf("%032x", maxVal)
			crockfordVal = zeta_id.Format(maxVal)

			parsedID, parseErr := zeta_id.Parse(crockfordVal)
			parseOk := parseErr == nil && parsedID.Cmp(maxVal) == 0
			canonicalOk := zeta_id.IsCanonical(crockfordVal)

			roundtripOk = parseOk && canonicalOk
			matchesExpected = hexVal == v.ExpectedHex && crockfordVal == v.ExpectedCrockford
		} else if v.Type != nil && *v.Type == "lenient-alias" {
			var authRaw uint8
			if v.AuthorityRaw != nil {
				authRaw = *v.AuthorityRaw
			}
			var momRaw uint8
			if v.MomentumRaw != nil {
				momRaw = *v.MomentumRaw
			}

			obs := zeta_id.ZetaObservation{
				Version:    v.Version,
				Timestamp:  v.Timestamp,
				Chromosome: v.Chromosome,
				Category:   v.Category,
				Firefly:    v.Firefly,
				Authority:  zeta_id.Authority{Type: zeta_id.AuthorityType(v.AuthorityType), Value: authRaw},
				Persona:    v.Persona,
				Momentum:   zeta_id.Momentum{Type: zeta_id.MomentumType(v.MomentumType), Value: momRaw},
				Location:   v.Location,
			}

			packed, err := zeta_id.Pack(obs, zeta_id.DeterministicEnv{})
			if err != nil {
				t.Fatalf("failed to pack observation for %s: %v", v.Id, err)
			}
			hexVal = zeta_id.ToHex(packed)
			crockfordVal = zeta_id.Format(packed)

			parsedID, parseErr := zeta_id.Parse(*v.InputCrockford)
			parseOk := parseErr == nil && parsedID.Cmp(packed) == 0
			inputCanonicalOk := zeta_id.IsCanonical(*v.InputCrockford)
			expectedCanonicalOk := zeta_id.IsCanonical(v.ExpectedCrockford)

			roundtripOk = parseOk && !inputCanonicalOk && expectedCanonicalOk
			matchesExpected = hexVal == v.ExpectedHex && crockfordVal == v.ExpectedCrockford
		} else {
			var authRaw uint8
			if v.AuthorityRaw != nil {
				authRaw = *v.AuthorityRaw
			}
			var momRaw uint8
			if v.MomentumRaw != nil {
				momRaw = *v.MomentumRaw
			}

			obs := zeta_id.ZetaObservation{
				Version:    v.Version,
				Timestamp:  v.Timestamp,
				Chromosome: v.Chromosome,
				Category:   v.Category,
				Firefly:    v.Firefly,
				Authority:  zeta_id.Authority{Type: zeta_id.AuthorityType(v.AuthorityType), Value: authRaw},
				Persona:    v.Persona,
				Momentum:   zeta_id.Momentum{Type: zeta_id.MomentumType(v.MomentumType), Value: momRaw},
				Location:   v.Location,
			}

			packed, err := zeta_id.Pack(obs, zeta_id.DeterministicEnv{})
			if err != nil {
				t.Fatalf("failed to pack observation for %s: %v", v.Id, err)
			}
			hexVal = zeta_id.ToHex(packed)
			crockfordVal = zeta_id.Format(packed)

			unpacked := zeta_id.Unpack(packed)
			parsedID, parseErr := zeta_id.Parse(crockfordVal)
			parseOk := parseErr == nil && parsedID.Cmp(packed) == 0
			isCanonical := zeta_id.IsCanonical(crockfordVal)

			roundtripOk = observationsEqual(obs, unpacked) && parseOk && isCanonical
			matchesExpected = hexVal == v.ExpectedHex && crockfordVal == v.ExpectedCrockford
		}

		outMap[v.Id] = ZetaIdOutput{
			Hex:             hexVal,
			Crockford:       crockfordVal,
			RoundtripOk:     roundtripOk,
			MatchesExpected: matchesExpected,
		}
	}

	jsonData, err := json.MarshalIndent(outMap, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal JSON: %v", err)
	}

	jsonStr := string(jsonData) + "\n"

	outputPath := filepath.Join(fixtureDir, "go-output.json")
	if err := os.WriteFile(outputPath, []byte(jsonStr), 0644); err != nil {
		t.Fatalf("failed to write go-output.json: %v", err)
	}
}

func TestZetaIdCanonicality(t *testing.T) {
	if !zeta_id.IsCanonical("081JVQXNCD370ZG2R010000000") {
		t.Error("expected 081JVQXNCD370ZG2R010000000 to be canonical")
	}
	if zeta_id.IsCanonical("081JVQXNCD370ZG2R010000000" + "z") {
		t.Error("expected lowercase/lenient not to be canonical")
	}
	if zeta_id.IsCanonical("081JVQXNCD370ZG2R01000000o") {
		t.Error("expected lenient o alias not to be canonical")
	}
	if zeta_id.IsCanonical("Z0000000000000000000000000") {
		t.Error("expected first char >= 8 to be non-canonical")
	}
}

type CanonicalJsonVector struct {
	Id    string      `json:"id"`
	Value interface{} `json:"value"`
}

type CanonicalJsonVectors struct {
	Canonical []CanonicalJsonVector `json:"canonical"`
	Invalid   []CanonicalJsonVector `json:"invalid"`
}

func TestCrossVerifyCanonicalJson(t *testing.T) {
	repoRoot := findRepoRoot()
	fixtureDir := filepath.Join(repoRoot, "tests", "cross-verification", "canonical-json")
	vectorsPath := filepath.Join(fixtureDir, "vectors.json")

	data, err := os.ReadFile(vectorsPath)
	if err != nil {
		t.Fatalf("failed to read vectors.json: %v", err)
	}

	top, err := parseJSON(string(data))
	if err != nil {
		t.Fatalf("failed to parse vectors.json: %v", err)
	}

	topMap, ok := top.(map[string]interface{})
	if !ok {
		t.Fatalf("expected top-level object in vectors.json")
	}

	canonicalList, ok := topMap["canonical"].([]interface{})
	if !ok {
		t.Fatalf("expected 'canonical' array in vectors.json")
	}
	invalidList, ok := topMap["invalid"].([]interface{})
	if !ok {
		t.Fatalf("expected 'invalid' array in vectors.json")
	}

	outMap := make(map[string]string)

	for _, rec := range canonicalList {
		recMap, ok := rec.(map[string]interface{})
		if !ok {
			t.Fatalf("canonical record is not an object")
		}
		id := recMap["id"].(string)
		expected := recMap["expected_canonical_json"].(string)
		val := recMap["value"]

		got, err := canonical_json.Marshal(val)
		if err != nil {
			t.Fatalf("canonical:%s: unexpected error: %v", id, err)
		}
		if string(got) != expected {
			t.Fatalf("canonical:%s mismatch: got=%s expected=%s", id, got, expected)
		}
		outMap["canonical:"+id] = string(got)
	}

	for _, rec := range invalidList {
		recMap, ok := rec.(map[string]interface{})
		if !ok {
			t.Fatalf("invalid record is not an object")
		}
		id := recMap["id"].(string)
		val := recMap["value"]

		_, err := canonical_json.Marshal(val)
		if err != nil {
			outMap["invalid:"+id] = "<rejected>"
		} else {
			outMap["invalid:"+id] = "ACCEPTED"
		}
	}

	jsonData, err := json.MarshalIndent(outMap, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal JSON: %v", err)
	}

	jsonStr := string(jsonData) + "\n"

	outputPath := filepath.Join(fixtureDir, "go-output.json")
	if err := os.WriteFile(outputPath, []byte(jsonStr), 0644); err != nil {
		t.Fatalf("failed to write go-output.json: %v", err)
	}
}

type jsonParser struct {
	runes []rune
	pos   int
}

func parseJSON(s string) (interface{}, error) {
	p := &jsonParser{runes: []rune(s), pos: 0}
	p.skipWs()
	val, err := p.parseValue()
	if err != nil {
		return nil, err
	}
	p.skipWs()
	if p.pos != len(p.runes) {
		return nil, errors.New("trailing data")
	}
	return val, nil
}

func (p *jsonParser) parseValue() (interface{}, error) {
	p.skipWs()
	if p.pos >= len(p.runes) {
		return nil, errors.New("unexpected EOF")
	}
	r := p.runes[p.pos]
	switch r {
	case 'n':
		return p.parseLiteral("null", nil)
	case 't':
		return p.parseLiteral("true", true)
	case 'f':
		return p.parseLiteral("false", false)
	case '"':
		return p.parseString()
	case '[':
		return p.parseArray()
	case '{':
		return p.parseObject()
	default:
		if r == '-' || (r >= '0' && r <= '9') {
			return p.parseNumber()
		}
		return nil, fmt.Errorf("unexpected char: %c", r)
	}
}

func (p *jsonParser) parseLiteral(lit string, val interface{}) (interface{}, error) {
	for i, r := range lit {
		if p.pos+i >= len(p.runes) || p.runes[p.pos+i] != r {
			return nil, fmt.Errorf("expected literal: %s", lit)
		}
	}
	p.pos += len(lit)
	return val, nil
}

func (p *jsonParser) skipWs() {
	for p.pos < len(p.runes) {
		r := p.runes[p.pos]
		if r == ' ' || r == '\t' || r == '\n' || r == '\r' {
			p.pos++
		} else {
			break
		}
	}
}

func (p *jsonParser) parseString() (interface{}, error) {
	p.pos++ // skip '"'
	var sb strings.Builder
	hasRejected := false
	for p.pos < len(p.runes) {
		r := p.runes[p.pos]
		if r == '"' {
			p.pos++
			if hasRejected {
				return canonical_json.RejectedValue{}, nil
			}
			return sb.String(), nil
		}
		if r == '\\' {
			if p.pos+1 >= len(p.runes) {
				return nil, errors.New("unterminated string escape")
			}
			next := p.runes[p.pos+1]
			if next == 'u' {
				if p.pos+5 >= len(p.runes) {
					return nil, errors.New("truncated \\u escape")
				}
				hexStr := string(p.runes[p.pos+2 : p.pos+6])
				p.pos += 6
				val, err := strconv.ParseUint(hexStr, 16, 32)
				if err != nil {
					return nil, errors.New("invalid hex escape")
				}
				u := uint32(val)
				if u >= 0xD800 && u <= 0xDBFF {
					if p.pos+6 <= len(p.runes) && p.runes[p.pos] == '\\' && p.runes[p.pos+1] == 'u' {
						hexStr2 := string(p.runes[p.pos+2 : p.pos+6])
						val2, err := strconv.ParseUint(hexStr2, 16, 32)
						if err == nil && val2 >= 0xDC00 && val2 <= 0xDFFF {
							p.pos += 6
							rCombined := utf16.DecodeRune(rune(u), rune(val2))
							sb.WriteRune(rCombined)
							continue
						}
					}
					hasRejected = true
					continue
				}
				if u >= 0xDC00 && u <= 0xDFFF {
					hasRejected = true
					continue
				}
				sb.WriteRune(rune(u))
				continue
			}
			switch next {
			case '"':
				sb.WriteRune('"')
			case '\\':
				sb.WriteRune('\\')
			case '/':
				sb.WriteRune('/')
			case 'b':
				sb.WriteRune('\b')
			case 'f':
				sb.WriteRune('\f')
			case 'n':
				sb.WriteRune('\n')
			case 'r':
				sb.WriteRune('\r')
			case 't':
				sb.WriteRune('\t')
			default:
				return nil, fmt.Errorf("invalid escape: \\%c", next)
			}
			p.pos += 2
			continue
		}
		sb.WriteRune(r)
		p.pos++
	}
	return nil, errors.New("unterminated string")
}

func (p *jsonParser) parseNumber() (interface{}, error) {
	start := p.pos
	if p.runes[p.pos] == '-' {
		p.pos++
	}
	p.consumeDigits()
	isFloat := false
	if p.pos < len(p.runes) && p.runes[p.pos] == '.' {
		isFloat = true
		p.pos++
		p.consumeDigits()
	}
	if p.pos < len(p.runes) && (p.runes[p.pos] == 'e' || p.runes[p.pos] == 'E') {
		isFloat = true
		p.pos++
		if p.pos < len(p.runes) && (p.runes[p.pos] == '+' || p.runes[p.pos] == '-') {
			p.pos++
		}
		p.consumeDigits()
	}
	tok := string(p.runes[start:p.pos])
	if isFloat {
		return float64(0), nil
	}
	return json.Number(tok), nil
}

func (p *jsonParser) consumeDigits() {
	for p.pos < len(p.runes) && p.runes[p.pos] >= '0' && p.runes[p.pos] <= '9' {
		p.pos++
	}
}

func (p *jsonParser) parseArray() (interface{}, error) {
	p.pos++ // skip '['
	p.skipWs()
	if p.pos < len(p.runes) && p.runes[p.pos] == ']' {
		p.pos++
		return []interface{}{}, nil
	}
	var items []interface{}
	for {
		item, err := p.parseValue()
		if err != nil {
			return nil, err
		}
		items = append(items, item)
		p.skipWs()
		if p.pos >= len(p.runes) {
			return nil, errors.New("unterminated array")
		}
		if p.runes[p.pos] == ',' {
			p.pos++
			p.skipWs()
			continue
		}
		if p.runes[p.pos] == ']' {
			p.pos++
			return items, nil
		}
		return nil, errors.New("expected ',' or ']'")
	}
}

func (p *jsonParser) parseObject() (interface{}, error) {
	p.pos++ // skip '{'
	p.skipWs()
	if p.pos < len(p.runes) && p.runes[p.pos] == '}' {
		p.pos++
		return map[string]interface{}{}, nil
	}
	m := make(map[string]interface{})
	hasRejectedKey := false
	for {
		p.skipWs()
		if p.pos >= len(p.runes) || p.runes[p.pos] != '"' {
			return nil, errors.New("expected string key")
		}
		keyVal, err := p.parseString()
		if err != nil {
			return nil, err
		}

		var key string
		switch k := keyVal.(type) {
		case string:
			key = k
		case canonical_json.RejectedValue:
			hasRejectedKey = true
		}

		p.skipWs()
		if p.pos >= len(p.runes) || p.runes[p.pos] != ':' {
			return nil, errors.New("expected ':'")
		}
		p.pos++ // skip ':'
		val, err := p.parseValue()
		if err != nil {
			return nil, err
		}
		if !hasRejectedKey {
			m[key] = val
		}
		p.skipWs()
		if p.pos >= len(p.runes) {
			return nil, errors.New("unterminated object")
		}
		if p.runes[p.pos] == ',' {
			p.pos++
			p.skipWs()
			continue
		}
		if p.runes[p.pos] == '}' {
			p.pos++
			if hasRejectedKey {
				return canonical_json.RejectedValue{}, nil
			}
			return m, nil
		}
		return nil, errors.New("expected ',' or '}'")
	}
}

type YamlVector struct {
	Id   string `json:"id"`
	Yaml string `json:"yaml"`
}

type YamlVectors struct {
	Vectors []YamlVector `json:"vectors"`
}

func TestCrossVerifyYaml(t *testing.T) {
	repoRoot := findRepoRoot()
	fixtureDir := filepath.Join(repoRoot, "tests", "cross-verification", "yaml")
	vectorsPath := filepath.Join(fixtureDir, "vectors.json")

	data, err := os.ReadFile(vectorsPath)
	if err != nil {
		t.Fatalf("failed to read vectors.json: %v", err)
	}

	var fixture YamlVectors
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("failed to unmarshal vectors.json: %v", err)
	}

	outMap := make(map[string][]zetayaml.YamlEvent)
	for _, v := range fixture.Vectors {
		events, err := zetayaml.ReadEvents(v.Yaml)
		if err != nil {
			t.Fatalf("yaml:%s: unexpected error: %v", v.Id, err)
		}
		outMap[v.Id] = events
	}

	jsonData, err := json.MarshalIndent(outMap, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal JSON: %v", err)
	}

	jsonStr := string(jsonData) + "\n"

	outputPath := filepath.Join(fixtureDir, "go-output.json")
	if err := os.WriteFile(outputPath, []byte(jsonStr), 0644); err != nil {
		t.Fatalf("failed to write go-output.json: %v", err)
	}
}

type ZSetMerkleVectorEntry struct {
	Key    string `yaml:"key"`
	Weight int64  `yaml:"weight"`
}

type ZSetMerkleVector struct {
	Id          string                  `yaml:"id"`
	Entries     []ZSetMerkleVectorEntry `yaml:"entries"`
	ExpectedHex string                  `yaml:"expected_hex"`
}

type ZSetMerkleYaml struct {
	Vectors []ZSetMerkleVector `yaml:"vectors"`
}

func TestCrossVerifyZSetMerkle(t *testing.T) {
	repoRoot := findRepoRoot()
	fixtureDir := filepath.Join(repoRoot, "tests", "cross-verification", "zset-merkle")
	vectorsPath := filepath.Join(fixtureDir, "vectors.yaml")

	data, err := os.ReadFile(vectorsPath)
	if err != nil {
		t.Fatalf("failed to read vectors.yaml: %v", err)
	}

	var y ZSetMerkleYaml
	if err := yaml.Unmarshal(data, &y); err != nil {
		t.Fatalf("failed to unmarshal vectors.yaml: %v", err)
	}

	outMap := make(map[string]string)
	for _, v := range y.Vectors {
		var entries []zset_merkle.Entry
		for _, e := range v.Entries {
			entries = append(entries, zset_merkle.Entry{
				Key:    e.Key,
				Weight: e.Weight,
			})
		}
		rootHash := zset_merkle.Root(entries)
		outMap[v.Id] = rootHash.ToHex()
	}

	jsonData, err := json.MarshalIndent(outMap, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal JSON: %v", err)
	}

	jsonStr := string(jsonData) + "\n"

	outputPath := filepath.Join(fixtureDir, "go-output.json")
	if err := os.WriteFile(outputPath, []byte(jsonStr), 0644); err != nil {
		t.Fatalf("failed to write go-output.json: %v", err)
	}
}
