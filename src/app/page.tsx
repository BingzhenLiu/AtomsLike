import { WorkspaceShell } from "@/components/workspace/workspace-shell";

/**
 * The workspace mode depends on server-side environment variables, which a
 * container only injects at run time. Rendering per request keeps the check
 * honest instead of freezing whatever the build machine happened to have.
 */
export const dynamic = "force-dynamic";

export default function Home() {
  const configured = Boolean(process.env.AI_API_KEY?.trim() && process.env.AI_MODEL?.trim());
  return <WorkspaceShell initialMode={configured ? "live" : "demo"} />;
}
