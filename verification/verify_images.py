from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_images_loading(page: Page):
    # Navigate to the app
    page.goto("http://localhost:8000")

    # Wait for the sheet select to be enabled (it's disabled while loading sheets)
    page.wait_for_function("document.getElementById('sheetSelect').disabled === false", timeout=10000)

    # Select 'Housewares' sheet
    page.select_option("#sheetSelect", "Housewares")

    # Wait for the loading spinner to disappear
    page.wait_for_selector("#loading", state="hidden", timeout=20000)

    # Wait for data table to appear
    page.wait_for_selector("#dataTable tbody tr", timeout=20000)

    # Wait a bit for images to attempt loading
    time.sleep(5)

    # Take a screenshot
    page.screenshot(path="/home/jules/verification/initial_load.png", full_page=True)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_images_loading(page)
            print("Verification script finished successfully.")
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
        finally:
            browser.close()
