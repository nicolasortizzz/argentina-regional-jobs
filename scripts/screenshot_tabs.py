#!/usr/bin/env python3
"""Capture each dashboard tab with Playwright (headless Chromium)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
DOCS.mkdir(exist_ok=True)

TABS = [
    "overview",
    "provinces",
    "sectors",
    "wages",
    "col",
    "affordability",
    "profile",
    "scenarios",
    "sources",
]

from playwright.sync_api import sync_playwright


def main():
    base = "http://127.0.0.1:8766/"
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.goto(base, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(800)
        for tab in TABS:
            btn = page.locator(f'button[data-tab="{tab}"]')
            btn.scroll_into_view_if_needed()
            btn.click()
            page.wait_for_selector(f"section#{tab}.tab.active", timeout=10000)
            page.wait_for_timeout(2000)
            out1 = Path(f"/workspace/reg_{tab}.png")
            out2 = DOCS / f"tab-{tab}.png"
            page.screenshot(path=str(out1), full_page=True)
            page.screenshot(path=str(out2), full_page=True)
            print("wrote", out1, out2)
        browser.close()
    if errors:
        print("CONSOLE_ERRORS:", *errors, sep="\n")
        sys.exit(1)
    print("OK zero console errors")


if __name__ == "__main__":
    main()
