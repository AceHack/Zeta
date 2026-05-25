// hat-system-operator entrypoint.
//
// Wires the four CRD controllers + the validating webhook + the
// tick sinks (NATS, slog→Loki, k8s Events, the HatSwap CR). Reads
// the cluster-wide HatPolicy singleton at startup to resolve
// tick-emit config.
package main

import (
	"flag"
	"log/slog"
	"os"

	"github.com/nats-io/nats.go"
	"k8s.io/apimachinery/pkg/runtime"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/healthz"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"

	v1a "github.com/Lucent-Financial-Group/Zeta/full-ai-cluster/k8s/applications/hat-system/operator/api/v1alpha1"
	"github.com/Lucent-Financial-Group/Zeta/full-ai-cluster/k8s/applications/hat-system/operator/internal/controller"
	"github.com/Lucent-Financial-Group/Zeta/full-ai-cluster/k8s/applications/hat-system/operator/internal/tick"
)

var (
	scheme   = runtime.NewScheme()
	setupLog = ctrl.Log.WithName("setup")
)

func init() {
	utilruntime.Must(clientgoscheme.AddToScheme(scheme))
	utilruntime.Must(v1a.AddToScheme(scheme))
}

func main() {
	var (
		metricsAddr      string
		probeAddr        string
		natsURL          string
		enableLeaderElec bool
	)
	flag.StringVar(&metricsAddr, "metrics-bind-address", ":8080", "")
	flag.StringVar(&probeAddr, "health-probe-bind-address", ":8081", "")
	flag.StringVar(&natsURL, "nats-url",
		"nats://nats.nats.svc.cluster.local:4222",
		"NATS endpoint for tick publish. Set empty to disable NATS emit.")
	flag.BoolVar(&enableLeaderElec, "leader-elect", true, "")
	flag.Parse()

	ctrl.SetLogger(zap.New(zap.UseDevMode(false)))

	var natsConn *nats.Conn
	if natsURL != "" {
		conn, err := nats.Connect(natsURL,
			nats.Name("hat-system-operator"),
			nats.MaxReconnects(-1),
			nats.PingInterval(30),
		)
		if err != nil {
			setupLog.Error(err, "NATS connect failed — continuing without NATS emit")
		} else {
			natsConn = conn
			defer natsConn.Drain()
		}
	}

	mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
		Scheme:                 scheme,
		Metrics:                metricsserver.Options{BindAddress: metricsAddr},
		HealthProbeBindAddress: probeAddr,
		LeaderElection:         enableLeaderElec,
		LeaderElectionID:       "hat-system-operator.society.zeta.io",
	})
	if err != nil {
		setupLog.Error(err, "unable to start manager")
		os.Exit(1)
	}

	sinks := tick.Sinks{
		Client:   mgr.GetClient(),
		Recorder: mgr.GetEventRecorderFor("hat-system-operator"),
		NATS:     natsConn,
		Logger:   slog.New(slog.NewJSONHandler(os.Stdout, nil)),
	}

	if err := (&controller.HatBindingReconciler{
		Client: mgr.GetClient(),
		Scheme: mgr.GetScheme(),
		Sinks:  sinks,
	}).SetupWithManager(mgr); err != nil {
		setupLog.Error(err, "unable to create HatBinding controller")
		os.Exit(1)
	}

	// TODO: register HatReconciler (reputation accumulation) and
	// HatPolicyReconciler (singleton enforcement + status rollup).
	// Stubs intentionally omitted in this scaffold — extend with
	// `kubebuilder create api` once the project is initialized.

	if err := mgr.AddHealthzCheck("healthz", healthz.Ping); err != nil {
		setupLog.Error(err, "unable to set up health check")
		os.Exit(1)
	}
	if err := mgr.AddReadyzCheck("readyz", healthz.Ping); err != nil {
		setupLog.Error(err, "unable to set up ready check")
		os.Exit(1)
	}

	setupLog.Info("starting manager")
	if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
		setupLog.Error(err, "manager exited")
		os.Exit(1)
	}
}
