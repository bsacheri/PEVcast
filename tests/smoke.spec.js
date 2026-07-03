const { test, expect } = require('@playwright/test');

test('PEVcast homepage renders the main controls', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/index.html');

  await expect(page).toHaveTitle('PEVcast');
  await expect(page.getByRole('heading', { name: 'PEVcast' })).toBeVisible();
  await expect(page.locator('#cityTitle')).toContainText('Moon Township, PA');
  await expect(page.locator('#quickSelect')).toBeVisible();
  await expect(page.locator('#cityInput')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Range:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chart Compare' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Menu/ })).toBeVisible();

  await page.getByRole('button', { name: /Menu/ }).click();
  await expect(page.locator('#mLocationsSection')).toBeVisible();
  await expect(page.locator('#mLocationsSection details, #mLocationsSection summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit Quick List' })).toBeVisible();

  expect(pageErrors).toEqual([]);
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

test('maximized mobile hides chart compare and moves visible-hours below buttons', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/index.html');
  await expect(page.locator('#mainScrollScaleValue')).toContainText('24h', { timeout: 15000 });

  await page.locator('#chartMaxBtn').click();

  await expect(page.locator('.compare-action')).toBeHidden();
  const layout = await page.evaluate(() => {
    const buttons = document.getElementById('btnContainer').getBoundingClientRect();
    const slider = document.getElementById('scrollScaleControlContainer').getBoundingClientRect();
    return {
      sliderBelowButtons: slider.top >= buttons.bottom + 4,
      sliderTop: Math.round(slider.top),
      buttonBottom: Math.round(buttons.bottom),
    };
  });

  expect(layout.sliderBelowButtons).toBe(true);
});
