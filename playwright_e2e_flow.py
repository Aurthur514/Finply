from __future__ import annotations

import json
import sys

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


def text_or_empty(locator) -> str:
    try:
        return (locator.text_content() or "").strip()
    except Exception:
        return ""


def main() -> int:
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000"
    result: dict[str, object] = {
        "loaded": False,
        "selected_symbol": "",
        "active_asset_price": "",
        "active_asset_source": "",
        "offline_warning": False,
        "chart_heading": "",
        "prediction_symbol": "",
        "prediction_error": "",
        "research_symbol": "",
        "research_error": "",
        "console_errors": [],
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        console_errors: list[str] = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)
        result["loaded"] = True

        search = page.get_by_placeholder("Search stocks, crypto, or companies...")
        search.click()
        search.fill("NVDA")
        page.wait_for_timeout(1000)
        page.get_by_text("NVDA", exact=True).first.click()
        page.wait_for_timeout(4000)

        result["selected_symbol"] = text_or_empty(page.locator("text=Selected:").locator(".."))
        result["active_asset_price"] = text_or_empty(page.locator("text=ACTIVE ASSET").locator("..").locator("div").nth(3))
        source_badges = page.locator("text=Finply Offline Feed")
        if source_badges.count():
            result["active_asset_source"] = "Finply Offline Feed"
        else:
            result["active_asset_source"] = text_or_empty(page.locator("text=ACTIVE ASSET").locator("..").locator("div").nth(4))
        result["offline_warning"] = page.locator("text=Price is from fallback market data").count() > 0
        result["chart_heading"] = text_or_empty(page.locator("h3").filter(has_text="NVDA Chart").first)

        page.get_by_role("button", name="AI View").first.click()
        page.wait_for_timeout(4000)
        result["prediction_symbol"] = text_or_empty(page.locator("text=AI Predictions").locator("..").locator("text=NVDA").first)
        result["prediction_error"] = text_or_empty(page.locator("div").filter(has_text="Failed to fetch prediction").first)

        page.get_by_role("button", name="Research Memo").first.click()
        page.wait_for_timeout(4000)
        result["research_symbol"] = text_or_empty(page.locator("text=Research Memo").locator("..").locator("text=NVDA").first)
        result["research_error"] = text_or_empty(page.locator("div").filter(has_text="Failed to generate research memo").first)

        result["console_errors"] = console_errors[:20]
        print(json.dumps(result, indent=2))
        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
