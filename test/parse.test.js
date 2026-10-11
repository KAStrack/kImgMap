/* Parsing, serialisation, and the data API (no pointer interaction) */
'use strict';
const { test, IMG } = require('./harness');

const inline = () => { window.ed = new kImgMap('#img', { mode: 'inline' }); };

test('version is exposed and matches the source build', async t => {
  await t.setup('');
  t.eq(await t.page.evaluate(() => kImgMap.version), t.SRC_VERSION);
});

test('parses existing areas and round-trips output', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><area shape="rect" coords="10,20,110,120" href="/a" alt="A">
<area shape="circle" coords="400,200,50" href="/b" alt="B">
<area shape="poly" coords="500,50,600,50,550,150" href="/c" alt="C"></textarea></div>`, inline);
  t.eq(await t.page.evaluate(() => ed.getAreas().map(a => [a.shape, a.coords])),
    [['rect', [10, 20, 110, 120]], ['circle', [400, 200, 50]], ['poly', [500, 50, 600, 50, 550, 150]]]);
  t.eq(await t.page.evaluate(() => ed.getHTML()),
    '<area shape="rect" coords="10,20,110,120" href="/a" alt="A">\n<area shape="circle" coords="400,200,50" href="/b" alt="B">\n<area shape="poly" coords="500,50,600,50,550,150" href="/c" alt="C">');
  t.eq(await t.page.$$eval('.kimgmap-ag', g => g.length), 3, 'rendered groups');
  t.eq(await t.page.$$eval('.kimgmap-list-item', g => g.length), 3, 'list items');
});

test('parses areas inside a <map> wrapper', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><map name="m"><area shape="rect" coords="1,2,30,40"></map></textarea></div>`, inline);
  t.eq(await t.page.evaluate(() => ed.getHTML()), '<area shape="rect" coords="1,2,30,40">');
});

test('parser tolerates bad input (coord counts, unknown shape, aliases, separators); keeps what it cannot edit', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><area shape="rect" coords="10,10"><area shape="star" coords="1,2,3"><area shape="circ" coords="100,100,10"><area shape="polygon" coords="1 1; 50 1; 25 40"><area shape="RECT" coords="60,60,5,5"></textarea></div>`, inline);
  const r = await t.page.evaluate(() => ({ html: ed.getHTML(), nan: document.querySelector('.kimgmap-svg').innerHTML.includes('NaN') }));
  t.eq(await t.errors(), [], 'no errors');
  t.ok(!r.nan, 'no NaN in SVG');
  t.eq(r.html, '<area shape="circle" coords="100,100,10">\n<area shape="poly" coords="1,1,50,1,25,40">\n<area shape="rect" coords="5,5,60,60">\n<area shape="rect" coords="10,10">\n<area shape="star" coords="1,2,3">');
});

test('parser: prototype-key shapes, px coords, invalid shape → rect, default kept verbatim', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><area shape="constructor" coords="1,2,3,4,5,6"><area shape="rect" coords="10px, 20px, 110px, 120px"><area shape="rec" coords="5,5,50,50"><area shape="default"></textarea></div>`, inline);
  t.eq(await t.page.evaluate(() => ed.getHTML()), '<area shape="rect" coords="1,2,3,4">\n<area shape="rect" coords="10,20,110,120">\n<area shape="rect" coords="5,5,50,50">\n<area shape="default">');
  t.eq(await t.errors(), []);
  t.eq(await t.page.evaluate(() => { ed.setAreas([{ shape: 'toString', coords: [1, 2, 3], attrs: {} }]); return ed.areas.length; }), 0, 'setAreas rejects prototype keys');
});

test('output: <map> wrapper with name', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><area shape="rect" coords="10,10,50,50"></textarea></div>`,
    () => { window.ed = new kImgMap('#img', { mode: 'inline', output: 'map', mapName: 'm1' }); });
  t.eq(await t.page.evaluate(() => ed.getHTML()), '<map name="m1">\n<area shape="rect" coords="10,10,50,50">\n</map>');
});

test('output: coords are rounded, values escaped, present-but-empty attributes kept', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"></textarea></div>`, inline);
  t.eq(await t.page.evaluate(() => {
    ed.setAreas([{ shape: 'rect', coords: [1.4, 2.6, 30.5, 40], attrs: { href: '/x?a=1&b="2"', alt: '' } }]);
    return ed.getHTML();
  }), '<area shape="rect" coords="1,3,31,40" href="/x?a=1&amp;b=&quot;2&quot;" alt="">');
});

test('outputAttributes always writes listed attrs; onAttributeChange mirrors', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><area shape="rect" coords="10,10,50,50"></textarea></div>`,
    () => { window.ed = new kImgMap('#img', { mode: 'inline', attributes: ['href', { attr: 'title', label: 'Name' }],
      outputAttributes: ['href', 'alt', 'title'],
      onAttributeChange: (a, attr, v) => attr === 'title' ? { alt: v } : undefined }); });
  t.eq(await t.html(), '<area shape="rect" coords="10,10,50,50">', 'untouched before edit');
  await t.page.click('.kimgmap-list-item');
  t.eq(await t.page.$eval('label[for$="-title"]', l => l.textContent), 'Name');
  await t.page.fill('[data-attr="title"]', 'T');
  t.eq(await t.html(), '<area shape="rect" coords="10,10,50,50" href="" alt="T" title="T">');
});

test('properties panel edits attributes (text + target select)', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><area shape="rect" coords="100,100,200,200"></textarea></div>`, inline);
  await t.page.click('.kimgmap-list-item');
  await t.page.fill('[data-attr="href"]', '/x?a=1&b="2"');
  await t.page.selectOption('[data-attr="target"]', '_blank');
  t.eq(await t.html(), '<area shape="rect" coords="100,100,200,200" href="/x?a=1&amp;b=&quot;2&quot;" target="_blank">');
});

test('properties panel keeps a custom target value', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><area shape="rect" coords="1,1,50,50" target="myframe"></textarea></div>`, inline);
  await t.page.click('.kimgmap-list-item');
  t.eq(await t.page.$eval('[data-attr="target"]', s => s.value), 'myframe');
});

test('setAreas / getAreas are deep copies', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"></textarea></div>`, inline);
  const r = await t.page.evaluate(() => {
    const src = [{ shape: 'circle', coords: [100, 100, 20], attrs: { href: '/z' } }];
    ed.setAreas(src); src[0].coords[0] = 999;
    const out = ed.getAreas(); out[0].attrs.href = 'mut';
    return [ed.getHTML(), document.getElementById('ta').value];
  });
  t.eq(r, ['<area shape="circle" coords="100,100,20" href="/z">', '<area shape="circle" coords="100,100,20" href="/z">']);
});

test('setAreas() works on a modal instance before first open', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"></textarea></div>`, () => { window.ed = new kImgMap('#img'); });
  t.eq(await t.page.evaluate(() => { ed.setAreas([{ shape: 'rect', coords: [1, 2, 30, 40], attrs: {} }]); return document.getElementById('ta').value; }), '<area shape="rect" coords="1,2,30,40">');
});

test('onUpdate fires with (html, areas) on change', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"></textarea></div>`,
    () => { window.calls = []; window.ed = new kImgMap('#img', { mode: 'inline', onUpdate: (h, a) => calls.push([h, a.length]) }); });
  await t.page.evaluate(() => ed.setAreas([{ shape: 'rect', coords: [1, 2, 30, 40], attrs: {} }]));
  t.eq(await t.page.evaluate(() => calls), [['<area shape="rect" coords="1,2,30,40">', 1]]);
});
