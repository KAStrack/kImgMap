/*
 * Pointer interaction: drawing, moving, resizing, selecting.
 * Every forInputs() scenario runs once with a mouse and once with touch.
 */
'use strict';
const { test, forInputs, IMG } = require('./harness');

const page = (ta = '') => `<div>${IMG}<textarea id="ta">${ta}</textarea></div>`;
const inline = (opts = {}) => `window.ed = new kImgMap('#img', ${JSON.stringify({ mode: 'inline', ...opts })})`;

/* ── Drawing ─────────────────────────────────────────────────────────────── */

forInputs('draws a rect in natural-pixel coords (display scaled 2×)', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 250));
  await t.expectHTML('<area shape="rect" coords="100,100,300,250">');
  t.eq(await t.page.$$eval('.kimgmap-list-item.is-active', e => e.length), 1, 'new area selected');
});

forInputs('rect drawn right-to-left is normalised', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  await t.drag(t.at(b, 300, 250), t.at(b, 100, 100));
  await t.expectHTML('<area shape="rect" coords="100,100,300,250">');
});

forInputs('rect drawn past the image edge is clamped to the image', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  await t.drag(t.at(b, 700, 300), [b.x + b.w + 60, b.y + b.h + 60]);
  await t.expectHTML('<area shape="rect" coords="700,300,800,400">');
});

forInputs('tiny accidental rect is discarded', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  await t.drag(t.at(b, 100, 100), t.at(b, 102, 102));
  t.eq(await t.html(), '');
});

forInputs('shows a preview while drawing and removes it afterwards', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  await t.down(t.at(b, 100, 100));
  await t.move(t.at(b, 300, 250));
  t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 1, 'preview during draw');
  t.eq(await t.page.$$eval('.kimgmap-ag', e => e.length), 0, 'no area yet');
  await t.up();
  t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 0, 'preview removed');
});

forInputs('draws a circle (radius clamped inside the image)', async t => {
  await t.setup(page(), inline());
  await t.tool('circle');
  const b = await t.box();
  await t.drag(t.at(b, 400, 200), t.at(b, 460, 280));
  await t.expectHTML('<area shape="circle" coords="400,200,100">');
  await t.drag(t.at(b, 700, 200), t.at(b, 700, 390));
  await t.expectHTML('<area shape="circle" coords="400,200,100">\n<area shape="circle" coords="700,200,100">', 'clamped to edge distance');
});

forInputs('draws a polygon and closes it on the first vertex', async t => {
  await t.setup(page(), inline());
  await t.tool('poly');
  const b = await t.box();
  for (const [x, y] of [[100, 100], [300, 100], [200, 300]]) { await t.tap(t.at(b, x, y)); await t.page.waitForTimeout(350); }
  t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 1, 'preview while drawing poly');
  await t.tap(t.at(b, 101, 101));
  await t.expectHTML('<area shape="poly" coords="100,100,300,100,200,300">');
});

forInputs('polygon closes by double-click/double-tap on the last point (no duplicate vertex)', async t => {
  await t.setup(page(), inline());
  await t.tool('poly');
  const b = await t.box();
  await t.tap(t.at(b, 100, 100)); await t.page.waitForTimeout(350);
  await t.tap(t.at(b, 300, 100)); await t.page.waitForTimeout(350);
  await t.doubleTap(t.at(b, 200, 300));
  await t.page.waitForTimeout(100);
  await t.expectHTML('<area shape="poly" coords="100,100,300,100,200,300">');
});

forInputs('polygon with fewer than 3 points is discarded', async t => {
  await t.setup(page(), inline());
  await t.tool('poly');
  const b = await t.box();
  await t.tap(t.at(b, 100, 100)); await t.page.waitForTimeout(350);
  await t.doubleTap(t.at(b, 300, 100));
  await t.page.waitForTimeout(100);
  t.eq(await t.html(), '');
});

/* ── Moving ──────────────────────────────────────────────────────────────── */

forInputs('dragging an area moves it (select tool)', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline({ defaultShape: null }));
  const b = await t.box();
  await t.drag(t.at(b, 150, 150), t.at(b, 200, 170));
  await t.expectHTML('<area shape="rect" coords="150,120,250,220">');
});

forInputs('dragging an area with a draw tool active moves it instead of drawing', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  const b = await t.box();
  await t.drag(t.at(b, 150, 150), t.at(b, 200, 170));
  await t.expectHTML('<area shape="rect" coords="150,120,250,220">');
});

