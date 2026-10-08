const h = require('./helpers');
const { test, expect } = h;

test.describe('Invalid saved scores', function() {
   const cases = [
      { saved: 'invalid', shown: '0' },
      { saved: '12abc', shown: '0' },
      { saved: '1e21', shown: '0' },
      { saved: '99999999999999999999', shown: '0' }, // not a safe integer
      { saved: '-5', shown: '0' },
      { saved: '42', shown: '42' }
   ];

   for (const c of cases) {
      test('saved "' + c.saved + '" shows a high score of ' + c.shown, async function({ page, failedResponses }) {
         await h.seedHighscore(page, c.saved);
         await h.openGame(page);
         await h.showScoreboard(page, 0);
         expect(await h.shownDigits(page, '#highscore')).toBe(c.shown);
         expect(failedResponses).toEqual([]);
      });
   }

   test('a new score replaces an invalid saved score', async function({ page }) {
      await h.seedHighscore(page, 'invalid');
      await h.openGame(page);
      await h.showScoreboard(page, 3);
      expect(await h.shownDigits(page, '#highscore')).toBe('3');
   });

   test('a long high score stays inside its scoreboard row', async function({ page }) {
      await h.seedHighscore(page, String(Number.MAX_SAFE_INTEGER));
      await h.openGame(page);
      await h.showScoreboard(page, 0);
      // Wait for the slide-in to finish so the boxes are in their final place.
      await page.waitForTimeout(800);
      // 16 digits at 14px each don't fit the 104px row; they must not spill out of
      // it sideways or wrap onto extra lines over the rest of the scoreboard.
      const overflow = await page.evaluate(function() {
         var row = document.getElementById('highscore').getBoundingClientRect();
         return Array.from(document.querySelectorAll('#highscore img')).filter(function(img) {
            var r = img.getBoundingClientRect();
            return r.left < row.left - 1 || r.right > row.right + 1 ||
               r.top < row.top - 1 || r.bottom > row.bottom + 1;
         }).length;
      });
      expect(overflow).toBe(0);
   });
});

test.describe('High score storage', function() {
   test('the high score is saved to localStorage', async function({ page }) {
      await h.openGame(page);
      await h.showScoreboard(page, 5);
      const values = await page.evaluate(function() {
         return Object.keys(localStorage).map(function(k) { return localStorage.getItem(k); });
      });
      expect(values).toContain('5');
   });

   test('the game works when localStorage throws', async function({ page, pageErrors }) {
      await page.addInitScript(function() {
         ['getItem', 'setItem', 'removeItem'].forEach(function(name) {
            Storage.prototype[name] = function() { throw new Error('storage disabled'); };
         });
      });
      await h.openGame(page);
      await h.showScoreboard(page, 5);
      expect(await h.shownDigits(page, '#highscore')).toBe('5');
      expect(pageErrors).toEqual([]);
   });
});

test('Accidental global variable `medal`', async function({ page }) {
   await h.openGame(page);
   await h.showScoreboard(page, 25);
   expect(await page.evaluate(function() { return typeof window.medal; })).not.toBe('string');
});
