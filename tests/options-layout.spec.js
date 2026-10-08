const h = require('./helpers');
const { test, expect } = h;

// Spawns one pipe with the game's own spawner and returns its gap height.
async function measureGap(page) {
   await h.setBird(page, { position: 180, velocity: 0, gravity: 0 });
   await page.clock.runFor(1500);
   return page.locator('.pipe').first().evaluate(function(pipe) {
      var upper = pipe.querySelector('.pipe_upper').getBoundingClientRect();
      var lower = pipe.querySelector('.pipe_lower').getBoundingClientRect();
      var scale = pipe.getBoundingClientRect().height / pipe.offsetHeight;
      return Math.round((lower.top - upper.bottom) / scale);
   });
}

test.describe('Easy and debug options', function() {
   const cases = [
      { query: '', easy: false, debug: false },
      { query: '?easy', easy: true, debug: false },
      { query: '?debug', easy: false, debug: true },
      { query: '?easy&debug', easy: true, debug: true },
      { query: '?debug&easy', easy: true, debug: true },
      { query: '?easy=1', easy: true, debug: false },
      { query: '?easy&utm_source=test', easy: true, debug: false },
      { query: '?utm_source=test&debug', easy: false, debug: true }
   ];

   for (const c of cases) {
      test('"' + (c.query || 'no query') + '": easy ' + c.easy + ', debug ' + c.debug, async function({ page }) {
         await h.openGame(page, { clock: true, query: c.query });
         await h.startGame(page);
         if (c.debug)
            await expect(page.locator('#playerbox')).toBeVisible();
         else
            await expect(page.locator('#playerbox')).toBeHidden();
         expect(await measureGap(page)).toBe(c.easy ? 200 : 90);
      });
   }
});

test.describe('Short viewports show the whole playfield', function() {
   async function expectPlayfieldVisible(page) {
      const box = await page.evaluate(function() {
         var land = document.getElementById('land').getBoundingClientRect();
         var fly = document.getElementById('flyarea').getBoundingClientRect();
         return { flyTop: fly.top, landTop: land.top, landBottom: land.bottom, height: innerHeight };
      });
      expect(box.flyTop, 'fly area top').toBeGreaterThanOrEqual(-1);
      expect(box.landTop, 'ground top').toBeLessThan(box.height);
      expect(box.landBottom, 'ground bottom').toBeLessThanOrEqual(box.height + 1);
   }

   test('landscape phone (568x320)', async function({ page }) {
      await page.setViewportSize({ width: 568, height: 320 });
      await h.openGame(page);
      await expectPlayfieldVisible(page);
   });

   test('after rotating from portrait to landscape', async function({ page }) {
      await page.setViewportSize({ width: 320, height: 568 });
      await h.openGame(page);
      await page.setViewportSize({ width: 568, height: 320 });
      await page.waitForTimeout(100);
      await expectPlayfieldVisible(page);
   });

   test('the bird dies on the visible ground', async function({ page }) {
      await page.setViewportSize({ width: 568, height: 320 });
      await h.openGame(page);
      await h.startGame(page);
      await expect.poll(function() { return h.getState(page); }, { timeout: 6000 }).toBe(h.STATE.Score);
      const birdBottom = await page.locator('#player').evaluate(function(el) { return el.getBoundingClientRect().bottom; });
      expect(birdBottom).toBeLessThanOrEqual(320);
   });

   test('desktop (1280x720)', async function({ page }) {
      await h.openGame(page);
      await expectPlayfieldVisible(page);
   });
});

test.describe('Pipes spawn at the playfield right edge', function() {
   for (const width of [375, 768, 1920]) {
      test('viewport width ' + width, async function({ page }) {
         await page.setViewportSize({ width: width, height: 720 });
         await h.openGame(page, { clock: true });
         await h.startGame(page);
         await h.setBird(page, { position: 180, velocity: 0, gravity: 0 });
         // The first pipe spawns 1400ms into the round.
         await page.clock.runFor(1401);
         const pos = await page.evaluate(function() {
            var pipe = document.querySelector('.pipe');
            return {
               pipeLeft: pipe.getBoundingClientRect().left,
               fieldRight: document.getElementById('flyarea').getBoundingClientRect().right
            };
         });
         expect(pos.pipeLeft).toBeGreaterThanOrEqual(pos.fieldRight - 5);
         expect(pos.pipeLeft).toBeLessThanOrEqual(pos.fieldRight + 60);
      });
   }
});
