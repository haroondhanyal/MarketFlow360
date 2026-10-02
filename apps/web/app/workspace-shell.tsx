"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Workspace } from "./api";

const links = [["/", "▥", "Overview"], ["/leads", "♧", "Leads"], ["/customers", "♙", "Customers"], ["/deals", "◈", "Deals"], ["/tasks", "☑", "Tasks"], ["/campaigns", "➤", "Campaigns"], ["/content", "▦", "Content Calendar"], ["/landing-pages", "⌑", "Landing Pages"], ["/automations", "⚙", "Automations"], ["/team", "♟", "Team"]];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(); const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]); const [name, setName] = useState(""); const [error, setError] = useState(""); const [activeId,setActiveId]=useState("");const [activeRole,setActiveRole]=useState("");const [menuOpen,setMenuOpen]=useState(false);
  useEffect(() => {
    api<{user:{name:string},workspaces:Workspace[] }>("/auth/me").then(result => {
      setName(result.user.name); setWorkspaces(result.workspaces);
      const saved=localStorage.getItem("mf_workspace");const selected=saved&&result.workspaces.some(w=>w.id===saved)?saved:result.workspaces[0]?.id??"";setActiveId(selected);setActiveRole(result.workspaces.find(w=>w.id===selected)?.role??"");if(selected)localStorage.setItem("mf_workspace",selected);
    }).catch(() => router.replace("/login"));
  }, [router]);
  async function logout() { await api("/auth/logout", { method: "POST" }).catch(() => undefined); localStorage.removeItem("mf_workspace"); router.replace("/login"); }
  return <main className="shell">
    <aside className={menuOpen?"sidebar menu-open":"sidebar"}><Link className="brand" href="/"><span className="mark">▥</span>MarketFlow<span>360</span></Link>
      <div className="workspace-label">Workspace</div>
      <select className="workspace" aria-label="Switch workspace" value={activeId} onChange={e=>{localStorage.setItem("mf_workspace",e.target.value);setActiveId(e.target.value);location.reload();}}>
        {workspaces.map(w=><option value={w.id} key={w.id}>{w.name}</option>)}
      </select>
      <nav aria-label="Main navigation">{links.filter(([href])=>href!=="/team"||["OWNER","ADMIN"].includes(activeRole)).map(([href,icon,label])=><Link onClick={()=>setMenuOpen(false)} className={path===href?"nav active":"nav"} href={href} key={href}><span>{icon}</span>{label}</Link>)}</nav>
      <div className="upgrade"><strong>✦ &nbsp;MarketFlow360</strong><p>Simple tools to manage your customer relationships.</p></div>
    </aside>
    <section className="main"><header><button className="menu-toggle" aria-label="Toggle navigation" onClick={()=>setMenuOpen(!menuOpen)}>☰</button><label className="search">MarketFlow360 workspace</label><div className="profile"><b>{name.slice(0,1).toUpperCase() || "M"}</b> &nbsp; {name || "Loading…"} <button className="logout" onClick={logout}>Log out</button></div></header>
      {error && <p className="error-banner">{error}</p>}<div className="content">{children}</div>
    </section>
  </main>;
}

export function PageHeading({ title, subtitle }: { title: string; subtitle: string }) { return <div className="title-row"><div><h1>{title}</h1><p>{subtitle}</p></div></div>; }

export function Screen({ children }: { children: React.ReactNode }) { return <WorkspaceShell>{children}</WorkspaceShell>; }
