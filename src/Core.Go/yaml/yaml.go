package yaml

import (
	"errors"
	"regexp"
	"strings"
)

type ScalarKind string

const (
	Null  ScalarKind = "Null"
	Bool  ScalarKind = "Bool"
	Int   ScalarKind = "Int"
	Float ScalarKind = "Float"
	Str   ScalarKind = "Str"
)

type ScalarStyle string

const (
	Plain        ScalarStyle = "Plain"
	SingleQuoted ScalarStyle = "SingleQuoted"
	DoubleQuoted ScalarStyle = "DoubleQuoted"
)

type YamlEvent struct {
	E     string       `json:"e"`
	Raw   *string      `json:"raw,omitempty"`
	Kind  *ScalarKind  `json:"kind,omitempty"`
	Style *ScalarStyle `json:"style,omitempty"`
}

var (
	nullLiterals = map[string]bool{"": true, "~": true, "null": true, "Null": true, "NULL": true}
	boolLiterals = map[string]bool{"true": true, "True": true, "TRUE": true, "false": true, "False": true, "FALSE": true}
	intRe        = regexp.MustCompile(`^-?[0-9]+$`)
	floatRe      = regexp.MustCompile(`^-?[0-9]+\.[0-9]+([eE][-+]?[0-9]+)?$`)
)

func resolvePlainKind(raw string) ScalarKind {
	if nullLiterals[raw] {
		return Null
	}
	if boolLiterals[raw] {
		return Bool
	}
	if intRe.MatchString(raw) {
		return Int
	}
	if floatRe.MatchString(raw) {
		return Float
	}
	return Str
}

var unsupportedValueStart = map[rune]bool{
	'&': true, '*': true, '!': true, '{': true, '[': true, '|': true, '>': true,
}

func isSpace(r rune) bool {
	return r == ' ' || r == '\t'
}

func leftTrim(s string) string {
	runes := []rune(s)
	i := 0
	for i < len(runes) && isSpace(runes[i]) {
		i++
	}
	return string(runes[i:])
}

func stripTrailingComment(token string) string {
	runes := []rune(token)
	for i := 0; i < len(runes); i++ {
		if runes[i] == '#' && i > 0 && isSpace(runes[i-1]) {
			return string(runes[:i])
		}
	}
	return token
}

func decodeSingleQuoted(token string) (string, error) {
	var sb strings.Builder
	runes := []rune(token)
	for i := 1; i < len(runes); i++ {
		r := runes[i]
		if r == '\'' {
			if i+1 < len(runes) && runes[i+1] == '\'' {
				sb.WriteRune('\'')
				i++
				continue
			}
			return sb.String(), nil
		}
		sb.WriteRune(r)
	}
	return "", errors.New("UnterminatedQuote")
}

func decodeDoubleQuoted(token string) (string, error) {
	var sb strings.Builder
	runes := []rune(token)
	for i := 1; i < len(runes); i++ {
		r := runes[i]
		if r == '"' {
			return sb.String(), nil
		}
		if r == '\\' {
			if i+1 >= len(runes) {
				return "", errors.New("UnterminatedQuote")
			}
			next := runes[i+1]
			switch next {
			case '\\':
				sb.WriteRune('\\')
			case '"':
				sb.WriteRune('"')
			case 'n':
				sb.WriteRune('\n')
			case 't':
				sb.WriteRune('\t')
			case 'r':
				sb.WriteRune('\r')
			case '0':
				sb.WriteRune('\x00')
			case '/':
				sb.WriteRune('/')
			default:
				return "", errors.New("UnexpectedCharacter")
			}
			i++
			continue
		}
		sb.WriteRune(r)
	}
	return "", errors.New("UnterminatedQuote")
}

type parsedScalar struct {
	raw   string
	kind  ScalarKind
	style ScalarStyle
}

func parseValue(token string) (parsedScalar, error) {
	if len(token) == 0 {
		return parsedScalar{raw: "", kind: Null, style: Plain}, nil
	}
	runes := []rune(token)
	first := runes[0]
	if first == '"' {
		dec, err := decodeDoubleQuoted(token)
		if err != nil {
			return parsedScalar{}, err
		}
		return parsedScalar{raw: dec, kind: Str, style: DoubleQuoted}, nil
	}
	if first == '\'' {
		dec, err := decodeSingleQuoted(token)
		if err != nil {
			return parsedScalar{}, err
		}
		return parsedScalar{raw: dec, kind: Str, style: SingleQuoted}, nil
	}
	if unsupportedValueStart[first] {
		return parsedScalar{}, errors.New("UnsupportedConstruct")
	}
	raw := strings.TrimRight(stripTrailingComment(token), " \t\r\n")
	return parsedScalar{raw: raw, kind: resolvePlainKind(raw), style: Plain}, nil
}

