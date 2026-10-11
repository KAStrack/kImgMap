/* Image geometry: layout, host-page CSS, wrappers, scale, out-of-bounds areas, responsive maps */
'use strict';
const { test, forInputs } = require('./harness');

/** Page with one <img id="img"> (plus attributes/CSS) loaded from a w×h canvas */
async function setupImg(t, { w = 800, h = 400, imgAttrs = '', css = '', wrap = x => x, ta = '', opts = { mode: 'inline' }, before = '' } = {}) {
  await t.setup(`<style>${css}</style>${before}${wrap(`<img id="img" ${imgAttrs}>`)}<textarea id="ta">${ta}</textarea>`);
  await t.page.evaluate(async ([w, h, o]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#8ab'; g.fillRect(0, 0, w, h);
    const img = document.getElementById('img');
    await new Promise(r => { img.onload = r; img.src = c.toDataURL(); });
    window.ed = new kImgMap(img, { textarea: '#ta', ...o });
    if (o.mode !== 'inline') ed.open();
  }, [w, h, opts]);
  await t.settled();
}
/** Bounding boxes of the image's content box and the SVG overlay */
const boxes = t => t.page.evaluate(() => {
  const img = document.querySelector('.kimgmap-img-wrap img'), cs = getComputedStyle(img), r = img.getBoundingClientRect();
  const px = p => parseFloat(cs[p]) || 0;
  const content = { x: r.left + px('borderLeftWidth') + px('paddingLeft'), y: r.top + px('borderTopWidth') + px('paddingTop') };
  content.w = r.right - px('borderRightWidth') - px('paddingRight') - content.x;
  content.h = r.bottom - px('borderBottomWidth') - px('paddingBottom') - content.y;
  const s = document.querySelector('.kimgmap-svg').getBoundingClientRect();
  return { content, svg: { x: s.left, y: s.top, w: s.width, h: s.height } };
});
const near = (a, b, tol = 1.5) => ['x', 'y', 'w', 'h'].every(k => Math.abs(a[k] - b[k]) <= tol);

/* ── Layout ─────────────────────────────────────────────────────────────── */

test('inline: a wide image can be scrolled fully into view (left edge not cut off)', async t => {
  // The author forces a size wider than the editor (inline styles beat the editor's max-width)
  await setupImg(t, { w: 1600, h: 400, imgAttrs: 'style="width:1600px;max-width:none"', before: '<div style="width:900px">', ta: '<area shape="rect" coords="10,10,100,100">' });
  const r = await t.page.evaluate(() => {
    const area = document.querySelector('.kimgmap-img-area'); area.scrollLeft = 0;
    const a = area.getBoundingClientRect(), w = document.querySelector('.kimgmap-img-wrap').getBoundingClientRect();
    const s = document.querySelector('.kimgmap-shape').getBoundingClientRect();
    return { wrapLeftVisible: w.left >= a.left - 0.5, shapeVisible: s.left >= a.left - 0.5 };
  });
  t.eq(r, { wrapLeftVisible: true, shapeVisible: true });
});

test('inline: width/height attributes do not distort the image', async t => {
  await setupImg(t, { w: 1000, h: 800, imgAttrs: 'width="1000" height="800"', before: '<div style="width:700px">' });
  const ratio = await t.page.$eval('.kimgmap-img-wrap img', i => i.getBoundingClientRect().width / i.getBoundingClientRect().height);
  t.ok(Math.abs(ratio - 1.25) < 0.02, `displayed ratio ${ratio}`);
});

for (const mode of ['inline', 'modal']) {
  test(`${mode}: host-page img padding, border and object-fit do not misalign the overlay`, async t => {
    await setupImg(t, { css: 'img { padding: 20px; border: 10px solid red; object-fit: cover; box-sizing: border-box; }', imgAttrs: 'style="width:400px"', opts: { mode } });
    const { content, svg } = await boxes(t);
    t.ok(near(content, svg), `content ${JSON.stringify(content)} vs svg ${JSON.stringify(svg)}`);
    t.eq(await t.page.$eval('.kimgmap-img-wrap img', i => getComputedStyle(i).objectFit), 'fill');
  });
}

