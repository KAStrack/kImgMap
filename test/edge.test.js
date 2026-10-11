/* Limits, clamping, keyboard variants, option handling and other edge cases */
'use strict';
const { test, forInputs, IMG } = require('./harness');

const page = (ta = '') => `<div>${IMG}<textarea id="ta">${ta}</textarea></div>`;
const inline = (opts = {}) => `window.ed = new kImgMap('#img', ${JSON.stringify({ mode: 'inline', ...opts })})`;
const exact = { tol: 0 };

/* ── Clamping (exact — clamped values are integers) ─────────────────────── */

forInputs('resize handles clamp exactly at the image edges', async t => {
  const far = b => [b.x + b.w + 80, Math.max(2, b.y - 80)];   // beyond the top-right corner (stay in the viewport)
  const farBR = b => [b.x + b.w + 80, b.y + b.h + 80];  // beyond the bottom-right corner
  const cases = [
    ['rect e',   '<area shape="rect" coords="200,100,400,300">', [400, 200], farBR, '<area shape="rect" coords="200,100,800,300">'],
    ['rect se',  '<area shape="rect" coords="200,100,400,300">', [400, 300], farBR, '<area shape="rect" coords="200,100,800,400">'],
    ['circle',   '<area shape="circle" coords="700,200,50">',    [750, 200], farBR, '<area shape="circle" coords="700,200,100">'],
    ['poly',     '<area shape="poly" coords="100,100,300,100,200,300">', [300, 100], far, '<area shape="poly" coords="100,100,800,0,200,300">'],
  ];
  for (const [name, html, [x, y], to, expected] of cases) {
    await t.setup(page(html), inline({ defaultShape: null }));
    const b = await t.box();
    await t.drag(t.at(b, x, y), to(b));
    await t.expectHTML(expected, name, exact);
  }
});

test('duplicate offsets circles and polygons by 10px, clamped inside the image', async t => {
  await t.setup(page('<area shape="circle" coords="100,100,20">\n<area shape="circle" coords="785,385,10">\n<area shape="poly" coords="790,10,800,10,795,20">'), inline());
  for (let i = 0; i < 3; i++) {
    await t.page.locator('.kimgmap-list-item').nth(i).click();
    await t.tool('duplicate');
  }
  await t.expectHTML([
    '<area shape="circle" coords="100,100,20">', '<area shape="circle" coords="785,385,10">', '<area shape="poly" coords="790,10,800,10,795,20">',
    '<area shape="circle" coords="110,110,20">', '<area shape="circle" coords="790,390,10">', '<area shape="poly" coords="790,20,800,20,795,30">',
  ].join('\n'), 'duplicates', exact);
});

test('a duplicate has its own attributes', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50" alt="orig">'), inline());
  await t.page.click('.kimgmap-list-item');
  await t.tool('duplicate');
  await t.page.fill('[data-attr="alt"]', 'copy');
  await t.expectHTML('<area shape="rect" coords="10,10,50,50" alt="orig">\n<area shape="rect" coords="20,20,60,60" alt="copy">', '', exact);
});

/* ── Drawing limits ─────────────────────────────────────────────────────── */

test('slivers and tiny circles are discarded', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 102));   // 200×2 sliver
  await t.tool('circle');
  await t.drag(t.at(b, 400, 200), t.at(b, 402, 200));   // r = 2
  t.eq(await t.html(), '');
});

forInputs('drag, resize and draw in sequence all work', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  await t.drag(t.at(b, 100, 100), t.at(b, 200, 200));   // draw
  await t.drag(t.at(b, 150, 150), t.at(b, 250, 150));   // drag
  await t.drag(t.at(b, 300, 200), t.at(b, 350, 250));   // resize (se handle)
  await t.drag(t.at(b, 500, 100), t.at(b, 600, 200));   // draw again
  await t.expectHTML('<area shape="rect" coords="200,100,350,250">\n<area shape="rect" coords="500,100,600,200">');
});

test('the Select tool button stops drawing; areas can still be dragged', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  await t.tool('select');
  t.eq(await t.page.$eval('.kimgmap-tool.is-active', b => b.dataset.tool), 'select');
  const b = await t.box();
  await t.drag(t.at(b, 400, 100), t.at(b, 600, 300));
  await t.drag(t.at(b, 150, 150), t.at(b, 200, 150));
  await t.expectHTML('<area shape="rect" coords="150,100,250,200">');
});

test('[mouse] dblclick closes a polygon even when its two clicks land apart', async t => {
  await t.setup(page(), inline());
  await t.tool('poly');
  const b = await t.box();
  for (const [x, y] of [[100, 100], [300, 100], [300, 300]]) await t.page.mouse.click(...t.at(b, x, y));
  await t.page.mouse.click(...t.at(b, 100, 300));
  await t.page.mouse.move(...t.at(b, 100, 330));                // second click of the double-click is 15px away
  await t.page.mouse.down({ clickCount: 2 }); await t.page.mouse.up({ clickCount: 2 });
  t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 0, 'polygon closed');
  await t.expectHTML('<area shape="poly" coords="100,100,300,100,300,300,100,300,100,330">');
});

