// hatgraph/render — read the live cluster's Hat + HatBinding state
// and emit a Graphviz DOT file capturing nodes + edges per the
// type table in README.md. Standalone binary; uses only the
// kubeconfig env / default loading, no operator deps.
//
//	go run ./render.go --out hatgraph.dot
//	dot -Tsvg hatgraph.dot -o hatgraph.svg
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/clientcmd"
)

var (
	outPath = flag.String("out", "hatgraph.dot", "DOT output path; - for stdout")
)

func main() {
	flag.Parse()

	cfg, err := clientcmd.BuildConfigFromFlags("", clientcmd.RecommendedHomeFile)
	if err != nil {
		die("kubeconfig: %v", err)
	}
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		die("dynamic client: %v", err)
	}

	ctx := context.Background()
	hatGVR := schema.GroupVersionResource{Group: "society.zeta.io", Version: "v1alpha1", Resource: "hats"}
	hbGVR := schema.GroupVersionResource{Group: "society.zeta.io", Version: "v1alpha1", Resource: "hatbindings"}

	hats, err := dyn.Resource(hatGVR).List(ctx, metav1.ListOptions{})
	if err != nil {
		die("list hats: %v", err)
	}
	hbs, err := dyn.Resource(hbGVR).Namespace("").List(ctx, metav1.ListOptions{})
	if err != nil {
		die("list hatbindings: %v", err)
	}

	var w io.Writer = os.Stdout
	if *outPath != "-" {
		f, err := os.Create(*outPath)
		if err != nil {
			die("open out: %v", err)
		}
		defer f.Close()
		w = f
	}

	fmt.Fprintln(w, "digraph HatGraph {")
	fmt.Fprintln(w, `  rankdir=LR;`)
	fmt.Fprintln(w, `  node [shape=box, style=rounded];`)

	// Hat nodes (cluster-scoped).
	for _, h := range hats.Items {
		name := h.GetName()
		desc, _, _ := unstructString(h.Object, "spec", "description")
		fmt.Fprintf(w, "  %q [label=%q, color=blue];\n", name, name+"\\n"+truncate(desc, 40))
	}

	// Wearer nodes + wears edges.
	wearers := map[string]bool{}
	for _, b := range hbs.Items {
		wid, _, _ := unstructString(b.Object, "spec", "wearer", "spiffeID")
		hat, _, _ := unstructString(b.Object, "spec", "hat")
		phase, _, _ := unstructString(b.Object, "status", "phase")
		if wid == "" || hat == "" {
			continue
		}
		if !wearers[wid] {
			fmt.Fprintf(w, "  %q [label=%q, shape=ellipse, color=gray];\n",
				wid, shortSpiffe(wid))
			wearers[wid] = true
		}
		edgeColor := "black"
		if phase == "Warmup" {
			edgeColor = "orange"
		} else if phase == "Probation" {
			edgeColor = "red"
		}
		fmt.Fprintf(w, "  %q -> %q [label=%q, color=%s];\n",
			wid, hat, "wears/"+phase, edgeColor)
	}

	// conflicts-with edges (undirected — render as dashed).
	for _, h := range hats.Items {
		name := h.GetName()
		conflicts, _, _ := unstructSlice(h.Object, "spec", "throttles", "conflictsWith")
		for _, c := range conflicts {
			fmt.Fprintf(w, "  %q -> %q [style=dashed, color=red, arrowhead=none, label=\"conflicts\"];\n",
				name, c)
		}
	}

	fmt.Fprintln(w, "}")
}

func unstructString(obj map[string]any, path ...string) (string, bool, error) {
	cur := any(obj)
	for _, p := range path {
		m, ok := cur.(map[string]any)
		if !ok {
			return "", false, nil
		}
		cur, ok = m[p]
		if !ok {
			return "", false, nil
		}
	}
	s, ok := cur.(string)
	return s, ok, nil
}

func unstructSlice(obj map[string]any, path ...string) ([]string, bool, error) {
	cur := any(obj)
	for _, p := range path {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil, false, nil
		}
		cur, ok = m[p]
		if !ok {
			return nil, false, nil
		}
	}
	raw, ok := cur.([]any)
	if !ok {
		return nil, false, nil
	}
	out := make([]string, 0, len(raw))
	for _, v := range raw {
		if s, ok := v.(string); ok {
			out = append(out, s)
		}
	}
	return out, true, nil
}

func shortSpiffe(s string) string {
	if i := strings.LastIndex(s, "/"); i >= 0 && i < len(s)-1 {
		return s[i+1:]
	}
	return s
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

func die(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "hatgraph: "+format+"\n", args...)
	os.Exit(1)
}
