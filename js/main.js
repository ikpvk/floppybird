var debugmode = false;

var states = Object.freeze({
   SplashScreen: 0,
   GameScreen: 1,
   ScoreScreen: 2
});

var currentstate;

var gravity = 0.25;
var velocity = 0;
var position = 180;
var rotation = 0;
var jump = -4.6;

//the playfield is a fixed-size world (see fitPlayfield); everything below is in world pixels
var flyArea = document.getElementById("flyarea").offsetHeight;
var playerleft = 60;
var playerwidth = 34;
var playerheight = 24;

var score = 0;
var highscore = 0;

var pipeheight = 90;
var pipewidth = 52;
var pipespeed = 1000 / 450; //px per tick: crosses 1000px in 7.5s, matching the scrolling ground
var pipes = [];

var replayclickable = false;

//sounds
var volume = 0.3;
var soundJump = loadSound("assets/sounds/sfx_wing.ogg");
var soundScore = loadSound("assets/sounds/sfx_point.ogg");
var soundHit = loadSound("assets/sounds/sfx_hit.ogg");
var soundDie = loadSound("assets/sounds/sfx_die.ogg");
var soundSwoosh = loadSound("assets/sounds/sfx_swooshing.ogg");

//loops: one fixed-step loop drives the bird, the pipes and pipe spawning,
//so movement and collision can never drift apart
var updaterate = 1000.0 / 60.0; //60 times a second
var pipeinterval = Math.round(1400 / updaterate); //ticks between new pipes
var loopGameloop;
var ticks = 0;

//pending death-sequence timers, cancelled when a new round starts
var deathTimers = [];

var el = {
   container: document.getElementById("gamecontainer"),
   flyarea: document.getElementById("flyarea"),
   player: document.getElementById("player"),
   splash: document.getElementById("splash"),
   bigscore: document.getElementById("bigscore"),
   scoreboard: document.getElementById("scoreboard"),
   currentscore: document.getElementById("currentscore"),
   highscore: document.getElementById("highscore"),
   medal: document.getElementById("medal"),
   replay: document.getElementById("replay"),
   playerbox: document.getElementById("playerbox"),
   pipebox: document.getElementById("pipebox")
};

(function init() {
   var params = new URLSearchParams(window.location.search);
   if(params.has("debug"))
      debugmode = true;
   if(params.has("easy"))
      pipeheight = 200;

   highscore = loadHighscore();

   fitPlayfield();
   window.addEventListener("resize", fitPlayfield);
   window.addEventListener("orientationchange", fitPlayfield);

   //start with the splash screen
   showSplash();
})();

function loadSound(src)
{
   var audio = new Audio(src);
   audio.volume = volume;
   return audio;
}

function playSound(audio)
{
   audio.pause();
   audio.currentTime = 0;
   var playing = audio.play();
   //play() rejects if the file failed to load or autoplay is blocked; the game doesn't depend on it
   if(playing)
      playing.catch(function() {});
}

//Scales the playfield down on viewports shorter than its 525px minimum height
//so the ground stays on screen. The world keeps its size, so collision math
//(done in world pixels) is unaffected by the scale.
function fitPlayfield()
{
   var minheight = 525;
   var scale = Math.min(1, window.innerHeight / minheight);
   var style = el.container.style;
   if(scale < 1)
   {
      style.transform = "scale(" + scale + ")";
      style.width = (window.innerWidth / scale) + "px";
      style.height = minheight + "px";
   }
   else
   {
      style.transform = "";
      style.width = "";
      style.height = "";
   }
}

//Animates `el` to the styles in `to` (from its current styles) and leaves `to` applied.
//An earlier tween on the element is cancelled, so its `done` callback never runs.
function tween(elem, to, duration, easing, done, from)
{
   if(!from)
   {
      var computed = getComputedStyle(elem);
      from = {};
      for(var key in to)
         from[key] = computed[key];
   }
   cancelTween(elem);
   Object.assign(elem.style, to);
   elem.tween = elem.animate([from, to], { duration: duration, easing: easing });
   if(done)
      elem.tween.onfinish = done;
}

//Cancels only the tween started by tween(), not CSS animations such as the bird's wings
//(elem.getAnimations() would include those too).
function cancelTween(elem)
{
   if(elem.tween)
   {
      elem.tween.cancel();
      elem.tween = null;
   }
}

