// Package v1alpha1 contains the Go type definitions matching the
// CRDs under ../../crds/. Kept hand-authored (not kubebuilder-
// regenerated) so the on-disk CRD YAML stays the source of truth —
// the operator is one consumer of the schema; OPA, ArgoCD diffs,
// and `kubectl explain` are all equal peers and they read the YAML.
//
// If you DO regenerate with `controller-gen`, mirror the changes
// back into ../../crds/*.yaml in the same PR — never let the two
// drift.
package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/scheme"
)

var (
	GroupVersion = schema.GroupVersion{Group: "society.zeta.io", Version: "v1alpha1"}

	SchemeBuilder = &scheme.Builder{GroupVersion: GroupVersion}

	AddToScheme = SchemeBuilder.AddToScheme
)

func init() {
	SchemeBuilder.Register(
		&Hat{}, &HatList{},
		&HatBinding{}, &HatBindingList{},
		&HatSwap{}, &HatSwapList{},
		&HatPolicy{}, &HatPolicyList{},
	)
}

// -------------------------------------------------------------------
// Hat
// -------------------------------------------------------------------

// +kubebuilder:object:root=true
// +kubebuilder:resource:scope=Cluster
// +kubebuilder:subresource:status
type Hat struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              HatSpec   `json:"spec"`
	Status            HatStatus `json:"status,omitempty"`
}

// HatSpec — Max's compression: hat = skills + opa/rbac. Skills
// describe what the wearer CAN do; Authority describes what the
// wearer is PERMITTED to do. The operator only enforces Authority;
// Skills are matchable metadata for assignment reactors.
// HatSpec — Max's compression: hat = skills + opa/rbac. Skills
// describe what the wearer CAN do; Authority describes what the
// wearer is PERMITTED to do. Supervises declares supervisory edges
// in the hat hierarchy (DAG; no cycles). The operator only enforces
// Authority + Supervises edges; Skills are matchable metadata for
// assignment reactors.
//
// Why this is hat-not-cage despite supervisory hierarchy: every hat
// in this spec is time-bounded by cooldown / warmup / sticky-
// attribution / succession. Supervisory weight rides on the ROLE,
// not on any individual wearer. A supervisor who oversteps gets
// swapped off; the hat persists and the next wearer inherits the
// same constraints. Cages live on wearers; this lives on roles.
type HatSpec struct {
	Description string         `json:"description,omitempty"`
	Skills      []Skill        `json:"skills,omitempty"`
	Supervises  []string       `json:"supervises,omitempty"`
	Authority   HatAuthority   `json:"authority"`
	Throttles   *HatThrottles  `json:"throttles,omitempty"`
}

type Skill struct {
	Name       string `json:"name"`
	Level      string `json:"level,omitempty"`      // novice | intermediate | expert
	ProvidedBy string `json:"providedBy,omitempty"` // e.g. claude-plugins-official/foo
}

type HatAuthority struct {
	Namespaces []string         `json:"namespaces,omitempty"`
	Rules      []AuthorityRule  `json:"rules,omitempty"`
}

type AuthorityRule struct {
	Verbs     []string `json:"verbs"`
	Resources []string `json:"resources"`
	APIGroups []string `json:"apiGroups,omitempty"`
}

type HatThrottles struct {
	CooldownSeconds          *int     `json:"cooldownSeconds,omitempty"`
	StickyAttributionSeconds *int     `json:"stickyAttributionSeconds,omitempty"`
	WarmupSeconds            *int     `json:"warmupSeconds,omitempty"`
	QuorumGated              *bool    `json:"quorumGated,omitempty"`
	QuorumSize               *int     `json:"quorumSize,omitempty"`
	ConflictsWith            []string `json:"conflictsWith,omitempty"`
}

type HatStatus struct {
	Reputation       int64               `json:"reputation,omitempty"`
	CurrentWearers   []string            `json:"currentWearers,omitempty"`
	LifetimeWearers  int64               `json:"lifetimeWearers,omitempty"`
	Conditions       []metav1.Condition  `json:"conditions,omitempty"`
}

// +kubebuilder:object:root=true
type HatList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []Hat `json:"items"`
}

// -------------------------------------------------------------------
// HatBinding
// -------------------------------------------------------------------

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
type HatBinding struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              HatBindingSpec   `json:"spec"`
	Status            HatBindingStatus `json:"status,omitempty"`
}

type HatBindingSpec struct {
	Hat         string         `json:"hat"`
	Wearer      Wearer         `json:"wearer"`
	CosignedBy  []Cosignature  `json:"cosignedBy,omitempty"`
	RequestedAt *metav1.Time   `json:"requestedAt,omitempty"`
}

type Wearer struct {
	SpiffeID          string                   `json:"spiffeID"`
	ServiceAccountRef *ServiceAccountReference `json:"serviceAccountRef,omitempty"`
}

type ServiceAccountReference struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}

type Cosignature struct {
	SpiffeID    string      `json:"spiffeID"`
	SignedAt    metav1.Time `json:"signedAt"`
	Attestation string      `json:"attestation,omitempty"`
}

// HatBindingPhase is the lifecycle phase of a binding. Transitions
// drive the operator's tick emit — every transition produces exactly
// one HatSwap event.
type HatBindingPhase string

const (
	PhasePending   HatBindingPhase = "Pending"
	PhaseWarmup    HatBindingPhase = "Warmup"
	PhaseActive    HatBindingPhase = "Active"
	PhaseProbation HatBindingPhase = "Probation"
	PhaseRevoked   HatBindingPhase = "Revoked"
)