forInputs('a stretched image (CSS aspect ≠ natural) keeps the overlay and shapes aligned', async t => {
  await setupImg(t, { imgAttrs: 'style="width:400px;height:300px"' });
  const { content, svg } = await boxes(t);
  t.ok(near(content, svg), 'overlay covers the image');
  await t.drag([content.x + content.w * 0.25, content.y + content.h * 0.25], [content.x + content.w * 0.75, content.y + content.h * 0.75]);
  await t.expectHTML('<area shape="rect" coords="200,100,600,300">');
  // Compare centre and size (Firefox includes the stroke in SVG bounding boxes, so allow for it)
  const shape = await t.page.$eval('.kimgmap-shape', s => { const r = s.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, sw: parseFloat(getComputedStyle(s).strokeWidth) }; });
  const ok = Math.abs(shape.cx - (content.x + content.w / 2)) <= 2 && Math.abs(shape.cy - (content.y + content.h / 2)) <= 2 &&
    Math.abs(shape.w - content.w / 2) <= shape.sw + 2 && Math.abs(shape.h - content.h / 2) <= shape.sw + 2;
  t.ok(ok, `shape drawn where the pointer was: ${JSON.stringify(shape)} vs content ${JSON.stringify(content)}`);
}, { inputs: ['mouse'] });

/* ── Wrappers ───────────────────────────────────────────────────────────── */

test('inline: an image inside <picture> keeps its sources and is restored on destroy', async t => {
  await t.setup('<div id="c"><picture id="pic"><source id="src"><img id="img"></picture><textarea id="ta"></textarea></div>');
  const r = await t.page.evaluate(async () => {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c.toDataURL(); };
    const img = document.getElementById('img');
    document.getElementById('src').srcset = mk(800, 400);
    await new Promise(r => { img.onload = r; img.src = mk(200, 100); });
    const before = document.getElementById('c').innerHTML;
    window.ed = new kImgMap(img, { mode: 'inline', textarea: '#ta' });
    await new Promise(r => setTimeout(r, 100));
    const res = [img.parentElement.id, document.querySelector('.kimgmap-svg').getAttribute('viewBox')];
    ed.destroy();
    return [...res, document.getElementById('c').innerHTML === before];
  });
  t.eq(r, ['pic', '0 0 800 400', true]);
});

test('inline: an image inside a link — editing does not navigate; restored on destroy', async t => {
  await setupImg(t, { wrap: x => `<a id="lnk" href="#navigated">${x}</a>` });
  const b = await t.box();
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 250));
  await t.page.mouse.click(...t.at(b, 600, 300));
  t.eq(await t.page.evaluate(() => [location.hash, !!document.querySelector('.kimgmap-editor').closest('a')]), ['', false]);
  t.eq(await t.page.evaluate(() => { ed.destroy(); return document.getElementById('img').parentElement.id; }), 'lnk');
});

/* ── Scale ──────────────────────────────────────────────────────────────── */

test('a tiny pointer jitter on a huge image does not create an area', async t => {
  await setupImg(t, { w: 8000, h: 4000, imgAttrs: 'style="width:400px"' });
  const b = await t.box();
  await t.drag([b.x + 100, b.y + 100], [b.x + 101.5, b.y + 101.5]);
  t.eq(await t.html(), '');
});

test('handles keep their on-screen size on a small, upscaled image', async t => {
  await setupImg(t, { w: 100, h: 50, imgAttrs: 'style="width:800px"', ta: '<area shape="rect" coords="10,10,40,40">' });
  const w = await t.page.$eval('.kimgmap-handle', h => h.getBoundingClientRect().width);
  t.ok(w >= 10 && w <= 16, `handle ${w}px`);
});

/* ── Areas that extend past the image (imported maps) ───────────────────── */

forInputs('areas already outside the image do not jump when moved', async t => {
  await setupImg(t, { imgAttrs: 'style="width:400px"', ta: '<area shape="rect" coords="700,0,900,100">\n<area shape="circle" coords="20,20,80">', opts: { mode: 'inline', defaultShape: null } });
  const b = await t.box();
  await t.drag(t.at(b, 750, 50), t.at(b, 740, 50));                 // 10px left: allowed, moves inward
  await t.drag(t.at(b, 40, 40), t.at(b, 50, 40));                   // circle 10px right
  await t.expectHTML('<area shape="rect" coords="690,0,890,100">\n<area shape="circle" coords="30,20,80">');
}, { inputs: ['mouse', 'touch'] });

/* ── Responsive maps ────────────────────────────────────────────────────── */