/* ── Keyboard variants ──────────────────────────────────────────────────── */

test('Cmd+D duplicates, plain D does not, Backspace deletes', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  await t.page.click('.kimgmap-list-item');
  const n = () => t.page.$$eval('.kimgmap-list-item', e => e.length);
  await t.page.keyboard.press('d');
  t.eq(await n(), 1, 'plain d');
  await t.page.keyboard.press('Meta+d');
  t.eq(await n(), 2, 'Meta+d');
  await t.page.keyboard.press('Backspace');
  t.eq(await n(), 1, 'Backspace');
});

/* ── Validation ─────────────────────────────────────────────────────────── */

test('mandatoryTitles: whitespace is not a title; errors clear when fixed or deleted', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50" title="  ">\n<area shape="rect" coords="100,100,150,150">'), () => { window.ed = new kImgMap('#img', { mandatoryTitles: true }); });
  await t.openModal();
  await t.page.click('.kimgmap-save');
  t.eq(await t.page.$$eval('.kimgmap-list-error-dot', e => e.length), 2, 'both flagged (whitespace title)');
  await t.page.locator('.kimgmap-list-item').nth(0).click();
  await t.page.fill('[data-attr="title"]', 'Fixed');
  t.eq(await t.page.$$eval('.kimgmap-list-error-dot', e => e.length), 1, 'dot cleared once titled');
  await t.page.locator('.kimgmap-list-item').nth(1).click();
  await t.page.click('.kimgmap-del-btn');
  t.eq(await t.page.$eval('.kimgmap-validation-banner', b => b.hidden), true, 'banner hidden after deleting the last flagged area');
});

/* ── Modal & options ────────────────────────────────────────────────────── */

test('onOpen fires; reopening re-reads textarea edits', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), () => { window.opens = 0; window.ed = new kImgMap('#img', { showTextarea: true, onOpen: () => opens++ }); });
  await t.openModal();
  await t.page.keyboard.press('Escape'); await t.settled();
  await t.page.fill('#ta', '<area shape="circle" coords="100,100,30">');
  await t.openModal();
  t.eq(await t.page.evaluate(() => [opens, document.querySelector('.kimgmap-badge').textContent]), [2, 'C']);
});

test('showTextarea "optional" toggles back to hidden', async t => {
  await t.setup(page(), () => { window.ed = new kImgMap('#img', { showTextarea: 'optional' }); });
  await t.page.click('.kimgmap-show-code-btn');
  await t.page.click('.kimgmap-show-code-btn');
  t.eq(await t.page.evaluate(() => [getComputedStyle(document.getElementById('ta')).display, document.querySelector('.kimgmap-show-code-btn').textContent]), ['none', 'Show Code']);
});

test('textarea option accepts a selector string', async t => {
  await t.setup(`${IMG}<p>elsewhere</p><textarea id="ta"></textarea>`, () => { window.ed = new kImgMap('#img', { mode: 'inline', textarea: '#ta' }); });
  await t.page.evaluate(() => ed.setAreas([{ shape: 'rect', coords: [1, 2, 30, 40], attrs: {} }]));
  t.eq(await t.html(), '<area shape="rect" coords="1,2,30,40">');
});

test('setAreas accepts shape aliases; outputAttributes accepts { attr, label } entries; mapName is escaped', async t => {
  await t.setup(page(), inline({ output: 'map', mapName: 'a"b', outputAttributes: [{ attr: 'href', label: 'Link' }] }));
  await t.page.evaluate(() => ed.setAreas([{ shape: 'circ', coords: [50, 50, 10], attrs: { href: '/x', alt: 'not listed' } }]));
  t.eq(await t.html(), '<map name="a&quot;b">\n<area shape="circle" coords="50,50,10" href="/x">\n</map>');
});

test('onAttributeChange overrides show up in visible inputs', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'),
    () => { window.ed = new kImgMap('#img', { mode: 'inline', onAttributeChange: (a, attr, v) => attr === 'title' ? { alt: v } : undefined }); });
  await t.page.click('.kimgmap-list-item');
  await t.page.fill('[data-attr="title"]', 'Mirror');
  t.eq(await t.page.$eval('[data-attr="alt"]', i => i.value), 'Mirror');
});

test('parser trims odd polygon coords and extra circle coords', async t => {
  await t.setup(page('<area shape="poly" coords="1,1,50,1,25,40,99"><area shape="circle" coords="10,10,5,7">'), inline());
  t.eq(await t.page.evaluate(() => ed.getAreas().map(a => a.coords)), [[1, 1, 50, 1, 25, 40], [10, 10, 5]]);
});

/* ── Lifecycle ──────────────────────────────────────────────────────────── */

