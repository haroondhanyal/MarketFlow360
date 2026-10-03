"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Workspace } from "./api";

const links = [["/", "▥", "Overview"], ["/leads", "♧", "Leads"], ["/customers", "♙", "Customers"], ["/deals", "◈", "Deals"], ["/tasks", "☑", "Tasks"], ["/campaigns", "➤", "Campaigns"], ["/content", "▦", "Content Calendar"], ["/landing-pages", "⌑", "Landing Pages"], ["/automations", "⚙", "Automations"], ["/integrations", "⇄", "Integrations"], ["/assistant", "✦", "Assistant"], ["/reports", "▤", "Reports"], ["/audit", "▧", "Audit Log"], ["/plans", "◇", "Plans & Billing"], ["/team", "♟", "Team"], ["/platform-admin", "⌘", "Platform Admin"]];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]); const [name, setName] = useState(""); const [profileImage,setProfileImage]=useState<string|null>(null); const [error, setError] = useState(""); const [activeId,setActiveId]=useState("");const [activeRole,setActiveRole]=useState("");const [platformAdmin,setPlatformAdmin]=useState(false);const [menuOpen,setMenuOpen]=useState(false);const [createWorkspaceOpen,setCreateWorkspaceOpen]=useState(false);const [workspaceName,setWorkspaceName]=useState("");const [workspaceType,setWorkspaceType]=useState<"BUSINESS"|"AGENCY">("BUSINESS");const [creatingWorkspace,setCreatingWorkspace]=useState(false);const [workspaceError,setWorkspaceError]=useState("");
  useEffect(() => {
    api<{user:{name:string;profileImage:string|null},workspaces:Workspace[],platformAdmin:boolean }>("/auth/me").then(result => {
      setName(result.user.name); setProfileImage(result.user.profileImage); setWorkspaces(result.workspaces); setPlatformAdmin(result.platformAdmin);
      const saved=localStorage.getItem("mf_workspace");const selected=saved&&result.workspaces.some(w=>w.id===saved)?saved:result.workspaces[0]?.id??"";setActiveId(selected);setActiveRole(result.workspaces.find(w=>w.id===selected)?.role??"");if(selected)localStorage.setItem("mf_workspace",selected);
    }).catch(() => router.replace("/login"));
  }, [router]);
  useEffect(() => {
    const savedTheme = localStorage.getItem("mf_theme") || "soft-gray-light";
    const savedFont = localStorage.getItem("mf_font") || "clean-ui";
    document.documentElement.dataset.theme = ({"vscode-dark-plus":"graphite-dark","vscode-dark-modern":"graphite-modern","vscode-high-contrast":"contrast-black","vscode-light-modern":"soft-gray-light"} as Record<string,string>)[savedTheme] ?? savedTheme;
    document.documentElement.dataset.font = ({vscode:"clean-ui",modern:"modern-sans",mono:"developer-mono"} as Record<string,string>)[savedFont] ?? savedFont;
    const updateProfile = (event: Event) => {
      const user = (event as CustomEvent<{ name: string; profileImage: string | null }>).detail;
      setName(user.name); setProfileImage(user.profileImage);
    };
    window.addEventListener("mf-profile-updated", updateProfile);
    return () => window.removeEventListener("mf-profile-updated", updateProfile);
  }, []);
  async function logout() { await api("/auth/logout", { method: "POST" }).catch(() => undefined); localStorage.removeItem("mf_workspace"); router.replace("/login"); }
  function switchWorkspace(value:string) {
    if(value==="__create_workspace__") { setActiveId(localStorage.getItem("mf_workspace")??activeId); setWorkspaceName(""); setWorkspaceError(""); setCreateWorkspaceOpen(true); return; }
    localStorage.setItem("mf_workspace",value);setActiveId(value);location.reload();
  }
  async function createWorkspace(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setWorkspaceError("");setCreatingWorkspace(true);
    try { const created=await api<Workspace>("/workspaces",{method:"POST",body:JSON.stringify({name:workspaceName.trim(),type:workspaceType})});setWorkspaces(current=>[...current,created]);localStorage.setItem("mf_workspace",created.id);setActiveId(created.id);setCreateWorkspaceOpen(false);location.reload(); }
    catch(e) { setWorkspaceError(e instanceof Error?e.message:"Could not create workspace."); }
    finally { setCreatingWorkspace(false); }
  }
  return <main className="shell">
    <aside className={menuOpen?"sidebar menu-open":"sidebar"}><Link className="brand" href="/"><span className="mark">▥</span>MarketFlow<span>360</span></Link>
      <div className="workspace-label">Workspace</div>
      <select className="workspace" aria-label="Switch workspace" value={activeId} onChange={e=>switchWorkspace(e.target.value)}>
        {workspaces.map(w=><option value={w.id} key={w.id}>{w.name}</option>)}
        <option disabled>────────────</option><option value="__create_workspace__">＋ Create new workspace</option>
      </select>
      <nav aria-label="Main navigation">{links.filter(([href])=>(href!=="/team"||["OWNER","ADMIN"].includes(activeRole))&&(href!=="/platform-admin"||platformAdmin)).map(([href,icon,label])=><Link onClick={()=>setMenuOpen(false)} className={path===href?"nav active":"nav"} href={href} key={href}><span>{icon}</span>{label}</Link>)}</nav>
      <div className="upgrade"><strong>✦ &nbsp;Workspace shortcuts</strong><p>Jump back into your daily work.</p><div className="sidebar-shortcuts"><Link href="/leads">＋ Add or view leads <span>→</span></Link><Link href="/tasks">☑ Open tasks <span>→</span></Link><Link href="/reports">▤ View reports <span>→</span></Link></div></div>
    </aside>
    <section className="main"><header><button className="menu-toggle" aria-label="Toggle navigation" onClick={()=>setMenuOpen(!menuOpen)}>☰</button><label className="search">MarketFlow360 workspace</label><div className="profile"><Link href="/profile" className="profile-link" aria-label="Edit profile">{profileImage?<img src={profileImage} alt=""/>:<b>{name.slice(0,1).toUpperCase() || "M"}</b>}<span>{name || "Loading…"}</span><small>Edit profile</small></Link><button className="logout" onClick={logout}>Log out</button></div></header>
      {error && <p className="error-banner">{error}</p>}<div className="content">{children}</div>
    </section>
    {createWorkspaceOpen&&<div className="workspace-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCreateWorkspaceOpen(false)}}><form className="panel workspace-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title" onSubmit={createWorkspace}><button type="button" className="workspace-modal-close" aria-label="Close" onClick={()=>setCreateWorkspaceOpen(false)}>×</button><h2 id="workspace-modal-title">Create a workspace</h2><p>Give this workspace a name. You can switch between all your workspaces from the menu.</p>{workspaceError&&<div className="form-error">{workspaceError}</div>}<label>Workspace name<input autoFocus value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} minLength={2} maxLength={80} placeholder="My new workspace" required/></label><label>Workspace type<select value={workspaceType} onChange={e=>setWorkspaceType(e.target.value as "BUSINESS"|"AGENCY")}><option value="BUSINESS">Business</option><option value="AGENCY">Agency</option></select></label><div className="workspace-modal-actions"><button className="secondary" type="button" onClick={()=>setCreateWorkspaceOpen(false)}>Cancel</button><button className="primary" disabled={creatingWorkspace}>{creatingWorkspace?"Creating…":"Create workspace"}</button></div></form></div>}
  </main>;
}

export function PageHeading({ title, subtitle }: { title: string; subtitle: string }) { return <div className="title-row"><div><h1>{title}</h1><p>{subtitle}</p></div></div>; }

export function Screen({ children }: { children: React.ReactNode }) { return <WorkspaceShell>{children}</WorkspaceShell>; }
