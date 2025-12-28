from playwright.sync_api import Page, expect, sync_playwright
import time
import os

def verify_images_loading(page: Page):
    # Navigate to the app
    page.goto("http://localhost:8000")

    # Wait for the sheet select to be enabled
    page.wait_for_function("document.getElementById('sheetSelect').disabled === false", timeout=10000)

    # Select 'Miscellaneous' sheet
    page.select_option("#sheetSelect", "Miscellaneous")

    # Wait for data table to appear
    page.wait_for_selector("#dataTable tbody tr", timeout=20000)

    # Get visible headers
    headers = page.locator("#tableHead th").all_inner_texts()
    print(f"Visible Headers: {headers}")

    # Get all available headers from JS context
    all_headers = page.evaluate("allHeaders")
    print(f"All Available Headers: {all_headers}")

    # Verify 'Image' is before 'Name' (case insensitive)
    headers_lower = [h.lower() for h in headers]
    if "image" in headers_lower and "name" in headers_lower:
        img_idx = headers_lower.index("image")
        name_idx = headers_lower.index("name")
        if img_idx < name_idx:
            print("SUCCESS: Image column is before Name column.")
        else:
            print(f"FAILURE: Image column (idx {img_idx}) is NOT before Name column (idx {name_idx}).")
    else:
        print("FAILURE: 'Image' or 'Name' header not found in visible headers.")

    # Wait a bit for images
    time.sleep(3)

    # Take a screenshot
    screenshot_path = "verification/misc_load.png"
    page.screenshot(path=screenshot_path, full_page=True)
    print(f"Screenshot saved to {screenshot_path}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_images_loading(page)
            print("Verification script finished successfully.")
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            exit(1)
        finally:
            browser.close()
