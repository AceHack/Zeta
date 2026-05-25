// Package tick is the operator's structured tick source.
//
// Every state transition in the Hat lifecycle goes through Emit, and
// Emit fans out to all configured sinks: an immutable HatSwap CR
// (durable), a k8s Event (operator-readable for `kubectl describe`),
// a structured log line (Loki picks it up), and an optional NATS
// publish (for reactors that want push instead of poll).
//
// The fan-out is best-effort per sink — a NATS outage does not block
// the CR write; a Loki gap does not block the Event. The HatSwap CR
// is the canonical record, and the operator's reconcile loop will
// retry CR writes on failure (controller-runtime queue semantics).
package tick

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/nats-io/nats.go"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/record"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"

	v1a "github.com/Lucent-Financial-Group/Zeta/full-ai-cluster/k8s/applications/hat-system/operator/api/v1alpha1"
)

// Sinks holds the runtime-resolved per-sink handles. Any nil sink is
// silently skipped, so the operator can run with NATS / Loki / Events
// independently enabled.
type Sinks struct {
	Client   client.Client
	Recorder record.EventRecorder
	NATS     *nats.Conn
	Logger   *slog.Logger
}

// Tick describes a single state transition. The reconciler builds
// one of these per transition and hands it to Emit.
type Tick struct {
	Hat            string
	Wearer         v1a.Wearer
	Event          v1a.SwapEvent
	OccurredAt     time.Time
	Reason         string
	Message        string
	Binding        *v1a.HatBinding
	ThrottleName   string
	PreviousWearer *v1a.PreviousWearer
}

func Emit(ctx context.Context, s Sinks, t Tick) error {
	if t.OccurredAt.IsZero() {
		t.OccurredAt = time.Now().UTC()
	}

	// 1. Durable CR. Write first so a later sink failure leaves the
	// canonical record intact.
	swap := &v1a.HatSwap{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: fmt.Sprintf("%s-%s-", t.Hat, t.Event),
			Namespace:    bindingNamespace(t),
		},
		Spec: v1a.HatSwapSpec{
			Hat:            t.Hat,
			Wearer:         t.Wearer,
			Event:          t.Event,
			OccurredAt:     metav1.NewTime(t.OccurredAt),
			Reason:         t.Reason,
			Message:        t.Message,
			ThrottleName:   t.ThrottleName,
			PreviousWearer: t.PreviousWearer,
		},
	}
	if t.Binding != nil {
		swap.Spec.BindingRef = &v1a.BindingReference{
			Name:      t.Binding.Name,
			Namespace: t.Binding.Namespace,
			UID:       string(t.Binding.UID),
		}
	}
	if s.Client != nil {
		if err := s.Client.Create(ctx, swap); err != nil {
			return fmt.Errorf("emit HatSwap CR: %w", err)
		}
	}

	// 2. Best-effort k8s Event (drops if recorder is nil).
	if s.Recorder != nil && t.Binding != nil {
		eventType := corev1.EventTypeNormal
		if t.Event == v1a.Throttled || t.Event == v1a.Probation {
			eventType = corev1.EventTypeWarning
		}
		s.Recorder.Eventf(t.Binding, eventType, string(t.Event),
			"%s: %s", t.Reason, t.Message)
	}

	// 3. Best-effort structured log (Loki picks it up via the standard
	// Alloy → Loki pipeline already running in the cluster).
	if s.Logger != nil {
		s.Logger.LogAttrs(ctx, slog.LevelInfo, "hat.tick",
			slog.String("hat", t.Hat),
			slog.String("wearer.spiffeID", t.Wearer.SpiffeID),
			slog.String("event", string(t.Event)),
			slog.String("reason", t.Reason),
			slog.String("throttle", t.ThrottleName),
			slog.Time("occurredAt", t.OccurredAt),
		)
	}

	// 4. Best-effort NATS publish.
	if s.NATS != nil {
		payload, err := json.Marshal(struct {
			Hat        string         `json:"hat"`
			Wearer     v1a.Wearer     `json:"wearer"`
			Event      v1a.SwapEvent  `json:"event"`
			Reason     string         `json:"reason"`
			Throttle   string         `json:"throttle,omitempty"`
			OccurredAt time.Time      `json:"occurredAt"`
		}{
			Hat: t.Hat, Wearer: t.Wearer, Event: t.Event,
			Reason: t.Reason, Throttle: t.ThrottleName,
			OccurredAt: t.OccurredAt,
		})
		if err != nil {
			// Marshal failure is operator-bug territory; surface but
			// don't fail the tick — CR is already written.
			ctrl.Log.Error(err, "tick.Emit: marshal NATS payload")
		} else {
			subject := fmt.Sprintf("zeta.society.hats.%s.%s", t.Hat, t.Event)
			if pubErr := s.NATS.Publish(subject, payload); pubErr != nil {
				ctrl.Log.Error(pubErr, "tick.Emit: NATS publish",
					"subject", subject)
			}
		}
	}

	return nil
}

func bindingNamespace(t Tick) string {
	if t.Binding != nil && t.Binding.Namespace != "" {
		return t.Binding.Namespace
	}
	return "hat-system"
}
