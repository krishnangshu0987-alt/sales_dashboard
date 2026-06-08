/**
 * app.js — SalesViz Interactive Dashboard
 * Features: animated counters, sortable table, row filters, search,
 *           sparklines, modal drill-down, threshold slider, year checkboxes,
 *           compare toggle, category legend toggle, CSV export, chart save.
 */
"use strict";

/* ── STATE ── */
let currentYear    = 2024;
let currentPieType = "doughnut";
let thresholdValue = null;
let sortCol        = null;
let sortDir        = 1;   // 1 = asc, -1 = desc
let tableFilter    = "all";
let searchQuery    = "";
let hiddenCategories = new Set();
let sparkCharts    = {};
let barChartInst   = null;
let lineChartInst  = null;
let pieChartInst   = null;
let modalSparkInst = null;

/* ── CHART.JS DEFAULTS ── */
Chart.defaults.color       = "rgba(255,255,255,0.55)";
Chart.defaults.borderColor = "rgba(255,255,255,0.08)";
Chart.defaults.font.family = "'DM Mono', monospace";

/* ── HELPERS ── */
const fmt    = n => "$" + (n >= 1000 ? (n/1000).toFixed(1)+"k" : n.toLocaleString());
const sum    = a => a.reduce((t,v)=>t+v, 0);
const avg    = a => Math.round(sum(a)/a.length);
const pctDiff = (a,b) => b ? (((a-b)/b)*100).toFixed(1) : null;
const pctStr  = (a,b) => { const d=pctDiff(a,b); return d===null?"—":(d>=0?"▲ +":"▼ ")+Math.abs(d)+"%"; };
const pctCls  = (a,b) => !b?"":a>=b?"delta--up":"delta--down";

function showToast(msg, dur=2200) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("toast--show");
  setTimeout(() => t.classList.remove("toast--show"), dur);
}

