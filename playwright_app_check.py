from __future__ import annotations

import sys
import time

from playwright.sync_api import sync_playwright


ERROR_MARKERS = [
    "Uncaught runtime errors:",
    "Cannot read properties of null",
    "Failed to compile",
    "TypeError:",
]


def main() -> int:
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(5000)

        title = page.title()
        body_text = page.locator("body").inner_text(timeout=10000)
        runtime_errors = [marker for marker in ERROR_MARKERS if marker in body_text]

        print(f"Loaded URL: {target_url}")
        print(f"Page title: {title}")
        print(f"Runtime error markers found: {len(runtime_errors)}")
        if runtime_errors:
            print("Markers:")
            for marker in runtime_errors:
                print(f"- {marker}")
            browser.close()
            return 1

        visible_text = " ".join(body_text.split())[:400]
        print(f"Page text sample: {visible_text}")
        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
