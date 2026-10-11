/* Untrusted textarea content, attribute values, and labels must never execute */
'use strict';
const { test, IMG } = require('./harness');

const inline = () => { window.ed = new kImgMap('#img', { mode: 'inline' }); };

test('textarea markup does not execute while parsing or listing', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><img src=x onerror="window.__xss1=1"><area shape="rect" coords="10,10,50,50" alt="<img src=x onerror=window.__xss2=1>"></textarea></div>`, inline);
  await t.page.waitForTimeout(300);
  t.eq(await t.page.evaluate(() => [window.__xss1 || 0, window.__xss2 || 0]), [0, 0], 'xss flags [parse, list label]');
});

test('malicious shape attribute does not inject markup', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><area shape='rect"><img src=x onerror=window.__xss3=1>' coords="10,10,50,50"></textarea></div>`, inline);
  await t.page.waitForTimeout(300);
  t.eq(await t.page.evaluate(() => window.__xss3 || 0), 0);
});

test('attribute values cannot break out of the property inputs', async t => {
  const evil = '"><img src=x onerror=window.__xss7=1>';
  await t.setup(`<div>${IMG}<textarea id="ta"></textarea></div>`, inline);
  await t.page.evaluate(v => ed.setAreas([{ shape: 'rect', coords: [1, 1, 50, 50], attrs: { href: v, title: v } }]), evil);
  await t.page.click('.kimgmap-list-item');
  await t.page.waitForTimeout(200);
  t.eq(await t.page.evaluate(() => [window.__xss7 || 0, document.querySelector('[data-attr="href"]').value]), [0, evil]);
});

test('typed attribute values do not execute in the area list', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><area shape="rect" coords="10,10,50,50"></textarea></div>`, inline);
  await t.page.click('.kimgmap-list-item');
  await t.page.fill('[data-attr="alt"]', '<img src=x onerror=window.__xss4=1>');
  await t.page.waitForTimeout(300);
  t.eq(await t.page.evaluate(() => [window.__xss4 || 0, document.querySelector('.kimgmap-list-label').textContent]), [0, '<img src=x onerror=window.__xss4=1>']);
});

test('setAreas() data with markup does not execute', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"></textarea></div>`, inline);
  await t.page.evaluate(() => ed.setAreas([{ id: '"><img src=x onerror=window.__xss5=1>', shape: 'rect', coords: [1, 1, 50, 50], attrs: { href: '<img src=x onerror=window.__xss6=1>' } }]));
  await t.page.click('.kimgmap-list-item');
  await t.page.waitForTimeout(300);
  t.eq(await t.page.evaluate(() => [window.__xss5 || 0, window.__xss6 || 0]), [0, 0]);
  t.eq(await t.errors(), []);
});

test('labels are HTML-escaped and new label keys apply', async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"><area shape="rect" coords="10,10,50,50"></textarea></div>`,
    () => { window.ed = new kImgMap('#img', { mode: 'inline', labels: { areas: 'Zonen', select: '<b>x</b>' } }); });
  t.eq(await t.page.evaluate(() => [document.querySelector('.kimgmap-section-title').textContent, document.querySelector('[data-tool=select] span').textContent]), ['Zonen', '<b>x</b>']);
});
