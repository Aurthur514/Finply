from __future__ import annotations

import json
import sys
from typing import Dict, List

from playwright.sync_api import sync_playwright, Page, Browser


def wait_for_loading_to_complete(page: Page, timeout: int = 10000) -> None:
    """Wait for loading states to complete"""
    try:
        page.wait_for_function(
            "() => !document.querySelector('[class*=\"animate-pulse\"]') && !document.querySelector('[class*=\"loading\"]')",
            timeout=timeout
        )
    except:
        pass  # Continue if loading detection fails


def test_sidebar_button(page: Page, button_name: str, expected_heading: str = None) -> Dict[str, object]:
    """Test a specific sidebar button and return results"""
    result = {
        "button": button_name,
        "clicked": False,
        "loaded": False,
        "heading_found": False,
        "error": None
    }

    try:
        # Click the button
        button = page.get_by_text(button_name, exact=True).first
        button.click()
        result["clicked"] = True

        # Wait for loading
        page.wait_for_timeout(2000)
        wait_for_loading_to_complete(page)

        # Check if expected heading appears
        if expected_heading:
            try:
                heading = page.get_by_role("heading", { "name": expected_heading }).first
                result["heading_found"] = heading.is_visible(timeout=5000)
            except:
                result["heading_found"] = False

        result["loaded"] = True

    except Exception as e:
        result["error"] = str(e)

    return result


def test_overview_category(page: Page) -> List[Dict[str, object]]:
    """Test all Overview category buttons"""
    results = []

    # Dashboard
    results.append(test_sidebar_button(page, "Dashboard", "Dashboard"))

    # Market Overview
    results.append(test_sidebar_button(page, "Market Overview", "Market Overview"))

    # Cryptocurrency
    results.append(test_sidebar_button(page, "Cryptocurrency", "Cryptocurrency"))

    return results


def test_trading_category(page: Page) -> List[Dict[str, object]]:
    """Test all Trading category buttons"""
    results = []

    # Paper Trading
    results.append(test_sidebar_button(page, "Paper Trading", "Trading"))

    # Portfolio
    results.append(test_sidebar_button(page, "Portfolio", "Portfolio"))

    # Order History
    results.append(test_sidebar_button(page, "Order History", "Order History"))

    # Watchlist
    results.append(test_sidebar_button(page, "Watchlist", "Watchlist"))

    return results


def test_analysis_category(page: Page) -> List[Dict[str, object]]:
    """Test all Analysis & Research category buttons"""
    results = []

    # Technical Analysis
    results.append(test_sidebar_button(page, "Technical Analysis", "Technical Analysis"))

    # AI Predictions
    results.append(test_sidebar_button(page, "AI Predictions", "AI Predictions"))

    # Research Memo
    results.append(test_sidebar_button(page, "Research Memo", "Research Memo"))

    # Backtesting Lab
    results.append(test_sidebar_button(page, "Backtesting Lab", "Backtesting Lab"))

    # Scenario Lab
    results.append(test_sidebar_button(page, "Scenario Lab", "Scenario Lab"))

    return results


def test_tools_category(page: Page) -> List[Dict[str, object]]:
    """Test all Tools & Intelligence category buttons"""
    results = []

    # AI Copilot
    results.append(test_sidebar_button(page, "AI Copilot", "AI Assistant"))

    # News Intelligence
    results.append(test_sidebar_button(page, "News Intelligence", "News Intelligence"))

    # Risk Simulator
    results.append(test_sidebar_button(page, "Risk Simulator", "Risk Simulator"))

    return results


def test_mobile_sidebar(page: Page) -> Dict[str, object]:
    """Test mobile sidebar functionality"""
    result = {
        "mobile_sidebar_tested": False,
        "sidebar_opened": False,
        "sidebar_closed": False,
        "error": None
    }

    try:
        # Set mobile viewport
        page.set_viewport_size({"width": 375, "height": 667})

        # Look for mobile menu button (hamburger menu)
        mobile_menu_button = page.locator('[class*="md:hidden"]').first
        if mobile_menu_button.is_visible():
            mobile_menu_button.click()
            result["sidebar_opened"] = True

            page.wait_for_timeout(1000)

            # Try to close sidebar by clicking outside or close button
            page.locator('body').click(position={'x': 10, 'y': 10})
            page.wait_for_timeout(1000)

            result["sidebar_closed"] = True

        result["mobile_sidebar_tested"] = True

    except Exception as e:
        result["error"] = str(e)

    return result


def test_onboarding_flow(page: Page) -> Dict[str, object]:
    """Test onboarding tour functionality"""
    result = {
        "onboarding_tested": False,
        "tour_started": False,
        "tour_completed": False,
        "steps_navigated": 0,
        "error": None
    }

    try:
        # Check if onboarding modal appears
        onboarding_modal = page.locator('[class*="onboarding"]').first
        if onboarding_modal.is_visible(timeout=5000):
            result["tour_started"] = True

            # Count steps and try to navigate through them
            next_buttons = page.locator('button').filter(has_text="Next")
            skip_buttons = page.locator('button').filter(has_text="Skip")

            step_count = 0
            while next_buttons.count() > 0 and step_count < 10:
                next_buttons.first.click()
                page.wait_for_timeout(1000)
                step_count += 1

            result["steps_navigated"] = step_count

            # Check if tour completed
            if page.locator('text="Welcome to Finply!"').count() == 0:
                result["tour_completed"] = True

        result["onboarding_tested"] = True

    except Exception as e:
        result["error"] = str(e)

    return result


def main() -> int:
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:21908"

    results = {
        "target_url": target_url,
        "app_loaded": False,
        "overview_tests": [],
        "trading_tests": [],
        "analysis_tests": [],
        "tools_tests": [],
        "mobile_sidebar_test": {},
        "onboarding_test": {},
        "console_errors": [],
        "summary": {
            "total_buttons_tested": 0,
            "buttons_clicked_successfully": 0,
            "buttons_loaded_successfully": 0,
            "buttons_with_errors": 0
        }
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=False)  # Run in headed mode to see the tests
        page = browser.new_page()

        # Capture console errors
        console_errors: List[str] = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        try:
            # Load the application
            page.goto(target_url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(5000)
            results["app_loaded"] = True

            # Test Overview category
            results["overview_tests"] = test_overview_category(page)

            # Test Trading category
            results["trading_tests"] = test_trading_category(page)

            # Test Analysis & Research category
            results["analysis_tests"] = test_analysis_category(page)

            # Test Tools & Intelligence category
            results["tools_tests"] = test_tools_category(page)

            # Test mobile sidebar
            results["mobile_sidebar_test"] = test_mobile_sidebar(page)

            # Test onboarding flow
            results["onboarding_test"] = test_onboarding_flow(page)

        except Exception as e:
            results["error"] = str(e)

        # Collect console errors
        results["console_errors"] = console_errors[:20]

        # Calculate summary
        all_tests = (results["overview_tests"] + results["trading_tests"] +
                    results["analysis_tests"] + results["tools_tests"])

        results["summary"]["total_buttons_tested"] = len(all_tests)

        for test in all_tests:
            if test.get("clicked", False):
                results["summary"]["buttons_clicked_successfully"] += 1
            if test.get("loaded", False):
                results["summary"]["buttons_loaded_successfully"] += 1
            if test.get("error"):
                results["summary"]["buttons_with_errors"] += 1

        browser.close()

    # Print results
    print(json.dumps(results, indent=2))

    # Return success if all buttons were tested without critical errors
    return 0 if results["summary"]["buttons_with_errors"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())