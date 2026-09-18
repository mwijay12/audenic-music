import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { bootNative } from "./player/nativeBridge";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import App from "./App";

console.log("Main.tsx: Script started");

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