test('kImgMap.responsive() scales a published map to the displayed image size', async t => {
  await t.setup('<img id="pub" usemap="#m" style="width:400px;display:block"><map name="m"><area id="a1" shape="rect" coords="0,0,400,200" href="#a"><area id="a2" shape="circle" coords="600,300,50" href="#b"></map>');
  await t.page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 400;
    const img = document.getElementById('pub');
    await new Promise(r => { img.onload = r; img.src = c.toDataURL(); });
    window.stop = kImgMap.responsive(img);
  });
  const coords = () => t.page.evaluate(() => [...document.querySelectorAll('area')].map(a => a.getAttribute('coords')));
  t.eq(await coords(), ['0,0,200,100', '300,150,25'], 'scaled to 400px');
  await t.page.evaluate(() => { document.getElementById('pub').style.width = '800px'; });
  await t.page.waitForFunction(() => document.getElementById('a1').getAttribute('coords') === '0,0,400,200');
  t.eq(await coords(), ['0,0,400,200', '600,300,50'], 'follows resizes');
  await t.page.evaluate(() => { document.getElementById('pub').style.width = '200px'; });
  await t.page.waitForFunction(() => document.getElementById('a1').getAttribute('coords') === '0,0,100,50');
  t.eq(await t.page.evaluate(() => { stop(); return [...document.querySelectorAll('area')].map(a => a.getAttribute('coords')); }), ['0,0,400,200', '600,300,50'], 'stop() restores');
});

test('kImgMap.responsive(): the scaled map is what the browser hit-tests', async t => {
  await t.setup('<img id="pub" usemap="#m" style="width:400px;display:block;margin:0"><map name="m"><area id="a1" shape="rect" coords="0,0,400,200" href="#a"></map>');
  await t.page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 400;
    const img = document.getElementById('pub');
    await new Promise(r => { img.onload = r; img.src = c.toDataURL(); });
    kImgMap.responsive(img);
  });
  t.eq(await t.page.evaluate(() => { const r = document.getElementById('pub').getBoundingClientRect(); return [document.elementFromPoint(r.left + 150, r.top + 75)?.id, document.elementFromPoint(r.left + 250, r.top + 150)?.id]; }), ['a1', 'pub']);
}, { browsers: ['chromium'] });

/* ── Review follow-ups ──────────────────────────────────────────────────── */

test('modal: a large image is scaled to fit the dialog (no horizontal scrolling), keeping its shape', async t => {
  await setupImg(t, { w: 3000, h: 1500, css: 'img { width: 100%; }', opts: { mode: 'modal' } });
  t.ok(await t.page.evaluate(() => { const a = document.querySelector('.kimgmap-img-area'); return a.scrollWidth <= a.clientWidth + 1; }), 'fits');
  const ratio = await t.page.$eval('.kimgmap-editor-img', i => i.getBoundingClientRect().width / i.getBoundingClientRect().height);
  t.ok(Math.abs(ratio - 2) < 0.02, `aspect ratio kept under host img { width: 100% }: ${ratio}`);
  // A tall image is limited by the dialog's height — it must shrink in both directions,
  // even if the page gives images a fixed width
  await setupImg(t, { w: 1000, h: 3000, css: 'img { width: 600px; }', opts: { mode: 'modal' } });
  const tall = await t.page.$eval('.kimgmap-editor-img', i => i.getBoundingClientRect().width / i.getBoundingClientRect().height);
  t.ok(Math.abs(tall - 1 / 3) < 0.02, `tall image keeps its aspect ratio: ${tall}`);
});

test('modal on a phone: the image fits the screen width', async t => {
  await setupImg(t, { w: 1600, h: 800, opts: { mode: 'modal' } });
  t.ok(await t.page.evaluate(() => { const a = document.querySelector('.kimgmap-img-area'); return a.scrollWidth <= a.clientWidth + 1; }), 'fits');
}, { viewport: { width: 360, height: 740 } });

test('inline: a photo larger than the page fits its width, and a very tall one is capped', async t => {
  await setupImg(t, { w: 3000, h: 1500, before: '<div style="width:900px">' });
  t.ok(await t.page.$eval('.kimgmap-img-wrap img', i => i.getBoundingClientRect().width <= 900), 'fits the width');
  await setupImg(t, { w: 1000, h: 6000, before: '<div style="width:900px">' });
  t.ok(await t.page.$eval('.kimgmap-editor', e => e.getBoundingClientRect().height <= 900), 'editor height capped');
});