forInputs('drag past the edge clamps, and releasing outside the editor ends the drag', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  const b = await t.box();
  await t.drag(t.at(b, 150, 150), [b.x + b.w + 150, b.y + b.h + 100]);
  await t.expectHTML('<area shape="rect" coords="700,300,800,400">', 'clamped', { tol: 0 });
  if (t.input !== 'touch') await t.hover(t.at(b, 300, 200));   // touch has no hover
  await t.expectHTML('<area shape="rect" coords="700,300,800,400">', 'unchanged after release');
});

forInputs('dragging circles and polygons keeps their shape at the edge', async t => {
  await t.setup(page('<area shape="circle" coords="200,200,50">\n<area shape="poly" coords="500,100,600,100,550,200">'), inline());
  const b = await t.box();
  await t.drag(t.at(b, 200, 200), t.at(b, 0, 200));
  await t.drag(t.at(b, 550, 130), t.at(b, 800, 130));
  await t.expectHTML('<area shape="circle" coords="50,200,50">\n<area shape="poly" coords="700,100,800,100,750,200">', 'clamped', { tol: 0 });
});

/* ── Resizing ────────────────────────────────────────────────────────────── */

// Rect 200,100 → 400,300; handles nw n ne e se s sw w; each dragged by +20,+20
const RECT_HANDLES = [
  ['nw', [200, 100], '220,120,400,300'],
  ['n',  [300, 100], '200,120,400,300'],
  ['ne', [400, 100], '200,120,420,300'],
  ['e',  [400, 200], '200,100,420,300'],
  ['se', [400, 300], '200,100,420,320'],
  ['s',  [300, 300], '200,100,400,320'],
  ['sw', [200, 300], '220,100,400,320'],
  ['w',  [200, 200], '220,100,400,300'],
];
forInputs('each of the 8 rect handles resizes the correct edges', async t => {
  for (const [name, [x, y], expected] of RECT_HANDLES) {
    await t.setup(page('<area shape="rect" coords="200,100,400,300">'), inline());
    const b = await t.box();
    await t.drag(t.at(b, x, y), t.at(b, x + 20, y + 20));
    await t.expectHTML(`<area shape="rect" coords="${expected}">`, `handle ${name}`);
  }
});

forInputs('a rect handle cannot invert the rect', async t => {
  await t.setup(page('<area shape="rect" coords="200,100,400,300">'), inline());
  const b = await t.box();
  await t.drag(t.at(b, 200, 100), t.at(b, 600, 380));
  await t.expectHTML('<area shape="rect" coords="399,299,400,300">', 'clamped to 1px', { tol: 0 });
});

forInputs('circle handle changes the radius', async t => {
  await t.setup(page('<area shape="circle" coords="400,200,50">'), inline());
  const b = await t.box();
  await t.drag(t.at(b, 450, 200), t.at(b, 480, 200));
  await t.expectHTML('<area shape="circle" coords="400,200,80">');
});

forInputs('polygon vertex handle moves one vertex', async t => {
  await t.setup(page('<area shape="poly" coords="100,100,300,100,200,300">'), inline({ defaultShape: null }));
  const b = await t.box();
  await t.drag(t.at(b, 300, 100), t.at(b, 350, 150));
  await t.expectHTML('<area shape="poly" coords="100,100,350,150,200,300">');
});

forInputs('with the poly tool active, dragging a vertex does not start a new polygon', async t => {
  await t.setup(page('<area shape="poly" coords="100,100,300,100,200,300">'), inline());
  await t.tool('poly');
  const b = await t.box();
  await t.drag(t.at(b, 300, 100), t.at(b, 320, 120));
  t.eq(await t.page.evaluate(() => [document.querySelectorAll('.kimgmap-preview').length, document.querySelectorAll('.kimgmap-list-item').length]), [0, 1], 'no polygon started');
  await t.expectHTML('<area shape="poly" coords="100,100,320,120,200,300">');
});

forInputs('resizing an unselected area selects it and shows its coords', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">\n<area shape="rect" coords="200,100,400,300">'), inline());
  await t.tapEl('.kimgmap-list-item', { nth: 0 });   // select the OTHER area first
  const b = await t.box();
  await t.drag(t.at(b, 400, 300), t.at(b, 420, 320));
  t.eq(await t.page.$eval('.kimgmap-coords-input', e => e.value.replace(/\s/g, '')), '200,100,420,320');
});

