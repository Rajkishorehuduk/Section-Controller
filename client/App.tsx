// Workaround: swallow benign ResizeObserver loop warnings thrown by some libs
if (typeof window !== "undefined" && (window as any).ResizeObserver) {
  const RO = (window as any).ResizeObserver;
  try {
    (window as any).ResizeObserver = class extends RO {
      constructor(cb: any) {
        super((entries: any) => {
          try {
            cb(entries);
          } catch (err: any) {
            if (
              !(err instanceof Error) ||
              err.message !== "ResizeObserver loop completed with undelivered notifications."
            ) {
              throw err;
            }
            // otherwise ignore the benign browser/runtime error
          }
        });
      }
    };
  } catch (e) {
    // ignore
  }
}

// Additionally filter global error events to stop noisy ResizeObserver messages
if (typeof window !== "undefined") {
  window.addEventListener("error", (ev: ErrorEvent) => {
    const msg = ev?.message || (ev?.error && ev.error.message);
    if (
      typeof msg === "string" &&
      msg.includes("ResizeObserver loop completed with undelivered notifications")
    ) {
      try {
        ev.preventDefault();
        // stop propagation to avoid other handlers
        ev.stopImmediatePropagation?.();
      } catch {}
    }
  });

  window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    const reason = ev?.reason;
    const msg = reason && (reason.message || reason.toString && reason.toString());
    if (typeof msg === "string" && msg.includes("ResizeObserver loop completed with undelivered notifications")) {
      try {
        ev.preventDefault();
      } catch {}
    }
  });
}

import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  Link,
  useLocation,
} from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Occupancy from "./pages/Occupancy";
import { TrainFront } from "lucide-react";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

function Layout() {
  const location = useLocation();
  const linkClass = (path: string) =>
    `px-3 py-1.5 rounded-md text-sm font-medium ${location.pathname === path ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`;

  const formatTime = (d: Date) =>
    new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
  const [time, setTime] = useState<string>(() => formatTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 backdrop-blur supports-[backdrop-filter]:bg-background/70 bg-background border-b">
        <div className="container h-full flex items-center justify-between gap-6">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fab6d1e726f40464da9a859f012a0368c%2F9ae4c51586e549a0b82054d031e6967f?format=webp&width=128"
              alt="Indian Railways"
              className="h-9 w-9 rounded-full border bg-white object-cover"
              loading="eager"
              decoding="async"
            />
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">
                Eastern Railway Control Panel
              </div>
              <div className="text-xs text-muted-foreground">
                Chandanpur ↔ Shaktigarh
              </div>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-4">
            <nav className="flex items-center gap-2">
              <Link to="/" className={linkClass("/")}>
                Dashboard
              </Link>
              <Link to="/occupancy" className={linkClass("/occupancy")}>
                Occupancy
              </Link>
            </nav>
            <div
              className="text-sm sm:text-base font-mono tabular-nums text-muted-foreground"
              aria-label="Clock"
            >
              {time}
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t bg-background/60">
        <div className="container py-3 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Eastern Railway — Panel for directives
          to Station Masters
        </div>
      </footer>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/occupancy" element={<Occupancy />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
