#!/usr/bin/env python3
"""Fetch regional labour-market data from public APIs. JSON under data/ with provenance."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

try:
    import requests
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(parents=True, exist_ok=True)

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "argentina-regional-jobs/1.0 (educational)"})
VERIFY_BCRA = False
ISO = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def save(name: str, payload: dict) -> None:
    with open(DATA / name, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def fetch_json(
    url: str,
    *,
    verify: bool = True,
    params: Optional[dict] = None,
    timeout: int = 120,
) -> tuple[Optional[Any], Optional[str]]:
    try:
        r = SESSION.get(url, params=params, timeout=timeout, verify=verify)
        r.raise_for_status()
        return r.json(), None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def series_api(ids: list[str], limit: int = 5000, chunk: int = 6) -> dict:
    base = "https://apis.datos.gob.ar/series/api/series/"
    out: dict[str, list] = {}
    meta: list = []
    errors: list[str] = []
    unique = list(dict.fromkeys(ids))
    for i in range(0, len(unique), chunk):
        batch = unique[i : i + chunk]
        ids_s = ",".join(batch)
        url = f"{base}?ids={ids_s}&format=json&limit={limit}"
        data, err = fetch_json(url)
        if err:
            errors.append(f"{batch[0]}…: {err}")
            continue
        if not data or "data" not in data:
            errors.append(f"{batch[0]}…: empty payload")
            continue
        raw = data["data"]
        if data.get("meta"):
            meta.extend(data.get("meta") or [])
        if isinstance(raw, dict):
            for sid, rows in raw.items():
                out[sid] = _parse_series_rows(rows)
        elif isinstance(raw, list):
            if len(batch) == 1:
                out[batch[0]] = _parse_series_rows(raw)
            else:
                for j, sid in enumerate(batch):
                    bucket: list[dict] = []
                    for row in raw:
                        if isinstance(row, (list, tuple)) and len(row) > j + 1:
                            val = row[j + 1]
                            if val is not None:
                                bucket.append({"date": row[0], "value": val})
                    if bucket:
                        out[sid] = bucket
    return {
        "source_url": base,
        "fetched_at": ISO,
        "error": "; ".join(errors) if errors else None,
        "series": out,
        "meta": meta,
    }


def _parse_series_rows(rows: list) -> list[dict]:
    out = []
    for r in rows or []:
        if isinstance(r, dict):
            out.append({"date": r["indice_tiempo"], "value": r["valor"]})
        elif isinstance(r, (list, tuple)) and len(r) >= 2 and r[1] is not None:
            out.append({"date": r[0], "value": r[1]})
    return sorted(out, key=lambda x: x["date"])


def bcra_series(var_id: int, page_limit: int = 1000) -> dict:
    base_v4 = f"https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/{var_id}"
    points: list[dict] = []
    offset = 0
    total = 0
    err = None
    while True:
        url_used = f"{base_v4}?limit={page_limit}&offset={offset}"
        data, err = fetch_json(url_used, verify=VERIFY_BCRA)
        if err or not data or not data.get("results"):
            break
        rs = data["metadata"]["resultset"]
        total = rs.get("count", 0)
        det = data["results"][0].get("detalle", [])
        for row in det:
            points.append({"date": row["fecha"], "value": row["valor"]})
        offset += page_limit
        if offset >= total or not det:
            break
    api_version = "v4.0"
    if not points:
        base_v3 = f"https://api.bcra.gob.ar/estadisticas/v3.0/Monetarias/{var_id}"
        data, err = fetch_json(f"{base_v3}?limit={page_limit}", verify=VERIFY_BCRA)
        api_version = "v3.0"
        if data and data.get("results"):
            for row in data["results"][0].get("detalle", []):
                points.append({"date": row["fecha"], "value": row["valor"]})
    return {
        "idVariable": var_id,
        "source_url": base_v4,
        "api_version": api_version,
        "fetched_at": ISO,
        "error": err if not points else None,
        "points": points,
        "count": len(points),
    }


PROVINCES = [
    {
        "key": "neuquen",
        "label": "Neuquén",
        "region": "Patagonia",
        "patagonia_tax": True,
        "energy_hub": True,
        "employment_id": "70.1_N_E_0_A_7",
        "wage_id": "71.1_N_E_0_A_7",
        "unemployment_id": "45.2_ECTDTN_0_T_41",
        "unemployment_label": "Neuquén (EPH)",
        "rent_city": "Neuquén",
    },
    {
        "key": "rio_negro",
        "label": "Río Negro",
        "region": "Patagonia",
        "patagonia_tax": True,
        "employment_id": "70.1_RN_E_0_A_9",
        "wage_id": "71.1_RN_E_0_A_9",
        "unemployment_id": "45.2_ECTDTVCP_0_T_57",
        "unemployment_label": "Viedma–Carmen de Patagones",
        "rent_city": "Bariloche",
    },
    {
        "key": "chubut",
        "label": "Chubut",
        "region": "Patagonia",
        "patagonia_tax": True,
        "employment_id": "70.1_C_E_0_A_6",
        "wage_id": "71.1_C_E_0_A_6",
        "unemployment_id": "45.2_ECTDTCR_0_T_52",
        "unemployment_label": "Comodoro Rivadavia",
        "rent_city": "Comodoro Rivadavia",
    },
    {
        "key": "santa_cruz",
        "label": "Santa Cruz",
        "region": "Patagonia",
        "patagonia_tax": True,
        "employment_id": "70.1_SC_E_0_A_10",
        "wage_id": "71.1_SC_E_0_A_10",
        "unemployment_id": "45.2_ECTDTRG_0_T_46",
        "unemployment_label": "Río Gallegos",
        "rent_city": "Río Gallegos",
    },
    {
        "key": "mendoza",
        "label": "Mendoza",
        "region": "Cuyo",
        "patagonia_tax": False,
        "employment_id": "70.1_M_E_0_A_7",
        "wage_id": "71.1_M_E_0_A_7",
        "unemployment_id": "45.2_ECTDTGM_0_T_46",
        "unemployment_label": "Gran Mendoza",
        "rent_city": "Mendoza",
    },
    {
        "key": "san_juan",
        "label": "San Juan",
        "region": "Cuyo",
        "patagonia_tax": False,
        "employment_id": "70.1_SJ_E_0_A_8",
        "wage_id": "71.1_SJ_E_0_A_8",
        "unemployment_id": "45.2_ECTDTGSJ_0_T_47",
        "unemployment_label": "Gran San Juan",
        "rent_city": "San Juan",
    },
    {
        "key": "salta",
        "label": "Salta",
        "region": "Noroeste",
        "patagonia_tax": False,
        "employment_id": "70.1_S_E_0_A_5",
        "wage_id": "71.1_S_E_0_A_5",
        "unemployment_id": "45.2_ECTDTS_0_T_39",
        "unemployment_label": "Salta",
        "rent_city": "Salta",
    },
    {
        "key": "catamarca",
        "label": "Catamarca",
        "region": "Noroeste",
        "patagonia_tax": False,
        "employment_id": "70.1_C_E_0_A_9",
        "wage_id": "71.1_C_E_0_A_9",
        "unemployment_id": "45.2_ECTDTGC_0_T_48",
        "unemployment_label": "Gran Catamarca",
        "rent_city": "San Fernando del Valle",
    },
]

BENCHMARKS = [
    {
        "key": "national",
        "label": "National (private registered)",
        "employment_id": "70.1_TSP_E_0_A_20",
        "wage_id": "71.1_TSP_E_0_A_20",
        "unemployment_id": "45.1_ECTDT_0_A_33",
        "unemployment_label": "Total urban agglomerates",
    },
    {
        "key": "caba",
        "label": "CABA",
        "employment_id": "70.1_C_E_0_A_4",
        "wage_id": "71.1_C_E_0_A_4",
        "unemployment_id": "45.2_ECTDTC_0_T_38",
        "unemployment_label": "CABA",
    },
    {
        "key": "pba",
        "label": "Buenos Aires Province",
        "employment_id": "70.1_PBA_E_0_A_22",
        "wage_id": "71.1_PBA_E_0_A_22",
        "unemployment_id": "42.3_EPH_PUNTUAGBA_0_M_28",
        "unemployment_label": "GBA (EPH continuous)",
    },
]

SECTOR_SERIES = {
    "mining_oil": {
        "label": "Mining & oil/gas (registered, private)",
        "employment_id": "155.1_MRIA_PELEO_C_0_0_16",
        "employment_national_id": "66.1_M_E_0_A_19",
    },
    "construction": {
        "label": "Construction",
        "employment_id": "155.1_CTRUCCIION_C_0_0_12",
        "employment_national_id": "66.1_C_E_0_A_12",
    },
    "logistics": {
        "label": "Transport, storage & communications",
        "employment_id": "152.1_TSPORTEEST_2009_M_35",
        "employment_national_id": "66.1_TAC_E_0_A_40",
    },
    "financial": {
        "label": "Financial intermediation",
        "employment_id": "324.1_J_INTERMEDADO__65",
        "wage_id": "323.1_J_INTERMEDADO__59",
    },
    "professional": {
        "label": "Business & professional services",
        "employment_id": "66.1_AIEA_E_0_A_48",
    },
}

CANASTA = {
    "national_cbt": "444.1_CANASTA_BATAL_0_0_20_94",
    "national_cba": "444.1_CANASTA_BARIA_0_0_26_47",
    "patagonia_cbt": "444.1_CANASTA_batotPatagonia_0_0_26_47",
    "patagonia_cba": "444.1_CANASTA_BARIAPatagonia_0_0_26_47",
    "cuyo_cbt": "444.1_CANASTA_batotCuyo_0_0_26_47",
    "cuyo_cba": "444.1_CANASTA_BARIACuyo_0_0_26_47",
    "noroeste_cbt": "444.1_CANASTA_batotNoroeste_0_0_26_47",
    "noroeste_cba": "444.1_CANASTA_BARIANoroeste_0_0_26_47",
    "pampeana_cbt": "444.1_CANASTA_batotPampeana_0_0_26_47",
    "pampeana_cba": "444.1_CANASTA_BARIAPampeana_0_0_26_47",
}

ENERGY_SERIES = [
    "PROD_PET_SESCO_3",
    "PROD_PET_SESCO_2",
    "PROD_PET_SESCO_6",
    "PROD_GAS_SESCO_2",
]

EXPORT_SERIES = [
    "350.1_NEUQUEN_TOUEN__21",
    "350.1_MENDOZA_TOOZA__21",
    "350.1_SALTA_TOTALTA__17",
    "350.1_RIO_NEGRO_GRO__25",
]


def fetch_series_bundle(ids: list[str], label: str) -> dict:
    unique = list(dict.fromkeys(ids))
    block = series_api(unique)
    block["label"] = label
    block["ids"] = unique
    block["series_count"] = sum(1 for v in block.get("series", {}).values() if v)
    return block


def bcra_fx_fallback() -> dict:
    """Fallback FX if BCRA API errors (official wholesale reference)."""
    url = "https://dolarapi.com/v1/dolares/oficial"
    data, err = fetch_json(url)
    pts = []
    if isinstance(data, dict) and data.get("venta"):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        pts.append({"date": today, "value": float(data["venta"])})
    return {
        "idVariable": 5,
        "source_url": url,
        "api_version": "dolarapi-fallback",
        "fetched_at": ISO,
        "error": err,
        "points": pts,
        "count": len(pts),
        "note": "Single-day fallback when BCRA estadisticas API unavailable",
    }


def try_rent_index() -> dict:
    """Attempt public rent report URLs; store curated fallback in facts if unreachable."""
    attempts = [
        {
            "name": "zonaprop_index",
            "url": "https://www.zonaprop.com.ar/noticias/indice-zonaprop/",
        },
        {
            "name": "argenprop_blog",
            "url": "https://www.argenprop.com/noticias",
        },
    ]
    out = {"fetched_at": ISO, "attempts": [], "series": []}
    for a in attempts:
        try:
            r = SESSION.get(a["url"], timeout=30)
            out["attempts"].append(
                {
                    "name": a["name"],
                    "url": a["url"],
                    "status": r.status_code,
                    "ok": r.status_code == 200,
                    "note": "HTML landing page only; structured index not parsed in this pipeline",
                }
            )
        except Exception as e:
            out["attempts"].append(
                {"name": a["name"], "url": a["url"], "ok": False, "error": str(e)}
            )
    return out


def try_indec_eph_xls() -> dict:
    url = (
        "https://www.indec.gob.ar/ftp/cuadros/sociedad/"
        "eph_mercado_trabajo_tasas_e_indicadores.xls"
    )
    try:
        r = SESSION.get(url, timeout=90)
        return {
            "source_url": url,
            "fetched_at": ISO,
            "ok": r.status_code == 200,
            "bytes": len(r.content) if r.content else 0,
            "error": None if r.status_code == 200 else f"HTTP {r.status_code}",
        }
    except Exception as e:
        return {"source_url": url, "fetched_at": ISO, "ok": False, "error": str(e)}


def main() -> None:
    sources: dict[str, Any] = {"fetched_at": ISO, "ok": [], "failed": []}

    def track(name: str, ok: bool, detail: str = "") -> None:
        entry = {"name": name, "detail": detail, "at": ISO}
        (sources["ok"] if ok else sources["failed"]).append(entry)

    # BCRA FX (A3500 wholesale reference id 5)
    fx = bcra_series(5)
    if fx.get("count", 0) < 2:
        fb = bcra_fx_fallback()
        if fb.get("count"):
            fx["fallback"] = fb
            fx["points"] = (fx.get("points") or []) + fb["points"]
            fx["count"] = len(fx["points"])
    save("bcra_fx.json", fx)
    track("bcra_fx_wholesale", fx.get("count", 0) > 0, fx.get("error") or f"n={fx.get('count')}")

    # Labour provinces
    emp_ids = [p["employment_id"] for p in PROVINCES + BENCHMARKS]
    wage_ids = [p["wage_id"] for p in PROVINCES + BENCHMARKS if p.get("wage_id")]
    unemp_ids = [p["unemployment_id"] for p in PROVINCES + BENCHMARKS]
    labour = fetch_series_bundle(emp_ids + wage_ids + unemp_ids, "SIPA/OEDE via datos.gob.ar")
    labour["provinces"] = PROVINCES
    labour["benchmarks"] = BENCHMARKS
    labour["documentation"] = (
        "70.1_*: miles de puestos declarados sector privado (Ministerio de Trabajo SIPA/OEDE). "
        "71.1_*: remuneración total sector privado. 45.*: tasas de desempleo EPH por aglomerado."
    )
    save("labour_provinces.json", labour)
    track(
        "labour_provinces",
        labour.get("series_count", 0) > 0,
        f"series_ok={labour.get('series_count')}/{len(labour.get('ids', []))}",
    )

    sector_ids = []
    for s in SECTOR_SERIES.values():
        sector_ids.extend(
            [x for x in [s.get("employment_id"), s.get("employment_national_id"), s.get("wage_id")] if x]
        )
    sectors = fetch_series_bundle(sector_ids, "Registered employment by sector (national)")
    sectors["sectors"] = SECTOR_SERIES
    save("labour_sectors.json", sectors)
    track("labour_sectors", sectors.get("series_count", 0) > 0, f"series_ok={sectors.get('series_count')}")

    canasta = fetch_series_bundle(list(CANASTA.values()), "INDEC canasta básica por región")
    canasta["mapping"] = CANASTA
    save("canasta.json", canasta)
    track("canasta_regional", canasta.get("series_count", 0) > 0, f"series_ok={canasta.get('series_count')}")

    # National CPI context
    cpi = fetch_series_bundle(
        ["145.3_INGNACNAL_DICI_M_15", "145.3_INGNACUAL_DICI_M_38"],
        "INDEC national CPI",
    )
    save("cpi_national.json", cpi)
    track("cpi_national", cpi.get("series_count", 0) > 0, "")

    energy = fetch_series_bundle(ENERGY_SERIES, "Secretaría de Energía / datos.gob.ar production")
    energy["notes"] = (
        "PROD_PET_SESCO_3: petróleo cuenca neuquina; PROD_PET_SESCO_2: Golfo San Jorge; "
        "PROD_GAS_SESCO_2: gas Golfo San Jorge."
    )
    save("energy.json", energy)
    track("energy_production", energy.get("series_count", 0) > 0, "")

    exports = fetch_series_bundle(EXPORT_SERIES, "INDEC provincial goods exports")
    save("exports.json", exports)
    track("provincial_exports", exports.get("series_count", 0) > 0, "")

    ripte = fetch_series_bundle(["158.1_REPTE_0_0_5"], "RIPTE national benchmark wage index")
    save("ripte.json", ripte)
    track("ripte", ripte.get("series_count", 0) > 0, "")

    rents = try_rent_index()
    save("rents.json", rents)
    track("rent_portals", any(a.get("ok") for a in rents.get("attempts", [])), "see facts.json for figures")

    eph_xls = try_indec_eph_xls()
    save("indec_eph_probe.json", eph_xls)
    track("indec_eph_xls", eph_xls.get("ok"), eph_xls.get("error") or f"bytes={eph_xls.get('bytes')}")

    manifest = {
        "generated_at": ISO,
        "files": [
            "bcra_fx.json",
            "labour_provinces.json",
            "labour_sectors.json",
            "canasta.json",
            "cpi_national.json",
            "energy.json",
            "exports.json",
            "ripte.json",
            "rents.json",
            "indec_eph_probe.json",
            "facts.json",
            "sources.json",
        ],
    }
    save("manifest.json", manifest)
    save("sources.json", sources)

    print(f"Wrote data to {DATA}")
    print(f"OK: {len(sources['ok'])}, failed: {len(sources['failed'])}")
    for f in sources["failed"]:
        print("  FAIL:", f["name"], f.get("detail"))


if __name__ == "__main__":
    main()