forInputs('a stale pointer that never sent pointerup does not lock the editor', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  // A press whose release never arrives (e.g. delivered to a removed node)
  await t.page.evaluate(([type, x, y]) => { window.__sim.down('lost', type, x, y); window.__sim.lose('lost'); }, [t.input, ...t.at(b, 600, 300)]);
  t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 1, 'stale draw in progress');
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 250));
  await t.expectHTML('<area shape="rect" coords="100,100,300,250">');
  await t.drag(t.at(b, 400, 100), t.at(b, 500, 200));
  await t.expectHTML('<area shape="rect" coords="100,100,300,250">\n<area shape="rect" coords="400,100,500,200">', 'editor keeps working');
});

forInputs('resize keeps the pressed handle element (no DOM churn under the pointer)', async t => {
  await t.setup(page('<area shape="rect" coords="200,100,400,300">'), inline());
  await t.page.evaluate(() => { window.pressed = null; document.addEventListener('pointerdown', e => { pressed = e.target; }, true); });
  const b = await t.box();
  await t.down(t.at(b, 400, 300));
  await t.move(t.at(b, 420, 320));
  t.eq(await t.page.evaluate(() => [pressed?.classList.contains('kimgmap-handle'), pressed?.isConnected]), [true, true]);
  await t.up();
  await t.expectHTML('<area shape="rect" coords="200,100,420,320">');
});

forInputs('a click near the last vertex of an unfinished polygon is ignored, not a discard', async t => {
  await t.setup(page(), inline());
  await t.tool('poly');
  const b = await t.box();
  await t.tap(t.at(b, 100, 100)); await t.page.waitForTimeout(350);
  await t.tap(t.at(b, 300, 100)); await t.page.waitForTimeout(350);
  await t.tap(t.at(b, 305, 102)); await t.page.waitForTimeout(350);
  t.eq(await t.page.$eval('.kimgmap-preview', p => p.getAttribute('points').trim().split(/\s+/).length), 2, 'still drawing with 2 points');
  await t.tap(t.at(b, 200, 300)); await t.page.waitForTimeout(350);
  await t.tap(t.at(b, 100, 100));
  await t.expectHTML('<area shape="poly" coords="100,100,300,100,200,300">');
});

/* ── Selection ───────────────────────────────────────────────────────────── */

forInputs('tapping an area selects it; tapping the background deselects', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200" alt="A">'), inline({ defaultShape: null }));
  const b = await t.box();
  await t.tap(t.at(b, 150, 150));
  t.eq(await t.page.evaluate(() => [!!document.querySelector('.kimgmap-ag.is-selected'), document.querySelector('.kimgmap-props').hidden]), [true, false], 'selected');
  await t.tap(t.at(b, 600, 300));
  t.eq(await t.page.evaluate(() => [!!document.querySelector('.kimgmap-ag.is-selected'), document.querySelector('.kimgmap-props').hidden]), [false, true], 'deselected');
});

forInputs('tapping an area list item selects it', async t => {
  await t.setup(page('<area shape="rect" coords="1,1,50,50" alt="A">\n<area shape="rect" coords="100,100,200,200" alt="B">'), inline());
  const items = await t.page.$$('.kimgmap-list-item');
  const bb = await items[1].boundingBox();
  await t.tap([bb.x + bb.width / 2, bb.y + bb.height / 2]);
  t.eq(await t.page.evaluate(() => ed.areas.findIndex(a => a.id === document.querySelector('.kimgmap-ag.is-selected')?.dataset.id)), 1);
});

forInputs('editable: false — no handles, areas cannot be moved, but can be selected', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline({ editable: false, defaultShape: null }));
  t.eq(await t.page.$$eval('.kimgmap-handle', e => e.length), 0, 'no handles');
  const b = await t.box();
  await t.drag(t.at(b, 150, 150), t.at(b, 250, 250));
  await t.expectHTML('<area shape="rect" coords="100,100,200,200">');
  await t.tap(t.at(b, 150, 150));
  t.ok(await t.page.$('.kimgmap-ag.is-selected'), 'selected');
});

forInputs('editable: false with a draw tool — pressing an area selects it without drawing over it', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,300,300">'), inline({ editable: false }));
  const b = await t.box();
  await t.drag(t.at(b, 150, 150), t.at(b, 250, 250));
  await t.expectHTML('<area shape="rect" coords="100,100,300,300">');
  t.ok(await t.page.$('.kimgmap-ag.is-selected'), 'selected');
});

