/*
 * Pen-specific behaviour. General drawing/editing with a pen is covered by the
 * forInputs() scenarios in interaction.test.js (which run with mouse, touch and pen).
 */
'use strict';
const { test, IMG } = require('./harness');

const page = (ta = '') => `<div>${IMG}<textarea id="ta">${ta}</textarea></div>`;
const inline = (opts = {}) => `window.ed = new kImgMap('#img', ${JSON.stringify({ mode: 'inline', ...opts })})`;
const pen = { input: 'pen' };

test('[pen] barrel and eraser buttons do not draw, move or resize', async t => {
  for (const button of [2, 5]) {
    await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
    const b = await t.box();
    for (const [from, to] of [[[400, 300], [600, 380]], [[150, 150], [300, 300]], [[200, 200], [300, 300]]]) {
      await t.penDown(t.at(b, ...from), button);
      await t.move(t.at(b, ...to));
      await t.up();
    }
    await t.expectHTML('<area shape="rect" coords="100,100,200,200">', `button ${button}`);
    t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 0, `button ${button}: nothing being drawn`);
    await t.drag(t.at(b, 400, 250), t.at(b, 500, 350));   // tip contact still works afterwards
    await t.expectHTML('<area shape="rect" coords="100,100,200,200">\n<area shape="rect" coords="400,250,500,350">', `button ${button}: tip draws`);
  }
}, pen);

test('[pen] hovering without contact changes nothing', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  const b = await t.box();
  for (const [x, y] of [[150, 150], [200, 200], [500, 300], [700, 50]]) await t.hover(t.at(b, x, y));
  await t.expectHTML('<area shape="rect" coords="100,100,200,200">');
  t.eq(await t.errors(), []);
}, pen);

test('[pen] uses precise targets on a touch-screen device, finger targets after touch', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline({ defaultShape: null }));
  const w = () => t.page.$eval('.kimgmap-handle', h => Math.round(h.getBoundingClientRect().width));
  const initial = await w();
  const b = await t.box();
  await t.tap(t.at(b, 600, 300));
  const afterPen = await w();
  await t.page.touchscreen.tap(...t.at(b, 600, 300));
  const afterTouch = await w();
  t.ok(initial >= 20 && afterPen <= 14 && afterTouch >= 20, `touch-screen ${initial}px → pen ${afterPen}px → touch ${afterTouch}px`);
}, pen);

test('[pen] palm rejection: a touch during a pen draw is ignored', async t => {
  await t.setup(page('<area shape="rect" coords="500,100,600,200">'), inline());
  const b = await t.box();
  await t.down(t.at(b, 100, 100));
  await t.move(t.at(b, 200, 180));
  await t.finger.down(0, t.at(b, 550, 150));     // palm lands on the other area
  await t.finger.move(0, t.at(b, 700, 350));
  await t.move(t.at(b, 300, 250));
  await t.finger.up(0);
  t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 1, 'pen still drawing after the palm lifts');
  await t.up();
  await t.expectHTML('<area shape="rect" coords="500,100,600,200">\n<area shape="rect" coords="100,100,300,250">');
}, pen);

test('[pen] a pen press takes over from a touch interaction that never ended', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  await t.page.evaluate(([x, y]) => { window.__sim.down('lost', 'touch', x, y); window.__sim.lose('lost'); }, t.at(b, 600, 300));   // touch whose release was lost
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 250));
  await t.expectHTML('<area shape="rect" coords="100,100,300,250">');
}, pen);

test('[pen] a stray touch does not change target sizes mid-stroke', async t => {
  await t.setup(page('<area shape="rect" coords="500,100,600,200">'), inline());
  const w = () => t.page.$eval('.kimgmap-handle', h => Math.round(h.getBoundingClientRect().width));
  const b = await t.box();
  await t.tap(t.at(b, 700, 350));                // pen in use → precise targets
  const before = await w();
  await t.down(t.at(b, 100, 100));
  await t.move(t.at(b, 200, 200));
  await t.finger.down(0, t.at(b, 700, 50));      // palm
  const during = await w();
  await t.finger.up(0);
  await t.up();
  t.eq([before <= 14, during], [true, before], `handle ${before}px before, ${during}px during palm contact`);
}, pen);
