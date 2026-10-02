export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export type Workspace = { id: string; name: string; role: string; currency: string };

export function activeWorkspaceId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("mf_workspace") ?? "";
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const workspaceId = activeWorkspaceId();
  if (workspaceId) headers.set("x-workspace-id", workspaceId);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const message = Array.isArray(error?.message) ? error.message.join(" ") : error?.message;
    throw new Error(message || `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function downloadApiFile(path: string, filename: string) {
  const headers = new Headers();
  const workspaceId = activeWorkspaceId();
  if (workspaceId) headers.set("x-workspace-id", workspaceId);
  const response = await fetch(`${API_URL}${path}`, { headers, credentials: "include" });
  if (!response.ok) throw new Error("Could not download this file.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
