// Shared fixtures and helpers for the floppybird tests.
//
// Most tests drive the game through the page (clicks, keys, viewport, network).
// The physics and scoreboard tests also need to set up exact situations, so they
// reach into the game's globals (`position`, `velocity`, `pipes`, `showScore`...).
// Those white-box hooks all live in this file; if the to_do.md refactor renames
// or restructures them, update the helpers below rather than the specs.

const base = require('@playwright/test');
const { expect } = base;

const STATE = { Splash: 0, Game: 1, Score: 2 };

const test = base.test.extend({
   // Blocks every request that leaves the local test server and records its URL.
   externalRequests: [async function({ page, baseURL }, use) {
      const origin = new URL(baseURL).origin;
      const blocked = [];
      await page.route('**/*', function(route) {
         const url = route.request().url();
         if (url.startsWith(origin) || url.startsWith('data:'))
            return route.continue();
         blocked.push(url);
         return route.abort();
      });
      await use(blocked);
   }, { auto: true }],

   // Same-origin responses with an error status (e.g. a missing digit image).
   failedResponses: [async function({ page }, use) {
      const failed = [];
      page.on('response', function(res) {
         if (res.status() >= 400)
            failed.push(res.status() + ' ' + res.url());
      });
      await use(failed);
   }, { auto: true }],

   // Uncaught exceptions thrown by the page.
   pageErrors: [async function({ page }, use) {
      const errors = [];
      page.on('pageerror', function(err) { errors.push(err.message); });
      await use(errors);
   }, { auto: true }]
});

// Loads the game and waits for the splash screen.
// With `clock: true`, timers are faked and paused, so the game loop only runs
// when a test calls `tick()`. CSS animations still run on real time.
async function openGame(page, options) {
   options = options || {};
   if (options.clock)
      await page.clock.install();
   await page.goto('/index.html' + (options.query || ''));
   if (options.clock) {
      const now = await page.evaluate(function() { return Date.now(); });
      await page.clock.pauseAt(now + 1000);
   }
   await expect.poll(function() { return getState(page); }).toBe(STATE.Splash);
}

function getState(page) {
   return page.evaluate(function() { return window.currentstate; });
}

// A left click inside the fly area, at (150, 300) in unscaled fly area pixels.
async function clickGame(page, options) {
   const scale = (await flyAreaGeometry(page)).scale;
   await page.locator('#flyarea').click(Object.assign({ position: { x: 150 * scale, y: 300 * scale } }, options));
}

async function startGame(page) {
   await clickGame(page);
   await expect.poll(function() { return getState(page); }).toBe(STATE.Game);
}

// Runs exactly one game-loop tick (requires `clock: true`).
// The loop is setInterval(gameloop, 1000/60); one 17ms step fires it once.
async function tick(page) {
   await page.clock.runFor(17);
}

// Sets bird physics state. Any field left out keeps its current value.
async function setBird(page, bird) {
   await page.evaluate(function(b) {
      if (b.position !== undefined) window.position = b.position;
      if (b.velocity !== undefined) window.velocity = b.velocity;
      if (b.gravity !== undefined) window.gravity = b.gravity;
   }, bird);
}

function getBird(page) {
   return page.evaluate(function() {
      return { position: window.position, velocity: window.velocity, score: window.score };
   });
}

// Replaces all pipes with one static pipe at `left` (px from the fly area's left
// edge) whose gap starts `gapTop` px below the top of the fly area.
async function placePipe(page, pipe) {
   await page.evaluate(function(p) {
      window.pipes.forEach(function(pipe) { pipe.el.remove(); });
      window.pipes = [];
      window.createPipe(p.left, p.gapTop);
   }, pipe);
}

// Shows the scoreboard for a given final score without going through a death.
async function showScoreboard(page, score) {
   await page.evaluate(function(s) {
      window.score = s;
      window.showScore();
   }, score);
   await expect(page.locator('#scoreboard')).toBeVisible();
}

// Replaces a global function with a wrapper that counts calls in window.__calls.
async function countCalls(page, name) {
   await page.evaluate(function(n) {
      window.__calls = window.__calls || {};
      window.__calls[n] = 0;
      var original = window[n];
      window[n] = function() {
         window.__calls[n]++;
         return original.apply(this, arguments);
      };
   }, name);
}

function callCount(page, name) {
   return page.evaluate(function(n) { return window.__calls[n]; }, name);
}

// Records every <audio> element the game creates (Buzz or `new Audio`) in
// window.__audios. Must run before the page loads.
async function recordAudioElements(page) {
   await page.addInitScript(function() {
      window.__audios = [];
      var createElement = Document.prototype.createElement;
      Document.prototype.createElement = function(tag) {
         var el = createElement.apply(this, arguments);
         if (String(tag).toLowerCase() === 'audio')
            window.__audios.push(el);
         return el;
      };
      var NativeAudio = window.Audio;
      window.Audio = function(src) {
         var el = new NativeAudio(src);
         window.__audios.push(el);
         return el;
      };
      window.Audio.prototype = NativeAudio.prototype;
   });
}

// Makes every sound file fail to load.
async function blockSounds(page) {
   await page.route('**/*.ogg', function(route) { return route.abort(); });
}

// Pre-seeds a saved high score in both the cookie and localStorage.
async function seedHighscore(page, value) {
   await page.addInitScript(function(v) {
      document.cookie = 'highscore=' + v + '; path=/';
      try { localStorage.setItem('highscore', v); } catch (e) {}
   }, value);
}

// Reads the digits shown in a score element from the images' alt text.
function shownDigits(page, selector) {
   return page.locator(selector + ' img').evaluateAll(function(imgs) {
      return imgs.map(function(img) { return img.getAttribute('alt'); }).join('');
   });
}

// Geometry of the fly area in page pixels, plus the fly area's scale factor
// (1 unless the playfield is scaled to fit the viewport).
function flyAreaGeometry(page) {
   return page.evaluate(function() {
      var fly = document.getElementById('flyarea');
      var rect = fly.getBoundingClientRect();
      return {
         top: rect.top,
         left: rect.left,
         right: rect.right,
         landTop: document.getElementById('land').getBoundingClientRect().top,
         scale: rect.height / fly.offsetHeight
      };
   });
}

module.exports = {
   test, expect, STATE,
   openGame, getState, clickGame, startGame, tick,
   setBird, getBird, placePipe, showScoreboard,
   countCalls, callCount, recordAudioElements, blockSounds,
   seedHighscore, shownDigits, flyAreaGeometry
};
