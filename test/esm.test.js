/* The ES module build (docs/kImgMap.mjs, docs/kImgMap.min.mjs) and package entry points */
'use strict';
const fs   = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { test } = require('./harness');

// Native modules don't load from file:// — serve the page and the module from a fake origin
const ORIGIN = 'http://kimgmap.test';

test('ES module: default and named export work as a native <script type="module"> (no global)', async t => {
  const file = t.build === 'min' ? 'docs/kImgMap.min.mjs' : 'docs/kImgMap.mjs';
  await t.page.route(`${ORIGIN}/**`, route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/kImgMap.mjs') return route.fulfill({ body: fs.readFileSync(path.join(t.ROOT, file), 'utf8'), contentType: 'text/javascript' });
    if (u.pathname === '/kImgMap.css') return route.fulfill({ body: t.CSS, contentType: 'text/css' });
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><link rel="stylesheet" href="/kImgMap.css">
      <div><img id="img" alt=""><textarea id="ta"></textarea></div>
      <script type="module">
        import kImgMap, { kImgMap as named } from '/kImgMap.mjs';
        const c = document.createElement('canvas'); c.width = 800; c.height = 400;
        const img = document.getElementById('img');
        img.onload = () => {
          const ed = new kImgMap(img, { mode: 'inline' });
          window.result = { same: kImgMap === named, version: kImgMap.version, global: typeof window.kImgMap, ed: !!document.querySelector('.kimgmap-editor') };
        };
        img.src = c.toDataURL();
      </script>` });
  });
  await t.page.goto(`${ORIGIN}/`);
  await t.page.waitForFunction(() => window.result, null, { timeout: 10000 });
  t.eq(await t.page.evaluate(() => window.result), { same: true, version: t.SRC_VERSION, global: 'undefined', ed: true });
  await t.page.focus('.kimgmap-img-area');
  await t.page.keyboard.press('Enter');
  t.eq(await t.page.$eval('#ta', el => el.value), '<area shape="rect" coords="300,150,500,250">', 'it edits');
});

test('package entry points: import → ES module, require → UMD, both the same version', async t => {
  const pkg = require(path.join(t.ROOT, 'package.json'));
  const esm = await import(pathToFileURL(path.join(t.ROOT, pkg.exports['.'].import)).href);
  t.eq([typeof esm.default, esm.default.version, esm.kImgMap === esm.default], ['function', t.SRC_VERSION, true]);
  t.eq(require(path.join(t.ROOT, pkg.exports['.'].require)).version, t.SRC_VERSION);
  t.eq(pkg.module, pkg.exports['.'].import.replace(/^\.\//, ''));
  for (const f of pkg.files) t.ok(fs.existsSync(path.join(t.ROOT, f)), `package file ${f} exists`);
}, { browsers: ['chromium'] });
