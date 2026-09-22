import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default function Home() {
  const configured = Boolean(process.env.AI_API_KEY?.trim() && process.env.AI_MODEL?.trim());
  return <WorkspaceShell initialMode={configured ? "live" : "demo"} />;
}
