/*
 * Browser test harness for kImgMap (Playwright: Chromium, Firefox, WebKit).
 *
 *   test(name, fn, opts)        — register a test; fn receives a context object `t`
 *   forInputs(name, fn, opts)   — register one test per input type (mouse, touch, pen)
 *
 * Test options:
 *   input:     'mouse' | 'touch' | 'pen'      (set by forInputs)
 *   inputs:    restrict forInputs to a subset
 *   browsers:  restrict to some browsers, e.g. ['chromium']
 *   realInput: skip where the input has to be simulated (see below)
 *   viewport:  { width, height }
 *   deviceScaleFactor: device pixel ratio for the page (default 1)
 *   context:   extra Playwright browser-context options (e.g. { isMobile: true })
 *   allowErrors: true, or an array of RegExps — uncaught page errors and
 *              console.error messages fail the test unless allowed here
 *   timeout:   per-test timeout in ms (default 30000)
 *
 * Input backends — every test reports which one it used:
 *   mouse   real Playwright mouse in every browser
 *   touch   Chromium: real touch via CDP Input.dispatchTouchEvent (multi-touch, cancel)
 *           Firefox/WebKit: real taps (page.touchscreen); drags are simulated
 *   pen     Chromium: real pen via CDP Input.dispatchMouseEvent { pointerType: 'pen' }
 *           Firefox/WebKit: simulated
 * Simulated input dispatches PointerEvents in the page and models the platform
 * rules that matter here: touch events stay bound to the element first touched
 * (implicit capture — if that element is removed, its events are lost, as in
 * WebKit), click/dblclick follow a press+release without movement, and the
 * first active pointer of each type is primary. Browser gestures (scrolling,
 * touch-action) can't be simulated — such tests set realInput.
 *
 * The `t` object passed to each test:
 *   t.page, t.input, t.browser, t.build, t.simulated
 *   t.setup(body, script) — load a page with the plugin + a generated 800×400 image
 *   t.box()               — bounding box of the most recent .kimgmap-svg
 *   t.at(box, x, y)       — natural-image coords → page coords
 *   t.down/move/up, t.drag(from, to), t.tap(pt), t.doubleTap(pt), t.hover(pt)
 *   t.finger.down(id, pt) / move(id, pt) / up(id) / cancel()   — multi-touch
 *   t.penDown(pt, button) — pen press with a given button (2 = barrel, 5 = eraser)
 *   t.tool(name), t.tapEl(selector)
 *   t.html(), t.expectHTML(exp, msg, { tol }) — textarea HTML; coords may differ by
 *                         ±tol (default 2, for pointer rounding — use tol: 0 for clamped values)
 *   t.settled(), t.openModal() — wait for modal transitions (never use fixed sleeps)
 *   t.axe(selector, { minImpact }) — axe-core violations as strings
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SRC_VERSION = require(path.join(ROOT, 'kImgMap.js')).version;
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BUILDS = {
  src: { js: 'kImgMap.js',          css: 'kImgMap.css' },
  min: { js: 'docs/kImgMap.min.js', css: 'docs/kImgMap.min.css' },
};

/** Standard test image: 800×400 natural, displayed at 400×200 (scale 2) */
const IMG = `<img data-test id="img" style="width:400px;height:200px;display:block" alt="">`;

const tests = [];
function test(name, fn, opts = {}) { tests.push({ name, fn, opts }); }
function forInputs(name, fn, opts = {}) {
  for (const input of opts.inputs || ['mouse', 'touch', 'pen']) {
    test(`[${input}] ${name}`, fn, { ...opts, input });
  }
}

/* ── Assertions ──────────────────────────────────────────────────────────── */

class AssertionError extends Error {}
class Skip extends Error {}
function eq(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new AssertionError(`${msg || 'mismatch'}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`);
  }
}
function ok(v, msg) { if (!v) throw new AssertionError(msg || 'expected truthy'); }

/** Compare two HTML strings, allowing coords to differ by up to `tol` */
function htmlNear(actual, expected, tol = 2) {
  const split = s => {
    const coords = [];
    const rest = s.replace(/coords="([^"]*)"/g, (_, c) => { coords.push(c.split(',').map(Number)); return 'coords=""'; });
    return { rest, coords };
  };
  const a = split(actual), e = split(expected);
  if (a.rest !== e.rest || a.coords.length !== e.coords.length) return false;
  return a.coords.every((c, i) => c.length === e.coords[i].length &&
    c.every((v, j) => Math.abs(v - e.coords[i][j]) <= tol));
}

/* ── Simulated pointer input (runs in the page) ──────────────────────────── */