//high score storage: validated as a whole nonnegative safe integer, else 0
function parseScore(value)
{
   if(typeof value !== "string" || !/^\d+$/.test(value))
      return 0;
   var n = Number(value);
   return Number.isSafeInteger(n) ? n : 0;
}

function loadHighscore()
{
   try
   {
      var saved = localStorage.getItem("highscore");
      if(saved !== null)
         return parseScore(saved);
   }
   catch(e) {}

   //fall back to the cookie older versions saved
   var match = document.cookie.match(/(?:^|;\s*)highscore=([^;]*)/);
   return match ? parseScore(match[1]) : 0;
}

function saveHighscore(value)
{
   try
   {
      localStorage.setItem("highscore", String(value));
   }
   catch(e) {}
}

function showSplash()
{
   currentstate = states.SplashScreen;

   //cancel anything left over from the last death
   deathTimers.forEach(clearTimeout);
   deathTimers = [];

   //set the defaults (again)
   velocity = 0;
   position = 180;
   rotation = 0;
   score = 0;
   ticks = 0;

   //update the player in preparation for the next game
   cancelTween(el.player);
   updatePlayer();

   playSound(soundSwoosh);

   //clear out all the pipes if there are any
   pipes.forEach(function(pipe) { pipe.el.remove(); });
   pipes = [];

   //make everything animated again
   setAnimationsRunning(true);

   //fade in the splash
   tween(el.splash, { opacity: "1" }, 2000, "ease");
}

function setAnimationsRunning(running)
{
   document.querySelectorAll(".animated").forEach(function(elem) {
      elem.style.animationPlayState = running ? "running" : "paused";
   });
}

function startGame()
{
   currentstate = states.GameScreen;

   //fade out the splash
   tween(el.splash, { opacity: "0" }, 500, "ease");

   //update the big score
   setBigScore();

   //debug mode?
   if(debugmode)
   {
      //show the bounding boxes
      el.playerbox.style.display = "block";
      el.pipebox.style.display = "block";
   }

   //start up our loop
   loopGameloop = setInterval(gameloop, updaterate);

   //jump from the start!
   playerJump();
}

function updatePlayer()
{
   //rotation
   rotation = Math.min((velocity / 10) * 90, 90);

   //apply rotation and position
   el.player.style.top = position + "px";
   el.player.style.transform = "rotate(" + rotation + "deg)";
}

//The bird's hitbox, in fly area coordinates.
//It's a heuristic, not exact rotated-sprite geometry: the box is centred on the bird,
//its height is halfway between the sprite's height and the height of the rotated
//sprite's bounding box, and its width narrows from 34px towards ~27px as the bird tilts
//(the sine's argument is the tilt as a fraction of 90deg, not an angle in radians).
//It is never wider than the sprite. At 90deg it's 27.3 x 29px.
function playerHitbox()
{
   var angle = Math.abs(rotation) * Math.PI / 180;
   var rotatedheight = playerwidth * Math.sin(angle) + playerheight * Math.cos(angle);

   var width = playerwidth - (Math.sin(Math.abs(rotation) / 90) * 8);
   var height = (playerheight + rotatedheight) / 2;
   var centerx = playerleft + playerwidth / 2;
   var centery = position + playerheight / 2;

   return {
      left: centerx - width / 2,
      right: centerx + width / 2,
      top: centery - height / 2,
      bottom: centery + height / 2,
      width: width,
      height: height
   };
}

function drawBox(elem, left, top, width, height)
{
   elem.style.left = left + "px";
   elem.style.top = top + "px";
   elem.style.width = width + "px";
   elem.style.height = height + "px";
}

