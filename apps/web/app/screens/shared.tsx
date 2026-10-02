"use client";
import { ChangeEvent, useEffect, useState } from "react";
import { api, downloadApiFile } from "../api";
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
type Attachment={id:string;fileName:string;mimeType:string;sizeBytes:number;createdAt:string};
export function Attachments({recordType,recordId}:{recordType:"LEAD"|"CUSTOMER"|"TASK";recordId:string}){const [rows,setRows]=useState<Attachment[]>([]);const [error,setError]=useState("");async function load(){try{setRows(await api<Attachment[]>(`/attachments?recordType=${recordType}&recordId=${encodeURIComponent(recordId)}`));setError("")}catch(e){setError(e instanceof Error?e.message:"Could not load files.")}}useEffect(()=>{void load()},[recordId,recordType]);async function upload(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value="";if(!file)return;if(file.size>3*1024*1024){setError("Choose a file smaller than 3 MB.");return}try{const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]||"");reader.onerror=()=>reject(new Error("Could not read this file."));reader.readAsDataURL(file)});await api("/attachments",{method:"POST",body:JSON.stringify({recordType,recordId,fileName:file.name,mimeType:file.type||"application/octet-stream",data})});await load()}catch(err){setError(err instanceof Error?err.message:"Could not upload file.")}}async function remove(id:string){try{await api(`/attachments/${id}`,{method:"DELETE"});await load()}catch(e){setError(e instanceof Error?e.message:"Could not delete file.")}}return <section className="attachment-box"><b>Attachments</b><label className="attachment-add">＋ Add file<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv" onChange={upload}/></label>{error&&<small className="thread-error">{error}</small>}{rows.map(file=><div className="attachment-row" key={file.id}><button className="text-button" onClick={()=>void downloadApiFile(`/attachments/${file.id}/download`,file.fileName).catch(e=>setError(e.message))}>{file.fileName}</button><small>{(file.sizeBytes/1024).toFixed(0)} KB</small><button className="text-button" onClick={()=>void remove(file.id)} aria-label={`Remove ${file.fileName}`}>×</button></div>)}</section>}