test('destroy() removes every listener it added to document and window', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), () => {
    window.live = new Map();
    for (const target of [document, window]) {
      const add = target.addEventListener, rem = target.removeEventListener;
      target.addEventListener = function (type, fn, o) { live.set(fn, type); return add.call(this, type, fn, o); };
      target.removeEventListener = function (type, fn, o) { live.delete(fn); return rem.call(this, type, fn, o); };
    }
    for (const mode of ['inline', 'modal']) {
      const img = document.getElementById('img');
      const ed = new kImgMap(img, { mode });
      if (mode === 'modal') ed.open();
      ed.destroy();
    }
  });
  t.eq(await t.page.evaluate(() => [...live.values()]), [], 'listeners still attached after destroy');
});

test('destroy() restores the image when it was its parent\'s first child', async t => {
  await t.setup(`<div id="c">${IMG}<textarea id="ta"></textarea></div>`, () => { window.ed = new kImgMap('#img', { mode: 'inline' }); ed.destroy(); });
  t.eq(await t.page.evaluate(() => document.getElementById('c').firstElementChild.id), 'img');
});

test('destroy() leaves the textarea exactly as it found it', async t => {
  await t.setup(`<div id="c">${IMG}<textarea id="ta"></textarea><textarea id="hidden" style="display:none; color: red"></textarea></div>`, () => {
    window.before = document.getElementById('c').innerHTML;
    const a = new kImgMap('#img', { mode: 'inline' }); a.destroy();
    const b = new kImgMap('#img', { textarea: '#hidden' }); b.destroy();
  });
  t.eq(await t.page.evaluate(() => document.getElementById('c').innerHTML), await t.page.evaluate(() => before));
});

forInputs('two instances on one page are independent in both directions', async t => {
  await t.setup(`${page()}<div><img data-test id="img2" style="width:400px;height:200px;display:block"><textarea id="ta2"></textarea></div>`,
    () => { window.a = new kImgMap('#img', { mode: 'inline' }); window.b = new kImgMap('#img2', { mode: 'inline' }); });
  const svgs = await t.page.$$eval('.kimgmap-svg', s => s.map(e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }));
  await t.drag(t.at(svgs[1], 100, 100), t.at(svgs[1], 300, 250));
  t.eq(await t.page.evaluate(() => [a.getHTML(), b.areas.length]), ['', 1]);
}, { inputs: ['mouse', 'touch'] });

test('rendering many areas reads layout a constant number of times (no per-area layout thrash)', async t => {
  let s = '';
  for (let i = 0; i < 300; i++) s += `<area shape="rect" coords="${(i % 30) * 25},${Math.floor(i / 30) * 30},${(i % 30) * 25 + 20},${Math.floor(i / 30) * 30 + 20}">\n`;
  await t.setup(`<div>${t.IMG}<textarea id="ta">${s}</textarea></div>`, () => { window.ed = new kImgMap('#img', { mode: 'inline' }); });
  const reads = await t.page.evaluate(() => {
    let n = 0;
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () { n++; return orig.call(this); };
    const count = fn => { n = 0; fn(); return n; };
    const out = {
      renderAll: count(() => { ed._renderAll(); window.first = document.querySelector('.kimgmap-ag'); }),   // first must survive the rest
      add:       count(() => { ed._canvas.focus(); ed._canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }),
      duplicate: count(() => ed._duplicateArea(ed._sel)),
      delete:    count(() => ed._deleteArea(ed._sel)),
    };
    Element.prototype.getBoundingClientRect = orig;
    return out;
  });
  for (const [k, n] of Object.entries(reads)) t.ok(n <= 6, `${k}: ${n} layout reads for 300 areas`);
  t.eq(await t.page.$$eval('.kimgmap-ag', g => g.length), 301, 'add + duplicate + delete leave 301 areas');
  t.eq(await t.page.evaluate(() => first.isConnected), true, 'the other areas were not re-rendered');
});

forInputs('a handle grabbed off-centre still reaches the image edge', async t => {
  // Grab each handle a few screen px inside its centre, then drag far past the edge
  const cases = [
    ['poly vertex', '<area shape="poly" coords="100,100,300,100,200,300">', [300, 100], [5, 5],  b => [b.x + b.w + 80, Math.max(2, b.y - 80)], '<area shape="poly" coords="100,100,800,0,200,300">'],
    ['rect se',     '<area shape="rect" coords="200,100,400,300">',         [400, 300], [-5, -5], b => [b.x + b.w + 80, b.y + b.h + 80], '<area shape="rect" coords="200,100,800,400">'],
    ['rect nw',     '<area shape="rect" coords="200,100,400,300">',         [200, 100], [5, 5],  b => [Math.max(2, b.x - 80), Math.max(2, b.y - 80)], '<area shape="rect" coords="0,0,400,300">'],
  ];
  for (const [name, html, [x, y], [ox, oy], to, expected] of cases) {
    await t.setup(page(html), inline({ defaultShape: null }));
    await t.page.locator('.kimgmap-list-item').click();
    const b = await t.box();
    const [px, py] = t.at(b, x, y);
    await t.drag([px + ox * (t.input === 'touch' ? 1.5 : 0.8), py + oy * (t.input === 'touch' ? 1.5 : 0.8)], to(b));
    await t.expectHTML(expected, name, { tol: 0 });
  }
});