function gameloop() {
   //update the player speed/position
   velocity += gravity;
   position += velocity;

   //have they tried to escape through the ceiling? :o
   //(stop the upward speed too, or the bird sticks there until gravity cancels it)
   rotation = Math.min((velocity / 10) * 90, 90);
   if(playerHitbox().top <= 0)
   {
      position = 0;
      if(velocity < 0)
         velocity = 0;
   }

   //update the player
   updatePlayer();
   var box = playerHitbox();

   //if we're in debug mode, draw the bounding box
   if(debugmode)
      drawBox(el.playerbox, box.left, box.top, box.width, box.height);

   //move the pipes, and add a new one every pipeinterval ticks
   updatePipes();

   //did we hit the ground? (same hitbox as the pipes use)
   if(box.bottom >= flyArea)
   {
      playerDead();
      return;
   }

   //we can't go any further without a pipe
   var nextpipe = null;
   for(var i = 0; i < pipes.length; i++)
   {
      if(!pipes[i].passed)
      {
         nextpipe = pipes[i];
         break;
      }
   }
   if(nextpipe == null)
      return;

   //determine the bounding box of the next pipes inner area
   var pipetop = nextpipe.topheight;
   var pipeleft = nextpipe.x;
   var piperight = pipeleft + pipewidth;
   var pipebottom = pipetop + pipeheight;

   if(debugmode)
      drawBox(el.pipebox, pipeleft, pipetop, pipewidth, pipeheight);

   //are we level with the pipe?
   if(box.right > pipeleft && box.left < piperight)
   {
      //we're within the pipe, have we passed between upper and lower pipes?
      if(!(box.top > pipetop && box.bottom < pipebottom))
      {
         //no! we touched the pipe
         playerDead();
         return;
      }
   }

   //have we passed the imminent danger?
   if(box.left > piperight)
   {
      nextpipe.passed = true;

      //score a point
      playerScore();
   }
}

//Handle space bar
document.addEventListener("keydown", function(e) {
   if(e.code !== "Space")
      return;

   //don't scroll or activate whatever has focus
   e.preventDefault();

   //holding the key down would otherwise keep flapping
   if(e.repeat)
      return;

   //in ScoreScreen, hitting space should click the "replay" button. else it's just a regular spacebar hit
   if(currentstate == states.ScoreScreen)
      replay();
   else
      screenClick();
});

//Handle mouse, pen and touch input in one place. A tap also fires compatibility
//mouse events, so listening for pointerdown alone counts each tap once.
el.container.addEventListener("pointerdown", function(e) {
   //primary button / first finger only
   if(!e.isPrimary || e.button !== 0)
      return;

   //leave links and buttons alone
   if(e.target.closest("a, button"))
      return;

   screenClick();
});

function screenClick()
{
   if(currentstate == states.GameScreen)
   {
      playerJump();
   }
   else if(currentstate == states.SplashScreen)
   {
      startGame();
   }
}

function playerJump()
{
   velocity = jump;
   //play jump sound
   playSound(soundJump);
}

function drawDigits(elem, value, font)
{
   elem.textContent = "";
   value.toString().split("").forEach(function(digit) {
      var img = document.createElement("img");
      img.src = "assets/font_" + font + "_" + digit + ".png";
      img.alt = digit;
      elem.appendChild(img);
   });
}

//Small digits are 12px wide with 2px padding, so a 104px row holds 7 at full size.
//Longer numbers shrink to fit the row.
function drawSmallDigits(elem, value)
{
   drawDigits(elem, value, "small");
   var imgs = elem.querySelectorAll("img");
   var rowwidth = 104;
   if(imgs.length * 14 <= rowwidth)
      return;

   var width = rowwidth / imgs.length - 2;
   imgs.forEach(function(img) {
      img.style.width = width + "px";
      img.style.height = (width * 14 / 12) + "px";
   });
}

function setBigScore(erase)
{
   if(erase)
   {
      el.bigscore.textContent = "";
      return;
   }

   drawDigits(el.bigscore, score, "big");
}

function setSmallScore()
{
   drawSmallDigits(el.currentscore, score);
}

function setHighScore()
{
   drawSmallDigits(el.highscore, highscore);
}

function setMedal()
{
   el.medal.textContent = "";

   if(score < 10)
      //signal that no medal has been won
      return false;

   var medal = "bronze";
   if(score >= 20)
      medal = "silver";
   if(score >= 30)
      medal = "gold";
   if(score >= 40)
      medal = "platinum";

   var img = document.createElement("img");
   img.src = "assets/medal_" + medal + ".png";
   img.alt = medal;
   el.medal.appendChild(img);

   //signal that a medal has been won
   return true;
}

