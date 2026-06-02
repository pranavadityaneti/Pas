import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { AuthProvider } from "./context/AuthContext";
import App from "./App.tsx";
import "./index.css";

// ─── Sentry init ─────────────────────────────────────────────────────────────
// Reads VITE_SENTRY_DSN from build-time env. If unset (local dev w/o DSN),
// init() is skipped — Sentry.captureException becomes a no-op, no warnings.
// Set on Vercel: Project → Settings → Environment Variables → VITE_SENTRY_DSN.
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' locally, 'production' on Vercel build
    sendDefaultPii: true,
    // Conservative perf-trace sampling — bump later if we want richer perf data.
    tracesSampleRate: 0.1,
    // Session-replay disabled by default (privacy + cost). Enable per-route later if useful.
  });
  console.log("[Sentry] initialised — env:", import.meta.env.MODE);
} else {
  console.log("[Sentry] VITE_SENTRY_DSN not set — Sentry init skipped (no-op).");
}

// ─── Render with Sentry ErrorBoundary ────────────────────────────────────────
// Any thrown render-time error in the React tree below this point is captured
// to Sentry and shown as the fallback UI instead of a white screen.
createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary
    fallback={({ resetError }) => (
      <div style={{ padding: 32, fontFamily: "system-ui", maxWidth: 540, margin: "10vh auto" }}>
        <h1 style={{ color: "#b42926", marginBottom: 12 }}>Something went wrong.</h1>
        <p style={{ color: "#374151", marginBottom: 20 }}>
          The error has been reported. Try reloading the page; if the problem persists,
          our team will see it in monitoring.
        </p>
        <button
          onClick={resetError}
          style={{
            background: "#111827",
            color: "white",
            border: "none",
            padding: "10px 18px",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    )}
  >
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </Sentry.ErrorBoundary>
);
