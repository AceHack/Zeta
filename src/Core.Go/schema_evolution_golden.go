// Schema evolution golden vector conformance — Go oracle (#6 of 10).
// Parses schema-golden-vectors.json, replays deltas, asserts value-equality.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
)

type SchemaField struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Required bool   `json:"required"`
}

type SchemaEntry struct {
	Field  SchemaField
	Weight int
}

type Delta struct {
	Retract []SchemaField `json:"retract"`
	Insert  []SchemaField `json:"insert"`
}

type ReplayState struct {
	ActiveFields []SchemaField `json:"activeFields"`
	EntryCount   int           `json:"entryCount"`
}

type FinalState struct {
	FieldNames []string `json:"fieldNames"`
	FieldCount int      `json:"fieldCount"`
}

type CommPair struct {
	DeltaA   int  `json:"deltaA"`
	DeltaB   int  `json:"deltaB"`
	Commutes bool `json:"commutes"`
}

type GoldenVectors struct {
	InitialFields        []SchemaField `json:"initialFields"`
	Deltas               []Delta       `json:"deltas"`
	ExpectedReplayStates []ReplayState `json:"expectedReplayStates"`
	ExpectedFinalState   FinalState    `json:"expectedFinalState"`
	CommutativePairs     []CommPair    `json:"commutativePairs"`
}

func applyDelta(schema []SchemaEntry, delta Delta) []SchemaEntry {
	m := make(map[string]SchemaEntry)
	for _, e := range schema {
		if existing, ok := m[e.Field.Name]; ok {
			m[e.Field.Name] = SchemaEntry{Field: e.Field, Weight: existing.Weight + e.Weight}
		} else {
			m[e.Field.Name] = e
		}
	}
	for _, f := range delta.Retract {
		if existing, ok := m[f.Name]; ok {
			m[f.Name] = SchemaEntry{Field: f, Weight: existing.Weight - 1}
		} else {
			m[f.Name] = SchemaEntry{Field: f, Weight: -1}
		}
	}
	for _, f := range delta.Insert {
		if existing, ok := m[f.Name]; ok {
			m[f.Name] = SchemaEntry{Field: f, Weight: existing.Weight + 1}
		} else {
			m[f.Name] = SchemaEntry{Field: f, Weight: 1}
		}
	}
	var result []SchemaEntry
	for _, e := range m {
		if e.Weight != 0 {
			result = append(result, e)
		}
	}
	return result
}

func sortedFieldNames(schema []SchemaEntry) []string {
	var names []string
	for _, e := range schema {
		if e.Weight > 0 {
			names = append(names, e.Field.Name)
		}
	}
	sort.Strings(names)
	return names
}

func activeCount(schema []SchemaEntry) int {
	count := 0
	for _, e := range schema {
		if e.Weight > 0 {
			count++
		}
	}
	return count
}

func sliceEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: go run . <path-to-json>")
		os.Exit(1)
	}

	data, err := os.ReadFile(os.Args[1])
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to read: %v\n", err)
		os.Exit(1)
	}

	var vectors GoldenVectors
	if err := json.Unmarshal(data, &vectors); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to parse: %v\n", err)
		os.Exit(1)
	}

	// Initialize
	schema := make([]SchemaEntry, len(vectors.InitialFields))
	for i, f := range vectors.InitialFields {
		schema[i] = SchemaEntry{Field: f, Weight: 1}
	}

	// Replay
	fmt.Println("--- Replaying deltas ---")
	for i, delta := range vectors.Deltas {
		schema = applyDelta(schema, delta)
		active := activeCount(schema)
		expected := vectors.ExpectedReplayStates[i].EntryCount
		if active != expected {
			fmt.Fprintf(os.Stderr, "FAIL: Delta %d count mismatch: expected %d, got %d\n", i, expected, active)
			os.Exit(1)
		}
		fmt.Printf("  Delta %d: %d fields ✓\n", i, active)
	}

	// Final
	fmt.Println("--- Final state ---")
	finalNames := sortedFieldNames(schema)
	if !sliceEqual(finalNames, vectors.ExpectedFinalState.FieldNames) {
		fmt.Fprintf(os.Stderr, "FAIL: Final names mismatch\n")
		os.Exit(1)
	}
	if activeCount(schema) != vectors.ExpectedFinalState.FieldCount {
		fmt.Fprintf(os.Stderr, "FAIL: Final count mismatch\n")
		os.Exit(1)
	}
	fmt.Printf("  Final: %d fields [%s] ✓\n", len(finalNames), join(finalNames))

	// Commutativity
	fmt.Println("--- Commutativity ---")
	initialSchema := make([]SchemaEntry, len(vectors.InitialFields))
	for i, f := range vectors.InitialFields {
		initialSchema[i] = SchemaEntry{Field: f, Weight: 1}
	}
	for _, pair := range vectors.CommutativePairs {
		ab := applyDelta(applyDelta(initialSchema, vectors.Deltas[pair.DeltaA]), vectors.Deltas[pair.DeltaB])
		ba := applyDelta(applyDelta(initialSchema, vectors.Deltas[pair.DeltaB]), vectors.Deltas[pair.DeltaA])
		if !sliceEqual(sortedFieldNames(ab), sortedFieldNames(ba)) {
			fmt.Fprintf(os.Stderr, "FAIL: Deltas (%d,%d) do not commute\n", pair.DeltaA, pair.DeltaB)
			os.Exit(1)
		}
		fmt.Printf("  Deltas (%d,%d) commute ✓\n", pair.DeltaA, pair.DeltaB)
	}

	fmt.Println("\nAll golden vectors passed! (Go oracle #6)")
}

func join(s []string) string {
	result := ""
	for i, v := range s {
		if i > 0 {
			result += ", "
		}
		result += v
	}
	return result
}
