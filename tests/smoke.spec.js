const { test, expect } = require('@playwright/test');

test('PEVcast homepage renders the main controls', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/index.html');

  await expect(page).toHaveTitle('PEVcast');
  await expect(page.getByRole('heading', { name: 'PEVcast' })).toBeVisible();
  await expect(page.locator('#cityTitle')).toContainText('Moon Township, PA');
  await expect(page.locator('#quickSelect')).toBeVisible();
  await expect(page.locator('#cityInput')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Search location' })).toBeVisible();
  await expect(page.locator('#gpsBtn svg')).toBeVisible();
  await expect(page.getByRole('button', { name: /Range:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chart Compare' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Menu/ })).toBeVisible();

  await page.getByRole('button', { name: /Menu/ }).click();
  await expect(page.locator('#mLocationsSection')).toBeVisible();
  await expect(page.locator('#mLocationsSection details, #mLocationsSection summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Quick List' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('location search opens a focused dialog and returns DC suggestions', async ({ page }) => {
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('name') || '';
    if (query.toLowerCase().includes('washington') || query.toLowerCase().includes('district')) {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ results: [{
          name: 'Washington',
          admin1: 'District of Columbia',
          country: 'United States',
          latitude: 38.9072,
          longitude: -77.0369,
        }] }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Search location' }).click();

  await expect(page.locator('#locationSearchModal')).toBeVisible();
  await expect(page.locator('#locationSearchInput')).toBeFocused();
  await page.locator('#locationSearchInput').fill('DC');
  await expect(page.locator('.location-search-option-primary').first()).toHaveText('Washington');
  await expect(page.locator('.location-search-option-secondary').first()).toContainText('District of Columbia');
  await expect(page.locator('#locationSearchInput')).toHaveAttribute('aria-expanded', 'true');

  await page.getByRole('button', { name: 'Close location search' }).click();
  await expect(page.locator('#locationSearchModal')).toBeHidden();
});

test('mobile location search uses the available visual viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Search location' }).click();

  const layout = await page.evaluate(() => {
    const sheet = document.querySelector('.location-search-sheet').getBoundingClientRect();
    const input = document.querySelector('#locationSearchInput').getBoundingClientRect();
    return { sheetTop: Math.round(sheet.top), sheetHeight: Math.round(sheet.height), inputTop: Math.round(input.top) };
  });

  expect(layout.sheetTop).toBe(0);
  expect(layout.sheetHeight).toBeGreaterThan(700);
  expect(layout.inputTop).toBeGreaterThanOrEqual(12);
});

test('Android back closes open surfaces before requesting app close', async ({ page }) => {
  let closeCalls = 0;
  await page.exposeFunction('__recordPevcastClose', () => { closeCalls += 1; });
  await page.addInitScript(() => {
    window.__pevcastCloseCalls = 0;
    window.close = () => {
      window.__pevcastCloseCalls += 1;
      window.__recordPevcastClose();
    };
  });
  await page.goto('/index.html');

  await page.getByRole('button', { name: /Menu/ }).click();
  await expect(page.locator('#appMenuPanel')).toBeVisible();

  await page.evaluate(() => history.back());
  await expect(page.locator('#appMenuPanel')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__pevcastCloseCalls)).toBe(0);

  await page.evaluate(() => history.back());
  await expect.poll(() => closeCalls).toBe(1);
});

test('Android back on the main chart screen requests app close without prompting', async ({ page }) => {
  let closeCalls = 0;
  let confirmCalls = 0;
  await page.exposeFunction('__recordPevcastClose', () => { closeCalls += 1; });
  await page.exposeFunction('__recordPevcastConfirm', () => { confirmCalls += 1; });
  await page.addInitScript(() => {
    window.__pevcastCloseCalls = 0;
    window.__pevcastConfirmCalls = 0;
    window.close = () => {
      window.__pevcastCloseCalls += 1;
      window.__recordPevcastClose();
    };
    window.confirm = () => {
      window.__pevcastConfirmCalls += 1;
      window.__recordPevcastConfirm();
      return false;
    };
  });
  await page.goto('/index.html');
  await expect(page.locator('#cityTitle')).toContainText('Moon Township, PA');
  await expect.poll(() => page.evaluate(() => history.state?.pevcastBackGuard === true)).toBe(true);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#pevcast-main');

  await page.evaluate(() => history.back());
  await expect.poll(() => closeCalls).toBe(1);
  expect(confirmCalls).toBe(0);
});

test('Android back after using Range requests app close without prompting', async ({ page }) => {
  let closeCalls = 0;
  let confirmCalls = 0;
  await page.exposeFunction('__recordPevcastClose', () => { closeCalls += 1; });
  await page.exposeFunction('__recordPevcastConfirm', () => { confirmCalls += 1; });
  await page.addInitScript(() => {
    window.__pevcastCloseCalls = 0;
    window.__pevcastConfirmCalls = 0;
    window.close = () => {
      window.__pevcastCloseCalls += 1;
      window.__recordPevcastClose();
    };
    window.confirm = () => {
      window.__pevcastConfirmCalls += 1;
      window.__recordPevcastConfirm();
      return false;
    };
  });
  await page.goto('/index.html');
  await expect(page.locator('#cityTitle')).toContainText('Moon Township, PA');
  await expect.poll(() => page.evaluate(() => history.state?.pevcastBackGuard === true)).toBe(true);
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#pevcast-main');

  await page.getByRole('button', { name: /Range:/ }).click();
  await page.evaluate(() => history.back());
  await expect.poll(() => closeCalls).toBe(1);
  expect(confirmCalls).toBe(0);
});

test('visible-hours scrolling keeps both y axes visible', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#stickyYAxisLeftCanvas')).toBeVisible();
  await expect(page.locator('#stickyYAxisRightCanvas')).toBeVisible();

  await page.locator('#mainScrollScale').evaluate((slider) => {
    slider.value = slider.min;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect.poll(async () => page.locator('#chartScroll').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

  const before = await page.evaluate(() => {
    const left = document.getElementById('stickyYAxisLeftCanvas').getBoundingClientRect();
    const right = document.getElementById('stickyYAxisRightCanvas').getBoundingClientRect();
    return { leftX: Math.round(left.left), rightX: Math.round(right.right) };
  });

  await page.locator('#chartScroll').evaluate((el) => { el.scrollLeft = el.scrollWidth; });

  const after = await page.evaluate(() => {
    const left = document.getElementById('stickyYAxisLeftCanvas').getBoundingClientRect();
    const right = document.getElementById('stickyYAxisRightCanvas').getBoundingClientRect();
    return { leftX: Math.round(left.left), rightX: Math.round(right.right) };
  });

  expect(after).toEqual(before);
});

test('visible-hours selection survives a viewport resize', async ({ page }) => {
  await page.goto('/index.html');
  const slider = page.locator('#mainScrollScale');
  await expect(slider).toBeVisible();
  await expect.poll(async () => slider.evaluate((element) => Number(element.dataset.visibleHoursTotal) > 0)).toBe(true);

  await slider.evaluate((element) => {
    element.value = element.min;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const selectedStop = await slider.inputValue();
  const selectedLabel = await page.locator('#mainScrollScaleValue').textContent();

  await page.setViewportSize({ width: 960, height: 760 });

  await expect(slider).toHaveValue(selectedStop);
  await expect(page.locator('#mainScrollScaleValue')).toHaveText(selectedLabel || '');
  await expect.poll(async () => page.locator('#chartScroll').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});

test('GPS resolving overlay can be canceled back to the last location', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#cityTitle')).toContainText('Moon Township, PA');
  await expect(page.locator('#mainScrollScaleValue')).toContainText('24h');

  const dialogs = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = () => {};
  });

  await page.getByRole('button', { name: 'Use GPS' }).click();
  await expect(page.locator('#locationLoadingOverlay')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#locationLoadingOverlay')).toBeHidden();
  await expect(page.locator('#cityTitle')).toContainText('Moon Township, PA');
  expect(dialogs).toEqual([]);
});

test('startup does not request fresh geolocation without a user gesture', async ({ page }) => {
  let geolocationCalls = 0;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: () => { window.__geolocationCalls = (window.__geolocationCalls || 0) + 1; },
      },
    });
    window.__geolocationCalls = 0;
  });

  await page.goto('/index.html');
  await expect(page.locator('#cityTitle')).toContainText('Moon Township, PA');
  geolocationCalls = await page.evaluate(() => window.__geolocationCalls);
  expect(geolocationCalls).toBe(0);
});

test('mobile quick select keeps Use GPS beside it at content width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/index.html');

  const layout = await page.evaluate(() => {
    const quick = document.getElementById('quickSelect').getBoundingClientRect();
    const gps = document.getElementById('gpsBtn').getBoundingClientRect();
    return {
      sameRow: Math.abs(quick.top - gps.top) < 3,
      gpsRightOfQuick: gps.left > quick.right,
      gpsWidth: Math.round(gps.width),
    };
  });

  expect(layout.sameRow).toBe(true);
  expect(layout.gpsRightOfQuick).toBe(true);
  expect(layout.gpsWidth).toBeLessThan(110);
});

