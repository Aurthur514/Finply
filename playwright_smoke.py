from __future__ import annotations

import sys

from playwright.sync_api import sync_playwright


def main() -> int:
    target_url = sys.argv[1] if len(sys.argv) > 1 else "data:text/html,<title>Playwright Smoke Test</title><h1>Finply OK</h1>"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(target_url, wait_until="domcontentloaded")

        title = page.title()
        heading = page.locator("h1").first.text_content() if page.locator("h1").count() else ""

        print(f"Loaded URL: {target_url}")
        print(f"Page title: {title}")
        print(f"First h1: {heading}")

        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