test('responsive(): calling it twice, maps referenced by id, and tiny circles', async t => {
  await t.setup('<img id="pub" usemap="#m" style="width:200px;display:block"><map id="m"><area id="a1" shape="rect" coords="0,0,400,200"><area id="a2" shape="circle" coords="10,10,1"></map>');
  await t.page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 400;
    const img = document.getElementById('pub');
    await new Promise(r => { img.onload = r; img.src = c.toDataURL(); });
    kImgMap.responsive(img); kImgMap.responsive(img);
  });
  t.eq(await t.page.evaluate(() => [...document.querySelectorAll('area')].map(a => a.getAttribute('coords'))), ['0,0,100,50', '3,3,1']);
});

test('inline: an image inside a label inside a link — editing does not navigate', async t => {
  await setupImg(t, { wrap: x => `<a id="lnk" href="#navigated"><label id="lbl">${x}</label></a>` });
  const b = await t.box();
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 250));
  await t.page.mouse.click(...t.at(b, 600, 300));
  t.eq(await t.page.evaluate(() => [location.hash, !!document.querySelector('.kimgmap-editor').closest('a, label')]), ['', false]);
  t.eq(await t.page.evaluate(() => { ed.destroy(); return document.getElementById('img').parentElement.id; }), 'lbl');
});

test('resizing a circle whose handle is outside the image does not snap it smaller', async t => {
  await setupImg(t, { imgAttrs: 'style="width:400px"', ta: '<area shape="circle" coords="780,200,50">', opts: { mode: 'inline', defaultShape: null } });
  const b = await t.box();
  // The handle (at 830, outside the image) follows the pointer: 10px in → radius 40, not the 20 a pointer clamped to the image edge would give
  await t.drag(t.at(b, 830, 200), t.at(b, 820, 200));
  await t.expectHTML('<area shape="circle" coords="780,200,40">');
});

test('Alt+arrow resizing keeps areas that extend past the image where they are', async t => {
  await setupImg(t, { ta: '<area shape="rect" coords="700,0,900,100">\n<area shape="circle" coords="20,20,80">' });
  // (an out-of-bounds circle may shrink step by step, but isn't snapped to fit — nor grown further out)
  for (const [i, key] of [[0, 'Alt+ArrowDown'], [1, 'Alt+ArrowLeft']]) {
    await t.page.locator('.kimgmap-list-item').nth(i).click();
    await t.page.focus('.kimgmap-img-area');
    await t.page.keyboard.press(key);
  }
  await t.expectHTML('<area shape="rect" coords="700,0,900,101">\n<area shape="circle" coords="20,20,79">', '', { tol: 0 });
});

test('a sub-pixel rect on a small, upscaled image is not saved with zero size', async t => {
  await setupImg(t, { w: 100, h: 50, imgAttrs: 'style="width:800px"' });
  const b = await t.box();
  await t.drag([b.x + 85, b.y + 85], [b.x + 90, b.y + 90]);    // ~0.6 image px
  t.eq(await t.html(), '');
});

test('<picture> with w-descriptor sources: the largest candidate defines the coordinate space; textarea found', async t => {
  await t.setup('<div><picture><source id="src" sizes="300px"><img id="img"></picture><textarea id="ta"><area shape="rect" coords="1,1,9,9"></textarea></div>');
  const r = await t.page.evaluate(async () => {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c.toDataURL(); };
    const img = document.getElementById('img');
    document.getElementById('src').srcset = `${mk(1600, 800)} 1600w, ${mk(800, 400)} 800w`;
    await new Promise(r => { img.onload = r; img.src = mk(10, 5); });
    window.ed = new kImgMap(img, { mode: 'inline' });   // no textarea option: found next to the <picture>
    await new Promise(r => setTimeout(r, 100));
    return [document.querySelector('.kimgmap-svg').getAttribute('viewBox'), ed.getHTML()];
  });
  t.eq(r, ['0 0 1600 800', '<area shape="rect" coords="1,1,9,9">']);
});

test('responsive(): two images sharing one map scale it once', async t => {
  await t.setup('<img id="p1" usemap="#m" style="width:200px;display:block"><img id="p2" usemap="#m" style="width:200px;display:block"><map name="m"><area id="a1" shape="rect" coords="0,0,400,200"></map>');
  await t.page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 400;
    for (const id of ['p1', 'p2']) { const img = document.getElementById(id); await new Promise(r => { img.onload = r; img.src = c.toDataURL(); }); }
    kImgMap.responsive('#p1'); kImgMap.responsive('#p2');
  });
  t.eq(await t.page.$eval('#a1', a => a.getAttribute('coords')), '0,0,100,50');
});
