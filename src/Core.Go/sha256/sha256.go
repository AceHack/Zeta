package sha256

import (
	"crypto/sha256"
	"encoding/hex"
)

func HashBytes(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func HashString(data string) string {
	return HashBytes([]byte(data))
}
