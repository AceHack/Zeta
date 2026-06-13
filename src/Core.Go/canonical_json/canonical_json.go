package canonical_json

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

const maxSafeInteger = 9007199254740991

type RejectedValue struct{}

func isWellFormed(s string) bool {
	if !utf8.ValidString(s) {
		return false
	}
	for _, r := range s {
		if r >= 0xD800 && r <= 0xDFFF {
			return false
		}
	}
	return true
}

func compareUTF16(a, b string) int {
	a16 := utf16.Encode([]rune(a))
	b16 := utf16.Encode([]rune(b))
	for i := 0; i < len(a16) && i < len(b16); i++ {
		if a16[i] < b16[i] {
			return -1
		} else if a16[i] > b16[i] {
			return 1
		}
	}
	if len(a16) < len(b16) {
		return -1
	} else if len(a16) > len(b16) {
		return 1
	}
	return 0
}

func escapeString(s string, buf *bytes.Buffer) {
	buf.WriteByte('"')
	for i := 0; i < len(s); {
		r, size := utf8.DecodeRuneInString(s[i:])
		switch r {
		case '"':
			buf.WriteString(`\"`)
		case '\\':
			buf.WriteString(`\\`)
		case '\b':
			buf.WriteString(`\b`)
		case '\f':
			buf.WriteString(`\f`)
		case '\n':
			buf.WriteString(`\n`)
		case '\r':
			buf.WriteString(`\r`)
		case '\t':
			buf.WriteString(`\t`)
		default:
			if r < 0x20 {
				fmt.Fprintf(buf, `\u00%02x`, r)
			} else {
				buf.WriteRune(r)
			}
		}
		i += size
	}
	buf.WriteByte('"')
}

func Marshal(v interface{}) ([]byte, error) {
	var buf bytes.Buffer
	err := writeCanonical(v, &buf)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func writeCanonical(v interface{}, buf *bytes.Buffer) error {
	if v == nil {
		buf.WriteString("null")
		return nil
	}

	switch val := v.(type) {
	case RejectedValue:
		return errors.New("lone surrogate or rejected value")

	case bool:
		if val {
			buf.WriteString("true")
		} else {
			buf.WriteString("false")
		}
		return nil

	case string:
		if !isWellFormed(val) {
			return errors.New("lone surrogate or invalid UTF-8")
		}
		escapeString(val, buf)
		return nil

	case json.Number:
		s := string(val)
		if strings.Contains(s, ".") || strings.Contains(s, "e") || strings.Contains(s, "E") {
			return errors.New("float not allowed")
		}
		n, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			return errors.New("integer out of range")
		}
		absN := n
		if absN < 0 {
			absN = -absN
		}
		if absN > maxSafeInteger {
			return errors.New("unsafe integer")
		}
		buf.WriteString(s)
		return nil

	case int:
		n := int64(val)
		absN := n
		if absN < 0 {
			absN = -absN
		}
		if absN > maxSafeInteger {
			return errors.New("unsafe integer")
		}
		buf.WriteString(strconv.FormatInt(n, 10))
		return nil

	case int64:
		absN := val
		if absN < 0 {
			absN = -absN
		}
		if absN > maxSafeInteger {
			return errors.New("unsafe integer")
		}
		buf.WriteString(strconv.FormatInt(val, 10))
		return nil

	case float64:
		return errors.New("float not allowed")

	case []interface{}:
		buf.WriteByte('[')
		for i, item := range val {
			if i > 0 {
				buf.WriteByte(',')
			}
			err := writeCanonical(item, buf)
			if err != nil {
				return err
			}
		}
		buf.WriteByte(']')
		return nil

	case map[string]interface{}:
		keys := make([]string, 0, len(val))
		for k := range val {
			if !isWellFormed(k) {
				return errors.New("lone surrogate or invalid UTF-8 in object key")
			}
			keys = append(keys, k)
		}

		sort.Slice(keys, func(i, j int) bool {
			return compareUTF16(keys[i], keys[j]) < 0
		})

		buf.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				buf.WriteByte(',')
			}
			escapeString(k, buf)
			buf.WriteByte(':')
			err := writeCanonical(val[k], buf)
			if err != nil {
				return err
			}
		}
		buf.WriteByte('}')
		return nil

	default:
		return fmt.Errorf("unsupported type: %T", val)
	}
}