type HatBindingStatus struct {
	Phase                   HatBindingPhase    `json:"phase,omitempty"`
	EffectiveAuthority      *HatAuthority      `json:"effectiveAuthority,omitempty"`
	BoundAt                 *metav1.Time       `json:"boundAt,omitempty"`
	WarmupEndsAt            *metav1.Time       `json:"warmupEndsAt,omitempty"`
	StickyAttributionEndsAt *metav1.Time       `json:"stickyAttributionEndsAt,omitempty"`
	Conditions              []metav1.Condition `json:"conditions,omitempty"`
}

// +kubebuilder:object:root=true
type HatBindingList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []HatBinding `json:"items"`
}

// -------------------------------------------------------------------
// HatSwap (append-only tick events)
// -------------------------------------------------------------------

// SwapEvent enumerates every transition the operator emits as a tick.
// Adding a new value here = adding a new tick class downstream
// reactors can subscribe to — keep it small + meaningful.
type SwapEvent string

const (
	SwapOn      SwapEvent = "SwapOn"
	SwapOff     SwapEvent = "SwapOff"
	WarmupBegin SwapEvent = "WarmupBegin"
	WarmupEnd   SwapEvent = "WarmupEnd"
	Probation   SwapEvent = "Probation"
	QuorumGrant SwapEvent = "QuorumGrant"
	Throttled   SwapEvent = "Throttled"
)

// +kubebuilder:object:root=true
type HatSwap struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              HatSwapSpec `json:"spec"`
}

type HatSwapSpec struct {
	Hat             string             `json:"hat"`
	Wearer          Wearer             `json:"wearer"`
	Event           SwapEvent          `json:"event"`
	OccurredAt      metav1.Time        `json:"occurredAt"`
	Reason          string             `json:"reason,omitempty"`
	Message         string             `json:"message,omitempty"`
	BindingRef      *BindingReference  `json:"bindingRef,omitempty"`
	ThrottleName    string             `json:"throttleName,omitempty"`
	PreviousWearer  *PreviousWearer    `json:"previousWearer,omitempty"`
}

type BindingReference struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	UID       string `json:"uid,omitempty"`
}

type PreviousWearer struct {
	SpiffeID  string       `json:"spiffeID"`
	RevokedAt *metav1.Time `json:"revokedAt,omitempty"`
}

// +kubebuilder:object:root=true
type HatSwapList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []HatSwap `json:"items"`
}

// -------------------------------------------------------------------
// HatPolicy (cluster-wide defaults singleton)
// -------------------------------------------------------------------

// +kubebuilder:object:root=true
// +kubebuilder:resource:scope=Cluster
// +kubebuilder:subresource:status
type HatPolicy struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              HatPolicySpec   `json:"spec"`
	Status            HatPolicyStatus `json:"status,omitempty"`
}

type HatPolicySpec struct {
	Throttles         PolicyThrottles `json:"throttles,omitempty"`
	SwapRetentionDays int             `json:"swapRetentionDays,omitempty"`
	TickEmit          TickEmit        `json:"tickEmit,omitempty"`
}

type PolicyThrottles struct {
	CooldownSeconds          int `json:"cooldownSeconds,omitempty"`
	StickyAttributionSeconds int `json:"stickyAttributionSeconds,omitempty"`
	WarmupSeconds            int `json:"warmupSeconds,omitempty"`
	MaxBindingsPerWearer     int `json:"maxBindingsPerWearer,omitempty"`
	MaxNewHatsPerDay         int `json:"maxNewHatsPerDay,omitempty"`
	QuorumDefaultSize        int `json:"quorumDefaultSize,omitempty"`
}

type TickEmit struct {
	NATSSubject              string `json:"natsSubject,omitempty"`
	EnableLokiStructuredLogs bool   `json:"enableLokiStructuredLogs,omitempty"`
	EnableEvents             bool   `json:"enableEvents,omitempty"`
}

type HatPolicyStatus struct {
	LastReconciledAt *metav1.Time `json:"lastReconciledAt,omitempty"`
	ActiveHats       int          `json:"activeHats,omitempty"`
	ActiveBindings   int          `json:"activeBindings,omitempty"`
	SwapsLast24h     int          `json:"swapsLast24h,omitempty"`
}

// +kubebuilder:object:root=true
type HatPolicyList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []HatPolicy `json:"items"`
}

// DeepCopyObject glue — minimal hand-rolled stubs so this file compiles
// without controller-gen having been run yet. Replace with generated
// `zz_generated.deepcopy.go` from `make generate` once kubebuilder is
// bootstrapped (kubebuilder init + the four `kubebuilder create api`
// invocations described in the operator README).
func (h *Hat) DeepCopyObject() runtime.Object         { return h }
func (h *HatList) DeepCopyObject() runtime.Object     { return h }
func (b *HatBinding) DeepCopyObject() runtime.Object  { return b }
func (b *HatBindingList) DeepCopyObject() runtime.Object { return b }
func (s *HatSwap) DeepCopyObject() runtime.Object     { return s }
func (s *HatSwapList) DeepCopyObject() runtime.Object { return s }
func (p *HatPolicy) DeepCopyObject() runtime.Object   { return p }
func (p *HatPolicyList) DeepCopyObject() runtime.Object { return p }
