/**
 * Smoke tests — page loads, static elements visible, modals open/close.
 * These run on every CI push and must never be broken by a deploy.
 */
import { test, expect } from '@playwright/test';

test.describe('Page load', () => {
  test('title is correct', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/FreeWaterSite/i);
  });

  test('map initialises', async ({ page }) => {
    await page.goto('/');
    // Leaflet injects .leaflet-container when map is ready
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });
});

test.describe('Logo', () => {
  test('logo image is visible and has valid dimensions', async ({ page }) => {
    await page.goto('/');
    const logo = page.locator('#logo');
    await expect(logo).toBeVisible();

    const box = await logo.boundingBox();
    expect(box, 'logo must have a non-zero bounding box').not.toBeNull();
    expect(box.width).toBeGreaterThan(40);   // at minimum the pin icon width
    expect(box.height).toBeGreaterThan(10);  // at minimum a visible height
  });

  test('logo aspect ratio is sensible (not squished)', async ({ page }) => {
    await page.goto('/');
    const box = await page.locator('#logo').boundingBox();
    // viewBox is 360×60 → ratio = 6.  Allow 4–8 tolerance for any breakpoint.
    const ratio = box.width / box.height;
    expect(ratio).toBeGreaterThan(4);
    expect(ratio).toBeLessThan(8);
  });

  test('logo stays visible at 390px viewport width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const logo = page.locator('#logo');
    await expect(logo).toBeVisible();
    const box = await logo.boundingBox();
    expect(box.width).toBeGreaterThan(20);
    expect(box.height).toBeGreaterThan(10);
  });

  test('logo stays visible at 320px viewport width', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    const logo = page.locator('#logo');
    await expect(logo).toBeVisible();
    const box = await logo.boundingBox();
    expect(box.width).toBeGreaterThan(20);
  });
});

test.describe('Header', () => {
  test('search input and button are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#searchInput')).toBeVisible();
    await expect(page.locator('#searchButton')).toBeVisible();
  });

  test('Give button is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#donationOpenButton')).toBeVisible();
  });

  test('mobile header: brand and give button are in the same row', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const brandBox  = await page.locator('#brand').boundingBox();
    const giveBox   = await page.locator('#donationOpenButton').boundingBox();
    const searchBox = await page.locator('#searchContainer').boundingBox();

    // Brand and Give button should share roughly the same top edge (same row)
    expect(Math.abs(brandBox.y - giveBox.y)).toBeLessThan(24);

    // Search input row sits below the brand/give row
    expect(searchBox.y).toBeGreaterThan(brandBox.y + brandBox.height - 12);
  });
});

test.describe('Donation modal', () => {
  test('opens when Give button is clicked', async ({ page }) => {
    await page.goto('/');
    await page.click('#donationOpenButton');
    await expect(page.locator('#donationOverlay')).toBeVisible();
  });

  test('closes when × button is clicked', async ({ page }) => {
    await page.goto('/');
    await page.click('#donationOpenButton');
    await page.click('#donationCloseButton');
    await expect(page.locator('#donationOverlay')).toBeHidden();
  });

  test('closes when backdrop is clicked', async ({ page }) => {
    await page.goto('/');
    await page.click('#donationOpenButton');
    // Click the overlay area outside the card
    await page.mouse.click(10, 10);
    await expect(page.locator('#donationOverlay')).toBeHidden();
  });

  test('Donate button text updates when amount changes', async ({ page }) => {
    await page.goto('/');
    await page.click('#donationOpenButton');
    await page.click('[data-amount="50"]');
    await expect(page.locator('#donateButton')).toContainText('50');
  });
});

test.describe('Mission modal (desktop only)', () => {
  test.skip(({ isMobile }) => isMobile, 'Mission toggle is desktop-only');

  test('opens when Why free water? is clicked', async ({ page }) => {
    await page.goto('/');
    await page.click('#missionToggle');
    await expect(page.locator('#missionModal')).toBeVisible();
  });

  test('closes when × is clicked', async ({ page }) => {
    await page.goto('/');
    await page.click('#missionToggle');
    await page.click('#missionClose');
    await expect(page.locator('#missionModal')).toBeHidden();
  });

  test('closes when ESC is pressed', async ({ page }) => {
    await page.goto('/');
    await page.click('#missionToggle');
    await page.keyboard.press('Escape');
    await expect(page.locator('#missionModal')).toBeHidden();
  });
});
