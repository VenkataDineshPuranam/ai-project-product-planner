import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PlannerWorkspace } from "./PlannerWorkspace";
import { importProjectBundle } from "@/import-export/jsonBundle";
import enterpriseRagProgramJson from "../../sample-data/enterprise-rag-program.json?raw";

// Renders the Stage 8 Enterprise RAG Assistant sample program (150 tasks)
// through the same importProjectBundle validation path a real user import
// would go through, then through the tested scheduling engine (Stage 3)
// and the grid/Gantt UI (Stage 4). Product-management/AI lifecycle
// workspaces, navigation, and persistence wiring are later work per
// docs/IMPLEMENTATION_PLAN.md and docs/PRODUCTION_READINESS_REPORT.md.
const bundle = importProjectBundle(enterpriseRagProgramJson);

function App() {
  return (
    <main style={{ height: "100vh" }}>
      <PlannerWorkspace tasks={bundle.tasks} dependencies={bundle.dependencies} calendars={bundle.calendars} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
