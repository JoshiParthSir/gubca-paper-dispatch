import * as React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installInspectDeterrents } from "./lib/deterrents";

// Live site only, so developers can still debug locally
if (import.meta.env.PROD) installInspectDeterrents();

// Service worker (PWA install + faster repeat visits) on the live site only.
// In development it would interfere with hot reloading, so remove any that
// an earlier build installed on localhost.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  }
}

createRoot(document.getElementById("root")!).render(
  <App />
);
