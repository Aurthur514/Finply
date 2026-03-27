from __future__ import annotations

import json
import sys

from playwright.sync_api import sync_playwright


def main() -> int:
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000"
    failed_requests: list[dict[str, str]] = []
    console_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()

        page.on(
            "requestfailed",
            lambda request: failed_requests.append(
                {
                    "url": request.url,
                    "method": request.method,
                    "failure": request.failure or "",
                }
            ),
        )
        page.on(
            "console",
            lambda message: console_errors.append(message.text) if message.type == "error" else None,
        )

        page.goto(target_url, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(5000)

        print(f"Loaded URL: {target_url}")
        print(f"Failed requests: {len(failed_requests)}")
        for item in failed_requests[:20]:
            print(json.dumps(item))

        print(f"Console errors: {len(console_errors)}")
        for item in console_errors[:20]:
            print(item)

        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
