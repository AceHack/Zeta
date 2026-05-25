// Package controller — reconcilers for Hat / HatBinding / HatPolicy.
//
// The reconcile loop is the operator's tick source:
//
//   create/update event ─┐
//   delete event ────────┼──► Reconcile() ──► state transition ──► tick.Emit()
//   periodic resync ─────┘
//
// Each transition emits exactly one tick. Throttle decisions happen
// inside Reconcile — a denied bind produces a Throttled tick (CR +
// Event + log + NATS) but does not advance the binding past Pending.
package controller

import (
	"context"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"

	v1a "github.com/Lucent-Financial-Group/Zeta/full-ai-cluster/k8s/applications/hat-system/operator/api/v1alpha1"
	"github.com/Lucent-Financial-Group/Zeta/full-ai-cluster/k8s/applications/hat-system/operator/internal/tick"
)

// HatBindingReconciler reconciles HatBinding lifecycle.
type HatBindingReconciler struct {
	client.Client
	Scheme *runtime.Scheme
	Sinks  tick.Sinks
}

// +kubebuilder:rbac:groups=society.zeta.io,resources=hatbindings,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=society.zeta.io,resources=hatbindings/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=society.zeta.io,resources=hats,verbs=get;list;watch
// +kubebuilder:rbac:groups=society.zeta.io,resources=hats/status,verbs=update;patch
// +kubebuilder:rbac:groups=society.zeta.io,resources=hatpolicies,verbs=get;list;watch
// +kubebuilder:rbac:groups=society.zeta.io,resources=hatswaps,verbs=create;list

func (r *HatBindingReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	lg := log.FromContext(ctx).WithValues("hatbinding", req.NamespacedName)

	binding := &v1a.HatBinding{}
	if err := r.Get(ctx, req.NamespacedName, binding); err != nil {
		if apierrors.IsNotFound(err) {
			// Deletion — handled by finalizer flow in a fuller impl.
			// This skeleton lets the API server reclaim the object;
			// the SwapOff tick was emitted at finalizer time.
			return ctrl.Result{}, nil
		}
		return ctrl.Result{}, err
	}

	hat := &v1a.Hat{}
	if err := r.Get(ctx, client.ObjectKey{Name: binding.Spec.Hat}, hat); err != nil {
		return ctrl.Result{}, fmt.Errorf("fetch hat %q: %w", binding.Spec.Hat, err)
	}

	policy := &v1a.HatPolicy{}
	_ = r.Get(ctx, client.ObjectKey{Name: "default"}, policy)
	throttles := resolveThrottles(hat, policy)

	now := time.Now().UTC()

	switch binding.Status.Phase {
	case "", v1a.PhasePending:
		// Throttle gate. Real impl runs cooldown / quorum /
		// conflict-of-interest / max-bindings-per-wearer checks here.
		// Skeleton just transitions to Warmup if warmup configured,
		// else directly to Active. Throttle rejections would emit
		// v1a.Throttled tick and short-circuit return.
		if throttles.WarmupSeconds > 0 {
			endsAt := now.Add(time.Duration(throttles.WarmupSeconds) * time.Second)
			binding.Status.Phase = v1a.PhaseWarmup
			binding.Status.WarmupEndsAt = &metav1.Time{Time: endsAt}
			binding.Status.BoundAt = &metav1.Time{Time: now}
			if err := r.Status().Update(ctx, binding); err != nil {
				return ctrl.Result{}, err
			}
			_ = tick.Emit(ctx, r.Sinks, tick.Tick{
				Hat: hat.Name, Wearer: binding.Spec.Wearer,
				Event: v1a.WarmupBegin, OccurredAt: now,
				Reason: "WarmupStart",
				Message: fmt.Sprintf("probation until %s", endsAt.Format(time.RFC3339)),
				Binding: binding,
			})
			return ctrl.Result{RequeueAfter: time.Until(endsAt)}, nil
		}
		return r.activate(ctx, binding, hat, now)

	case v1a.PhaseWarmup:
		if binding.Status.WarmupEndsAt != nil && now.Before(binding.Status.WarmupEndsAt.Time) {
			return ctrl.Result{RequeueAfter: time.Until(binding.Status.WarmupEndsAt.Time)}, nil
		}
		_ = tick.Emit(ctx, r.Sinks, tick.Tick{
			Hat: hat.Name, Wearer: binding.Spec.Wearer,
			Event: v1a.WarmupEnd, OccurredAt: now,
			Reason: "WarmupComplete", Binding: binding,
		})
		return r.activate(ctx, binding, hat, now)

	case v1a.PhaseActive, v1a.PhaseProbation, v1a.PhaseRevoked:
		// Nothing to do at steady state. Anomaly-detection reactors
		// flip Active → Probation by patching status; that triggers
		// a fresh reconcile via watch.
		lg.V(1).Info("steady state", "phase", binding.Status.Phase)
		return ctrl.Result{}, nil
	}

	return ctrl.Result{}, nil
}

func (r *HatBindingReconciler) activate(ctx context.Context, binding *v1a.HatBinding, hat *v1a.Hat, now time.Time) (ctrl.Result, error) {
	binding.Status.Phase = v1a.PhaseActive
	binding.Status.EffectiveAuthority = &hat.Spec.Authority
	if binding.Status.BoundAt == nil {
		binding.Status.BoundAt = &metav1.Time{Time: now}
	}
	if err := r.Status().Update(ctx, binding); err != nil {
		return ctrl.Result{}, err
	}
	_ = tick.Emit(ctx, r.Sinks, tick.Tick{
		Hat: hat.Name, Wearer: binding.Spec.Wearer,
		Event: v1a.SwapOn, OccurredAt: now,
		Reason: "BindingActive", Binding: binding,
	})
	return ctrl.Result{}, nil
}

// SetupWithManager wires HatBinding into the controller manager.
func (r *HatBindingReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&v1a.HatBinding{}).
		Complete(r)
}

// resolveThrottles merges per-Hat overrides over policy defaults.
type resolvedThrottles struct {
	CooldownSeconds          int
	StickyAttributionSeconds int
	WarmupSeconds            int
	QuorumGated              bool
	QuorumSize               int
	ConflictsWith            []string
}

func resolveThrottles(h *v1a.Hat, p *v1a.HatPolicy) resolvedThrottles {
	r := resolvedThrottles{
		CooldownSeconds:          p.Spec.Throttles.CooldownSeconds,
		StickyAttributionSeconds: p.Spec.Throttles.StickyAttributionSeconds,
		WarmupSeconds:            p.Spec.Throttles.WarmupSeconds,
		QuorumSize:               p.Spec.Throttles.QuorumDefaultSize,
	}
	if h.Spec.Throttles == nil {
		return r
	}
	if h.Spec.Throttles.CooldownSeconds != nil {
		r.CooldownSeconds = *h.Spec.Throttles.CooldownSeconds
	}
	if h.Spec.Throttles.StickyAttributionSeconds != nil {
		r.StickyAttributionSeconds = *h.Spec.Throttles.StickyAttributionSeconds
	}
	if h.Spec.Throttles.WarmupSeconds != nil {
		r.WarmupSeconds = *h.Spec.Throttles.WarmupSeconds
	}
	if h.Spec.Throttles.QuorumGated != nil {
		r.QuorumGated = *h.Spec.Throttles.QuorumGated
	}
	if h.Spec.Throttles.QuorumSize != nil {
		r.QuorumSize = *h.Spec.Throttles.QuorumSize
	}
	r.ConflictsWith = h.Spec.Throttles.ConflictsWith
	return r
}
