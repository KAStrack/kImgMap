/* Touch-specific behaviour: scrolling, cancel, multi-touch, target sizes */
'use strict';
const { test, IMG } = require('./harness');

const page = (ta = '') => `<div>${IMG}<textarea id="ta">${ta}</textarea></div>`;
const inline = (opts = {}) => `window.ed = new kImgMap('#img', ${JSON.stringify({ mode: 'inline', ...opts })})`;
const touch = { input: 'touch' };

const realTouch = { input: 'touch', realInput: true };   // browser gestures (scrolling) can't be simulated

test('[touch] dragging on the image draws instead of scrolling the page', async t => {
  await t.setup(`<div style="height:120px"></div>${page()}<div style="height:3000px"></div>`, inline());
  const b = await t.box();
  await t.drag(t.at(b, 100, 300), t.at(b, 300, 100));
  t.eq(await t.page.evaluate(() => window.scrollY), 0, 'page did not scroll');
  await t.expectHTML('<area shape="rect" coords="100,100,300,300">');
}, realTouch);

test('[touch] the SVG overlay disables browser touch gestures', async t => {
  await t.setup(page(), inline());
  t.eq(await t.page.$eval('.kimgmap-svg', s => getComputedStyle(s).touchAction), 'none');
}, touch);

test('[touch] with the Select tool, dragging an area moves it without scrolling', async t => {
  await t.setup(`${page('<area shape="rect" coords="100,100,300,300">')}<div style="height:3000px"></div>`, inline({ defaultShape: null }));
  const b = await t.box();
  await t.drag(t.at(b, 200, 250), t.at(b, 200, 150));
  await t.page.waitForTimeout(200);
  t.eq(await t.page.evaluate(() => window.scrollY), 0, 'no scroll');
  await t.expectHTML('<area shape="rect" coords="100,0,300,200">');
}, realTouch);

test('[touch] a scroll gesture on the sidebar does not blur a focused property field', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  await t.tapEl('.kimgmap-list-item');
  await t.page.focus('[data-attr="href"]');
  const r = await t.page.locator('.kimgmap-section-title').first().boundingBox();
  await t.drag([r.x + 20, r.y + 40], [r.x + 20, r.y - 40]);
  t.eq(await t.page.evaluate(() => document.activeElement?.dataset?.attr), 'href');
}, touch);

test('[touch] targets switch between finger and mouse sizes with the input in use', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline({ defaultShape: null }));
  const w = () => t.page.$eval('.kimgmap-handle', h => Math.round(h.getBoundingClientRect().width));
  const big = await w();
  const b = await t.box();
  await t.page.mouse.click(...t.at(b, 600, 300));
  const small = await w();
  await t.page.touchscreen.tap(...t.at(b, 600, 300));
  t.ok(big >= 20 && small <= 14 && await w() >= 20, `touch ${big}px → mouse ${small}px → touch ${await w()}px`);
}, touch);

test('[touch] touchcancel during a drag reverts the area', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  const b = await t.box();
  await t.finger.down(0, t.at(b, 150, 150));
  await t.finger.move(0, t.at(b, 200, 170));
  await t.finger.move(0, t.at(b, 250, 190));
  await t.finger.cancel();
  await t.page.waitForTimeout(50);
  await t.expectHTML('<area shape="rect" coords="100,100,200,200">');
  t.eq(await t.page.$eval('.kimgmap-shape', r => [+r.getAttribute('x'), +r.getAttribute('y')]), [100, 100], 'SVG reverted too');
}, touch);

test('[touch] touchcancel during a draw discards the shape', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  await t.finger.down(0, t.at(b, 100, 100));
  await t.finger.move(0, t.at(b, 200, 200));
  await t.finger.move(0, t.at(b, 300, 250));
  await t.finger.cancel();
  await t.page.waitForTimeout(50);
  t.eq(await t.page.evaluate(() => [document.getElementById('ta').value, document.querySelectorAll('.kimgmap-preview').length]), ['', 0]);
  await t.drag(t.at(b, 400, 100), t.at(b, 500, 200));
  await t.expectHTML('<area shape="rect" coords="400,100,500,200">', 'next draw works');
}, touch);

test('[touch] a second finger is ignored during a draw', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  const A = t.at(b, 100, 100), B = t.at(b, 300, 250), F2a = t.at(b, 700, 50), F2b = t.at(b, 750, 380), F2c = t.at(b, 780, 390);
  await t.finger.down(0, A);
  await t.finger.move(0, t.at(b, 150, 150));
  await t.finger.down(1, F2a);                 // second finger lands
  await t.finger.move(0, t.at(b, 250, 200));
  await t.finger.move(1, F2b);
  await t.finger.move(0, B);                   // first finger reaches B
  await t.finger.move(1, F2c);                 // then only the second finger moves
  await t.finger.up(1);                        // second finger lifts first
  t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 1, 'still drawing after second finger lifts');
  await t.finger.up(0);
  await t.page.waitForTimeout(50);
  await t.expectHTML('<area shape="rect" coords="100,100,300,250">');
}, touch);

test('[touch] a second finger landing on another area cannot hijack a drag', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">\n<area shape="rect" coords="500,100,600,200">'), inline());
  const b = await t.box();
  await t.finger.down(0, t.at(b, 150, 150));
  await t.finger.move(0, t.at(b, 160, 160));
  await t.finger.down(1, t.at(b, 550, 150));   // second finger lands on the other area
  await t.finger.move(0, t.at(b, 200, 200));
  await t.finger.move(1, t.at(b, 650, 250));
  await t.finger.up(1);
  await t.finger.up(0);
  await t.page.waitForTimeout(50);
  await t.expectHTML('<area shape="rect" coords="150,150,250,250">\n<area shape="rect" coords="500,100,600,200">');
}, touch);

test('[touch] handles are enlarged for coarse pointers', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  const w = await t.page.$eval('.kimgmap-handle', h => h.getBoundingClientRect().width);
  t.ok(w >= 20, `handle is ${w}px wide on a touch screen`);
}, touch);

test('[mouse] handles stay small for fine pointers', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  const w = await t.page.$eval('.kimgmap-handle', h => h.getBoundingClientRect().width);
  t.ok(w <= 14, `handle is ${w}px wide with a mouse`);
});

test('[touch] tapping the toolbar and list works', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  await t.tool('circle');
  t.eq(await t.page.$eval('.kimgmap-tool.is-active', b => b.dataset.tool), 'circle');
  await t.tapEl('.kimgmap-list-item');
  await t.tool('duplicate');
  t.eq(await t.page.evaluate(() => ed.areas.length), 2);
}, touch);
