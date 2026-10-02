"use client";
import { useEffect, useState } from "react";
import { api } from "../api";
import { PageHeading, Screen } from "../workspace-shell";

export type ApiError = string;
export function useRows<T>(path: string) {
  const [rows,setRows]=useState<T[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  async function refresh(){setLoading(true);try{setRows(await api<T[]>(path));setError("");}catch(e){setError(e instanceof Error?e.message:"Could not load records.");}finally{setLoading(false);}}
  useEffect(()=>{void refresh();},[path]);
  return {rows,setRows,loading,error,refresh};
}
export function Frame({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){return <Screen><PageHeading title={title} subtitle={subtitle}/>{children}</Screen>;}
export function Message({children,error=false}:{children:React.ReactNode;error?:boolean}){return <p className={error?"form-error":"success-note"}>{children}</p>;}
export function Empty({text}:{text:string}){return <div className="empty-state"><span>▤</span><strong>Nothing here yet</strong><p>{text}</p></div>;}
export function Loading(){return <div className="empty-state">Loading…</div>;}
