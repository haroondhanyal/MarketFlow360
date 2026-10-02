"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, Workspace } from "../api";
export default function VerifyPage(){const [message,setMessage]=useState("Verifying your email…");const [error,setError]=useState("");const router=useRouter();useEffect(()=>{const token=new URLSearchParams(location.search).get("token");if(!token){setError("The verification link is missing its token.");return;}api<{workspaces:Workspace[]}>("/auth/verify-email",{method:"POST",body:JSON.stringify({token})}).then(r=>{if(r.workspaces[0])localStorage.setItem("mf_workspace",r.workspaces[0].id);setMessage("Email verified. Opening your workspace…");setTimeout(()=>router.replace("/"),600);}).catch(e=>setError(e instanceof Error?e.message:"Verification failed."));},[router]);return <main className="auth-page"><section className="auth-card"><Image src="/marketflow360-logo.svg" alt="MarketFlow360" width={270} height={58}/><h1>Email verification</h1>{error?<><div className="form-error">{error}</div><Link href="/register">Create another account</Link></>:<p>{message}</p>}</section></main>;}