const SIMULATOR = `(() => {
  const active = new Map();          // key → pointer state
  let nextId = 100;
  const lastClick = {};              // pointerType → { t, x, y }
  const BUTTONS = { 0: 1, 1: 4, 2: 2, 5: 32 };

  const ev = (type, p, x, y, o = {}) => new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true, view: window,
    pointerId: p.pid, pointerType: p.type, isPrimary: p.primary,
    clientX: x, clientY: y, screenX: x, screenY: y,
    button: o.button ?? -1, buttons: o.buttons ?? 0, pressure: o.pressure ?? 0,
    width: p.type === 'touch' ? 20 : 1, height: p.type === 'touch' ? 20 : 1,
    tiltX: p.type === 'pen' ? 20 : 0,
  });
  const hit = (x, y) => document.elementFromPoint(x, y) || document.documentElement;
  const common = (a, b) => { for (let n = a; n; n = n.parentNode) if (n.contains?.(b)) return n; return document.documentElement; };
  // Touch: events stay on the node first touched; if it's gone, they're lost
  const targetFor = (p, x, y) => p.type === 'touch' ? (p.target.isConnected ? p.target : null) : hit(x, y);

  window.__sim = {
    down(key, type, x, y, button = 0) {
      const primary = ![...active.values()].some(p => p.type === type);
      const p = { pid: nextId++, type, primary, button, target: hit(x, y), sx: x, sy: y, moved: false };
      active.set(key, p);
      p.target.dispatchEvent(ev('pointerdown', p, x, y, { button, buttons: BUTTONS[button] ?? 1, pressure: 0.5 }));
    },
    move(key, x, y) {
      const p = active.get(key); if (!p) return;
      if (Math.hypot(x - p.sx, y - p.sy) > 8) p.moved = true;
      p.x = x; p.y = y;
      targetFor(p, x, y)?.dispatchEvent(ev('pointermove', p, x, y, { buttons: BUTTONS[p.button] ?? 1, pressure: 0.5 }));
    },
    hover(type, x, y) {
      const p = { pid: type === 'pen' ? 99 : 98, type, primary: true };
      hit(x, y).dispatchEvent(ev('pointermove', p, x, y));
    },
    up(key) {
      const p = active.get(key); if (!p) return;
      active.delete(key);
      const x = p.x ?? p.sx, y = p.y ?? p.sy;
      const t = targetFor(p, x, y);
      t?.dispatchEvent(ev('pointerup', p, x, y, { button: p.button }));
      if ((p.moved && p.type === 'touch') || p.button !== 0 || !t) return;   // touch drags don't click
      const ct = p.type === 'touch' ? t : common(p.target, t);
      const lc = lastClick[p.type], now = performance.now();
      const detail = lc && now - lc.t < 500 && Math.hypot(x - lc.x, y - lc.y) < 15 ? 2 : 1;
      lastClick[p.type] = detail === 2 ? null : { t: now, x, y };
      const opts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, detail };
      ct.dispatchEvent(new PointerEvent('click', { ...opts, pointerId: p.pid, pointerType: p.type }));
      if (detail === 2) ct.dispatchEvent(new MouseEvent('dblclick', opts));
    },
    // Forget a pointer without delivering its release (the page never hears
    // about it — as when pointerup goes to a node that was removed)
    lose(key) { active.delete(key); },
    cancel() {
      for (const [key, p] of active) {
        targetFor(p, p.x ?? p.sx, p.y ?? p.sy)?.dispatchEvent(ev('pointercancel', p, p.x ?? p.sx, p.y ?? p.sy));
        active.delete(key);
      }
    },
  };
})();`;

/* ── Per-test context ────────────────────────────────────────────────────── */

