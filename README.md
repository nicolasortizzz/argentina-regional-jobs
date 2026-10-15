# Argentina Regional Jobs

Interactive, English-language dashboard on Argentina’s regional labour markets—focused on **Neuquén (Vaca Muerta)** and other growth provinces versus **national**, **CABA**, and **GBA/Pampeana** benchmarks.

**Live site:** [https://nicolasortizzz.github.io/argentina-regional-jobs/](https://nicolasortizzz.github.io/argentina-regional-jobs/)

## Run locally

```bash
python3 -m http.server 8766
# open http://127.0.0.1:8766/
```

Refresh data:

```bash
python3 -m venv .venv && .venv/bin/pip install requests openpyxl pandas
.venv/bin/python scripts/fetch_data.py
.venv/bin/python scripts/fetch_oede.py   # OEDE wages xlsx + SIPA 154.1 employment by province
```

Tab screenshots (requires Playwright; reuse economic-outlook venv or `pip install playwright && playwright install chromium`):

```bash
python3 -m http.server 8766 &
/path/to/.venv/bin/python scripts/screenshot_tabs.py
```

## Methodology

- **Provincial wages (OEDE/SIPA):** Monthly average **total remuneration** of registered private employees from the Ministerio de Trabajo provincial xlsx ([provinciales_serie_remuneraciones_mensual_2dig_9.xlsx](https://www.argentina.gob.ar/sites/default/files/provinciales_serie_remuneraciones_mensual_2dig_9.xlsx)), processed into `data/oede_wages.json`. **June and December include aguinaldo (SAC)**; the dashboard uses **May 2026** for cross-province comparisons unless noted. Sector breakdowns use the same non-SAC month.
- **Registered employment by province:** SIPA seasonal series **`154.1_*`** (thousands of private employees) via [datos.gob.ar](https://apis.datos.gob.ar/series/api/), stored in `data/sipa_employment.json`. Charts index to **Jun 2023 = 100**. **Mendoza, Catamarca, and CABA** are missing from the current feed; **Santa Cruz** ends **2024-10**.
- **Legacy datos.gob.ar 70.1 / 71.1:** Still used for EPH-linked metadata where needed; wage KPIs and affordability use OEDE xlsx instead of CPI extrapolation from stale 71.1 API points.
- **Unemployment:** INDEC EPH continuous rates by agglomerate (`45.2_*`, `42.3_*` GBA) via datos.gob.ar; INDEC labour-market xls probe stored in `data/indec_eph_probe.json`.
- **National sector employment:** Ministerio de Trabajo registered employment by sector (`155.1_*`, `324.1_*`, etc.).
- **Cost of living:** INDEC regional **Canasta Básica Total / Alimentaria** (`444.1_*`). Pampeana used as **GBA proxy** where no dedicated GBA CBT series is listed on datos.gob.ar.
- **Rents:** Curated monthly bands in `data/facts.json` / `data/rents.json`:
  - **Reporte Inmobiliario** via **La Nación** (Aug 2026) for Neuquén, Mendoza, Bariloche, Salta, etc.
  - **Zonaprop** CABA index (Sep 2026)
  - **ACACE** Comodoro Rivadavia (Aug 2026)
  - **San Juan** and **Río Gallegos** rents are **undocumented estimates** (labeled on site)
  - **Catamarca** excluded from affordability rankings (no rent input)
- **FX:** BCRA estadísticas API variable 5 (wholesale reference / A3500), with **dolarapi** fallback when BCRA errors (`data/bcra_fx.json`). USD wage views convert at **load-date FX only**.
- **Energy / exports:** datos.gob.ar / Secretaría de Energía production series and provincial export series.
- **Affordability:** OEDE gross wage (or analyst-sector average on Profile tab), minus 17% employee contributions, simplified **Ganancias 2026** monthly brackets (see `data/facts.json`), **Patagonia −22%** on taxable income where applicable, minus rent + adult-equivalent CBT (×0.55, labeled estimate).

Failed or empty API calls are listed in `data/sources.json` and omitted from charts—never imputed.

## Sources

| Topic | Provider |
|--------|-----------|
| OEDE provincial wages | [OEDE estadísticas provinciales](https://www.argentina.gob.ar/trabajo/estadisticas/oede-estadisticas-provinciales), [xlsx](https://www.argentina.gob.ar/sites/default/files/provinciales_serie_remuneraciones_mensual_2dig_9.xlsx) |
| SIPA employment by province | datos.gob.ar **`154.1_*`** |
| Registered employment & wages (legacy API) | [Ministerio de Trabajo — Estadísticas](https://www.argentina.gob.ar/trabajo/estadisticas), datos.gob.ar `70.1_*` / `71.1_*` |
| EPH unemployment | [INDEC](https://www.indec.gob.ar/), datos.gob.ar |
| CPI & canasta | INDEC via datos.gob.ar |
| FX | [BCRA API](https://api.bcra.gob.ar/) |
| Hydrocarbons | [datos.energia.gob.ar](https://datos.energia.gob.ar/) |
| RIGI context | [argentina.gob.ar](https://www.argentina.gob.ar/) |

## Caveats

- Provincial SIPA **154.1** coverage is incomplete for some jurisdictions; employment growth tables state exclusions explicitly.
- OEDE **SAC months** distort month-on-month comparisons—use non-June/December months for levels.
- Rent figures are **survey snapshots**, not transaction microdata; interior cities may lack published bands.
- Scenario paths on the Scenarios tab are **author illustrations**, not econometric forecasts.

## Author

**Nicolas Ortiz** — Economist | Financial & Data Analyst  
[GitHub](https://github.com/nicolasortizzz) · [LinkedIn](https://www.linkedin.com/in/nicolas-ortizzz/)

Educational research only; not tax, employment, or investment advice.
