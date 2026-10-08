const h = require('./helpers');
const { test, expect, STATE } = h;

test.describe('Mouse clicks work on touchscreen laptops', function() {
   test.use({ hasTouch: true });

   // Taps already work; starting this way keeps each test on its own assertion.
   async function startByTap(page) {
      await page.touchscreen.tap(150, 300);
      await expect.poll(function() { return h.getState(page); }).toBe(STATE.Game);
   }

   test('the page reports touch support', async function({ page }) {
      await h.openGame(page);
      expect(await page.evaluate(function() { return 'ontouchstart' in window; })).toBe(true);
   });

   test('a mouse click starts the game', async function({ page }) {
      await h.openGame(page);
      await h.startGame(page);
   });

   test('a mouse click flaps during a round', async function({ page }) {
      await h.openGame(page);
      await startByTap(page);
      await h.countCalls(page, 'playerJump');
      await h.clickGame(page);
      expect(await h.callCount(page, 'playerJump')).toBe(1);
   });

   test('one tap flaps exactly once', async function({ page }) {
      // A tap fires touchstart, pointerdown and mousedown; only one may count.
      await h.openGame(page);
      await startByTap(page);
      await h.countCalls(page, 'playerJump');
      await page.touchscreen.tap(150, 300);
      await page.waitForTimeout(100);
      expect(await h.callCount(page, 'playerJump')).toBe(1);
   });
});

test.describe('Spacebar handling', function() {
   test('space starts the game', async function({ page }) {
      // Guards against reading e.code from jQuery 1.10's event wrapper, which lacks it.
      await h.openGame(page);
      await page.keyboard.press('Space');
      await expect.poll(function() { return h.getState(page); }).toBe(STATE.Game);
   });

   test('space flaps during a round', async function({ page }) {
      await h.openGame(page);
      await h.startGame(page);
      await h.countCalls(page, 'playerJump');
      await page.keyboard.press('Space');
      expect(await h.callCount(page, 'playerJump')).toBe(1);
   });

   test('holding space flaps only once', async function({ page }) {
      await h.openGame(page);
      await h.startGame(page);
      await h.countCalls(page, 'playerJump');
      // Repeated keyboard.down() calls without keyboard.up() send repeat: true.
      await page.keyboard.down('Space');
      await page.keyboard.down('Space');
      await page.keyboard.down('Space');
      await page.keyboard.up('Space');
      expect(await h.callCount(page, 'playerJump')).toBe(1);
   });

   test('space during a round prevents the default action', async function({ page }) {
      await h.openGame(page);
      await h.startGame(page);
      await page.evaluate(function() {
         window.addEventListener('keydown', function(e) {
            if (e.code === 'Space') window.__spacePrevented = e.defaultPrevented;
         });
      });
      await page.keyboard.press('Space');
      expect(await page.evaluate(function() { return window.__spacePrevented; })).toBe(true);
   });
});

test.describe('Footer clicks and secondary mouse buttons', function() {
   test('right-clicking the game does not start a round', async function({ page }) {
      await h.openGame(page);
      await h.clickGame(page, { button: 'right' });
      await page.waitForTimeout(200);
      expect(await h.getState(page)).toBe(STATE.Splash);
   });

   test('right-clicking during a round does not flap', async function({ page }) {
      await h.openGame(page);
      await h.startGame(page);
      await h.countCalls(page, 'playerJump');
      await h.clickGame(page, { button: 'right' });
      expect(await h.callCount(page, 'playerJump')).toBe(0);
   });

   test('pressing a footer link does not start a round', async function({ page }) {
      await h.openGame(page);
      const link = page.locator('#footer a').first();
      await link.dispatchEvent('pointerdown', { button: 0, isPrimary: true });
      await link.dispatchEvent('mousedown', { button: 0 });
      await link.dispatchEvent('touchstart');
      await page.waitForTimeout(200);
      expect(await h.getState(page)).toBe(STATE.Splash);
   });
});