async function makeContext(page, input, browser, build) {
  const chromium  = browser === 'chromium';
  const cdp       = chromium && input !== 'mouse' ? await page.context().newCDPSession(page) : null;
  const simulated = input !== 'mouse' && !chromium;
  const code      = BUILDS[build];
  const JS  = fs.readFileSync(path.join(ROOT, code.js),  'utf8');
  const CSS = fs.readFileSync(path.join(ROOT, code.css), 'utf8');

  /* Real multi-touch (Chromium CDP): every event lists the active fingers */
  const fingers = new Map();
  const cdpTouch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: pts.map(([id, [x, y]]) => ({ x, y, id })),
  });
  /* Real pen (Chromium CDP) */
  let pos = null, penButton = 'left', penClicks = { t: 0, x: 0, y: 0 };   // pos: last pointer position
  const PEN_BUTTON = { 0: 'left', 1: 'middle', 2: 'right' };
  const cdpPen = (type, [x, y], o = {}) => cdp.send('Input.dispatchMouseEvent', {
    type, x, y, pointerType: 'pen', force: type === 'mouseReleased' || o.buttons === 0 ? 0 : 0.5, tiltX: 20,
    button: 'none', buttons: 0, clickCount: 1, ...o,
  });
  let usedSim = false;   // did this test actually use simulated input?
  let penSim = simulated; // backend for the current pen gesture
  const sim = (fn, ...args) => { usedSim = true; return page.evaluate(([f, a]) => window.__sim[f](...a), [fn, args]); };

  const t = {
    page, input, browser, build, simulated, eq, ok, IMG, JS, CSS, ROOT, SRC_VERSION, htmlNear,
    get usedSimulator() { return usedSim; },

    skip(reason) { throw new Skip(reason); },

    async setup(body, script) {
      await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>${CSS}</style></head><body>${body}</body></html>`);
      await page.evaluate(SIMULATOR);
      await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = 800; c.height = 400;
        const g = c.getContext('2d');
        g.fillStyle = '#8ab'; g.fillRect(0, 0, 800, 400);
        g.fillStyle = '#456'; g.fillRect(0, 0, 400, 200);
        window.__png = c.toDataURL('image/png');
        window.__errors = [];
        window.addEventListener('error', e => window.__errors.push(e.message));
      });
      await page.addScriptTag({ content: JS });
      await page.evaluate(async () => {
        const imgs = [...document.querySelectorAll('img[data-test]')];
        await Promise.all(imgs.map(i => new Promise(r => { i.onload = r; i.src = window.__png; })));
      });
      if (script) await page.evaluate(script);
      // Let layout and the first paint happen (a fixed sleep is too short under load)
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    },

    async errors() { return page.evaluate(() => window.__errors); },

    async box(selector = '.kimgmap-svg') {
      return page.evaluate(sel => {
        const all = [...document.querySelectorAll(sel)];
        const r = all[all.length - 1].getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      }, selector);
    },
    at(b, x, y) { return [b.x + x * b.w / 800, b.y + y * b.h / 400]; },

    /* Multi-touch */
    finger: {
      async down(id, pt) {
        if (simulated) return sim('down', 'f' + id, 'touch', ...pt);
        fingers.set(id, pt); await cdpTouch('touchStart', [...fingers]);
      },
      async move(id, pt) {
        if (simulated) return sim('move', 'f' + id, ...pt);
        fingers.set(id, pt); await cdpTouch('touchMove', [...fingers]);
      },
      async up(id) {
        if (simulated) return sim('up', 'f' + id);
        const pt = fingers.get(id); fingers.delete(id); await cdpTouch('touchEnd', [[id, pt]]);
      },
      async cancel() {
        if (simulated) return sim('cancel');
        fingers.clear(); await cdpTouch('touchCancel', []);
      },
    },

    async penDown(pt, button = 0) {
      pos = pt;
      penSim = simulated || button === 5;   // CDP has no eraser button — the whole gesture is simulated
      if (penSim) return sim('down', 'pen', 'pen', ...pt, button);
      penButton = PEN_BUTTON[button];
      await cdpPen('mouseMoved', pt);
      await cdpPen('mousePressed', pt, { button: penButton, buttons: { left: 1, middle: 4, right: 2 }[penButton] });
    },

    async down(pt) {
      pos = pt;
      if (input === 'touch') return t.finger.down(0, pt);
      if (input === 'pen')   return t.penDown(pt);
      await page.mouse.move(...pt); await page.mouse.down();
    },
    async move(to, steps = 4) {
      if (input === 'mouse') { pos = to; return page.mouse.move(...to, { steps }); }
      const from = pos || to;
      for (let i = 1; i <= steps; i++) {
        const p = [from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps];
        if (input === 'touch') await t.finger.move(0, p);
        else if (penSim) await sim('move', 'pen', ...p);
        else await cdpPen('mouseMoved', p, { button: penButton, buttons: { left: 1, middle: 4, right: 2 }[penButton] });
      }
      pos = to;
    },
    async up() {
      if (input === 'touch') return t.finger.up(0);
      if (input === 'pen')   return penSim ? sim('up', 'pen') : cdpPen('mouseReleased', pos, { button: penButton });
      await page.mouse.up();
    },
    async drag(from, to) {
      await t.down(from);
      await t.move([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
      await t.move(to);
      // Hold still before lifting: real Chromium treats a fast lift as a fling,
      // and suppresses the click of a tap that follows within ~100ms
      if (input === 'touch' && !simulated) { await page.waitForTimeout(60); await t.finger.move(0, to); }
      await t.up();
    },
    async hover(pt) {
      if (input === 'mouse') return page.mouse.move(...pt, { steps: 3 });
      if (input === 'touch') throw new Error('touch has no hover');
      if (simulated) return sim('hover', 'pen', ...pt);
      pos = pt; await cdpPen('mouseMoved', pt);
    },
    async tap(pt, clickCount = 1) {
      if (input === 'mouse') return page.mouse.click(...pt, { clickCount });
      if (input === 'touch') return page.touchscreen.tap(...pt);   // real taps in every browser
      if (simulated) { await sim('down', 'pen', 'pen', ...pt); return sim('up', 'pen'); }
      // Chromium real pen: a second press within the double-click window needs clickCount 2
      const now = Date.now(), cc = now - penClicks.t < 500 && Math.hypot(pt[0] - penClicks.x, pt[1] - penClicks.y) < 15 ? 2 : 1;
      penClicks = cc === 2 ? { t: 0, x: 0, y: 0 } : { t: now, x: pt[0], y: pt[1] };
      pos = pt;
      await cdpPen('mouseMoved', pt);
      await cdpPen('mousePressed', pt, { button: 'left', buttons: 1, clickCount: cc });
      await cdpPen('mouseReleased', pt, { button: 'left', clickCount: cc });
    },
    async doubleTap(pt) {
      if (input === 'mouse') return page.mouse.dblclick(...pt);
      await t.tap(pt); await t.tap(pt);
    },

    async tapEl(selector, { nth } = {}) {
      const loc = page.locator(selector);
      const b = await (nth === undefined ? loc.last() : loc.nth(nth)).boundingBox();
      await t.tap([b.x + b.width / 2, b.y + b.height / 2]);
    },
    async tool(name) { await t.tapEl(`.kimgmap-tool[data-tool="${name}"]`); },

    /**
     * Wait until modal open/close transitions have finished: no overlay is
     * mid-fade and no finite CSS animation/transition is running (checked on
     * consecutive frames).
     */
    async settled() {
      await page.evaluate(() => new Promise((resolve, reject) => {
        const raf = () => new Promise(r => requestAnimationFrame(r));
        const finite = a => a.effect?.getTiming().iterations !== Infinity;   // ignore looping cues (e.g. error pulse)
        const calm = () => document.getAnimations().filter(finite).every(a => a.playState !== 'running') &&
          [...document.querySelectorAll('.kimgmap-overlay')].every(o => o.classList.contains('is-open'));
        let timedOut = false;
        const stop = setTimeout(() => { timedOut = true; reject(new Error('UI did not settle within 5s')); }, 5000);
        (async () => {
          while (!timedOut) {
            await raf(); await raf();
            if (calm()) { await raf(); if (calm()) { clearTimeout(stop); return resolve(); } }
          }
        })();
      }));
    },
    async openModal() { await t.tapEl('.kimgmap-open-btn'); await t.settled(); },

    /**
     * Run axe-core on `selector` and return violations at or above `minImpact`
     * as compact strings (rule id + offending selectors).
     */
    async axe(selector, { minImpact = 'moderate', rules } = {}) {
      if (!await page.evaluate(() => !!window.axe)) await page.addScriptTag({ content: AXE });
      const order = ['minor', 'moderate', 'serious', 'critical'];
      const res = await page.evaluate(([sel, r]) => window.axe.run(sel, { resultTypes: ['violations'], preload: false, ...(r ? { rules: r } : {}) }), [selector, rules]);
      return res.violations.filter(v => order.indexOf(v.impact) >= order.indexOf(minImpact))
        .map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
    },

    async html() { return page.$eval('#ta', el => el.value); },
    async expectHTML(expected, msg, { tol = 2 } = {}) {
      const actual = await t.html();
      if (!htmlNear(actual, expected, tol)) {
        throw new AssertionError(`${msg || 'textarea HTML'}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`);
      }
    },
  };
  return t;
}

/* ── Runner ──────────────────────────────────────────────────────────────── */

async function runOne(browserName, build, list, concurrency) {
  const exe = browserName === 'chromium' && process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  const browser = await playwright[browserName].launch(exe);
  const results = new Array(list.length);
  let next = 0;

  const retries = Number(process.env.RETRIES ?? 1);
  async function worker() {
    while (next < list.length) {
      const i = next++;
      results[i] = await runTest(list[i]);
      // A failure that passes on retry is reported as flaky (never as a plain pass)
      for (let r = 0; r < retries && results[i].pass === false; r++) {
        const again = await runTest(list[i]);
        if (again.pass) results[i] = { ...again, flaky: results[i].err };
      }
    }
  }
  async function runTest({ name, fn, opts }) {
    {
      const input = opts.input || 'mouse';
      if (opts.browsers && !opts.browsers.includes(browserName)) return { name, skip: `${opts.browsers.join('/')} only` };
      if (opts.realInput && input !== 'mouse' && browserName !== 'chromium') return { name, skip: `needs real ${input} input` };
      const notes = [];
      let ctx = null, timer = null;
      try {
        ctx = await browser.newContext({
          viewport: opts.viewport || { width: 1200, height: 900 },
          deviceScaleFactor: opts.deviceScaleFactor || 1,
          hasTouch: input !== 'mouse',   // pen devices have touch screens too
          ...opts.context,
        });
        const page = await ctx.newPage();
        const pageErrors = [];
        page.on('pageerror', e => pageErrors.push(`uncaught: ${e.message}`));
        page.on('console', m => { if (m.type() === 'error') pageErrors.push(`console.error: ${m.text()}`); });
        const t = await makeContext(page, input, browserName, build);
        t.note = s => notes.push(s);
        const ms = opts.timeout || 30000;
        await Promise.race([
          fn(t),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new AssertionError(`timed out after ${ms}ms`)), ms); }),
        ]);
        const allowed = opts.allowErrors === true ? [/./] : (opts.allowErrors || []);
        const errs = pageErrors.filter(m => !allowed.some(re => re.test(m)));
        if (errs.length) throw new AssertionError(`page errors:\n   ${errs.join('\n   ')}`);
        return { name, pass: true, notes, simulated: t.usedSimulator };
      } catch (e) {
        if (e instanceof Skip) return { name, skip: e.message };
        return { name, pass: false, err: e instanceof AssertionError ? e.message : (e.stack || String(e)), notes };
      } finally {
        clearTimeout(timer);
        await ctx?.close().catch(() => {});
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  await browser.close();
  return results;
}

async function run({ browsers, builds }) {
  const grep = process.env.GREP ? new RegExp(process.env.GREP, 'i') : null;
  const names = new Set();
  for (const x of tests) { if (names.has(x.name)) throw new Error(`duplicate test name: ${x.name}`); names.add(x.name); }
  const list = tests.filter(x => !grep || grep.test(x.name));
  if (!list.length || !browsers.length || !builds.length) {
    console.error(`No tests selected (GREP=${process.env.GREP || ''}, browsers=${browsers}, builds=${builds})`);
    return 1;
  }
  const concurrency = Number(process.env.CONCURRENCY || 4);
  const verbose = !!process.env.VERBOSE;
  const summary = [];

  for (const build of builds) {
    for (const browser of browsers) {
      const results = await runOne(browser, build, list, concurrency);
      const pass = results.filter(r => r.pass).length;
      const skip = results.filter(r => r.skip).length;
      const sim  = results.filter(r => r.pass && r.simulated).length;
      const flaky = results.filter(r => r.flaky);
      const fail = results.length - pass - skip;
      console.log(`\n── ${browser} · ${build} build ──`);
      for (const r of results) {
        if (r.flaky) console.log('  ⚠', r.name, '(flaky — failed, then passed on retry)\n     ', r.flaky.split('\n').join('\n      '));
        else if (r.pass) { if (verbose) console.log('  ✓', r.name + (r.simulated ? '  (simulated input)' : '')); }
        else if (r.skip) { if (verbose) console.log('  -', r.name, `(skipped: ${r.skip})`); }
        else console.log('  ✗', r.name, '\n     ', r.err.split('\n').join('\n      '));
        for (const n of r.notes || []) console.log('      note:', r.name, '—', n);
      }
      console.log(`  ${pass} passed${sim ? ` (${sim} with simulated input)` : ''}, ${fail} failed, ${skip} skipped${flaky.length ? `, ${flaky.length} flaky` : ''}`);
      summary.push({ browser, build, pass, fail, skip, flaky: flaky.length });
    }
  }

  console.log('\nSummary');
  for (const s of summary) console.log(`  ${s.fail ? '✗' : s.flaky ? '⚠' : '✓'} ${s.browser.padEnd(9)} ${s.build}  ${s.pass} passed, ${s.fail} failed, ${s.skip} skipped${s.flaky ? `, ${s.flaky} flaky` : ''}`);
  console.log('');
  return summary.reduce((n, s) => n + s.fail, 0);
}

module.exports = { test, forInputs, run, eq, ok, IMG, ROOT };
