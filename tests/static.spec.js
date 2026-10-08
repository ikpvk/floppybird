// File-level checks for to_do.md items that don't need gameplay.
const fs = require('fs');
const path = require('path');
const h = require('./helpers');
const { test, expect } = h;

const root = path.resolve(__dirname, '..');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

test.describe('Remove the analytics script', function() {
   test('index.html loads no third-party scripts', function() {
      const srcs = Array.from(read('index.html').matchAll(/<script[^>]*\bsrc="([^"]+)"/g), function(m) { return m[1]; });
      expect(srcs.filter(function(src) { return /^(https?:)?\/\//.test(src); })).toEqual([]);
   });

   test('loading and playing makes no external requests', async function({ page, externalRequests }) {
      await h.openGame(page);
      await h.startGame(page);
      await page.waitForTimeout(500);
      expect(externalRequests).toEqual([]);
   });
});

test('Death screen: no user-agent sniffing remains', function() {
   expect(read('js/main.js')).not.toContain('navigator.userAgent');
});

test('Leftover tsconfig.json is deleted', function() {
   expect(fs.existsSync(path.join(root, 'tsconfig.json'))).toBe(false);
});

test('Accessibility: the viewport allows zooming', function() {
   const viewport = read('index.html').match(/<meta name="viewport" content="([^"]*)"/)[1];
   expect(viewport).not.toMatch(/user-scalable\s*=\s*(0|no)/);
   expect(viewport).not.toMatch(/maximum-scale/);
});

test('Invalid CSS declaration is deleted', function() {
   expect(read('css/main.css')).not.toMatch(/transition\s*:\s*translate3d/);
});

test('Outdated libraries: Buzz is no longer loaded', async function({ page }) {
   await h.openGame(page);
   expect(await page.evaluate(function() { return typeof window.buzz; })).toBe('undefined');
});

test('Outdated libraries: jQuery Transit is no longer loaded', async function({ page }) {
   await h.openGame(page);
   const transit = await page.evaluate(function() {
      return !!(window.jQuery && (window.jQuery.transit || window.jQuery.fn.transition));
   });
   expect(transit).toBe(false);
});

test('Outdated libraries: jQuery is removed or at least 3.5.0', async function({ page }) {
   await h.openGame(page);
   const version = await page.evaluate(function() { return window.jQuery ? window.jQuery.fn.jquery : null; });
   if (version !== null) {
      const parts = version.split('.').map(Number);
      expect(parts[0] * 100 + parts[1], 'jQuery ' + version).toBeGreaterThanOrEqual(305);
   }
});
