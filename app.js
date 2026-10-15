"use strict";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const S = {
  tab: "overview",
  ccy: "USD",
  fx: 1,
  fxDate: "",
  drawn: {},
  data: null,
  aff: { pct: 50, rentShare: 1, flatShare: 1 },
  wgSeriesReal: false,
};

const OEDE_PROV = {
  neuquen: "Neuquén",
  rio_negro: "Río Negro",
  chubut: "Chubut",
  santa_cruz: "Santa Cruz",
  mendoza: "Mendoza",
  san_juan: "San Juan",
  salta: "Salta",
  catamarca: "Catamarca",
  national: "National",
  caba: "CABA",
  pba: "Buenos Aires",
};
const OEDE_WAGE_MONTH = "2026-05";
const OEDE_WAGE_LABEL = "OEDE/SIPA, May 2026";
const SIPA_INDEX_BASE = "2023-06";
const SECTOR_LABELS = {
  oil_gas: "Oil & gas",
  mining: "Mining",
  construction: "Construction",
  logistics: "Logistics",
  utilities: "Utilities",
  finance: "Finance",
  it_services: "IT services",
  professional_services: "Professional services",
  commerce_retail: "Commerce & retail",
};

const REGION_CANASTA = {
  Patagonia: { cbt: "patagonia_cbt", cba: "patagonia_cba" },
  Cuyo: { cbt: "cuyo_cbt", cba: "cuyo_cba" },
  Noroeste: { cbt: "noroeste_cbt", cba: "noroeste_cba" },
};

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const CFG = { displaylogo: false, displayModeBar: false, responsive: true };
const layout = (extra = {}) =>
  Object.assign(
    {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "Inter", color: css("--tx"), size: 12 },
      margin: { l: 50, r: 16, t: 10, b: 40 },
      xaxis: { gridcolor: css("--bd"), color: css("--mu") },
      yaxis: { gridcolor: css("--bd"), color: css("--mu") },
      legend: { orientation: "h", y: 1.08 },
    },
    extra
  );

function plot(id, data, lay) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("sk");
  return Plotly.react(el, data, layout(lay), CFG);
}

function toast(t) {
  const e = $("#toast");
  e.textContent = t;
  e.classList.add("show");
  clearTimeout(e._t);
  e._t = setTimeout(() => e.classList.remove("show"), 2000);
}

