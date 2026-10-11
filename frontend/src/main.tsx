import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/tokens.css";
import App from "./App.tsx";
import { AuthProvider } from "./lib/AuthContext";
import { ThemeProvider } from "./lib/theme";
import { RevealController } from "./lib/useReveal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { API_BASE_URL } from "./lib/config";

// Scroll-reveal hides [data-reveal] elements only when this class exists,
// so if this bundle ever failed to run, all content would stay visible.
document.documentElement.classList.add("js");

// The free Render tier sleeps when idle and takes up to a minute to wake. Poke
// it the moment the site opens so it is already awake by the time a visitor
// scrolls to a section or opens the login page. Fire-and-forget; failure is fine.
fetch(`${API_BASE_URL}/health/`, { cache: "no-store" }).catch(() => {});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <RevealController />
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
