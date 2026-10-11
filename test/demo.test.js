/* The GitHub Pages site in docs/ — loads cleanly against the minified build */
'use strict';
const fs   = require('fs');
const path = require('path');
const { test } = require('./harness');

test('docs/ builds (minified, ES module) are up to date with kImgMap.js / kImgMap.css (run npm run build)', async t => {
  const { stale } = require('../scripts/build.js');
  t.eq(await stale(), [], 'stale builds');
}, { browsers: ['chromium'] });

test('docs/ and README size claims ("~N kB gzipped") match the minified builds (±1.5 kB)', async t => {
  const zlib = require('zlib');
  const gz = f => zlib.gzipSync(fs.readFileSync(path.join(t.ROOT, f))).length / 1024;
  const actual = gz('docs/kImgMap.min.js') + gz('docs/kImgMap.min.css');
  for (const f of ['README.md', 'docs/index.html']) {
    const m = fs.readFileSync(path.join(t.ROOT, f), 'utf8').match(/~(\d+) kB gzipped/);
    t.ok(m, `${f} states a size`);
    t.ok(Math.abs(+m[1] - actual) <= 1.5, `${f} says ~${m[1]} kB, the builds are ${actual.toFixed(1)} kB gzipped`);
  }
}, { browsers: ['chromium'] });

for (const f of ['index.html', 'docs.html']) {
  test(`docs/${f} loads with no JS errors and all local assets exist`, async t => {
    const errs = [];
    t.page.on('pageerror', e => errs.push(e.message));
    t.page.on('console', m => { if (m.type() === 'error' && !/picsum|net::|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await t.page.goto('file://' + path.join(t.ROOT, 'docs', f));
    await t.page.waitForTimeout(800);
    t.eq(errs, [], 'page errors');
    const local = await t.page.evaluate(() => [...document.querySelectorAll('link[href],script[src]')]
      .map(e => e.getAttribute('href') || e.getAttribute('src')).filter(u => !/^https?:/.test(u)));
    for (const u of local) t.ok(fs.existsSync(path.join(t.ROOT, 'docs', u)), 'missing asset ' + u);
    t.eq(await t.page.evaluate(() => typeof kImgMap === 'function' && kImgMap.version), t.SRC_VERSION, 'minified build is up to date with the source version');
  });
}

test('docs/index.html example 5 custom theme applies to the editor', async t => {
  await t.page.goto('file://' + path.join(t.ROOT, 'docs', 'index.html'));
  await t.page.waitForTimeout(500);
  const v = await t.page.evaluate(() => getComputedStyle(document.querySelector('#ex5-themed-wrap .kimgmap-editor')).getPropertyValue('--kimgmap-primary').trim());
  t.eq(v, '#4f46e5');
});

test('docs/index.html example 5 (custom dark theme) passes contrast with an area selected', async t => {
  await t.page.goto('file://' + path.join(t.ROOT, 'docs', 'index.html'));
  await t.page.waitForFunction(() => document.querySelector('#ex5-themed-wrap .kimgmap-svg')?.getAttribute('viewBox'), null, { timeout: 15000 });
  await t.page.evaluate(() => { ex5.setAreas([{ shape: 'rect', coords: [10, 10, 100, 100], attrs: {} }, { shape: 'circle', coords: [200, 200, 30], attrs: {} }, { shape: 'poly', coords: [300, 10, 350, 10, 325, 60], attrs: {} }]); });
  await t.page.locator('#ex5-themed-wrap .kimgmap-list-item').first().click();
  t.eq(await t.axe('#ex5-themed-wrap .kimgmap-editor', { rules: { 'color-contrast': { enabled: true } } }), []);
}, { allowErrors: [/picsum|net::|Failed to load resource/] });

/* ── The site itself: phones, contrast, structure ───────────────────────── */

for (const f of ['index.html', 'docs.html']) {
  for (const theme of ['light', 'dark']) {
    test(`docs/${f} (${theme}) at phone width: no sideways scrolling, nav reachable, one h1, no axe violations`, async t => {
      await t.page.emulateMedia({ colorScheme: theme });
      await t.page.goto('file://' + path.join(t.ROOT, 'docs', f));
      await t.page.waitForTimeout(500);
      t.eq(await t.page.evaluate(() => document.documentElement.scrollWidth), 375, 'page width');
      t.eq(await t.page.$$eval('.nav-links a', a => a.filter(x => x.getBoundingClientRect().width > 0).length), 3, 'site nav links visible');
      t.eq(await t.page.$$eval('h1', h => h.length), 1, 'one h1');
      t.eq(await t.axe('body'), []);
    }, { viewport: { width: 375, height: 800 }, allowErrors: [/picsum|net::|Failed to load resource/], timeout: 45000 });
  }
}

test('docs/docs.html: the contents list is collapsed on phones and closes after picking a section', async t => {
  await t.page.goto('file://' + path.join(t.ROOT, 'docs', 'docs.html'));
  const open = () => t.page.$eval('.docs-nav-details', d => d.open);
  t.eq(await open(), false, 'collapsed');
  await t.page.click('.docs-nav-details > summary');
  t.eq(await open(), true);
  await t.page.click('.docs-nav-link[href="#options"]');
  t.eq(await open(), false, 'closed after navigating');
  await t.page.setViewportSize({ width: 1200, height: 800 });
  await t.page.waitForFunction(() => document.querySelector('.docs-nav-details').open, null, { timeout: 3000 });
  t.eq(await t.page.$eval('.docs-nav-details > summary', s => getComputedStyle(s).display), 'none', 'always open, no toggle, on wide screens');
}, { viewport: { width: 375, height: 800 }, allowErrors: [/picsum|net::|Failed to load resource/] });

test('docs/ site theme switcher exposes its state and survives blocked storage', async t => {
  await t.page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await t.page.goto('file://' + path.join(t.ROOT, 'docs', 'index.html'));
  t.eq(await t.page.$$eval('.theme-btn', b => b.map(x => x.getAttribute('aria-pressed'))), ['false', 'true', 'false']);
  await t.page.click('.theme-btn[data-theme="dark"]');
  t.eq(await t.page.evaluate(() => document.documentElement.className), 'theme-dark');
  t.eq(await t.page.$$eval('.theme-btn', b => b.map(x => x.getAttribute('aria-pressed'))), ['false', 'false', 'true']);
}, { allowErrors: [/picsum|net::|Failed to load resource/] });