forInputs('interacting with the canvas focuses the inline editor (for shortcuts)', async t => {
  await t.setup(`<input id="other">${page('<area shape="rect" coords="100,100,200,200">')}`, inline({ defaultShape: null }));
  await t.page.focus('#other');
  const b = await t.box();
  await t.tap(t.at(b, 150, 150));
  t.eq(await t.page.evaluate(() => [!!document.activeElement?.closest('.kimgmap-editor'), document.activeElement?.classList.contains('kimgmap-img-area')]), [true, true]);
});

forInputs('two instances on one page are independent', async t => {
  await t.setup(`${page()}<div><img data-test id="img2" style="width:400px;height:200px;display:block"><textarea id="ta2"></textarea></div>`,
    () => { window.a = new kImgMap('#img', { mode: 'inline' }); window.b = new kImgMap('#img2', { mode: 'inline' }); });
  const first = await t.page.evaluate(() => { const r = document.querySelector('.kimgmap-svg').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await t.drag(t.at(first, 100, 100), t.at(first, 300, 250));
  t.eq(await t.page.evaluate(() => [a.areas.length, b.areas.length, document.getElementById('ta2').value]), [1, 0, '']);
});

/* ── Modal mode ──────────────────────────────────────────────────────────── */

forInputs('modal: draw and drag use the modal image scale', async t => {
  await t.setup(page(), () => { window.ed = new kImgMap('#img'); });
  await t.openModal();
  const b = await t.box();
  t.ok(Math.abs(b.w - 400) > 10, 'modal image is displayed at a different size than the page image');
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 250));
  await t.drag(t.at(b, 200, 200), t.at(b, 250, 220));
  await t.expectHTML('<area shape="rect" coords="150,120,350,270">');
});

forInputs('modal: releasing a drag over the backdrop does not close the modal', async t => {
  await t.setup(page(), () => { window.closes = []; window.ed = new kImgMap('#img', { onClose: s => closes.push(s) }); });
  await t.openModal();
  const b = await t.box();
  await t.drag(t.at(b, 600, 300), [5, 5]);
  await t.settled();
  t.eq(await t.page.evaluate(() => [closes, document.querySelectorAll('.kimgmap-overlay').length, ed.areas.length]), [[], 1, 1]);
  await t.tap([5, 5]);
  await t.tapEl('.kimgmap-discard-confirm'); await t.settled();   // there are unsaved changes
  t.eq(await t.page.evaluate(() => closes), [false], 'a real backdrop click still closes');
});

/* ── Mouse-specific ──────────────────────────────────────────────────────── */

test('[mouse] right-click does not start a draw, drag or resize', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  const b = await t.box();
  for (const [from, to] of [[[400, 300], [600, 380]], [[150, 150], [300, 300]], [[200, 200], [300, 300]]]) {
    await t.page.mouse.move(...t.at(b, ...from)); await t.page.mouse.down({ button: 'right' });
    await t.page.mouse.move(...t.at(b, ...to), { steps: 3 }); await t.page.mouse.up({ button: 'right' });
  }
  await t.page.mouse.move(...t.at(b, 700, 50), { steps: 3 });
  await t.expectHTML('<area shape="rect" coords="100,100,200,200">');
});

forInputs('polygon shows a preview line to the hovering cursor/pen', async t => {
  await t.setup(page(), inline());
  await t.tool('poly');
  const b = await t.box();
  await t.tap(t.at(b, 100, 100));
  await t.hover(t.at(b, 300, 200));
  const line = await t.page.$eval('.kimgmap-preview-line', l => [+l.getAttribute('x2'), +l.getAttribute('y2')]);
  t.ok(Math.abs(line[0] - 300) <= 2 && Math.abs(line[1] - 200) <= 2, 'line follows cursor: ' + line);
}, { inputs: ['mouse', 'pen'] });

test('[mouse] dragging does not select page text or start a native image drag', async t => {
  await t.setup(`<p id="txt">Some selectable text above the editor</p>${page('<area shape="rect" coords="100,100,200,200">')}`,
    () => { window.drags = 0; document.addEventListener('dragstart', () => drags++); window.ed = new kImgMap('#img', { mode: 'inline' }); });
  const b = await t.box();
  const p = await t.page.locator('#txt').boundingBox();
  await t.drag(t.at(b, 500, 300), [p.x + 5, p.y + 5]);
  await t.drag(t.at(b, 150, 150), [p.x + 5, p.y + 5]);
  t.eq(await t.page.evaluate(() => [window.getSelection().toString(), drags]), ['', 0]);
});
