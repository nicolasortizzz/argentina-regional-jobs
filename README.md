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
python3 -m venv .venv && .venv/bin/pip install requests openpyxl
.venv/bin/python scripts/fetch_data.py
```

Tab screenshots (requires Playwright; reuse economic-outlook venv or `pip install playwright && playwright install chromium`):

```bash
python3 -m http.server 8766 &
/path/to/.venv/bin/python scripts/screenshot_tabs.py
```

## Methodology

- **Registered employment & wages (provincial):** SIPA/OEDE series on [datos.gob.ar](https://apis.datos.gob.ar/series/api/) (`70.1_*` miles of private jobs; `71.1_*` total remuneration). Publication in the API is often **annual** and may end several years before the latest national print; the dashboard states observation dates on charts and tables.
- **Unemployment:** INDEC EPH continuous rates by agglomerate (`45.2_*`, `42.3_*` GBA) via datos.gob.ar; INDEC labour-market xls probe stored in `data/indec_eph_probe.json`.
- **National sector employment:** Ministerio de Trabajo registered employment by sector (`155.1_*`, `324.1_*`, etc.).
- **Cost of living:** INDEC regional **Canasta Básica Total / Alimentaria** (`444.1_*`). Pampeana used as **GBA proxy** where no dedicated GBA CBT series is listed on datos.gob.ar.
- **Rents:** Curated monthly bands from published market surveys in `data/facts.json` (not a live Zonaprop/Argenprop API).
- **FX:** BCRA estadísticas API variable 5 (wholesale reference / A3500), with **dolarapi** fallback when BCRA errors (`data/bcra_fx.json`).
- **Energy / exports:** datos.gob.ar / Secretaría de Energía production series and provincial export series.
- **Affordability:** Gross wage (with optional CPI scaling to latest national CPI month), minus 17% employee contributions, simplified **Ganancias 2026** monthly brackets (see `data/facts.json`), **Patagonia −22%** on taxable income where applicable, minus rent + adult-equivalent CBT (×0.55, labeled estimate).

Failed or empty API calls are listed in `data/sources.json` and omitted from charts—never imputed.

## Sources

| Topic | Provider |
|--------|-----------|
| Registered employment & wages | [Ministerio de Trabajo — Estadísticas](https://www.argentina.gob.ar/trabajo/estadisticas), [datos.gob.ar](https://apis.datos.gob.ar/series/api/) |
| EPH unemployment | [INDEC](https://www.indec.gob.ar/), datos.gob.ar |
| CPI & canasta | INDEC via datos.gob.ar |
| FX | [BCRA API](https://api.bcra.gob.ar/) |
| Hydrocarbons | [datos.energia.gob.ar](https://datos.energia.gob.ar/) |
| RIGI context | [argentina.gob.ar](https://www.argentina.gob.ar/) |

## Caveats

- Provincial SIPA series on datos.gob.ar can **lag** national sector series; unemployment and canasta are usually more timely.
- Wage extrapolation uses **national CPI** scaling—clearly labeled; not a substitute for current collective agreements or firm payroll.
- Rent figures are **survey snapshots**, not transaction microdata.
- Scenario paths on the Scenarios tab are **author illustrations**, not econometric forecasts.

## Author

**Nicolas Ortiz** — Economist | Financial & Data Analyst  
[GitHub](https://github.com/nicolasortizzz) · [LinkedIn](https://www.linkedin.com/in/nicolas-ortizzz/)

Educational research only; not tax, employment, or investment advice.
