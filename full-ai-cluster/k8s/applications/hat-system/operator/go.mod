module github.com/Lucent-Financial-Group/Zeta/full-ai-cluster/k8s/applications/hat-system/operator

go 1.23

// Versions pinned to the kubebuilder v4 + controller-runtime v0.19 line
// (the matched set for k8s 1.31 / 1.32 cluster targets). Bump together
// when upgrading; mixing controller-runtime majors with mismatched
// client-go usually breaks builds at compile time.

require (
	github.com/nats-io/nats.go v1.37.0
	github.com/onsi/ginkgo/v2 v2.21.0
	github.com/onsi/gomega v1.35.1
	github.com/spiffe/go-spiffe/v2 v2.4.0
	k8s.io/api v0.32.0
	k8s.io/apimachinery v0.32.0
	k8s.io/client-go v0.32.0
	sigs.k8s.io/controller-runtime v0.19.3
)
