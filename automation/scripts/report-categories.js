(() => {
  const categoryPath = () => /(?:^|\/)categories(?:\/|[?#]|$)/i.test(location.hash.replace(/^#\/?/, ""));
  const graphPath = () => /(?:^|\/)graphs(?:\/|[?#]|$)/i.test(location.hash.replace(/^#\/?/, ""));
  const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const duration = (milliseconds) => {
    const seconds = Math.max(0, milliseconds / 1000);
    return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
  };
  const pct = (part, total) => total ? `${(part / total * 100).toFixed(1)}%` : "0%";
  const dataReady = fetch("./marketflow-categories.json").then((response) => response.json());
  let selected = new URLSearchParams(location.hash.split("?")[1] ?? "").get("category") || "all";
  let search = "";

  function chartLine(points, value, title, unit = "") {
    const width = 640, height = 200, padX = 28, padY = 24;
    const values = points.map((point) => Number(point[value] ?? 0));
    const max = Math.max(1, ...values);
    const coords = values.map((v, i) => ({ x: points.length === 1 ? width / 2 : padX + i * (width - padX * 2) / (points.length - 1), y: height - padY - v / max * (height - padY * 2), v }));
    const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
    const grid = [0, 1, 2, 3].map((i) => `<line x1="${padX}" y1="${padY + i * (height - padY * 2) / 3}" x2="${width - padX}" y2="${padY + i * (height - padY * 2) / 3}" class="mf360-chart-grid"/>`).join("");
    const labels = coords.map((point, i) => `<text x="${point.x}" y="${height - 4}" text-anchor="middle" class="mf360-chart-label">${esc(points[i].label ?? `Run ${i + 1}`)}</text>`).join("");
    const dots = coords.map((point, i) => `<circle cx="${point.x}" cy="${point.y}" r="5" class="mf360-chart-dot"><title>${esc(points[i].label ?? `Run ${i + 1}`)}: ${point.v}${unit}</title></circle>`).join("");
    return `<div class="mf360-chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)} chart">${grid}${coords.length > 1 ? `<polyline points="${line}" class="mf360-chart-line"/>` : ""}${dots}${labels}</svg><div class="mf360-chart-latest">${coords.length === 1 ? "One recorded report run. More points appear after future runs." : `${coords.length} recorded report runs`}</div></div>`;
  }
  function barChart(items, value, label, formatter = (x) => String(x)) {
    const max = Math.max(1, ...items.map((item) => Number(item[value] ?? 0)));
    return `<div class="mf360-bars">${items.map((item) => `<div class="mf360-bar-row"><span>${esc(item.name)}</span><div class="mf360-bar-track"><i style="width:${Math.max(item[value] ? 2 : 0, Number(item[value] ?? 0) / max * 100)}%"></i></div><b>${esc(formatter(item[value] ?? 0))}</b></div>`).join("")}</div>`;
  }

  function projectTrend(history, projects) {
    const colors = ["#6845e8", "#1587c5", "#13a276", "#e07a3f", "#a044bc"];
    const runs = [...history].sort((a, b) => a.stop - b.stop);
    const series = projects.map((project, index) => ({
      name: project.name ?? project.id,
      id: project.id,
      color: colors[index % colors.length],
      values: runs.map((run) => Number(run.projects?.find((item) => item.id === project.id)?.total ?? 0)),
    })).filter((item) => item.values.some((value) => value > 0));
    if (!runs.length || !series.length) return barChart(projects.map((project) => ({ name: project.name ?? project.id, value: project.total ?? 0 })), "value", "cases");
    const width = 640, height = 230, padX = 42, padY = 26;
    const max = Math.max(1, ...series.flatMap((item) => item.values));
    const xAt = (index) => runs.length === 1 ? width / 2 : padX + index * (width - padX * 2) / (runs.length - 1);
    const yAt = (value) => height - padY - value / max * (height - padY * 2);
    const grid = [0, 1, 2, 3].map((index) => `<line x1="${padX}" y1="${padY + index * (height - padY * 2) / 3}" x2="${width - padX}" y2="${padY + index * (height - padY * 2) / 3}" class="mf360-chart-grid"/>`).join("");
    const labels = runs.map((run, index) => `<text x="${xAt(index)}" y="${height - 4}" text-anchor="middle" class="mf360-chart-label">${esc(new Date(run.stop).toLocaleDateString(undefined, { month: "short", day: "numeric" }))}</text>`).join("");
    const lines = series.map((item) => {
      const coords = item.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(" ");
      const dots = item.values.map((value, index) => `<circle cx="${xAt(index)}" cy="${yAt(value)}" r="4" fill="${item.color}"><title>${esc(item.name)} · ${value} cases</title></circle>`).join("");
      return `${runs.length > 1 ? `<polyline points="${coords}" fill="none" stroke="${item.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ""}${dots}`;
    }).join("");
    const legend = series.map((item) => `<span style="display:inline-flex;align-items:center;gap:5px;margin:4px 10px 0 0;color:var(--dash-muted);font-size:10px"><i style="width:9px;height:9px;border-radius:50%;background:${item.color}"></i>${esc(item.name)}</span>`).join("");
    return `<div class="mf360-chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Test case category counts by project over saved report runs">${grid}${lines}${labels}</svg><div>${legend}</div><div class="mf360-chart-latest">${runs.length === 1 ? "One saved run · future runs add trend points" : `${runs.length} saved report runs · case counts by project`}</div></div>`;
  }

  function renderGraphs(data, root) {
    const { projects = [], history = [] } = data;
    const points = history.map((run, index) => ({ ...run, label: new Date(run.stop).toLocaleDateString(undefined, { month: "short", day: "numeric" }) || `Run ${index + 1}` }));
    const retries = projects.map((project) => ({ name: project.name, value: project.retries }));
    const durations = projects.map((project) => ({ name: project.name, value: project.durationMs }));
    root.innerHTML = `<main class="mf360-overview mf360-graphs"><section class="mf360-welcome"><div><p class="mf360-overline">MarketFlow360 · Report graphs</p><h2>Trends & Graphs</h2><p class="mf360-welcome-copy">Charts use actual test-result records and saved report runs.</p></div><a class="mf360-primary-link" href="#/">← Overview</a></section><section class="mf360-dashboard-grid"><article class="mf360-panel"><h3>Test trend</h3><p class="mf360-help">Total test cases over report runs.</p>${chartLine(points, "total", "Test trend")}</article><article class="mf360-panel"><h3>Duration trend</h3><p class="mf360-help">Report execution duration over report runs.</p>${chartLine(points, "durationMs", "Duration trend", " ms")}</article><article class="mf360-panel"><h3>Retries trend</h3><p class="mf360-help">Actual recorded retries per run. Zero values are plotted and labelled.</p>${chartLine(points, "retries", "Retries trend")}${barChart(retries, "value", "retries")}</article><article class="mf360-panel"><h3>Categories trend</h3><p class="mf360-help">Saved UI, API, BDD, database and k6 case counts across report runs.</p>${projectTrend(history, projects)}</article><article class="mf360-panel"><h3>Duration by project</h3><p class="mf360-help">Summed duration from individual test results.</p>${barChart(durations, "value", "ms", (value) => duration(Number(value)))}</article></section></main>`;
  }

  function renderCategories(data, root) {
    const { categories = [], totals = {}, generatedAt, duration: runDuration = 0 } = data;
    const total = totals.total ?? categories.reduce((sum, category) => sum + category.total, 0);
    const failures = (totals.failed ?? 0) + (totals.broken ?? 0);
    const skipped = totals.skipped ?? 0;
    const chosen = categories.find((category) => category.name === selected);
    const maxCount = Math.max(1, ...categories.map((category) => category.total));
    const issueCount = (category) => category.failed + category.broken + category.skipped;
    const categoryRows = categories.map((category) => {
      const active = selected === category.name ? " selected" : "";
      const pctText = total ? ((category.total / total) * 100).toFixed(1) : "0.0";
      return `<button class="mf360-category-row${active}" type="button" data-category="${esc(category.name)}" style="--cat-color:${category.color}"><span class="mf360-category-icon">${esc(category.icon)}</span><span class="mf360-category-name">${esc(category.name)}<small class="mf360-category-description">${esc(category.description)}</small></span><span class="mf360-category-count">${category.total}</span><span class="mf360-category-bar"><i style="width:${Math.min(100, (category.total / maxCount) * 100)}%"></i></span><span class="mf360-category-percent">${pctText}%</span></button>`;
    }).join("");
    const stats = categories.map((category) => `<div class="mf360-category-stat" style="--cat-color:${category.color}" title="${esc(category.description)}"><strong>${category.total}</strong><span>${esc(category.name)}<br>${category.passed} pass · ${issueCount(category)} issues</span></div>`).join("");
    const chartColors = categories.map((category) => category.color);
    let cursor = 0;
    const gradient = categories.map((category, index) => {
      const start = cursor;
      cursor += total ? category.total / total * 100 : 100 / categories.length;
      return `${chartColors[index]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    }).join(",");
    const legend = categories.map((category) => `<button type="button" data-category="${esc(category.name)}" style="--cat-color:${category.color}"><i class="mf360-category-dot"></i><span>${esc(category.name)}</span><b>${category.total} · ${total ? ((category.total / total) * 100).toFixed(1) : "0.0"}%</b></button>`).join("");
    const testSource = chosen ? chosen.tests : categories.flatMap((category) => category.tests);
    const visibleTests = testSource.filter((test) => `${test.name} ${test.project} ${test.status}`.toLowerCase().includes(search.toLowerCase()));
    const caseMarkup = (test) => {
      const details = test.message || test.trace;
      const stepMarkup = test.steps.map((step) => `<div class="mf360-case-step ${esc(step.status)}">${esc(step.name)}</div>`).join("");
      const attachmentMarkup = test.attachments.map((attachment) => {
        const item = attachment.evidence;
        const isK6 = item?.id && item?.method && item?.path && item?.thresholds;
        const cards = isK6 ? `<section class="mf360-k6-evidence"><div class="mf360-k6-evidence-head"><strong>${esc(item.id)} · ${esc(item.method)} ${esc(item.path)}</strong><span>${esc(item.workspace)}</span></div><div class="mf360-k6-evidence-grid"><div><small>Requests</small><b>${item.passed}/${item.requestCount} passed</b></div><div><small>Average</small><b>${Number(item.averageMs).toFixed(2)} ms</b></div><div><small>Range</small><b>${Number(item.minMs).toFixed(2)}–${Number(item.maxMs).toFixed(2)} ms</b></div><div><small>p95 / limit</small><b>${Number(item.p95Ms).toFixed(2)} / ${Number(item.thresholds.p95Ms)} ms</b></div><div><small>p99 / limit</small><b>${Number(item.p99Ms).toFixed(2)} / ${Number(item.thresholds.p99Ms)} ms</b></div><div><small>Load profile</small><b>${item.thresholds.vus} VUs · ${item.thresholds.iterations} iterations</b></div></div><div class="mf360-k6-checks"><span>✓ HTTP 200</span><span>✓ Non-empty response</span><span>✓ Under ${Number(item.thresholds.p95Ms)} ms case limit</span>${item.failures?.length ? item.failures.map((failure) => `<span class="failed">× ${esc(failure)}</span>`).join("") : "<span>✓ No failed checks</span>"}</div>${attachment.href ? `<a class="mf360-k6-raw" href="${esc(attachment.href)}" target="_blank" rel="noreferrer">Open raw request evidence ↗</a>` : ""}</section>` : "";
        return `${cards}${attachment.href && !isK6 ? `<a href="${esc(attachment.href)}" target="_blank" rel="noreferrer">${esc(attachment.name || attachment.type || "Attachment")}</a>` : ""}`;
      }).join("");
      return `<details class="mf360-category-case"><summary><span class="mf360-case-status ${esc(test.status)}">${esc(test.status)}</span><span class="mf360-case-title">${esc(test.name)}</span><span class="mf360-case-meta">${esc(test.project)} · ${duration(test.duration)}</span></summary><div class="mf360-case-detail">${details ? `<pre class="mf360-case-error">${esc(details)}</pre>` : `<div>Passed in this report.</div>`}<a class="mf360-view-test" href="${esc(test.href)}">Open test result →</a>${stepMarkup ? `<div class="mf360-case-steps">${stepMarkup}</div>` : ""}${attachmentMarkup ? `<div class="mf360-case-attachments">${attachmentMarkup}</div>` : ""}</div></details>`;
    };
    const cases = visibleTests.map(caseMarkup).join("");
    const recentFailures = categories.flatMap((category) => category.tests.filter((test) => ["failed", "broken", "skipped", "unknown"].includes(test.status)).map((test) => ({ ...test, category: category.name }))).sort((a, b) => b.duration - a.duration).slice(0, 8);
    const recentMarkup = recentFailures.length ? `<div class="mf360-category-case-list">${recentFailures.map(caseMarkup).join("")}</div>` : `<div class="mf360-category-empty">No failed, broken, timed-out, or skipped cases. All ${total} report cases are listed above by category.</div>`;
    root.innerHTML = `<div class="mf360-category-app"><aside class="mf360-category-sidebar"><div class="mf360-category-side-title"><i class="mf360-category-side-mark" aria-hidden="true"></i>MarketFlow360</div><a class="mf360-category-nav" href="#/"><span class="mf360-category-nav-icon">⌂</span>Overview</a><a class="mf360-category-nav active" href="#/categories"><span class="mf360-category-nav-icon">⚐</span>Categories</a><a class="mf360-category-nav" href="#/suites"><span class="mf360-category-nav-icon">▱</span>Suites</a><a class="mf360-category-nav" href="#/behaviors"><span class="mf360-category-nav-icon">⑂</span>Behaviors</a><a class="mf360-category-nav" href="#/graphs"><span class="mf360-category-nav-icon">▥</span>Graphs</a></aside><main class="mf360-category-main"><section class="mf360-category-panel"><div class="mf360-category-heading"><div><p class="mf360-category-eyebrow">MarketFlow360 · Test categories</p><h2>Categories</h2><p>Select a suite group, then inspect each case's result, failure message, executed steps, hooks and attachments.</p></div><span class="mf360-category-run">${generatedAt ? new Date(generatedAt).toLocaleString() : "Latest report"} · ${duration(runDuration)}</span></div><div class="mf360-category-stats">${stats}</div><div class="mf360-category-grid"><section class="mf360-category-card"><div class="mf360-category-card__head">Categories · ${total} test cases · ${failures} failed · ${skipped} skipped</div><div class="mf360-category-list">${categoryRows}</div></section><section class="mf360-category-card"><div class="mf360-category-card__head">Case count by category</div><div class="mf360-category-chart"><div class="mf360-category-donut" style="background:conic-gradient(${gradient})"><div><strong>${total}</strong><span>test cases</span></div></div><div class="mf360-category-legend">${legend}</div></div></section><section class="mf360-category-card mf360-category-failures"><div class="mf360-category-card__head">Failed / Broken / Skipped Cases</div>${recentMarkup}</section><section class="mf360-category-card mf360-category-cases"><div class="mf360-category-card__head">${chosen ? esc(chosen.name) : "All cases"} · ${visibleTests.length} cases<label style="float:right;font-weight:400">Search <input data-search value="${esc(search)}" placeholder="test name, suite, status" style="margin-left:7px;padding:6px 8px;border:1px solid #41546d;border-radius:6px;background:#101d2e;color:#edf4fd"></label></div><div class="mf360-category-case-list">${cases || `<div class="mf360-category-empty">No matching cases.</div>`}</div></section></div></section></main></div>`;
    root.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => { selected = selected === button.dataset.category ? "all" : button.dataset.category; renderCategories(data, root); }));
    root.querySelector("[data-search]")?.addEventListener("input", (event) => { search = event.currentTarget.value; const start = event.currentTarget.selectionStart; renderCategories(data, root); const next = root.querySelector("[data-search]"); next?.focus(); next?.setSelectionRange(start, start); });
  }

  async function renderRoute() {
    const root = document.querySelector("#content");
    if (!root) return;
    const data = await dataReady;
    if (categoryPath()) {
      if (!root.querySelector(".mf360-category-app")) renderCategories(data, root);
    } else if (graphPath()) {
      if (!root.querySelector(".mf360-graphs")) renderGraphs(data, root);
    }
  }
  addEventListener("hashchange", () => { selected = new URLSearchParams(location.hash.split("?")[1] ?? "").get("category") || "all"; search = ""; setTimeout(renderRoute, 0); });
  const observer = new MutationObserver(renderRoute);
  const attachObserver = () => { const root = document.querySelector("#content"); if (root && !root.dataset.mf360Observer) { root.dataset.mf360Observer = "true"; observer.observe(root, { childList: true }); } renderRoute(); };
  setInterval(attachObserver, 350);
  attachObserver();
})();
