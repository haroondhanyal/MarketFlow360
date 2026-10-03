"use client";
import { useEffect, useState } from "react";
import { api, downloadApiFile } from "../api";
import { Frame, Loading, Message } from "../screens/shared";

type Report = {
  leadStages: { name: string; count: number }[];
  leadSources: { name: string; count: number }[];
  deals: { stage: string; currency: string; count: number; amountMinor: number }[];
  tasks: { name: string; count: number }[];
  campaigns: { name: string; count: number; plannedBudgetMinor: number }[];
  content: { name: string; count: number }[];
  leadTrend: { period: string; count: number; bucket: "day" | "week" }[];
};

export default function ReportsPage() {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const queryString = query.size ? `?${query}` : "";

  async function load() {
    try {
      setData(await api<Report>(`/reports/summary${queryString}`));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reports.");
    }
  }
  useEffect(() => { void load(); }, []);

  const groups: [string, [string, string | number][]][] = data ? [
    ["Lead stages", data.leadStages.map(x => [x.name, x.count])],
    ["Lead sources", data.leadSources.map(x => [x.name, x.count])],
    ["Deals", data.deals.map(x => [`${x.stage} · ${x.currency}`, `${x.count} · ${(x.amountMinor / 100).toLocaleString()}`])],
    ["Tasks", data.tasks.map(x => [x.name, x.count])],
    ["Campaigns", data.campaigns.map(x => [x.name, `${x.count} · PKR ${(x.plannedBudgetMinor / 100).toLocaleString()}`])],
    ["Content", data.content.map(x => [x.name, x.count])],
  ] : [];
  const trendMax = Math.max(1, ...(data?.leadTrend.map(x => x.count) ?? []));

  return <Frame title="Workspace Reports" subtitle="Review workspace activity and lead trends over a selected date range.">
    {error && <Message error>{error}</Message>}
    <div className="screen-actions">
      <label>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>To <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <button className="secondary" onClick={() => void load()}>Apply dates</button>
      <button className="secondary" onClick={() => void downloadApiFile(`/reports/export${queryString}`, "marketflow-workspace-report.csv").catch(e => setError(e.message))}>Export CSV</button>
    </div>
    {!data ? <Loading /> : <>
      <article className="panel report-panel trend-panel">
        <h2>New leads over time <small>Daily for up to 90 days, weekly for longer ranges</small></h2>
        {data.leadTrend.length === 0 ? <p className="subtle">No leads were created in this trend range.</p> : <div className="trend-chart" role="img" aria-label="New leads grouped over time">
          {data.leadTrend.map(point => <div className="trend-item" key={point.period} title={`${new Date(point.period).toLocaleDateString()}: ${point.count} leads`}>
            <span className="trend-count">{point.count}</span><div className="trend-bar" style={{ height: `${Math.max(4, point.count / trendMax * 100)}%` }} />
            <small>{new Date(point.period).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
          </div>)}
        </div>}
      </article>
      <div className="report-grid">{groups.map(([title, rows]) => <article className="panel report-panel" key={title}>
        <h2>{title}</h2>{rows.length ? rows.map(([name, value]) => <div className="simple-row" key={name}><span>{name.replaceAll("_", " ")}</span><b>{value}</b></div>) : <p className="subtle">No data yet.</p>}
      </article>)}</div>
      <p className="demo-note">Campaign amounts show planned budget, not actual advertising spend. Summary totals use the selected date range and active workspace.</p>
    </>}
  </Frame>;
}
