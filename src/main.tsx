import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startPersistence } from "./doc/persist";
import { sanitize } from "./editor/state";
import { App } from "./ui/App";
import "./styles.css";

startPersistence().then(() => {
  sanitize();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
