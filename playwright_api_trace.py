from __future__ import annotations

import json
import sys

from playwright.sync_api import sync_playwright


def main() -> int:
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000"
    bad_responses: list[dict[str, str | int]] = []
    api_responses: list[dict[str, str | int]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()

        def handle_response(response):
            url = response.url
            if "127.0.0.1:8000" not in url and "localhost:8000" not in url:
                return
            item = {
                "url": url,
                "status": response.status,
                "method": response.request.method,
            }
            api_responses.append(item)
            if response.status >= 400:
                bad_responses.append(item)

        page.on("response", handle_response)

        page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(8000)

        body_text = page.locator("body").inner_text(timeout=10000)
        print(f"Loaded URL: {target_url}")
        print(f"API responses seen: {len(api_responses)}")
        print(f"Bad API responses: {len(bad_responses)}")
        for item in bad_responses[:30]:
            print(json.dumps(item))

        print("Body contains 'Network Error':", "Network Error" in body_text)
        if "Network Error" in body_text:
            start = body_text.find("Network Error")
            snippet = body_text[max(0, start - 120): start + 240]
            print("Body snippet:")
            print(snippet)

        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