type contentLine struct {
	indent int
	text   string
}

func toContentLines(text string) ([]contentLine, error) {
	var out []contentLine
	lines := strings.Split(text, "\n")
	for _, raw := range lines {
		raw = strings.TrimSuffix(raw, "\r")

		indent := 0
		sawTab := false
		runes := []rune(raw)
	loop:
		for indent < len(runes) {
			ch := runes[indent]
			switch ch {
			case ' ':
				indent++
			case '\t':
				sawTab = true
				indent++
			default:
				break loop
			}
		}

		body := string(runes[indent:])
		if len(body) == 0 {
			continue
		}
		if body[0] == '#' {
			continue
		}
		if sawTab {
			return nil, errors.New("TabIndentation")
		}

		out = append(out, contentLine{indent: indent, text: body})
	}
	return out, nil
}

func isDocumentMarker(text string) bool {
	t := strings.TrimRight(text, " \t\r\n")
	return t == "---" || t == "..." || strings.HasPrefix(t, "--- ") || strings.HasPrefix(t, "... ")
}

type mappingEntry struct {
	key   string
	value *string
}

func splitMappingEntry(text string) *mappingEntry {
	inSingle := false
	inDouble := false
	runes := []rune(text)
	for i := 0; i < len(runes); i++ {
		ch := runes[i]
		if inSingle {
			if ch == '\'' {
				inSingle = false
			}
			continue
		}
		if inDouble {
			if ch == '\\' {
				i++
				continue
			}
			if ch == '"' {
				inDouble = false
			}
			continue
		}
		if ch == '\'' {
			inSingle = true
			continue
		}
		if ch == '"' {
			inDouble = true
			continue
		}
		if ch == '#' && i > 0 && isSpace(runes[i-1]) {
			return nil
		}
		if ch == ':' && (i+1 >= len(runes) || runes[i+1] == ' ' || runes[i+1] == '\t') {
			key := strings.TrimRight(string(runes[:i]), " \t")
			var val *string
			if i+1 < len(runes) {
				trimmed := leftTrim(string(runes[i+1:]))
				if len(trimmed) > 0 && !strings.HasPrefix(trimmed, "#") {
					val = &trimmed
				}
			}
			return &mappingEntry{key: key, value: val}
		}
	}
	return nil
}

type frame struct {
	indent int
	kind   string // "Mapping" or "Sequence"
}