/* ── ANIMATED COUNTER ── */
function animateCounter(el, target, prefix="$", suffix="", isMoney=true) {
  const start  = 0;
  const dur    = 700;
  const startT = performance.now();
  const isK    = target >= 1000 && isMoney;
  function tick(now) {
    const p = Math.min((now - startT) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const val  = start + (target - start) * ease;
    if (isMoney) {
      el.textContent = isK ? "$"+(val/1000).toFixed(1)+"k" : "$"+Math.round(val).toLocaleString();
    } else {
      el.textContent = prefix + (Number.isInteger(target) ? Math.round(val) : val.toFixed(1)) + suffix;
    }
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ── SPARKLINE ── */
function buildSparkline(canvasId, data, color="#E8FF47") {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (sparkCharts[canvasId]) sparkCharts[canvasId].destroy();
  sparkCharts[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels: MONTHS,
      datasets: [{ data, borderColor: color, borderWidth: 1.5,
        pointRadius: 0, tension: 0.4, fill: true,
        backgroundColor: color+"22" }]
    },
    options: {
      responsive: false, animation: false,
      plugins: { legend: {display:false}, tooltip: {enabled:false} },
      scales: { x:{display:false}, y:{display:false} }
    }
  });
}

/* ── KPI CARDS ── */
function updateKPIs(year) {
  const d    = SALES_DATA[year].monthly;
  const prev = SALES_DATA[year-1]?.monthly;

  const total   = sum(d);
  const avgVal  = avg(d);
  const bestIdx = d.indexOf(Math.max(...d));
  const growth  = pctDiff(total, prev ? sum(prev) : null);

  animateCounter(document.getElementById("kpi-total"), total, "$", "", true);
  document.getElementById("kpi-delta-total").textContent = prev ? pctStr(total,sum(prev)) : "Baseline";
  document.getElementById("kpi-delta-total").className   = "kpi-card__delta " + (prev ? pctCls(total,sum(prev)) : "");

  document.getElementById("kpi-best-month").textContent  = MONTHS[bestIdx];
  document.getElementById("kpi-best-value").textContent  = fmt(d[bestIdx]);

  animateCounter(document.getElementById("kpi-avg"), avgVal, "$", "", true);
  const prevAvg = prev ? avg(prev) : null;
  document.getElementById("kpi-avg-delta").textContent = prevAvg ? pctStr(avgVal,prevAvg) : "—";
  document.getElementById("kpi-avg-delta").className   = "kpi-card__delta " + (prevAvg ? pctCls(avgVal,prevAvg) : "");

  const gEl = document.getElementById("kpi-growth");
  if (growth !== null) {
    gEl.textContent = (growth>=0?"+":"")+growth+"%";
  } else { gEl.textContent = "N/A"; }
  document.getElementById("kpi-growth-label").textContent = prev ? "vs "+(year-1) : "No prior year";

  // Mini sparklines on KPI cards
  buildSparkline("spark-total", d, "#E8FF47");
  buildSparkline("spark-best",  d.map((_,i)=>i===bestIdx?d[i]:null), "#FFB347");
  buildSparkline("spark-avg",   d, "#4ECDC4");
  buildSparkline("spark-growth",d, growth>=0?"#6EE7B7":"#FF6B6B");
}

/* ── BAR CHART ── */
function buildBarChart(year) {
  const ctx  = document.getElementById("bar-chart").getContext("2d");
  const data = SALES_DATA[year].monthly.slice();
  const th   = thresholdValue;

  const bgColors = data.map(v =>
    th !== null && v < th ? "rgba(255,255,255,0.08)" : PALETTE.accent
  );

  if (barChartInst) barChartInst.destroy();
  barChartInst = new Chart(ctx, {
    type: "bar",
    data: {
      labels: MONTHS,
      datasets: [{
        label: "Revenue ($k)",
        data,
        backgroundColor: bgColors,
        borderRadius: 6,
        hoverBackgroundColor: "#fff"
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 500, easing: "easeInOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1a1a", borderColor: PALETTE.accent, borderWidth: 1,
          callbacks: { label: c => ` $${c.parsed.y}k` }
        }
      },
      scales: {
        x: { grid:{display:false}, ticks:{color:"rgba(255,255,255,0.4)"} },
        y: { grid:{color:"rgba(255,255,255,0.06)"}, ticks:{color:"rgba(255,255,255,0.4)", callback:v=>"$"+v+"k"} }
      },
      onHover: (e, els) => {
        const hs = document.getElementById("hover-stats");
        if (!els.length) { hs.classList.remove("hover-stats--visible"); return; }
        const idx = els[0].index;
        const rev = data[idx];
        const units = SALES_DATA[year].units[idx];
        const aov   = Math.round((rev*1000)/units);
        document.getElementById("hover-month").textContent = MONTHS[idx]+" "+year;
        document.getElementById("hover-rev").textContent   = "Revenue: "+fmt(rev);
        document.getElementById("hover-units").textContent = "Units: "+units.toLocaleString();
        document.getElementById("hover-aov").textContent   = "AOV: $"+aov;
        hs.classList.add("hover-stats--visible");
      },
      onClick: (e, els) => {
        if (!els.length) return;
        openModal(year, els[0].index);
      }
    },
    plugins: [{
      id: "thresholdLine",
      afterDraw(chart) {
        if (th === null) return;
        const {ctx, chartArea:{left,right}, scales:{y}} = chart;
        const yPos = y.getPixelForValue(th);
        ctx.save();
        ctx.strokeStyle = PALETTE.accent2;
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([6,4]);
        ctx.beginPath(); ctx.moveTo(left,yPos); ctx.lineTo(right,yPos); ctx.stroke();
        ctx.fillStyle = PALETTE.accent2;
        ctx.font      = "11px 'DM Mono',monospace";
        ctx.fillText("Threshold: $"+th+"k", left+6, yPos-6);
        ctx.restore();
      }
    }]
  });
}

/* ── LINE CHART ── */
function buildLineChart() {
  const ctx = document.getElementById("line-chart").getContext("2d");
  if (lineChartInst) lineChartInst.destroy();

  const visibleYears = getVisibleYears();
  const colors = {2022:PALETTE.accent3, 2023:PALETTE.accent4, 2024:PALETTE.accent};

  lineChartInst = new Chart(ctx, {
    type: "line",
    data: {
      labels: MONTHS,
      datasets: visibleYears.map(yr=>({
        label: String(yr),
        data: SALES_DATA[yr].monthly,
        borderColor: colors[yr],
        backgroundColor: colors[yr]+"18",
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 7,
        tension: 0.4,
        fill: false
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      interaction: { mode:"index", intersect:false },
      plugins: {
        legend: { position:"bottom" },
        tooltip: {
          backgroundColor:"#1a1a1a", borderColor:"rgba(255,255,255,0.1)", borderWidth:1,
          callbacks: { label: c=>` ${c.dataset.label}: $${c.parsed.y}k` }
        }
      },
      scales: {
        x: { grid:{display:false}, ticks:{color:"rgba(255,255,255,0.4)"} },
        y: { grid:{color:"rgba(255,255,255,0.06)"}, ticks:{color:"rgba(255,255,255,0.4)", callback:v=>"$"+v+"k"} }
      }
    }
  });
}

function getVisibleYears() {
  return Array.from(document.querySelectorAll("#year-checkboxes input:checked"))
    .map(el => parseInt(el.value));
}

/* ── PIE CHART + LEGEND ── */
function buildPieChart(year, type) {
  const ctx  = document.getElementById("pie-chart").getContext("2d");
  const cats = SALES_DATA[year].categories;
  const labels = Object.keys(cats);
  const values = Object.values(cats);
  const isBar  = type === "bar";

  // Filter hidden
  const filteredLabels = labels.filter(l => !hiddenCategories.has(l));
  const filteredVals   = filteredLabels.map(l => cats[l]);
  const filteredColors = filteredLabels.map(l => CATEGORY_COLORS[labels.indexOf(l)]);

  if (pieChartInst) pieChartInst.destroy();
  pieChartInst = new Chart(ctx, {
    type,
    data: {
      labels: filteredLabels,
      datasets: [{
        data: filteredVals,
        backgroundColor: isBar ? filteredColors.map(c=>c+"CC") : filteredColors,
        borderColor: "#111", borderWidth: isBar?0:2,
        hoverOffset: isBar?0:12, borderRadius: isBar?6:0
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false, animation:{duration:400},
      plugins: {
        legend: { display:false },
        tooltip: {
          backgroundColor:"#1a1a1a", borderColor:"rgba(255,255,255,0.1)", borderWidth:1,
          callbacks: { label: c=>` ${c.label}: ${c.parsed}%` }
        }
      },
      ...(isBar ? {
        scales:{
          x:{grid:{display:false}},
          y:{grid:{color:"rgba(255,255,255,0.06)"}, ticks:{callback:v=>v+"%"}}
        }
      }:{})
    }
  });

  buildCategoryLegend(labels, values);
}

function buildCategoryLegend(labels, values) {
  const leg = document.getElementById("category-legend");
  leg.innerHTML = "";
  labels.forEach((label, i) => {
    const item = document.createElement("div");
    item.className = "legend-item" + (hiddenCategories.has(label)?" legend-item--hidden":"");
    item.innerHTML = `<span class="legend-dot" style="background:${CATEGORY_COLORS[i]}"></span>${label} ${values[i]}%`;
    item.addEventListener("click", () => {
      if (hiddenCategories.has(label)) hiddenCategories.delete(label);
      else hiddenCategories.add(label);
      buildPieChart(currentYear, currentPieType);
    });
    leg.appendChild(item);
  });
}

/* ── MODAL ── */
function openModal(year, monthIdx) {
  const d      = SALES_DATA[year];
  const rev    = d.monthly[monthIdx];
  const units  = d.units[monthIdx];
  const aov    = Math.round((rev*1000)/units);
  const prev   = monthIdx > 0 ? d.monthly[monthIdx-1] : null;

  document.getElementById("modal-eyebrow").textContent = MONTHS[monthIdx]+" "+year;
  document.getElementById("modal-title").textContent   = fmt(rev);

  const grid = document.getElementById("modal-grid");
  grid.innerHTML = [
    ["Units Sold", units.toLocaleString()],
    ["Avg Order Value", "$"+aov],
    ["vs Prior Month", prev ? pctStr(rev,prev) : "—"],
    ["Share of Year", Math.round((rev/sum(d.monthly))*100)+"%"]
  ].map(([l,v])=>`<div class="modal__stat"><span class="modal__stat-label">${l}</span><span class="modal__stat-value">${v}</span></div>`).join("");

  // Sparkline showing how this month fits in the year
  const sparkData = d.monthly.map((v,i) => i===monthIdx ? v : null);
  const sparkAll  = d.monthly.slice();
  const sparkCtx  = document.getElementById("modal-sparkline").getContext("2d");
  if (modalSparkInst) modalSparkInst.destroy();
  modalSparkInst = new Chart(sparkCtx, {
    type:"line",
    data:{
      labels:MONTHS,
      datasets:[
        {data:sparkAll, borderColor:"rgba(255,255,255,0.15)", borderWidth:1.5, pointRadius:0, tension:0.4, fill:false},
        {data:d.monthly.map((v,i)=>i===monthIdx?v:null), borderColor:PALETTE.accent, borderWidth:0, pointRadius:7, pointBackgroundColor:PALETTE.accent, fill:false}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      plugins:{legend:{display:false}, tooltip:{enabled:false}},
      scales:{
        x:{display:true, ticks:{color:"rgba(255,255,255,0.3)", font:{size:9}}},
        y:{display:false}
      }
    }
  });

  document.getElementById("modal-backdrop").classList.add("modal--open");
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.remove("modal--open");
}

/* ── TABLE ── */
let tableData = [];

function buildTableData(year) {
  const {monthly, units} = SALES_DATA[year];
  return monthly.map((rev,i)=>({
    idx: i,
    month: MONTHS[i],
    revenue: rev,
    units: units[i],
    aov: Math.round((rev*1000)/units[i]),
    delta: i>0 ? parseFloat(pctDiff(rev,monthly[i-1])) : null,
    deltaStr: i>0 ? pctStr(rev,monthly[i-1]) : "—",
    deltaCls: i>0 ? pctCls(rev,monthly[i-1]) : ""
  }));
}

function renderTable() {
  const maxRev  = Math.max(...tableData.map(r=>r.revenue));
  const top3Rev = tableData.map(r=>r.revenue).sort((a,b)=>b-a).slice(0,3);

  let rows = [...tableData];

  // Filter
  if (tableFilter==="up")   rows = rows.filter(r=>r.delta!==null && r.delta>0);
  if (tableFilter==="down") rows = rows.filter(r=>r.delta!==null && r.delta<0);
  if (tableFilter==="top3") rows = rows.filter(r=>top3Rev.includes(r.revenue));

  // Search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    rows = rows.filter(r => r.month.toLowerCase().includes(q));
  }

  // Sort
  if (sortCol) {
    rows.sort((a,b)=>{
      const av = a[sortCol], bv = b[sortCol];
      if (av===null) return 1; if (bv===null) return -1;
      return (av>bv?1:-1)*sortDir;
    });
  }

  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";
  rows.forEach(r => {
    const barW = Math.round((r.revenue/maxRev)*80);
    const tr = document.createElement("tr");
    if (top3Rev.includes(r.revenue)) tr.classList.add("row--highlight");
    tr.innerHTML = `
      <td>${r.month}</td>
      <td class="mono">${fmt(r.revenue)}<span class="mini-bar" style="width:${barW}px"></span></td>
      <td class="mono">${r.units.toLocaleString()}</td>
      <td class="mono">$${r.aov}</td>
      <td class="mono ${r.deltaCls}">${r.deltaStr}</td>
    `;
    tr.addEventListener("click", () => openModal(currentYear, r.idx));
    tbody.appendChild(tr);
  });

  // Update sort icons
  document.querySelectorAll(".data-table th").forEach(th => {
    th.classList.remove("sort-active");
    th.querySelector(".sort-icon").textContent = "⇕";
  });
  if (sortCol) {
    const active = document.querySelector(`.data-table th[data-col="${sortCol}"]`);
    if (active) {
      active.classList.add("sort-active");
      active.querySelector(".sort-icon").textContent = sortDir===1?"↑":"↓";
    }
  }
}

/* ── CSV EXPORT ── */
function exportCSV(year) {
  const rows = buildTableData(year);
  const header = "Month,Revenue ($k),Units Sold,Avg Order Value ($),vs Prior Month\n";
  const body   = rows.map(r=>
    `${r.month},${r.revenue},${r.units},${r.aov},${r.deltaStr.replace("▲ ","").replace("▼ ","")}`
  ).join("\n");
  const blob = new Blob([header+body], {type:"text/csv"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `salesviz_${year}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast("CSV exported ✓");
}

/* ── FULL REFRESH ── */
function refreshDashboard(year) {
  currentYear = year;
  tableData   = buildTableData(year);

  updateKPIs(year);
  buildBarChart(year);
  buildPieChart(year, currentPieType);
  renderTable();

  document.getElementById("chart-year-label").textContent = year+" — click any bar for details";
  document.getElementById("pie-year-label").textContent   = year;
  document.getElementById("table-year-badge").textContent = year;
}

/* ── EVENT LISTENERS ── */

// Year tabs
document.querySelectorAll(".year-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".year-tab").forEach(b=>{
      b.classList.remove("year-tab--active"); b.setAttribute("aria-selected","false");
    });
    btn.classList.add("year-tab--active"); btn.setAttribute("aria-selected","true");
    refreshDashboard(parseInt(btn.dataset.year));
  });
});

// Compare all toggle
document.getElementById("compare-toggle").addEventListener("click", function() {
  const on = this.getAttribute("aria-checked")==="false";
  this.setAttribute("aria-checked", on?"true":"false");
  if (on) {
    // Show line chart area with all years checked
    document.querySelectorAll("#year-checkboxes input").forEach(el=>el.checked=true);
    buildLineChart();
    showToast("Showing all 3 years on trend chart");
  } else {
    buildLineChart();
    showToast("Compare mode off");
  }
});

// Year checkboxes
document.querySelectorAll("#year-checkboxes input").forEach(cb => {
  cb.addEventListener("change", buildLineChart);
});

// Chart type switcher
document.querySelectorAll(".chart-switch-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chart-switch-btn").forEach(b=>b.classList.remove("chart-switch-btn--active"));
    btn.classList.add("chart-switch-btn--active");
    currentPieType = btn.dataset.type;
    buildPieChart(currentYear, currentPieType);
  });
});

// Threshold slider
const slider  = document.getElementById("threshold-slider");
const display = document.getElementById("threshold-display");
slider.addEventListener("input", () => {
  const v = parseInt(slider.value);
  thresholdValue = v === 0 ? null : v;
  display.textContent = v === 0 ? "off" : "$"+v+"k";
  buildBarChart(currentYear);
});
document.getElementById("btn-clear-threshold").addEventListener("click", () => {
  slider.value = 0;
  thresholdValue = null;
  display.textContent = "off";
  buildBarChart(currentYear);
});

// Save bar chart as image
document.getElementById("btn-save-bar").addEventListener("click", () => {
  const canvas = document.getElementById("bar-chart");
  const a = document.createElement("a");
  a.download = "salesviz_bar_"+currentYear+".png";
  a.href = canvas.toDataURL("image/png");
  a.click();
  showToast("Chart saved as PNG ✓");
});

// Export CSV
document.getElementById("btn-export").addEventListener("click", () => exportCSV(currentYear));

// Table column sort
document.querySelectorAll(".data-table th[data-col]").forEach(th => {
  th.addEventListener("click", () => {
    const col = th.dataset.col;
    if (sortCol === col) sortDir *= -1;
    else { sortCol = col; sortDir = 1; }
    renderTable();
  });
});

// Table row filters
document.querySelectorAll(".tfilter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tfilter-btn").forEach(b=>b.classList.remove("tfilter-btn--active"));
    btn.classList.add("tfilter-btn--active");
    tableFilter = btn.dataset.filter;
    renderTable();
  });
});

// Search
document.getElementById("search-input").addEventListener("input", e => {
  searchQuery = e.target.value.trim();
  renderTable();
});

// Modal close
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-backdrop").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-backdrop")) closeModal();
});
document.addEventListener("keydown", e => { if (e.key==="Escape") closeModal(); });

// KPI card click → highlight best month in bar chart
document.querySelectorAll(".kpi-card").forEach(card => {
  card.addEventListener("click", () => {
    const kpi = card.dataset.kpi;
    if (kpi==="best") {
      const d = SALES_DATA[currentYear].monthly;
      const idx = d.indexOf(Math.max(...d));
      openModal(currentYear, idx);
    }
  });
});

/* ── INIT ── */
document.addEventListener("DOMContentLoaded", () => {
  buildLineChart();
  refreshDashboard(2024);
});
