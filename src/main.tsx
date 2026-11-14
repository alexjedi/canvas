import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installGroups } from "./doc/groups";
import { startPersistence } from "./doc/persist";
import { onCommit } from "./doc/store";
import { sanitize } from "./editor/state";
import { App } from "./ui/App";
import "./styles.css";

installGroups();

startPersistence().then(() => {
  sanitize();
  onCommit(sanitize);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