function playerDead()
{
   //stop animating everything!
   setAnimationsRunning(false);

   //drop the bird to the floor
   //(its top ends 34px above the floor because it'll be rotated 90 deg)
   var top = Math.max(position, flyArea - playerwidth);
   tween(el.player, { top: top + "px", transform: "rotate(90deg)" }, 1000, "cubic-bezier(0.645, 0.045, 0.355, 1)");

   //it's time to change states. as of now we're considered ScoreScreen to disable left click/flying
   currentstate = states.ScoreScreen;

   //destroy our gameloop
   clearInterval(loopGameloop);
   loopGameloop = null;

   //play the hit sound, then the dead sound, then show the score.
   //These run on timers rather than the sounds' "ended" events, so a sound that
   //fails to load or play can't leave the game stuck on this screen.
   //(sfx_hit is 0.54s long and sfx_die 0.75s)
   playSound(soundHit);
   deathTimers = [
      setTimeout(function() { playSound(soundDie); }, 540),
      setTimeout(function() { showScore(); }, 1300)
   ];
}

function showScore()
{
   //unhide us
   el.scoreboard.style.display = "block";

   //remove the big score
   setBigScore(true);

   //have they beaten their high score?
   if(score > highscore)
   {
      //yeah!
      highscore = score;
      //save it!
      saveHighscore(highscore);
   }

   //update the scoreboard
   setSmallScore();
   setHighScore();
   var wonmedal = setMedal();

   //SWOOSH!
   playSound(soundSwoosh);

   //show the scoreboard: slide it up from 40px below
   cancelTween(el.replay);
   Object.assign(el.replay.style, { transform: "translateY(40px)", opacity: "0" });
   tween(el.scoreboard, { transform: "translateY(0px)", opacity: "1" }, 600, "ease", function() {
      //When the animation is done, animate in the replay button and SWOOSH!
      playSound(soundSwoosh);
      tween(el.replay, { transform: "translateY(0px)", opacity: "1" }, 600, "ease");

      //also animate in the MEDAL! WOO!
      if(wonmedal)
         tween(el.medal, { opacity: "1", transform: "scale(1)" }, 1200, "ease", null, { opacity: "0", transform: "scale(2)" });
   }, { transform: "translateY(40px)", opacity: "0" });

   //make the replay button clickable
   replayclickable = true;
}

el.replay.addEventListener("click", replay);

function replay()
{
   //make sure we can only click once
   if(!replayclickable)
      return;
   else
      replayclickable = false;
   //SWOOSH!
   playSound(soundSwoosh);

   //fade out the scoreboard
   tween(el.scoreboard, { transform: "translateY(-40px)", opacity: "0" }, 1000, "ease", function() {
      //when that's done, display us back to nothing
      el.scoreboard.style.display = "none";

      //start the game over!
      showSplash();
   });
}

function playerScore()
{
   score += 1;
   //play score sound
   playSound(soundScore);
   setBigScore();
}

function createPipe(x, topheight)
{
   var bottomheight = (flyArea - pipeheight) - topheight;
   var pipe = { x: x, topheight: topheight, passed: false, el: document.createElement("div") };
   pipe.el.className = "pipe";
   pipe.el.innerHTML = '<div class="pipe_upper" style="height: ' + topheight + 'px;"></div>' +
      '<div class="pipe_lower" style="height: ' + bottomheight + 'px;"></div>';
   pipe.el.style.transform = "translateX(" + x + "px)";
   el.flyarea.appendChild(pipe.el);
   pipes.push(pipe);
   return pipe;
}

//Called once per tick: moves the pipes left, removes ones that are off screen,
//and adds a new pipe at the playfield's right edge every pipeinterval ticks.
function updatePipes()
{
   pipes = pipes.filter(function(pipe) {
      pipe.x -= pipespeed;
      if(pipe.x <= -pipewidth)
      {
         pipe.el.remove();
         return false;
      }
      pipe.el.style.transform = "translateX(" + pipe.x + "px)";
      return true;
   });

   ticks++;
   if(ticks % pipeinterval != 0)
      return;

   //add a new pipe (top height + bottom height  + pipeheight == flyArea)
   var padding = 80;
   var constraint = flyArea - pipeheight - (padding * 2); //double padding (for top and bottom)
   var topheight = Math.floor((Math.random()*constraint) + padding); //add lower padding
   createPipe(el.flyarea.offsetWidth, topheight);
}
