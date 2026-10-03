"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, Workspace } from "../api";
import { PasswordField } from "../password-field";

export default function LoginPage() {
  const [email,setEmail]=useState("owner@nexora.example"); const [password,setPassword]=useState("MarketFlow2026!"); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const router=useRouter();
  async function submit(e:FormEvent){e.preventDefault();setError("");setBusy(true);try{const result=await api<{workspaces:Workspace[]}>("/auth/login",{method:"POST",body:JSON.stringify({email,password})});if(result.workspaces[0])localStorage.setItem("mf_workspace",result.workspaces[0].id);const next=new URLSearchParams(location.search).get("next");router.replace(next?.startsWith("/")?next:"/");}catch(e){setError(e instanceof Error?e.message:"Could not sign in.");}finally{setBusy(false);}}
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><Image src="/marketflow360-logo.svg" alt="MarketFlow360" width={270} height={58} priority/><h1>Welcome back</h1><p>Sign in to your workspace.</p>{error&&<div className="form-error">{error}</div>}<label>Email<input autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<PasswordField label="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="primary" disabled={busy}>{busy?"Signing in…":"Sign in"}</button><p className="auth-foot"><Link href="/forgot-password">Forgot password?</Link></p><p className="auth-foot">New to MarketFlow360? <Link href="/register">Create an account</Link></p><small className="demo-note">Demo: owner@nexora.example · MarketFlow2026!</small></form></main>;
}
