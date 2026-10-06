import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/tokens.css";
import App from "./App.tsx";
import { AuthProvider } from "./lib/AuthContext";
import { ThemeProvider } from "./lib/theme";
import { RevealController } from "./lib/useReveal";
import { BootLoader } from "./components/BootLoader";

// Scroll-reveal hides [data-reveal] elements only when this class exists,
// so if this bundle ever failed to run, all content would stay visible.
document.documentElement.classList.add("js");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <BootLoader />
          <RevealController />
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
