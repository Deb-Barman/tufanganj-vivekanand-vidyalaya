import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/tokens.css";
import "./styles/mobile.css";
import App from "./App.tsx";
import { AuthProvider } from "./lib/AuthContext";
import { ThemeProvider } from "./lib/theme";
import { RevealController } from "./lib/useReveal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LightboxRoot } from "./components/media/Lightbox";
import { API_BASE_URL } from "./lib/config";
import { installLinkPrefetch, preloadPath, preloadPublicPages } from "./lib/routePreload";

// Scroll-reveal hides [data-reveal] elements only when this class exists,
// so if this bundle ever failed to run, all content would stay visible.
document.documentElement.classList.add("js");

// The free Render tier sleeps when idle and takes up to a minute to wake. Poke
// it the moment the site opens so it is already awake by the time a visitor
// scrolls to a section or opens the login page. Fire-and-forget; failure is fine.
fetch(`${API_BASE_URL}/health/`, { cache: "no-store" }).catch(() => {});

function mount() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <RevealController />
            <LightboxRoot />
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </StrictMode>
  );
  installLinkPrefetch();
  preloadPublicPages();
}

// Start downloading the page for the current URL right now and wait for it (at most 2.5 s) before the first
// render, so the first thing a visitor sees is the page's own skeleton, not a generic one that is then replaced.
// (The opening intro screen covers this moment, so the wait is not visible.)
void Promise.race([preloadPath(location.pathname), new Promise<void>((r) => setTimeout(r, 2500))]).then(mount, mount);
