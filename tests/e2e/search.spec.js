/**
 * Search + map interaction tests.
 * All external APIs (Nominatim, Overpass) are intercepted with mock responses
 * so tests are deterministic and offline-safe.
 */
import { test, expect } from '@playwright/test';

// ── Mock data ──────────────────────────────────────────────────────────────

/** Nominatim geocoding result — Basavanagudi, Bengaluru */
const MOCK_GEOCODE = [
  {
    lat: '12.9452',
    lon: '77.5754',
    display_name: 'Basavanagudi, South, Bruhat Bengaluru Mahanagara Palike, Karnataka, India',
    boundingbox: ['12.9268', '12.9628', '77.5543', '77.5965'],
  },
];

/** Overpass API response — three water nodes */
const MOCK_OVERPASS = {
  version: 0.6,
  elements: [
    {
      type: 'node',
      id: 100001,
      lat: 12.9452,
      lon: 77.5754,
      tags: { amenity: 'drinking_water', name: 'Gandhi Park Tap' },
    },
    {
      type: 'node',
      id: 100002,
      lat: 12.9430,
      lon: 77.5720,
      tags: { amenity: 'drinking_water' },
    },
    {
      type: 'node',
      id: 100003,
      lat: 12.9480,
      lon: 77.5780,
      tags: { amenity: 'fountain', drinking_water: 'yes', name: 'Bugle Rock Fountain' },
    },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function interceptAPIs(page) {
  await page.route('**/nominatim.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_GEOCODE) })
  );
  await page.route('**/overpass-api.de/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_OVERPASS) })
  );
}

async function doSearch(page) {
  await interceptAPIs(page);
  await page.goto('/');
  await page.fill('#searchInput', 'Basavanagudi');
  await page.click('#searchButton');
  // Wait for result count to appear
  await expect(page.locator('#statusMessage')).toContainText('free drinking water location', { timeout: 10_000 });
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Search flow', () => {
  test('searching a city shows result count', async ({ page }) => {
    await doSearch(page);
    await expect(page.locator('#statusMessage')).toContainText('3 free drinking water location');
  });

  test('body switches to results mode after search', async ({ page }) => {
    await doSearch(page);
    await expect(page.locator('body')).toHaveClass(/has-map-results/);
  });

  test('Refresh area button appears after search', async ({ page }) => {
    await doSearch(page);
    await expect(page.locator('#searchAreaButton')).toBeVisible();
  });
});

test.describe('Map markers', () => {
  test('water markers appear on the map after search', async ({ page }) => {
    await doSearch(page);
    // Each result gets a .waterMarkerIcon div in the Leaflet marker pane
    const markers = page.locator('.waterMarkerIcon');
    await expect(markers).toHaveCount(3, { timeout: 8_000 });
  });

  test('each marker contains the water-marker SVG image', async ({ page }) => {
    await doSearch(page);
    const markerImgs = page.locator('.waterMarkerIcon img');
    const count = await markerImgs.count();
    expect(count).toBe(3);
    for (let i = 0; i < count; i++) {
      await expect(markerImgs.nth(i)).toBeVisible();
      const box = await markerImgs.nth(i).boundingBox();
      expect(box.width).toBeGreaterThan(10);
      expect(box.height).toBeGreaterThan(10);
    }
  });

  test('markers are within the visible map area', async ({ page }) => {
    await doSearch(page);
    const mapBox  = await page.locator('#map').boundingBox();
    const markers = page.locator('.waterMarkerIcon');
    const count   = await markers.count();
    for (let i = 0; i < count; i++) {
      const mBox = await markers.nth(i).boundingBox();
      if (!mBox) continue;
      // Marker anchor centre should be inside the map container
      const cx = mBox.x + mBox.width / 2;
      const cy = mBox.y + mBox.height / 2;
      expect(cx).toBeGreaterThan(mapBox.x);
      expect(cx).toBeLessThan(mapBox.x + mapBox.width);
      expect(cy).toBeGreaterThan(mapBox.y);
      expect(cy).toBeLessThan(mapBox.y + mapBox.height);
    }
  });
});

test.describe('Water card (desktop popup)', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop popup — see mobile sheet tests');

  test('clicking a marker opens a Leaflet popup', async ({ page }) => {
    await doSearch(page);
    await page.locator('.waterMarkerIcon').first().click();
    await expect(page.locator('.leaflet-popup')).toBeVisible({ timeout: 5_000 });
  });

  test('popup contains site name', async ({ page }) => {
    await doSearch(page);
    await page.locator('.waterMarkerIcon').first().click();
    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText(/Gandhi Park Tap|Drinking Water|Free Water/i);
  });

  test('popup has action links (directions, OSM record)', async ({ page }) => {
    await doSearch(page);
    await page.locator('.waterMarkerIcon').first().click();
    const popup = page.locator('.leaflet-popup-content');
    await expect(popup.locator('a[href*="google.com/maps"]')).toBeVisible();
    await expect(popup.locator('a[href*="openstreetmap.org"]')).toHaveCount(2);
  });
});

test.describe('Water sheet (mobile bottom sheet)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile sheet — see desktop popup tests');

  test('clicking a marker opens the bottom sheet', async ({ page }) => {
    await doSearch(page);
    await page.locator('.waterMarkerIcon').first().click();
    await expect(page.locator('#waterSheet')).toBeVisible({ timeout: 5_000 });
  });

  test('bottom sheet contains site content', async ({ page }) => {
    await doSearch(page);
    await page.locator('.waterMarkerIcon').first().click();
    await expect(page.locator('#waterSheetContent')).toContainText(/water|fountain/i);
  });

  test('close button hides the sheet', async ({ page }) => {
    await doSearch(page);
    await page.locator('.waterMarkerIcon').first().click();
    await expect(page.locator('#waterSheet')).toBeVisible();
    await page.click('#waterSheetClose');
    await expect(page.locator('#waterSheet')).toBeHidden({ timeout: 3_000 });
  });

  test('ESC closes the sheet', async ({ page }) => {
    await doSearch(page);
    await page.locator('.waterMarkerIcon').first().click();
    await expect(page.locator('#waterSheet')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#waterSheet')).toBeHidden({ timeout: 3_000 });
  });
});

test.describe('Closest water button', () => {
  test('closest water button appears after search when location available', async ({ page }) => {
    // Grant geolocation permission and set a position inside Basavanagudi
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 12.9452, longitude: 77.5754 });
    await doSearch(page);
    // Button appears once a nearest site is computed
    await expect(page.locator('#closestWaterButton')).toBeVisible({ timeout: 5_000 });
  });
});
