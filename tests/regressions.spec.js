// "Already working well (keep these)" plus flows the fixes must not break.
// These pass on the current code.
const h = require('./helpers');
const { test, expect, STATE } = h;

test('a full round: start, die, scoreboard, replay, splash', async function({ page }) {
   await h.openGame(page);
   await h.startGame(page);
   await expect(page.locator('#replay')).toBeVisible({ timeout: 8000 });
   await expect.poll(function() {
      return page.evaluate(function() { return window.replayclickable; });
   }).toBe(true);
   await page.locator('#replay').click();
   await expect.poll(function() { return h.getState(page); }, { timeout: 4000 }).toBe(STATE.Splash);
   await expect(page.locator('#scoreboard')).toBeHidden();
});

test('space on the scoreboard replays', async function({ page }) {
   await h.openGame(page);
   await h.showScoreboard(page, 0);
   await page.evaluate(function() { window.currentstate = 2; });
   await page.keyboard.press('Space');
   await expect.poll(function() { return h.getState(page); }, { timeout: 4000 }).toBe(STATE.Splash);
});

test.describe('Medals', function() {
   const cases = [[9, null], [10, 'bronze'], [20, 'silver'], [30, 'gold'], [40, 'platinum'], [99, 'platinum']];
   for (const c of cases) {
      test('score ' + c[0] + ': ' + (c[1] || 'no medal'), async function({ page }) {
         await h.openGame(page);
         await h.showScoreboard(page, c[0]);
         const medal = page.locator('#medal img');
         if (c[1] === null)
            await expect(medal).toHaveCount(0);
         else
            await expect(medal).toHaveAttribute('src', 'assets/medal_' + c[1] + '.png');
      });
   }
});

test('scoreboard shows the current score', async function({ page }) {
   await h.openGame(page);
   await h.showScoreboard(page, 17);
   expect(await h.shownDigits(page, '#currentscore')).toBe('17');
});

test('the high score survives a reload', async function({ page }) {
   await h.openGame(page);
   await h.showScoreboard(page, 12);
   await page.reload();
   await expect.poll(function() { return h.getState(page); }).toBe(STATE.Splash);
   await h.showScoreboard(page, 0);
   expect(await h.shownDigits(page, '#highscore')).toBe('12');
});

test('a lower score does not replace the high score', async function({ page }) {
   await h.seedHighscore(page, '12');
   await h.openGame(page);
   await h.showScoreboard(page, 4);
   expect(await h.shownDigits(page, '#highscore')).toBe('12');
});

test('the big score counts points during a round', async function({ page }) {
   await h.openGame(page, { clock: true });
   await h.startGame(page);
   await h.placePipe(page, { left: 6, gapTop: 200 });
   await h.setBird(page, { position: 230, velocity: 0 });
   await h.tick(page);
   expect(await h.shownDigits(page, '#bigscore')).toBe('1');
});
