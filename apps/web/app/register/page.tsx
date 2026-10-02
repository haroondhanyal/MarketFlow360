"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, Workspace } from "../api";

export default function RegisterPage() {
  const [name,setName]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [workspaceName,setWorkspaceName]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);const router=useRouter();
  async function submit(e:FormEvent){e.preventDefault();setError("");setBusy(true);try{const result=await api<{verificationUrl:string}>("/auth/register",{method:"POST",body:JSON.stringify({name,email,password,workspaceName})});const url=new URL(result.verificationUrl);router.replace(url.pathname+url.search);}catch(e){setError(e instanceof Error?e.message:"Could not create workspace.");}finally{setBusy(false);}}
  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><Image src="/marketflow360-logo.svg" alt="MarketFlow360" width={270} height={58} priority/><h1>Create your workspace</h1><p>Start with your team and add records as you go.</p>{error&&<div className="form-error">{error}</div>}<label>Your name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" minLength={2} required/></label><label>Work email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={10} autoComplete="new-password" required/><small>Use at least 10 characters.</small></label><label>Workspace name<input value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} minLength={2} required/></label><button className="primary" disabled={busy}>{busy?"Creating…":"Create workspace"}</button><p className="auth-foot">Already registered? <Link href="/login">Sign in</Link></p></form></main>;
}