func ReadEvents(text string) ([]YamlEvent, error) {
	lines, err := toContentLines(text)
	if err != nil {
		return nil, err
	}

	events := []YamlEvent{{E: "StreamStart"}}
	var stack []frame

	pushContainer := func(indent int, kind string) {
		stack = append(stack, frame{indent: indent, kind: kind})
		if kind == "Mapping" {
			events = append(events, YamlEvent{E: "MappingStart"})
		} else {
			events = append(events, YamlEvent{E: "SequenceStart"})
		}
	}

	popGreaterThan := func(indent int) {
		for len(stack) > 0 && stack[len(stack)-1].indent > indent {
			top := stack[len(stack)-1]
			stack = stack[:len(stack)-1]
			if top.kind == "Mapping" {
				events = append(events, YamlEvent{E: "MappingEnd"})
			} else {
				events = append(events, YamlEvent{E: "SequenceEnd"})
			}
		}
	}

	childIndentAt := func(idx int) int {
		if idx+1 < len(lines) {
			return lines[idx+1].indent
		}
		return -1
	}

	peekChildKind := func(idx int, childIndent int) string {
		if idx+1 >= len(lines) {
			return "Mapping"
		}
		next := lines[idx+1]
		if next.indent != childIndent {
			return "Mapping"
		}
		if next.text == "-" || strings.HasPrefix(next.text, "- ") {
			return "Sequence"
		}
		return "Mapping"
	}

	emitKey := func(key string) error {
		parsed, err := parseValue(key)
		if err != nil {
			return err
		}
		kindStr := Str
		events = append(events, YamlEvent{E: "Scalar", Raw: &parsed.raw, Kind: &kindStr, Style: &parsed.style})
		return nil
	}

	emitNull := func() {
		rawVal := ""
		kindVal := Null
		styleVal := Plain
		events = append(events, YamlEvent{E: "Scalar", Raw: &rawVal, Kind: &kindVal, Style: &styleVal})
	}

	emitValue := func(value string) error {
		parsed, err := parseValue(value)
		if err != nil {
			return err
		}
		events = append(events, YamlEvent{E: "Scalar", Raw: &parsed.raw, Kind: &parsed.kind, Style: &parsed.style})
		return nil
	}

	emitValueOrEmptyFlow := func(value string) error {
		token := strings.TrimRight(stripTrailingComment(value), " \t\r\n")
		switch token {
		case "{}":
			events = append(events, YamlEvent{E: "MappingStart"})
			events = append(events, YamlEvent{E: "MappingEnd"})
			return nil
		case "[]":
			events = append(events, YamlEvent{E: "SequenceStart"})
			events = append(events, YamlEvent{E: "SequenceEnd"})
			return nil
		default:
			return emitValue(value)
		}
	}

	for li := 0; li < len(lines); li++ {
		line := lines[li]
		body := line.text
		indent := line.indent

		if isDocumentMarker(body) {
			return nil, errors.New("UnsupportedConstruct")
		}

		isSeqItem := body == "-" || strings.HasPrefix(body, "- ")

		if len(stack) == 0 {
			kind := "Mapping"
			if isSeqItem {
				kind = "Sequence"
			}
			pushContainer(indent, kind)
		} else if indent <= stack[len(stack)-1].indent {
			popGreaterThan(indent)
			if len(stack) == 0 {
				return nil, errors.New("UnexpectedIndent")
			}
			top := stack[len(stack)-1]
			if top.indent != indent {
				return nil, errors.New("UnexpectedIndent")
			}
			if isSeqItem != (top.kind == "Sequence") {
				return nil, errors.New("UnexpectedIndent")
			}
		}

		if isSeqItem {
			var afterDash string
			if body == "-" {
				afterDash = ""
			} else {
				afterDash = body[2:]
			}
			itemContent := leftTrim(afterDash)

			if len(itemContent) == 0 || strings.HasPrefix(itemContent, "#") {
				childIndent := childIndentAt(li)
				if childIndent > indent {
					pushContainer(childIndent, peekChildKind(li, childIndent))
				} else {
					emitNull()
				}
				continue
			}

			innerEntry := splitMappingEntry(itemContent)
			if innerEntry != nil {
				mapIndent := indent + (len(body) - len(itemContent))
				pushContainer(mapIndent, "Mapping")
				err := emitKey(innerEntry.key)
				if err != nil {
					return nil, err
				}
				if innerEntry.value != nil {
					err = emitValueOrEmptyFlow(*innerEntry.value)
					if err != nil {
						return nil, err
					}
				} else {
					childIndent := childIndentAt(li)
					if childIndent > mapIndent {
						pushContainer(childIndent, peekChildKind(li, childIndent))
					} else {
						emitNull()
					}
				}
				continue
			}

			err := emitValueOrEmptyFlow(itemContent)
			if err != nil {
				return nil, err
			}
			continue
		}

		entry := splitMappingEntry(body)
		if entry == nil {
			return nil, errors.New("UnsupportedConstruct")
		}
		err := emitKey(entry.key)
		if err != nil {
			return nil, err
		}
		if entry.value != nil {
			err = emitValueOrEmptyFlow(*entry.value)
			if err != nil {
				return nil, err
			}
		} else {
			childIndent := childIndentAt(li)
			if childIndent > indent {
				pushContainer(childIndent, peekChildKind(li, childIndent))
			} else {
				emitNull()
			}
		}
	}

	for len(stack) > 0 {
		top := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if top.kind == "Mapping" {
			events = append(events, YamlEvent{E: "MappingEnd"})
		} else {
			events = append(events, YamlEvent{E: "SequenceEnd"})
		}
	}
	events = append(events, YamlEvent{E: "StreamEnd"})
	return events, nil
}