function ser(id) {
  return (S.data.labour_provinces?.series?.[id] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
}
function serAny(bundle, id) {
  return (bundle?.series?.[id] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
}
function lastPt(arr) {
  return arr.length ? arr[arr.length - 1] : null;
}
function pct(a, b) {
  if (!a || !b) return null;
  return ((a / b - 1) * 100);
}
function fmtPct(v, d = 1) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(d)}%`;
}
function fmtNum(v, d = 1) {
  if (v == null || !Number.isFinite(v)) return "—";
  return (+v).toLocaleString("en-US", { maximumFractionDigits: d });
}
function moneyArs(v, d = 0) {
  if (v == null) return "—";
  const ars = +v;
  if (S.ccy === "ARS") return `ARS ${fmtNum(ars, d)}`;
  const usd = ars / S.fx;
  return `$${fmtNum(usd, 2)} <span class="muted small">(${fmtNum(ars, 0)} ARS)</span>`;
}

function cpiIndex() {
  return serAny(S.data.cpi_national, "145.3_INGNACNAL_DICI_M_15");
}
function cpiScale(fromDate) {
  const idx = cpiIndex();
  const b = lastPt(idx);
  if (!b?.value) return 1;
  const target = fromDate.slice(0, 7);
  let a = idx.find((p) => p.date.startsWith(target));
  if (!a) a = idx.find((p) => p.date >= `${target}-01`) || idx[0];
  if (!a?.value) return 1;
  return b.value / a.value;
}

function oedeProvKey(prov) {
  return OEDE_PROV[prov.key] || prov.label;
}

function isSacMonth(ym) {
  const m = +ym.slice(5, 7);
  return m === 6 || m === 12;
}

function lastNonSacWagePt(series) {
  for (let i = series.length - 1; i >= 0; i--) {
    if (!isSacMonth(series[i].date)) return series[i];
  }
  return null;
}

function wageProvGross(prov) {
  const rec = S.data.oede_wages?.provinces?.[oedeProvKey(prov)];
  if (!rec?.series?.length) return null;
  const pt = rec.series.find((p) => p.date === OEDE_WAGE_MONTH) || lastNonSacWagePt(rec.series);
  if (!pt) return null;
  return { gross: pt.value, date: pt.date, label: OEDE_WAGE_LABEL };
}

function lastNonNullPt(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]?.value != null && Number.isFinite(+arr[i].value)) return arr[i];
  }
  return null;
}

function cpiMomLatest() {
  const s = serAny(S.data.cpi_national, "145.3_INGNACUAL_DICI_M_38");
  return lastNonNullPt(s);
}

function sipaPts(label) {
  return (S.data.sipa_employment?.provinces?.[label]?.points || []).slice();
}

function sipaValueAt(label, ym) {
  const pts = sipaPts(label);
  const hit = pts.find((p) => p.date === ym);
  if (hit) return hit.value;
  const before = pts.filter((p) => p.date < ym).pop();
  const after = pts.find((p) => p.date > ym);
  if (before && after) {
    const t0 = new Date(`${before.date}-01`).getTime();
    const t1 = new Date(`${after.date}-01`).getTime();
    const t = new Date(`${ym}-01`).getTime();
    const w = (t - t0) / (t1 - t0);
    return before.value + w * (after.value - before.value);
  }
  return before?.value ?? after?.value ?? null;
}

function sectorWageMax(prov, sectorKey) {
  const sec = S.data.oede_wages?.provinces?.[oedeProvKey(prov)]?.sectors?.[sectorKey];
  return sec?.max ?? null;
}

function sipaIndexedSeries(label) {
  const pts = sipaPts(label);
  if (!pts.length) return null;
  const base = sipaValueAt(label, SIPA_INDEX_BASE);
  if (!base) return null;
  return {
    label,
    base,
    points: pts.map((p) => ({ date: p.date, value: (p.value / base) * 100, level: p.value })),
    last: pts[pts.length - 1],
  };
}

function sipaGrowthSinceBase(label) {
  const s = sipaIndexedSeries(label);
  if (!s?.last) return null;
  const baseVal = sipaValueAt(label, SIPA_INDEX_BASE);
  if (!baseVal) return null;
  return {
    label,
    pct: pct(s.last.value, baseVal),
    from: SIPA_INDEX_BASE,
    to: s.last.date,
    latest: s.last.value,
  };
}

const SIPA_MISSING = ["Mendoza", "Catamarca", "CABA"];

function analystGross(prov) {
  const keys = ["finance", "it_services", "professional_services"];
  const vals = keys.map((k) => sectorWageMax(prov, k)).filter((v) => v != null && Number.isFinite(v));
  if (!vals.length) return null;
  const gross = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { gross, date: OEDE_WAGE_MONTH, label: OEDE_WAGE_LABEL, sectors: keys };
}

function rentForCity(name) {
  const rows = S.data.facts?.rents_ars_monthly || [];
  const hit = rows.find((r) => r.city.toLowerCase() === name.toLowerCase());
  return hit ? { ...hit } : null;
}

function canastaRegion(prov) {
  const map = REGION_CANASTA[prov.region] || REGION_CANASTA.Patagonia;
  const m = S.data.canasta?.mapping || {};
  const cbtId = m[map.cbt];
  const cbaId = m[map.cba];
  return {
    cbt: lastPt(serAny(S.data.canasta, cbtId)),
    cba: lastPt(serAny(S.data.canasta, cbaId)),
    pampeana: lastPt(serAny(S.data.canasta, m.pampeana_cbt)),
  };
}

function gananciasMonthly(taxable) {
  const br = S.data.facts?.ganancias_2026_approx?.brackets || [];
  let tax = 0;
  let prev = 0;
  for (const b of br) {
    const cap = b.up_to == null ? Infinity : b.up_to;
    const slice = Math.max(0, Math.min(taxable, cap) - prev);
    tax += slice * b.rate;
    prev = cap;
    if (taxable <= cap) break;
  }
  return tax;
}

function netAffordability(prov, opts, wageFn = wageProvGross) {
  const w = wageFn(prov);
  if (!w) return null;
  const gross = w.gross * (opts.pct / 50);
  const ss = gross * 0.17;
  let taxable = gross - ss;
  if (prov.patagonia_tax) taxable *= 1 - 0.22;
  const tax = gananciasMonthly(Math.max(0, taxable));
  const net = gross - ss - tax;
  const c = canastaRegion(prov);
  const cbt = c.cbt?.value || c.pampeana?.value;
  const adultFood = cbt ? cbt * 0.55 * opts.flatShare : null;
  const r = rentForCity(prov.rent_city);
  const rent = r ? r.value * opts.rentShare : 0;
  const costs = (adultFood || 0) + rent;
  return { gross, ss, tax, net, costs, surplus: net - costs, w, adultFood, rent, r };
}

function renderKpis(el, arr) {
  el.innerHTML = arr
    .map(
      (k) =>
        `<div class="kpi"><div class="l">${k.l}</div><div class="v">${k.v}</div><div class="s">${k.s || ""}</div></div>`
    )
    .join("");
}

function setTape() {
  const fx = S.fx ? `BCRA A3500 ${S.fxDate}: ${fmtNum(S.fx, 2)} ARS/USD` : "FX loading…";
  const neu = S.data.labour_provinces?.provinces?.find((p) => p.key === "neuquen");
  const u = neu ? lastPt(ser(neu.unemployment_id)) : null;
  const un = u ? fmtPct(u.value * 100, 1) : "—";
  const oil = lastPt(serAny(S.data.energy, "PROD_PET_SESCO_3"));
  const bits = [
    fx,
    `Neuquén unemployment (EPH): ${un}`,
    oil ? `Neuquina basin oil: ${fmtNum(oil.value, 0)} (SESCO units)` : "",
    "Vaca Muerta · RIGI · regional labour",
  ].filter(Boolean);
  const inner = bits.map((b) => `<span>${b}</span>`).join("");
  $("#tape").innerHTML = inner + inner;
}

function drawOverview() {
  const provs = S.data.labour_provinces?.provinces || [];
  const neu = provs.find((p) => p.key === "neuquen");
  const nat = S.data.labour_provinces?.benchmarks?.find((b) => b.key === "national");
  const unNeu = lastPt(ser(neu?.unemployment_id));
  const unNat = lastPt(ser(nat?.unemployment_id));
  const wNeu = wageProvGross(neu);
  const cpi = cpiMomLatest();

  renderKpis($("#ovKpis"), [
    {
      l: "Neuquén unemployment",
      v: unNeu ? fmtPct(unNeu.value * 100, 1) : "—",
      s: unNeu ? `${unNeu.date.slice(0, 7)} · EPH` : "",
    },
    {
      l: "National unemployment",
      v: unNat ? fmtPct(unNat.value * 100, 1) : "—",
      s: unNat ? `${unNat.date.slice(0, 7)}` : "",
    },
    {
      l: "Neuquén gross wage",
      v: wNeu
        ? S.ccy === "USD"
          ? `$${fmtNum(wNeu.gross / S.fx, 0)}`
          : `ARS ${fmtNum(wNeu.gross, 0)}`
        : "—",
      s: wNeu ? OEDE_WAGE_LABEL : "",
    },
    {
      l: "National CPI (m/m)",
      v: cpi ? fmtPct(cpi.value * 100, 1) : "—",
      s: cpi ? cpi.date.slice(0, 7) : "",
    },
  ]);

  const sipaNeu = sipaPts("Neuquén").pop();
  $("#ovWhy").innerHTML = `<p>${S.data.facts?.selection_rationale || ""}</p>
    <p>Registered employment in Neuquén (SIPA): <b>${sipaNeu ? fmtNum(sipaNeu.value, 1) : "—"}</b> thousand private jobs (${sipaNeu?.date?.slice(0, 7) || "n/a"}).</p>`;

  $("#ovSnap").innerHTML = [
    `Manifest generated: <b>${S.data.manifest?.generated_at || "—"}</b>`,
    `FX observations: <b>${S.data.bcra_fx?.count || 0}</b> (${S.data.bcra_fx?.api_version || ""})`,
    `Failed fetches: <b>${(S.data.sources?.failed || []).length}</b> — see Sources tab`,
  ]
    .map((x) => `<p>${x}</p>`)
    .join("");

  const sipaTraces = provs
    .map((p) => sipaIndexedSeries(p.label))
    .filter(Boolean)
    .map((s) => ({
      x: s.points.map((p) => p.date),
      y: s.points.map((p) => p.value),
      type: "scatter",
      mode: "lines",
      name: s.label,
    }));
  plot("ovEmpIdx", sipaTraces, { yaxis: { title: "Index (Jun 2023 = 100)" } });

  const bench = S.data.labour_provinces?.benchmarks || [];
  const traces = provs
    .concat(bench)
    .map((p) => {
      const s = ser(p.unemployment_id);
      return {
        x: s.map((x) => x.date),
        y: s.map((x) => x.value * 100),
        type: "scatter",
        mode: "lines",
        name: p.label || p.key,
      };
    })
    .filter((t) => t.x.length);
  plot("ovUnemp", traces, { yaxis: { title: "%" } });
}

function drawProvinces() {
  const provs = S.data.labour_provinces?.provinces || [];
  const indexed = provs.map((p) => sipaIndexedSeries(p.label)).filter(Boolean);
  plot(
    "prEmp",
    indexed.map((s) => ({
      x: s.points.map((p) => p.date),
      y: s.points.map((p) => p.value),
      type: "scatter",
      mode: "lines",
      name: s.label,
    })),
    { yaxis: { title: "Index (Jun 2023 = 100)" } }
  );

  const growthRows = provs
    .map((p) => sipaGrowthSinceBase(p.label))
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct);
  $("#prGrowthTable").innerHTML = `<thead><tr><th>Province</th><th>Jun 2023</th><th>Latest</th><th>Growth</th><th>Note</th></tr></thead><tbody>${growthRows
    .map((g) => {
      const note = g.to === "2024-10" ? "series ends 2024-10" : "";
      return `<tr><td>${g.label}</td><td>${fmtNum(sipaValueAt(g.label, SIPA_INDEX_BASE), 1)}</td><td>${fmtNum(g.latest, 1)} (${g.to})</td><td class="${g.pct >= 0 ? "up" : "dn"}">${fmtPct(g.pct)}</td><td class="muted small">${note}</td></tr>`;
    })
    .join("")}</tbody><caption class="muted small" style="caption-side:bottom;text-align:left;padding-top:6px">Excluded (no SIPA 154.1 in feed): ${SIPA_MISSING.join(", ")}.</caption>`;

  plot(
    "prGrowth",
    [
      {
        x: indexed.map((s) => s.label),
        y: indexed.map((s) => s.last?.value),
        type: "bar",
        marker: { color: css("--ac") },
      },
    ],
    { yaxis: { title: "Thousand jobs (latest month)" } }
  );

  const oil = serAny(S.data.energy, "PROD_PET_SESCO_3");
  plot(
    "prEnergy",
    [{ x: oil.map((p) => p.date), y: oil.map((p) => p.value), type: "scatter", mode: "lines", name: "Neuquina basin" }],
    {}
  );
}

function drawSectors() {
  const sec = S.data.labour_sectors?.sectors || {};
  const keys = ["mining_oil", "construction", "logistics", "financial", "professional"];
  const vals = keys.map((k) => {
    const id = sec[k]?.employment_id;
    const pt = lastPt(serAny(S.data.labour_sectors, id));
    return { k, label: sec[k]?.label || k, v: pt?.value, d: pt?.date };
  });
  plot(
    "secBars",
    [{ x: vals.map((v) => v.label), y: vals.map((v) => v.v), type: "bar" }],
    { yaxis: { title: "Persons (latest)" } }
  );
  const oil = serAny(S.data.labour_sectors, sec.mining_oil?.employment_id);
  plot("secOil", [{ x: oil.map((p) => p.date), y: oil.map((p) => p.value), type: "scatter", mode: "lines" }], {});
  const co = serAny(S.data.labour_sectors, sec.construction?.employment_id);
  plot("secConst", [{ x: co.map((p) => p.date), y: co.map((p) => p.value), type: "scatter", mode: "lines" }], {});
}

function wageArsOrUsd(ars) {
  if (ars == null) return null;
  if (S.ccy === "ARS") return ars;
  return ars / S.fx;
}

function wageSeriesVal(ars, dateYm) {
  if (ars == null) return null;
  if (S.wgSeriesReal) {
    const sc = cpiScale(`${dateYm}-01`);
    return ars / (sc || 1);
  }
  return wageArsOrUsd(ars);
}

function drawWages() {
  const provs = S.data.labour_provinces?.provinces || [];
  const natBench = S.data.labour_provinces?.benchmarks?.find((b) => b.key === "national");
  const wNat = natBench ? wageProvGross(natBench) : null;
  const rows = provs.map((p) => {
    const w = wageProvGross(p);
    return { p, w };
  });
  const barY = (w) => (w ? wageArsOrUsd(w.gross) : null);
  const barLabels = rows.map((r) => r.p.label).concat(wNat ? ["National"] : []);
  const barVals = rows.map((r) => barY(r.w)).concat(wNat ? [barY(wNat)] : []);
  plot(
    "wgBar",
    [
      {
        x: barLabels,
        y: barVals,
        type: "bar",
        marker: {
          color: barLabels.map((l) => (l === "National" ? css("--mu") : css("--ac"))),
        },
      },
    ],
    {
      yaxis: { title: S.ccy === "USD" ? `USD / month (@ ${S.fxDate})` : "ARS / month" },
    }
  );

  const sectorKeys = [
    "oil_gas",
    "mining",
    "construction",
    "logistics",
    "utilities",
    "finance",
    "it_services",
    "professional_services",
    "commerce_retail",
  ];
  const provLabels = provs.map((p) => p.label);
  const z = sectorKeys.map((sk) =>
    provs.map((p) => {
      const v = sectorWageMax(p, sk);
      if (v == null) return null;
      return S.ccy === "USD" ? v / S.fx : v;
    })
  );
  plot(
    "wgSector",
    [
      {
        type: "heatmap",
        x: provLabels,
        y: sectorKeys.map((k) => SECTOR_LABELS[k] || k),
        z,
        colorscale: "Blues",
        hovertemplate: "%{x}<br>%{y}: %{z:.0f}<extra></extra>",
      },
    ],
    {
      margin: { l: 140, r: 16, t: 10, b: 80 },
      yaxis: { automargin: true },
      xaxis: { tickangle: -35 },
    }
  );

  const seriesProv = provs.filter((p) => S.data.oede_wages?.provinces?.[oedeProvKey(p)]?.series?.length);
  const traces = seriesProv.map((p) => {
    const s = S.data.oede_wages.provinces[oedeProvKey(p)].series.filter((pt) => !isSacMonth(pt.date));
    return {
      x: s.map((pt) => pt.date),
      y: s.map((pt) => wageSeriesVal(pt.value, pt.date)),
      type: "scatter",
      mode: "lines",
      name: p.label,
    };
  });
  if (wNat) {
    const s = S.data.oede_wages.provinces.National.series.filter((pt) => !isSacMonth(pt.date));
    traces.push({
      x: s.map((pt) => pt.date),
      y: s.map((pt) => wageSeriesVal(pt.value, pt.date)),
      type: "scatter",
      mode: "lines",
      name: "National",
      line: { dash: "dot", width: 2 },
    });
  }
  plot("wgSeries", traces, {
    yaxis: {
      title: S.wgSeriesReal
        ? "Real ARS (CPI-deflated)"
        : S.ccy === "USD"
          ? `USD / month (FX ${S.fxDate})`
          : "ARS / month",
    },
  });

  if (!$("#wgSeriesMode").dataset.bound) {
    $("#wgSeriesMode").dataset.bound = "1";
    $("#wgSeriesMode").onclick = () => {
      S.wgSeriesReal = !S.wgSeriesReal;
      $("#wgSeriesMode").textContent = S.wgSeriesReal ? "Real (CPI-deflated)" : "USD @ current FX";
      drawWages();
    };
  }
  $("#wgSeriesMode").textContent = S.wgSeriesReal ? "Real (CPI-deflated)" : "USD @ current FX";

  $("#wgTable").innerHTML = `<thead><tr><th>Province</th><th>Gross</th><th>As of</th><th>vs CABA</th></tr></thead><tbody>${rows
    .map((r) => {
      const caba = wageProvGross(S.data.labour_provinces.benchmarks.find((b) => b.key === "caba"));
      const ratio = r.w && caba?.gross ? r.w.gross / caba.gross : null;
      return `<tr><td>${r.p.label}</td><td>${r.w ? moneyArs(r.w.gross) : "—"}</td><td>${r.w?.date?.slice(0, 7) || "—"}</td><td>${ratio ? fmtPct((ratio - 1) * 100) : "—"}</td></tr>`;
    })
    .join("")}</tbody>`;
}

function drawCol() {
  const m = S.data.canasta?.mapping || {};
  const regions = [
    ["National", m.national_cbt],
    ["Patagonia", m.patagonia_cbt],
    ["Cuyo", m.cuyo_cbt],
    ["Noroeste", m.noroeste_cbt],
    ["Pampeana (GBA proxy)", m.pampeana_cbt],
  ];
  const cbtTr = regions.map(([name, id]) => {
    const s = serAny(S.data.canasta, id);
    return { x: s.map((p) => p.date), y: s.map((p) => p.value), type: "scatter", mode: "lines", name };
  });
  plot("colCbt", cbtTr, { yaxis: { title: "ARS" } });
  const cbaRegs = [
    ["National", m.national_cba],
    ["Patagonia", m.patagonia_cba],
    ["Cuyo", m.cuyo_cba],
    ["Noroeste", m.noroeste_cba],
  ];
  plot(
    "colCba",
    cbaRegs.map(([name, id]) => {
      const s = serAny(S.data.canasta, id);
      return { x: s.map((p) => p.date), y: s.map((p) => p.value), type: "scatter", mode: "lines", name };
    }),
    { yaxis: { title: "ARS" } }
  );

  const rents = S.data.facts?.rents_ars_monthly || [];
  $("#colRent").innerHTML = rents
    .map(
      (r) =>
        `<p><b>${r.city}</b>: ${moneyArs(r.value)} / month (${r.type}, ${r.as_of}) — <a href="${r.source_url}" target="_blank" rel="noopener">source</a> <span class="tag-estimate">${r.label}</span></p>`
    )
    .join("");
  plot(
    "colRentChart",
    [
      {
        x: rents.map((r) => r.city),
        y: rents.map((r) => r.value / S.fx),
        type: "bar",
      },
    ],
    { yaxis: { title: "USD / month" } }
  );
}

function drawAffordability() {
  const provs = S.data.labour_provinces?.provinces || [];
  if (!$("#affSliders").dataset.init) {
    $("#affSliders").dataset.init = "1";
    $("#affSliders").innerHTML = `
      <div class="vsl"><label>Wage percentile vs median <b id="affPctLbl">${S.aff.pct}%</b></label><input type="range" id="affPct" min="30" max="90" value="${S.aff.pct}"></div>
      <div class="vsl"><label>Rent multiplier <b id="affRentLbl">${S.aff.rentShare.toFixed(2)}×</b></label><input type="range" id="affRent" min="50" max="150" value="100"></div>
      <div class="vsl"><label>CBT adult-equivalent multiplier <b id="affFlatLbl">${S.aff.flatShare.toFixed(2)}×</b></label><input type="range" id="affFlat" min="50" max="150" value="100"></div>`;
    $("#affPct").oninput = (e) => {
      S.aff.pct = +e.target.value;
      $("#affPctLbl").textContent = `${S.aff.pct}%`;
      drawAffordability();
    };
    $("#affRent").oninput = (e) => {
      S.aff.rentShare = +e.target.value / 100;
      $("#affRentLbl").textContent = `${S.aff.rentShare.toFixed(2)}×`;
      drawAffordability();
    };
    $("#affFlat").oninput = (e) => {
      S.aff.flatShare = +e.target.value / 100;
      $("#affFlatLbl").textContent = `${S.aff.flatShare.toFixed(2)}×`;
      drawAffordability();
    };
  }
  const opts = S.aff;
  const rows = provs.map((p) => ({ p, a: netAffordability(p, opts) })).filter((r) => r.a && r.a.r);
  const missing = provs.filter((p) => !rentForCity(p.rent_city)).map((p) => p.label);
  rows.sort((a, b) => b.a.surplus - a.a.surplus);
  plot(
    "affChart",
    [
      {
        x: rows.map((r) => r.p.label),
        y: rows.map((r) => r.a.surplus / S.fx),
        type: "bar",
        marker: { color: rows.map((r) => (r.a.surplus >= 0 ? css("--up") : css("--dn"))) },
      },
    ],
    { yaxis: { title: "USD surplus after costs" } }
  );
  $("#affRank").innerHTML = `<thead><tr><th>Rank</th><th>Province</th><th>Net</th><th>Costs</th><th>Surplus</th></tr></thead><tbody>${rows
    .map(
      (r, i) =>
        `<tr><td>${i + 1}</td><td>${r.p.label}${r.a.r.documented === false ? ' <span class="tag-estimate">rent est.</span>' : ""}</td><td>${moneyArs(r.a.net)}</td><td>${moneyArs(r.a.costs)}</td><td class="${r.a.surplus >= 0 ? "up" : "dn"}">${moneyArs(r.a.surplus)}</td></tr>`
    )
    .join("")}</tbody>` + (missing.length ? `<caption style="caption-side:bottom;text-align:left;opacity:.7;padding-top:6px">Excluded (no documented rent data): ${missing.join(", ")}. "rent est." = undocumented placeholder rent.</caption>` : "");
}

function drawProfile() {
  const finId = S.data.labour_sectors?.sectors?.financial?.wage_id;
  const fin = serAny(S.data.labour_sectors, finId);
  const lastFin = lastPt(fin);
  $("#profText").innerHTML = `<p>Roles in <b>financial intermediation</b>, <b>professional services</b>, and <b>information &amp; communication</b> are proxied here with national financial-sector remuneration (SIPA) and provincial private-sector wage levels from datos.gob.ar.</p>
    <p>Latest national financial remuneration observation: <b>${lastFin ? moneyArs(lastFin.value) : "—"}</b> (${lastFin?.date?.slice(0, 7) || "n/a"}).</p>`;
  plot(
    "profWage",
    [{ x: fin.map((p) => p.date), y: fin.map((p) => p.value), type: "scatter", mode: "lines", name: "Financial sector" }],
    { yaxis: { title: "ARS" } }
  );
  const provs = S.data.labour_provinces?.provinces || [];
  plot(
    "profCmp",
    [
      {
        x: provs.map((p) => p.label),
        y: provs.map((p) => {
          const w = wageProvGross(p);
          return w && lastFin ? w.gross / lastFin.value : null;
        }),
        type: "bar",
        name: "Prov wage / financial wage",
      },
    ],
    { yaxis: { title: "Ratio" } }
  );
}

function drawScenarios() {
  const base = serAny(S.data.labour_national, "149.1_TL_REGIADO_OCTU_0_16");
  const dates = base.slice(-24).map((p) => p.date);
  const bvals = base.slice(-24).map((p) => p.value);
  const boom = bvals.map((v, i) => v * (1 + 0.008 * i));
  const slump = bvals.map((v, i) => v * (1 - 0.006 * i));
  plot(
    "scIdx",
    [
      { x: dates, y: bvals, type: "scatter", mode: "lines", name: "Base (index)" },
      { x: dates, y: boom, type: "scatter", mode: "lines", name: "Vaca Muerta boom" },
      { x: dates, y: slump, type: "scatter", mode: "lines", name: "Oil price slump" },
    ],
    { yaxis: { title: "Labour demand index (sim.)" } }
  );
  $("#scText").innerHTML = `<p><b>Base:</b> Continuation of national registered-employment momentum with stable oil prices.</p>
    <p><b>Vaca Muerta boom:</b> Faster rig count &amp; RIGI-linked capex; Neuquén/Chubut labour markets tighten <span class="tag-estimate">Author's view</span>.</p>
    <p><b>Slump:</b> External oil shock compresses hiring in hydrocarbons; spillovers to construction &amp; services.</p>`;
  $("#scConcl").innerHTML = `<p>Neuquén combines hydrocarbon exposure with Patagonia tax treatment and rising—but still patchy—cost-of-living data. Against CABA/GBA benchmarks, interior growth provinces can offer higher <em>real</em> savings when rents and regional canastas are accounted for, but SIPA provincial wage series in public APIs often lag; use unemployment (EPH) and national sector series for timeliness.</p>
    <p>Energy and mining output remain the structural justification for including Patagonia and Cuyo mining corridors in a regional labour dashboard.</p>`;
}

function drawSources() {
  const ok = S.data.sources?.ok || [];
  const fail = S.data.sources?.failed || [];
  const notes = S.data.facts?.methodology_notes || [];
  $("#srcList").innerHTML = `
    <p><b>Methodology</b></p><ul>${notes.map((n) => `<li>${n}</li>`).join("")}</ul>
    <p><b>Successful fetches</b></p><ul>${ok.map((o) => `<li>${o.name} — ${o.detail || "ok"} (${o.at})</li>`).join("")}</ul>
    <p><b>Failed / partial</b></p><ul>${fail.map((o) => `<li>${o.name} — ${o.detail || "failed"} (${o.at})</li>`).join("") || "<li>None</li>"}</ul>
    <p>Primary portals: <a href="https://www.argentina.gob.ar/trabajo/estadisticas" target="_blank" rel="noopener">Ministerio de Trabajo estadísticas</a>,
    <a href="https://apis.datos.gob.ar/series/api/" target="_blank" rel="noopener">datos.gob.ar series API</a>,
    <a href="https://www.indec.gob.ar/" target="_blank" rel="noopener">INDEC</a>,
    <a href="https://api.bcra.gob.ar/" target="_blank" rel="noopener">BCRA API</a>,
    <a href="https://datos.energia.gob.ar/" target="_blank" rel="noopener">datos.energia.gob.ar</a>.</p>`;
}

const TAB_DRAW = {
  overview: drawOverview,
  provinces: drawProvinces,
  sectors: drawSectors,
  wages: drawWages,
  col: drawCol,
  affordability: drawAffordability,
  profile: drawProfile,
  scenarios: drawScenarios,
  sources: drawSources,
};

function switchTab(id) {
  S.tab = id;
  $$(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
  $$("main .tab").forEach((s) => s.classList.toggle("active", s.id === id));
  const btn = $(`.tabs button[data-tab="${id}"]`);
  const ink = $("#ink");
  if (btn && ink) {
    ink.style.left = `${btn.offsetLeft}px`;
    ink.style.width = `${btn.offsetWidth}px`;
  }
  if (!S.drawn[id]) {
    TAB_DRAW[id]?.();
    S.drawn[id] = true;
  }
}

function redrawAll() {
  Object.keys(S.drawn).forEach((k) => delete S.drawn[k]);
  TAB_DRAW[S.tab]?.();
  S.drawn[S.tab] = true;
}

async function load() {
  const files = S.data?.manifest?.files || [
    "manifest",
    "bcra_fx",
    "labour_provinces",
    "labour_sectors",
    "labour_national",
    "canasta",
    "cpi_national",
    "energy",
    "exports",
    "facts",
    "sources",
    "oede_xlsx",
    "oede_wages",
    "sipa_employment",
    "rents",
  ];
  const payload = {};
  for (const f of files) {
    const name = f.replace(".json", "");
    const r = await fetch(`data/${name}.json`);
    payload[name] = await r.json();
  }
  S.data = payload;
  const fxPts = (payload.bcra_fx?.points || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const lf = lastPt(fxPts);
  S.fx = lf?.value || 1000;
  S.fxDate = lf?.date || "";
  const dates = [
    payload.manifest?.generated_at,
    payload.labour_provinces?.fetched_at,
    payload.canasta?.fetched_at,
  ].filter(Boolean);
  $("#asof").textContent = (dates[0] || "").slice(0, 10);
  $("#foot").textContent = `Nicolas Ortiz · Argentina Regional Jobs · FX ${S.fxDate} · ${S.ccy}`;
  setTape();
  switchTab("overview");
}

function initUi() {
  $("#theme").onclick = () => {
    const html = document.documentElement;
    html.dataset.theme = html.dataset.theme === "light" ? "dark" : "light";
    redrawAll();
  };
  $("#ccy").onclick = () => {
    S.ccy = S.ccy === "USD" ? "ARS" : "USD";
    $("#ccy").textContent = S.ccy;
    redrawAll();
    toast(`Display: ${S.ccy}`);
  };
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  window.addEventListener("resize", () => switchTab(S.tab));
}

initUi();
load().catch((e) => {
  console.error(e);
  toast("Failed to load data");
});
