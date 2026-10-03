import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type TestWorkspace = { id: string; name: string };
export function getTestWorkspaces(): TestWorkspace[] {
  try {
    return JSON.parse(readFileSync(resolve(import.meta.dirname, "../.state/workspaces.json"), "utf8")) as TestWorkspace[];
  } catch {
    return Array.from({ length: 5 }, (_, index) => ({ id: `workspace-pending-${index + 1}`, name: `MarketFlow360 Automation ${index + 1}` }));
  }
}
export function getTestWorkspace(index: number): TestWorkspace {
  const workspace = getTestWorkspaces()[index - 1];
  if (!workspace) throw new Error(`Test workspace index ${index} is invalid; expected 1 through 5.`);
  return workspace;
}
