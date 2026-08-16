import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Router as WouterRouter, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const AuthorizePage = lazy(() => import("./pages/AuthorizePage"));
const ObservatoryPage = lazy(() => import("./pages/ObservatoryPage"));
const WasmLabPage = lazy(() => import("./pages/WasmLabPage"));

function RouteLoader() {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--muted-foreground)", fontFamily: "monospace" }}>loading selected interface…</div>;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/authorize"}><Suspense fallback={<RouteLoader />}><AuthorizePage /></Suspense></Route>
      <Route path={"/observatory"}><Suspense fallback={<RouteLoader />}><ObservatoryPage /></Suspense></Route>
      <Route path={"/wasm-lab"}><Suspense fallback={<RouteLoader />}><WasmLabPage /></Suspense></Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const base = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <ErrorBoundary>
      <WouterRouter base={base}>
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
