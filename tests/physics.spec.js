const h = require('./helpers');
const { test, expect, STATE } = h;

test.describe('Physics and collision', function() {
   test.beforeEach(async function({ page }) {
      await h.openGame(page, { clock: true });
      await h.startGame(page);
   });

   test.describe('The ceiling stops upward speed', function() {
      test('hitting the ceiling zeroes upward velocity', async function({ page }) {
         await h.setBird(page, { position: 2, velocity: -4.6 });
         await h.tick(page);
         const bird = await h.getBird(page);
         expect(bird.velocity).toBeGreaterThanOrEqual(0);
         expect(bird.position).toBeGreaterThanOrEqual(0);
      });

      test('the ceiling is not fatal', async function({ page }) {
         await h.setBird(page, { position: 2, velocity: -4.6 });
         await h.tick(page);
         await h.tick(page);
         expect(await h.getState(page)).toBe(STATE.Game);
      });
   });

   test.describe('Ground and pipe collisions use the same hitbox', function() {
      // At velocity >= 10 the bird is rotated 90deg: its full rotated rectangle is
      // 34px tall, and the adjusted hitbox is 29px tall, 2.5px inside each edge.

      async function fallTo(page, offsetFromGround) {
         // Place the bird so that, after one tick at velocity 10, the top of its
         // 24px-tall element sits `offsetFromGround` px above the ground.
         const geo = await h.flyAreaGeometry(page);
         const groundY = (geo.landTop - geo.top) / geo.scale;
         await h.setBird(page, { position: groundY - offsetFromGround - 10, velocity: 9.75 });
         await h.tick(page);
      }

      test('the full rectangle touching the ground is not a death', async function({ page }) {
         // Full rectangle bottom: 1px below ground. Adjusted hitbox bottom: 1.5px above.
         await fallTo(page, 28);
         expect(await h.getState(page)).toBe(STATE.Game);
      });

      test('the adjusted hitbox touching the ground is a death', async function({ page }) {
         // Adjusted hitbox bottom: 1.5px below ground.
         await fallTo(page, 25);
         expect(await h.getState(page)).toBe(STATE.Score);
      });
   });

   test.describe('Cleared pipes cannot kill the bird', function() {
      // The bird's element spans x = 60..94 in the fly area. A pipe at left 6
      // (52px wide) has its right edge left of the bird's hitbox.

      test('leaving the gap after clearing a pipe scores instead of killing', async function({ page }) {
         await h.placePipe(page, { left: 6, gapTop: 200 });
         await h.setBird(page, { position: 100, velocity: 0 });
         await h.tick(page);
         expect(await h.getState(page)).toBe(STATE.Game);
         expect((await h.getBird(page)).score).toBe(1);
      });

      test('a pipe overlapping the bird still kills it outside the gap', async function({ page }) {
         await h.placePipe(page, { left: 70, gapTop: 200 });
         await h.setBird(page, { position: 100, velocity: 0 });
         await h.tick(page);
         expect(await h.getState(page)).toBe(STATE.Score);
      });

      test('passing through the gap scores a point', async function({ page }) {
         await h.placePipe(page, { left: 6, gapTop: 200 });
         await h.setBird(page, { position: 230, velocity: 0 });
         await h.tick(page);
         expect(await h.getState(page)).toBe(STATE.Game);
         expect((await h.getBird(page)).score).toBe(1);
      });
   });

   test.describe('Movement and collision run on one clock', function() {
      async function spawnPipe(page) {
         await h.setBird(page, { position: 180, velocity: 0, gravity: 0 });
         await page.clock.runFor(1500);
         await expect(page.locator('.pipe')).not.toHaveCount(0);
      }

      function pipeLeft(page) {
         return page.locator('.pipe').first().evaluate(function(el) { return el.getBoundingClientRect().left; });
      }

      test('pipes stand still while game time is paused', async function({ page }) {
         await spawnPipe(page);
         const before = await pipeLeft(page);
         await page.waitForTimeout(500); // real time passes, game time doesn't
         expect(Math.abs((await pipeLeft(page)) - before)).toBeLessThan(1);
      });

      test('pipes move with game time, not real time', async function({ page }) {
         // CSS-animated pipes also move while real time passes, so compare two
         // spans of equal real duration: one advancing 1000ms of game time, one
         // advancing none. Only movement driven by game time differs between them.
         await spawnPipe(page);

         let before = await pipeLeft(page);
         const start = Date.now();
         await page.clock.runFor(1000);
         const realDuration = Date.now() - start;
         const withGameTime = before - (await pipeLeft(page));

         before = await pipeLeft(page);
         await page.waitForTimeout(realDuration);
         const withoutGameTime = before - (await pipeLeft(page));

         expect(withGameTime - withoutGameTime).toBeGreaterThan(50);
      });
   });
});

test.describe('Clarify the heuristic hitbox math', function() {
   test('the hitbox never grows wider than the sprite', async function({ page }) {
      await h.openGame(page, { clock: true, query: '?debug' });
      await h.startGame(page);
      for (const velocity of [-4.6, -2, 0, 3, 10]) {
         await h.setBird(page, { position: 150, velocity: velocity });
         await h.tick(page);
         const width = await page.locator('#playerbox').evaluate(function(el) { return el.getBoundingClientRect().width; });
         expect(width, 'hitbox width at velocity ' + velocity).toBeLessThanOrEqual(34);
      }
   });
});
