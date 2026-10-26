import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { bootNative } from "./player/nativeBridge";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import App from "./App";

console.log("Main.tsx: Script started");

/**
 * URIError ("URI malformed") is thrown by encodeURI/decodeURI internals — most
 * often by Capacitor converting a media path that contains a bare "%". These
 * used to bubble up as uncaught render errors and blank the player. Swallow the
 * URIError family specifically (log a breadcrumb for diagnostics) so one bad
 * path can never take the whole screen down. Every other error still surfaces.
 */
function isUriError(e: unknown): boolean {
  const err = e as { name?: string; message?: string } | null;
  return !!err && (err.name === "URIError" || /URI malformed|malformed URI/i.test(err.message || ""));
}
try {
  window.addEventListener("error", (ev) => {
    if (isUriError(ev.error) || /URI malformed/i.test(ev.message || "")) {
      try {
        localStorage.setItem("au.lastUriError", JSON.stringify({
          msg: ev.message || String(ev.error),
          at: Date.now(),
        }));
      } catch { /* ignore */ }
      ev.preventDefault();
    }
  });
  window.addEventListener("unhandledrejection", (ev) => {
    if (isUriError(ev.reason)) {
      try { localStorage.setItem("au.lastUriError", JSON.stringify({ msg: String(ev.reason), at: Date.now() })); } catch { /* ignore */ }
      ev.preventDefault();
    }
  });
} catch { /* ignore */ }

import { AuthProvider } from "./auth/AuthContext";

function Root() {
  useEffect(() => {
    console.log("Root Component: Mounted");
    // Boot native features
    bootNative()
      .then(() => console.log("Native Boot: Completed"))
      .catch((err) => console.error("Native Boot: Failed", err));

    // Hide fallback
    const fb = document.getElementById("fallback");
    if (fb) {
      fb.style.display = "none";
      console.log("Fallback: Hidden");
    }
  }, []);

  return (
    <StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  console.log("Root Element: Found, rendering...");
  createRoot(rootEl).render(<Root />);
} else {
  console.error("Root Element: NOT FOUND");
}
