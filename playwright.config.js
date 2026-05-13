const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:8001',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'python -m http.server 8001',
    url: 'http://127.0.0.1:8001/index.html',
    reuseExistingServer: true,
    timeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
