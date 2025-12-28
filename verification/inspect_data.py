from playwright.sync_api import Page, expect, sync_playwright
import time
import json

def verify_images_loading(page: Page):
    # Navigate to the app
    page.goto("http://localhost:8000")

    # Wait for the sheet select to be enabled
    page.wait_for_function("document.getElementById('sheetSelect').disabled === false", timeout=10000)

    # Select 'Miscellaneous' sheet
    page.select_option("#sheetSelect", "Miscellaneous")

    # Wait for data table to appear
    page.wait_for_selector("#dataTable tbody tr", timeout=20000)

    # Inspect first row data
    first_row = page.evaluate("currentData[0]")
    print(f"First Row Data: {json.dumps(first_row, indent=2)}")

    # Check Image value specifically
    image_val = first_row.get("Image", "MISSING")
    print(f"Image value: '{image_val}'")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_images_loading(page)
        except Exception as e:
            print(f"Error: {e}")
            exit(1)
        finally:
            browser.close()
