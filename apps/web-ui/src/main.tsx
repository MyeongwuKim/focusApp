import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ThemeController } from "./components/ThemeController";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeController />
    <App />
  </StrictMode>
);
