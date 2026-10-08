# To Do: floppybird fixes

Issues found while reviewing `nebez/floppybird` (commit `efd2c7f`, 2026-02-16).

## High priority

- [ ] **Remove the analytics script** (`index.html:23`)
  - It loads `https://yummy.nebez.dev/script.js`, which reports a pageview to the author's server on every load, including local and self-hosted copies.
  - The old Google Analytics code only ran on `nebezb.com` and never inside an iframe. This script runs everywhere.
  - Fix: delete the `<script defer src="https://yummy.nebez.dev/...">` line.

- [ ] **Mouse clicks don't work on touchscreen laptops** (`js/main.js:249-252`)
  - When `"ontouchstart" in window` is true, only `touchstart` is bound and `mousedown` never is, so clicking with a mouse does nothing.
  - Fix: use a single `pointerdown` listener instead of choosing between touch and mouse.

- [ ] **The game can get stuck on the death screen** (`js/main.js:361-365`)
  - `showScore()` only runs after both `soundHit` and `soundDie` fire `ended`. If either sound fails to load or play, the scoreboard never appears and the game can't be restarted.
  - The UA-sniffing `isIncompatible` list (`js/main.js:460-482`) only works around this for browsers it knows about.
  - Fix: call `showScore()` after a fixed delay independently of audio and remove the UA sniffing. If retaining sound callbacks plus a timeout fallback, guard against duplicate calls and cancel stale callbacks when restarting.
  - Don't keep Buzz's `bindOnce` (Buzz 1.1.0, `js/buzz.min.js`). Its handler reads a shared counter when the event fires, not when it was bound. Tested against the bundled file: after one `ended` that never fired, the next `ended` runs the stale callback from the earlier death and drops the current one, so a per-death token checked inside the callback can't help. Use the fixed delay, or `addEventListener` with explicit `removeEventListener`.
  - Chaining `soundDie` off `soundHit`'s `ended` is also a sound callback that can go stale. Start `soundDie` from a timer too (the hit sound is 0.54s and the die sound 0.75s, so a ~1.3s score delay matches the current timing).

## Bugs

- [ ] **Accidental global variable `medal`** (`js/main.js:317`)
  - It's assigned without `var`/`let`. Declare it inside `setMedal()`.

- [ ] **Spacebar handling** (`js/main.js:236-246`)
  - Uses the deprecated `e.keyCode == 32`. With a native `keydown` listener, use `e.code === 'Space'`.
  - Holding space flaps repeatedly because of key auto-repeat. Ignore events where the native event's `repeat` is true.
  - jQuery 1.10.2 does not copy `code` or `repeat` into its event wrapper. If retaining the current jQuery handler, read `e.originalEvent.code` and `e.originalEvent.repeat`; simply changing to `e.code` would disable spacebar input.
  - Doesn't call `e.preventDefault()`. Prevent the default spacebar action during gameplay; the existing `overflow: hidden` limits ordinary page scrolling, but browser actions on focused controls can still occur.

- [ ] **The ceiling doesn't stop upward speed** (`js/main.js:181-182`)
  - It sets `position = 0` but leaves `velocity` unchanged, so the bird sticks to the ceiling until gravity cancels the upward speed (upward velocity lasts 18 ticks after a jump; the time spent at the ceiling depends on when it is reached). Also set `velocity = 0`.
  - Preserve this project's nonfatal ceiling behavior. The original game's ceiling behavior has not been independently verified in this review.

- [ ] **Movement and collision run on separate clocks**
  - Pipes move with a CSS animation (`animPipe 7500ms` in `css/main.css`).
  - New pipes spawn on `setInterval(updatePipes, 1400)`.
  - Bird physics and collision run on `setInterval(gameloop, 16.7)` and read `getBoundingClientRect()` each tick.
  - These drift apart when the page lags or the tab is in the background.
  - Fix (larger refactor): move pipes in JS inside a single `requestAnimationFrame` loop that uses delta time.

- [ ] **Clarify the heuristic hitbox math** (`js/main.js:155-158`)
  - `Math.sin(Math.abs(rotation) / 90)` uses a normalized angle as the sine argument to shrink the hitbox. It is a heuristic rather than a geometric calculation; this alone does not establish a gameplay bug.
  - Fix: document and test the intended collision margin, or replace the heuristic with a simpler fixed hitbox. Converting to radians alone does not produce correct rotated-rectangle geometry, and using signed `rotation` would make the hitbox grow during upward flight.

## Maintenance and cleanup

