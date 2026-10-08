const fs = require('fs');
const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.PORT) || 8123;

// Use a system Chromium when one exists so `npx playwright install` isn't needed.
const executablePath = process.env.CHROMIUM_PATH ||
   ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']
      .find(function(p) { return fs.existsSync(p); });

module.exports = defineConfig({
   testDir: 'tests',
   fullyParallel: true,
   reporter: 'list',
   use: {
      baseURL: 'http://127.0.0.1:' + PORT,
      viewport: { width: 1280, height: 720 },
      launchOptions: {
         executablePath: executablePath,
         args: ['--autoplay-policy=no-user-gesture-required']
      }
   },
   webServer: {
      command: 'node tests/server.js',
      url: 'http://127.0.0.1:' + PORT + '/index.html',
      env: { PORT: String(PORT) },
      reuseExistingServer: !process.env.CI
   }
});
