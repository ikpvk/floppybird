// "The game can get stuck on the death screen"
const h = require('./helpers');
const { test, expect, STATE } = h;

test.describe('Death screen without working audio', function() {
   test.beforeEach(async function({ page }) {
      await h.recordAudioElements(page);
      await h.blockSounds(page);
   });

   test('the scoreboard appears after a death', async function({ page }) {
      await h.openGame(page);
      await h.startGame(page);
      // No input: the bird falls to the ground within about 2 seconds.
      await expect(page.locator('#scoreboard')).toBeVisible({ timeout: 6000 });
   });

   test('the game can be replayed', async function({ page }) {
      await h.openGame(page);
      await h.startGame(page);
      await expect(page.locator('#replay')).toBeVisible({ timeout: 6000 });
      await expect.poll(function() {
         return page.evaluate(function() { return window.replayclickable; });
      }).toBe(true);
      await page.locator('#replay').click();
      await expect.poll(function() { return h.getState(page); }, { timeout: 4000 }).toBe(STATE.Splash);
      await h.startGame(page);
   });

   test('a late "ended" event does not show the scoreboard twice', async function({ page }) {
      await h.openGame(page);
      await h.startGame(page);
      await h.countCalls(page, 'showScore');
      await expect(page.locator('#scoreboard')).toBeVisible({ timeout: 6000 });
      await page.evaluate(function() {
         window.__audios.forEach(function(a) { a.dispatchEvent(new Event('ended')); });
         window.__audios.forEach(function(a) { a.dispatchEvent(new Event('ended')); });
      });
      await page.waitForTimeout(300);
      expect(await h.callCount(page, 'showScore')).toBe(1);
   });

   test('a stale "ended" from the previous death does not end the next round', async function({ page }) {
      await h.openGame(page);
      await h.startGame(page);
      await expect(page.locator('#replay')).toBeVisible({ timeout: 6000 });
      await expect.poll(function() {
         return page.evaluate(function() { return window.replayclickable; });
      }).toBe(true);
      await page.locator('#replay').click();
      await expect.poll(function() { return h.getState(page); }, { timeout: 4000 }).toBe(STATE.Splash);
      await h.startGame(page);

      // Round 2 is running. Fire the "ended" events round 1 never got.
      await page.evaluate(function() {
         window.__audios.forEach(function(a) { a.dispatchEvent(new Event('ended')); });
      });
      await page.waitForTimeout(100);
      expect(await h.getState(page)).toBe(STATE.Game);
      await expect(page.locator('#scoreboard')).toBeHidden();
   });
});