test('menu cycles chart between three heights', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#cityTitle')).toContainText('Moon Township, PA');
  await page.getByRole('button', { name: /Menu/ }).click();
  const heightButton = page.getByRole('button', { name: /Chart Height:/ });
  await expect(heightButton).toHaveText('Chart Height: Tall');

  const initialTall = await page.locator('.chart-container').evaluate((el) => Math.round(el.getBoundingClientRect().height));
  await heightButton.click();
  await expect(heightButton).toHaveText('Chart Height: Short');
  const short = await page.locator('.chart-container').evaluate((el) => Math.round(el.getBoundingClientRect().height));

  await heightButton.click();
  await expect(heightButton).toHaveText('Chart Height: Medium');
  const medium = await page.locator('.chart-container').evaluate((el) => Math.round(el.getBoundingClientRect().height));

  await heightButton.click();
  await expect(heightButton).toHaveText('Chart Height: Tall');
  const tallAgain = await page.locator('.chart-container').evaluate((el) => Math.round(el.getBoundingClientRect().height));

  expect(short).toBeLessThan(medium);
  expect(medium).toBeLessThan(tallAgain);
  expect(tallAgain).toBeGreaterThanOrEqual(initialTall);
});

test('location tools stay grouped and aligned on wide and mobile layouts', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 760 }, { width: 390, height: 860 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/index.html');

    const layout = await page.evaluate(() => {
      const ids = ['quickSelect', 'gpsBtn', 'locationSearchBtn', 'radarBtn'];
      const rects = Object.fromEntries(ids.map((id) => {
        const rect = document.getElementById(id).getBoundingClientRect();
        return [id, { top: Math.round(rect.top), height: Math.round(rect.height) }];
      }));
      return {
        rects,
        sameLocationToolsParent: document.getElementById('locationSearchBtn').parentElement === document.getElementById('radarBtn').parentElement,
        maximizeButtonCount: document.querySelectorAll('#chartMaxBtn').length,
      };
    });

    expect(layout.sameLocationToolsParent).toBe(true);
    expect(layout.maximizeButtonCount).toBe(0);
    expect(layout.rects.locationSearchBtn.height).toBe(34);
    expect(layout.rects.radarBtn.height).toBe(34);
    expect(layout.rects.locationSearchBtn.top).toBe(layout.rects.radarBtn.top);
    expect(layout.rects.quickSelect.height).toBe(34);
    expect(layout.rects.gpsBtn.height).toBe(34);
  }
});

test('snapshot dialog offers a persistent legend and adds it to the image', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#cityTitle')).toContainText('Moon Township, PA');
  await page.waitForFunction(() => document.getElementById('weatherChart')?.height > 200);

  await page.getByRole('button', { name: 'Save Snapshot' }).click();
  const legend = page.locator('#snapshotShowLegend');
  await expect(legend).not.toBeChecked();
  await legend.check();
  await page.locator('#snapshotCancelBtn').click();

  await page.getByRole('button', { name: 'Save Snapshot' }).click();
  await expect(page.locator('#snapshotShowLegend')).toBeChecked();
  await page.locator('#snapshotCancelBtn').click();

  const dimensions = await page.evaluate(async () => {
    const captured = [];
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      captured.push({ width: this.width, height: this.height });
      callback(new Blob(['snapshot'], { type: args[0] || 'image/png' }));
    };
    try {
      await window.buildChartSnapshotBlob('all', false);
      await window.buildChartSnapshotBlob('all', true);
    } finally {
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
    }
    return captured.slice(-2);
  });

  expect(dimensions).toHaveLength(2);
  expect(dimensions[1].height).toBeGreaterThan(dimensions[0].height);
});
