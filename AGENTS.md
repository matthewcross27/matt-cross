# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Real-browser testing in this sandbox

`chrome-devtools-axi` (and the underlying `chrome-devtools-mcp`) do not work in this
worktree environment: no Chrome/Chromium is installed. Both of these DO work (network
access to jsdelivr/npm/Google's Chrome-for-Testing CDN is available); install into an
explicit scratch path because the default caches get wiped between calls:

```sh
# option A (verified current): Playwright + its Chromium
npm install playwright --no-save
PLAYWRIGHT_BROWSERS_PATH=<scratch>/pw-browsers npx playwright install chromium
# option B: puppeteer-core + Chrome-for-Testing
npx -y @puppeteer/browsers install chrome@stable --path /tmp/chrome-install
```
Serve the site first with a plain static server (`python3 -m http.server`). Playwright's
default Chromium (`headless: true`) does support CSS scroll-driven animation and
compositing, so it can exercise the `view-timeline` scrub path. It still has **no real
GPU** (software raster) - it cannot reproduce the captain's compositing / fill-rate /
ProMotion cost; use it for JS/main-thread behaviour and 1:1-tracking checks, not final
smoothness sign-off. Drive real `page.mouse.wheel()` / rAF `scrollBy` momentum bursts,
never `scrollTo` jumps, when measuring scroll feel.

## Architecture (v2 rewrite: static site, no build, no animation library)

`index.html` + `css/style.css` + four plain scripts loaded in order: `js/sketch.js` (engine), `js/scenes.js` (hero
figure + soccer/basketball/guitar/wave scenes), `js/doodles.js` (skyline, project sketch, margin marks), `js/main.js`
(wiring only). Fonts and images are self-hosted in `assets/`. Projects are repeated `<article class="project">` blocks
in `index.html` (see the "ADDING A PROJECT" comment); placeholders are `class="ph"` spans in `[ brackets ]`.
GSAP, anime.js, Matter.js, rough.js and the old `scrub-vignette.js` are gone - do not reintroduce a library for what the
engine already does.

### `Sketch` engine (`js/sketch.js`)
- One stick-figure rig (`Sketch.figure`) used by every scene. Poses are authored in WORLD degrees, CSS-clockwise
  (limbs 0 = hanging down, negative = forward; chest/head 0 = upright, + = lean forward; foot + = toes down) and
  converted to parent-relative CSS `rotate` on nested `<g data-bone>` groups. `transform-origin` pivots are in local
  coordinates (verified inside translated parents), so no wrapper `<g>`s are needed.
- `Sketch.choreo` = monotone-cubic splines per channel + optional per-bone `lag` (overlap / follow-through) +
  procedural `layers` (gait, strum) + forward kinematics. With `ground` set it solves hips-y so the lowest foot point
  touches the floor (minus `air`). `fk` positions (e.g. `holdF`, `toeF`) drive anything that must coincide with a body
  part - the held basketball is a child of the forearm bone, the flying ball starts at the FK hold point.
- `Sketch.Scene` takes tracks (`fn(p) -> {x,y,r,s,o,dash}`) and drives them one of three ways from the SAME functions:
  `.scroll()` (native `view-timeline` + generated `@keyframes`, rAF fallback with identical maths), `.timed()` (hero
  entrance), `.still()` (reduced motion). Native vs fallback agree to <1px in tests.
- Scenes are not pinned: the stage's `cover` range is mapped to progress (`range: [a, b]`). `view-timeline-inset` is
  forced to `0px` because `auto` honours `html { scroll-padding-top }` and silently shifts the native range away from
  the fallback.
- Hand-drawn look = static seeded pencil strokes (`Pen`), drawn once. No live SVG filters, no mid-scroll redraws.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
