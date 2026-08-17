import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense, useEffect } from "react";
import { Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const AuthorizePage = lazy(() => import("./pages/AuthorizePage"));
const ObservatoryPage = lazy(() => import("./pages/ObservatoryPage"));
const WasmLabPage = lazy(() => import("./pages/WasmLabPage"));

function RouteLoader() {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--muted-foreground)", fontFamily: "monospace" }}>loading selected interface…</div>;
}

function LegacyPasskeyRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => setLocation("/authorize", { replace: true }), [setLocation]);
  return <RouteLoader />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/authorize"}><Suspense fallback={<RouteLoader />}><AuthorizePage /></Suspense></Route>
      <Route path={"/passkey-proposal"} component={LegacyPasskeyRedirect} />
      <Route path={"/observatory"}><Suspense fallback={<RouteLoader />}><ObservatoryPage /></Suspense></Route>
      <Route path={"/wasm-lab"}><Suspense fallback={<RouteLoader />}><WasmLabPage /></Suspense></Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    const reloadKey = "zeta-pages-lazy-chunk-recovery";
    const onLazyChunkError = (event: Event) => {
      const preloadEvent = event as Event & { preventDefault(): void };
      preloadEvent.preventDefault();
      if (sessionStorage.getItem(reloadKey) === "reloaded") return;
      sessionStorage.setItem(reloadKey, "reloaded");
      window.location.reload();
    };
    window.addEventListener("vite:preloadError", onLazyChunkError);
    return () => window.removeEventListener("vite:preloadError", onLazyChunkError);
  }, []);

  return (
    <ErrorBoundary>
      <WouterRouter hook={useHashLocation}>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </WouterRouter>
    </ErrorBoundary>
  );
}

export default App;