- [ ] **Outdated libraries**
  - jQuery 1.10.2 (2013) has known vulnerabilities: XSS (CVE-2015-9251, CVE-2020-11022, CVE-2020-11023) and prototype pollution (CVE-2019-11358). No exploit path was demonstrated in this game. See the [CVE-2019-11358 record](https://nvd.nist.gov/vuln/detail/CVE-2019-11358) and [jQuery's security fix notes](https://blog.jquery.com/2020/04/10/jquery-3-5-0-released/).
  - jQuery Transit and Buzz are no longer maintained.
  - Option: upgrade jQuery, or remove all three libraries (vanilla DOM, CSS transitions, and `Audio`).

- [ ] **Leftover `tsconfig.json`**
  - It points at `ts/game.ts`, which doesn't exist (the TypeScript version moved to `nebez/ts-floppybird`). Delete it.

- [ ] **High score storage** (`js/main.js:47-73`)
  - It's stored in a cookie with no `path`, and `parseInt` is called without a radix.
  - Fix: use `localStorage` (wrapped in try/catch) and `parseInt(x, 10)`.

- [ ] **Accessibility**
  - `index.html:9` sets `maximum-scale=1.0, user-scalable=0`, which stops users from zooming. Remove those.

## Additional findings (2026-10-08)

- [ ] **Invalid CSS declaration makes the intended acceleration hint ineffective** (`css/main.css:95-96`)
  - `-webkit-transition: translate3d(0,0,0)` supplies a transform function where a transition value is expected, so the declaration is invalid and ignored.
  - Fix: delete the declaration and its misleading comment. If profiling shows a benefit from a compositing hint, apply it selectively to moving elements; avoid a blanket `transform` rule that can change positioning and interact with the transforms managed by jQuery Transit.

- [ ] **Ground and pipe collisions use different bird hitboxes** (`js/main.js:151-160`, `js/main.js:173`, `js/main.js:210`)
  - Ground collision uses the full rotated rectangle's `box.bottom`, while pipe collision uses the adjusted `boxbottom`. The red debug hitbox also shows the adjusted rectangle, so ground collision can occur before that visible hitbox reaches the ground.
  - At 90 degrees, the rotated rectangle is 34px tall and the adjusted hitbox is 29px tall, giving the ground check a 2.5px earlier collision threshold.
  - Fix: use the same chosen hitbox for ground and pipe collision; with the existing adjusted hitbox, compare `boxbottom` against the ground position.

- [ ] **Cleared pipes can still kill the bird before awarding a point** (`js/main.js:207-231`)
  - The collision check only tests `boxright > pipeleft`; it never checks whether the bird is still to the left of the pipe's right edge. It runs before the passed-pipe scoring check.
  - Reproduction: with the bird's horizontal hitbox at 60–94px and a pipe at 6–58px, moving outside that pipe's vertical gap calls `playerDead()` even though the bird has cleared it, and no point is awarded.
  - The window is a single frame: the pipe is removed from `pipes` on the first tick where `boxleft > piperight`, so the repro state above exists only in that tick. A false death needs the bird to leave the gap in that same frame. Low priority.
  - Fix: require horizontal overlap on both sides (`boxright > pipeleft && boxleft < piperight`) for collision, and handle passed pipes independently.

- [ ] **Invalid saved scores break the high-score display and future saves** (`js/main.js:47-49`, `js/main.js:297-304`, `js/main.js:377-383`)
  - This is separate from the storage mechanism listed above: a cookie such as `highscore=invalid` makes `highscore` become `NaN`. The scoreboard requests nonexistent `font_small_N.png` and `font_small_a.png` assets, and `score > highscore` is always false, preventing recovery through normal play.
  - Negative values don't cause a visible problem: `showScore()` replaces the high score before drawing it, and `0 > -5`, so the first death fixes it and no minus-sign image is requested.
  - `parseInt` reads only the leading digits, so `"1e21"` becomes 1 and `"12abc"` becomes 12. Extremely large values can overflow the score display (`99999999999999999999` renders as 21 digits).
  - Fix: validate the entire saved string (for example `/^\d+$/`), not just its prefix, as a nonnegative, finite safe integer before using it; fall back to zero for invalid values and handle long scores in the layout.

- [ ] **Easy and debug options cannot be combined or used with other query parameters** (`js/main.js:41-44`)
  - The code compares the entire query string with `"?easy"` or `"?debug"`. Visiting `?easy&debug` enables neither option, and `?easy=1` or `?easy&utm_source=test` silently runs normal mode.
  - Fix: parse query parameters with `URLSearchParams` and check each option independently with `.has()`.

- [ ] **Short viewports clip the playfield and hide the ground** (`css/main.css:106-121`, `css/main.css:134-175`)
  - The game container has a 525px minimum height while the page hides overflow. At a 320px-high landscape viewport, the ground starts at 420px, below the visible screen; the bird can disappear below the viewport before ground collision occurs.
  - Fix: fit or scale the complete playfield to the available viewport, including after resize or orientation changes, and keep collision coordinates consistent with that scaling.

- [ ] **Pipe spawning uses a fixed horizontal position on every screen width** (`css/main.css:52-66`)
  - Every pipe starts at `left: 900px`. On a 1920px-wide viewport it appears inside the visible playfield; on narrow screens it spends several seconds offscreen. The visible approach time therefore changes with viewport width.
  - Fix: spawn pipes at the playfield's right edge and use a consistent movement speed, or scale a fixed-size game world to fit the screen.

- [ ] **Footer clicks and secondary mouse buttons trigger gameplay** (`js/main.js:249-263`, `index.html:53-56`)
  - Input is bound to the whole document without checking the event target or mouse button. Right-clicking or pressing a footer link starts a round from the splash screen and flaps during a round.
  - Fix: bind gameplay input to the game area, ignore secondary mouse buttons, and exclude interactive controls such as links. (Excluding the replay button isn't needed: `mousedown` does nothing on the score screen.)

Review validation: JavaScript syntax check passed. Targeted Node checks executed the existing game code with DOM/audio stubs to reproduce the collision, invalid-score, query-option, and input findings. Follow-up checks confirmed that negative scores recover before rendering, the large-score example renders 21 digits, and replay-screen mousedown does not trigger gameplay. The cleared-pipe case occurs only in a single frame. Viewport findings were checked against the CSS dimensions and animation endpoints; no browser rendering check was performed.

## Already working well (keep these)

- Points are scored when the bird actually passes a pipe (`boxleft > piperight`).
- Medals, a saved high score, `?easy` mode, and `?debug` hitbox display.
