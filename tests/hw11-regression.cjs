// Zero-dependency interaction regressions. Runs the page's real script in Node;
// this small DOM adapter supplies only the browser features used by this page.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let passed = 0;

class TextNode {
  constructor(text) { this.textContent = text; this.parentNode = null; }
}
class Element {
  constructor(tag, doc) { this.tagName = tag; this.doc = doc; this.childNodes = []; this.attrs = {}; this.dataset = {}; this.listeners = {}; this._value = ''; this.checked = false; this.hidden = false; this.disabled = false; this.validity = {badInput: false}; }
  get children() { return this.childNodes.filter(n => n instanceof Element); }
  get firstChild() { return this.childNodes[0]; }
  get id() { return this.attrs.id || ''; }
  set id(v) { this.attrs.id = v; }
  get className() { return this.attrs.class || ''; }
  set className(v) { this.attrs.class = v; }
  get classList() { const el = this; return { add(c) { el.className = [...new Set([...el.className.split(' ').filter(Boolean), c])].join(' '); }, remove(c) { el.className = el.className.split(' ').filter(x => x !== c).join(' '); }, toggle(c, on) { if (on) this.add(c); else this.remove(c); } }; }
  get value() { return this._value; }
  set value(v) { this._value = String(v); }
  get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
  set textContent(v) { this.replaceChildren(new TextNode(String(v))); }
  append(...nodes) { for (let n of nodes) { if (typeof n === 'string') n = new TextNode(n); if (n.parentNode) n.parentNode.childNodes = n.parentNode.childNodes.filter(x => x !== n); n.parentNode = this; this.childNodes.push(n); } }
  replaceChildren(...nodes) { for (const n of this.childNodes) n.parentNode = null; this.childNodes = []; this.append(...nodes); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'value') this.value = v; if (['checked', 'hidden', 'disabled'].includes(k)) this[k] = true; if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type) { if (type === 'click' && this.disabled) return; for (const fn of this.listeners[type] || []) fn({preventDefault() {}}); }
  focus() { this.doc.activeElement = this; }
  scrollIntoView() {}
  get offsetWidth() { return 100; }
  querySelectorAll(selector) { const found = []; for (const child of this.children) { if (selector.startsWith('.') ? child.className.split(' ').includes(selector.slice(1)) : selector.startsWith('[') ? child.getAttribute(selector.slice(1, -1)) !== null : child.tagName === selector) found.push(child); found.push(...child.querySelectorAll(selector)); } return found; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  reset() { for (const el of this.querySelectorAll('input').concat(this.querySelectorAll('select'))) { el.value = el.initialValue; el.checked = el.initialChecked; } }
}
function createDocument() {
  const doc = {activeElement: null};
  const root = new Element('body', doc), stack = [root];
  doc.createElement = tag => new Element(tag, doc);
  doc.createTextNode = text => new TextNode(text);
  doc.getElementById = id => { function find(el) { if (el.id === id) return el; for (const c of el.children) { const match = find(c); if (match) return match; } return null; } return find(root); };
  doc.querySelectorAll = selector => root.querySelectorAll(selector);
  const body = html.split('<body>')[1].split('<script>')[0];
  for (const token of body.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g)) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) { const tag = token.match(/^<\/([\w-]+)/)[1]; while (stack.length > 1) { if (stack.pop().tagName === tag) break; } }
    else if (token.startsWith('<')) { const match = token.match(/^<([\w-]+)([\s\S]*?)\/?\s*>$/); if (!match) continue; const [, tag, attrs] = match; const el = new Element(tag, doc); for (const a of attrs.matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)'|=([^\s>]+))?/g)) el.setAttribute(a[1], a[2] ?? a[3] ?? a[4] ?? ''); stack.at(-1).append(el); if (!['input', 'br', 'meta', 'link', 'img'].includes(tag) && !token.endsWith('/>')) stack.push(el); }
    else stack.at(-1).append(new TextNode(token));
  }
  for (const el of root.querySelectorAll('select')) el.value = el.children.find(c => c.tagName === 'option')?.getAttribute('value') ?? el.children[0]?.textContent ?? '';
  for (const el of root.querySelectorAll('input').concat(root.querySelectorAll('select'))) { el.initialValue = el.value; el.initialChecked = el.checked; }
  return doc;
}
const pathname = '/hw11/today-menu/index.html';
const key = 'hw5.today-menu.v1:' + pathname;
const fixture = [
  {id: 'noodle', name: '番茄蛋麵', price: 85, category: '麵食', spice: '不辣', vegetarian: true},
  {id: 'curry', name: '蔬菜咖哩飯', price: 120, category: '飯食', spice: '微辣', vegetarian: true},
  {id: 'kfc', name: 'KFC 雞腿堡', price: 200, category: '速食', spice: '微辣', vegetarian: false},
  {id: 'premium', name: '聚餐定食', price: 1500, category: '日式料理', spice: '不辣', vegetarian: false},
  {id: 'luxury', name: '山里精進會席', price: 2200, category: '日式料理', spice: '不辣', vegetarian: true},
  {id: 'breakfast', name: '蔬菜蛋餅', price: 45, category: '早餐', spice: '不辣', vegetarian: true}
];
function app({dishes, favorites = [], history = [], catalogRev = 4, raw} = {}) {
  const doc = createDocument(), storage = new Map();
  if (raw !== undefined) storage.set(key, raw);
  else if (dishes !== undefined) storage.set(key, JSON.stringify({version: 1, catalogRev, dishes, favorites, history}));
  const random = Object.create(Math); random.random = () => 0;
  vm.runInNewContext(source, {document: doc, location: {pathname}, localStorage: {getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v)}, Math: random, crypto: {randomUUID: () => 'new-id'}}, {filename: 'today-menu/index.html'});
  const $ = id => { const el = doc.getElementById(id); assert.ok(el, `Missing #${id}`); return el; };
  return {$, doc, storage, set(id, value) { const el = $(id); if (typeof value === 'boolean') el.checked = value; else el.value = value; el.emit(['budget', 'dish-search'].includes(id) ? 'input' : 'change'); }, click(id) { $(id).emit('click'); }, count() { return Number($('candidate-status').textContent.match(/符合條件 (\d+)/)[1]); }, actions() { return $('recovery-actions').querySelectorAll('button'); }, state() { return Object.fromEntries(['budget', 'dish-search', 'price-band', 'category', 'spice', 'vegetarian', 'favorite-only', 'avoid-repeat', 'price-sort'].map(id => [id, ['vegetarian', 'favorite-only', 'avoid-repeat'].includes(id) ? $(id).checked : $(id).value])); }, saved() { return JSON.parse(storage.get(key)); }};
}
function test(name, fn) { try { fn(); passed++; console.log(`PASS ${name}`); } catch (e) { console.error(`FAIL ${name}`); throw e; } }
function findAction(a, field) { return a.actions().find(b => b.dataset.recoveryField === field); }
function compareButton(a, id) { return a.$('cards').querySelectorAll('button').find(b => b.className === 'compare-toggle' && b.dataset.compareId === id); }
function compared(a, id) { return a.$('comparison-items').children.find(el => el.dataset.compareId === id); }

test('original 40 meals, 12 categories, 4 meals per brand and all price tiers remain', () => {
  const a = app(); assert.equal(a.count(), 40); assert.equal(a.$('category').children.length, 13);
  for (const query of ['KFC', '肯德基', "McDonald's", 'McDonald’s', 'ＭｃＤｏｎａｌｄｓ', '麥當勞', '麦当劳']) { a.set('dish-search', query); assert.equal(a.count(), 4, query); }
  a.set('dish-search', ''); a.set('price-band', 'premium'); assert.equal(a.count(), 3); a.set('price-band', 'luxury'); assert.equal(a.count(), 4);
});
test('conflicting search and category offer only useful single-filter counts', () => {
  const a = app({dishes: fixture}); a.set('category', '麵食'); a.set('dish-search', 'KFC');
  assert.equal(a.count(), 0); assert.equal(a.actions().length, 2);
  assert.match(findAction(a, 'query').textContent, /1 道符合/); assert.match(findAction(a, 'category').textContent, /1 道符合/);
  findAction(a, 'category').emit('click'); assert.equal(a.count(), 1); assert.equal(a.$('dish-search').value, 'KFC'); assert.equal(a.$('category').value, 'all'); assert.equal(a.$('draw').disabled, false); assert.equal(a.doc.activeElement.id, 'draw');
});
test('contradictory price band and cap show exact explicit alternatives', () => {
  const a = app({dishes: fixture}); a.set('budget', 100); a.set('price-band', 'premium');
  assert.equal(a.count(), 0); assert.equal(a.actions().length, 2);
  assert.match(findAction(a, 'priceBand').textContent, /所有價位.*2 道符合/s);
  assert.match(findAction(a, 'budget').textContent, /100 調高至 NT\$ 1500.*1 道符合/s);
  findAction(a, 'budget').emit('click'); assert.equal(a.$('budget').value, '1500'); assert.equal(a.$('price-band').value, 'premium'); assert.equal(a.count(), 1);
});
test('budget zero requires an explicit increase and preserves dietary preference', () => {
  const a = app({dishes: fixture}); a.set('budget', 0); a.set('vegetarian', true);
  assert.equal(a.actions().length, 1); assert.match(a.actions()[0].textContent, /0 調高至 NT\$ 45.*1 道符合/s);
  assert.equal(a.$('budget').value, '0'); a.actions()[0].emit('click'); assert.equal(a.$('budget').value, '45'); assert.equal(a.$('vegetarian').checked, true); assert.equal(a.count(), 1);
});
test('dietary conflict never proposes removing vegetarian and handles multi-condition dead ends', () => {
  const a = app({dishes: fixture}); a.set('vegetarian', true); a.set('category', '速食');
  assert.equal(a.actions().length, 1); assert.match(a.actions()[0].textContent, /4 道符合/); assert.equal(a.actions()[0].dataset.recoveryField, 'category');
  a.set('dish-search', 'KFC'); assert.equal(a.actions().length, 0); assert.match(a.$('recovery-summary').textContent, /只調整一項/); assert.match(a.$('recovery-note').textContent, /多個條件/); assert.equal(a.$('vegetarian').checked, true); assert.equal(a.$('draw').disabled, true);
});
test('empty favorites explain the cause and offer counted explicit exit', () => {
  const a = app({dishes: fixture}); a.set('favorite-only', true); assert.match(a.$('recovery-summary').textContent, /還沒有收藏/);
  assert.equal(a.actions().length, 1); assert.match(a.actions()[0].textContent, /取消.*6 道符合/s); a.actions()[0].emit('click'); assert.equal(a.count(), 6);
});
test('empty catalog offers no fabricated recovery and retains existing filters', () => {
  const a = app({dishes: []}); a.set('budget', 100); a.set('vegetarian', true);
  assert.equal(a.count(), 0); assert.equal(a.actions().length, 0); assert.match(a.$('recovery-summary').textContent, /菜單目前是空的/); assert.equal(a.$('budget').value, '100'); assert.equal(a.$('vegetarian').checked, true);
});
test('invalid budget blocks recovery and draw until corrected', () => {
  const a = app({dishes: fixture}); for (const value of ['-1', '0.5', '3001', 'abc']) { a.set('budget', value); assert.equal(a.count(), 0); assert.equal(a.$('budget').getAttribute('aria-invalid'), 'true'); assert.equal(a.$('recovery-panel').hidden, true); assert.equal(a.actions().length, 0); assert.match(a.$('result-content').textContent, /請先修正預算/); assert.equal(a.$('draw').disabled, true); }
  a.$('budget').validity.badInput = true; a.set('budget', ''); assert.equal(a.$('recovery-panel').hidden, true); a.$('budget').validity.badInput = false; a.set('budget', ''); assert.equal(a.count(), 6);
});
test('every shown action count is exact and changes only its named filter across 240 states', () => {
  let checked = 0;
  const fieldIds = {query: 'dish-search', priceBand: 'price-band', category: 'category', spice: 'spice', favoriteOnly: 'favorite-only', budget: 'budget'};
  for (const budget of ['', 100, 2000]) for (const band of ['all', 'premium']) for (const category of ['all', '麵食']) for (const spice of ['all', '微辣']) for (const vegetarian of [false, true]) for (const query of ['', 'KFC', '不存在', '山里', '蛋']) {
    const a = app({dishes: fixture}); for (const [id, v] of Object.entries({budget, 'price-band': band, category, spice, vegetarian, 'dish-search': query})) a.set(id, v);
    if (a.count()) continue;
    for (const button of a.actions()) {
      const before = a.state(), raw = a.storage.get(key), count = Number(button.textContent.match(/→ (\d+) 道/)[1]);
      button.emit('click'); assert.equal(a.count(), count); assert.ok(count > 0); assert.deepEqual(Object.keys(before).filter(id => before[id] !== a.state()[id]), [fieldIds[button.dataset.recoveryField]]); assert.equal(a.storage.get(key), raw); assert.equal(a.$('vegetarian').checked, vegetarian); checked++;
      for (const [id, v] of Object.entries(before)) a.set(id, v);
    }
  }
  assert.ok(checked > 100, `Only ${checked} recovery actions exercised`);
});
test('selected explanation includes all active constraints and exact remaining budget', () => {
  const a = app({dishes: fixture, favorites: ['luxury']}); for (const [id, v] of Object.entries({budget: 2300, 'price-band': 'luxury', category: '日式料理', spice: '不辣', vegetarian: true, 'favorite-only': true, 'dish-search': '精進'})) a.set(id, v);
  assert.equal(a.count(), 1); a.click('draw'); const text = a.$('match-reasons').textContent;
  for (const phrase of ['2200', '2300', '剩餘額度 NT$ 100', '犒賞 2000–3000', '日式料理', '不辣', '素食手動標記', '向店家確認', '我的最愛', '搜尋「精進」']) assert.ok(text.includes(phrase), phrase);
  assert.equal(a.$('match-reasons').getAttribute('aria-live'), 'polite');
});
test('condition changes refresh selected reasons and remove a stale selection', () => {
  const a = app({dishes: fixture}); a.set('dish-search', '山里'); a.set('budget', 2300); a.set('spice', '不辣'); a.click('draw');
  a.set('budget', 2400); assert.match(a.$('match-reasons').textContent, /剩餘額度 NT\$ 200/); a.set('spice', 'all'); assert.ok(!a.$('match-reasons').textContent.includes('辣度：'));
  a.set('budget', 2199); assert.equal(a.doc.getElementById('match-reasons'), null); assert.equal(a.$('result-favorite').hidden, true); assert.ok(!a.$('result-content').textContent.includes('剩餘額度'));
});
test('price band boundaries and budget extremes use inclusive upper budget without negative remainder', () => {
  const dishes = [0, 999, 1000, 1999, 2000, 3000].map(price => ({id: 'p' + price, name: '餐點' + price, price, category: '其他', spice: '不辣', vegetarian: false}));
  const a = app({dishes}); a.set('budget', 0); assert.equal(a.count(), 1); a.click('draw'); assert.match(a.$('match-reasons').textContent, /剩餘額度 NT\$ 0/);
  a.set('budget', 3000); for (const band of ['everyday', 'premium', 'luxury']) { a.set('price-band', band); assert.equal(a.count(), 2); }
  a.set('dish-search', '3000'); a.click('draw'); assert.match(a.$('match-reasons').textContent, /剩餘額度 NT\$ 0/); a.set('budget', ''); assert.match(a.$('match-reasons').textContent, /預算不限/);
});
test('favorites, five-item history and no-repeat draw remain functional', () => {
  const a = app({dishes: fixture}); a.click('draw'); const first = a.$('result-title').textContent; a.click('result-favorite'); assert.equal(a.saved().favorites.length, 1); a.set('avoid-repeat', true); a.click('draw'); assert.notEqual(a.$('result-title').textContent, first);
  for (let i = 0; i < 6; i++) a.click('draw'); assert.equal(a.saved().history.length, 5);
  a.set('favorite-only', true); assert.equal(a.count(), 1); a.click('draw'); a.click('draw'); assert.equal(a.saved().history.length, 5); a.click('clear-history'); assert.equal(a.saved().history.length, 0); assert.equal(a.saved().favorites.length, 1);
});
test('CRUD, selected edit refresh, delete and favorite-preserving undo remain functional', () => {
  const a = app({dishes: fixture}); a.$('dish-name').value = '測試餐'; a.$('dish-price').value = '90'; a.$('dish-category').value = '其他'; a.$('dish-spice').value = '不辣'; a.$('dish-form').emit('submit'); assert.equal(a.count(), 7); assert.equal(a.saved().dishes.length, 7);
  a.set('dish-search', '測試餐'); a.click('draw'); a.click('result-favorite'); let card = a.$('cards').children[0]; card.querySelectorAll('button').find(b => b.textContent === '修改').emit('click'); a.$('dish-price').value = '95'; a.$('dish-form').emit('submit'); assert.match(a.$('match-reasons').textContent, /預估 NT\$ 95/);
  card = a.$('cards').children[0]; card.querySelectorAll('button').find(b => b.textContent === '刪除').emit('click'); assert.equal(a.count(), 0); assert.equal(a.saved().favorites.length, 0); a.click('undo-delete'); assert.equal(a.count(), 1); assert.equal(a.saved().favorites.length, 1); assert.equal(a.saved().dishes.at(-1).price, 95);
});
test('sorting and all-menu view preserve the candidate pool and recovery logic', () => {
  const a = app({dishes: fixture}); a.set('price-sort', 'price-desc'); assert.equal(a.count(), 6); assert.equal(a.$('cards').children[0].dataset.dishId, 'luxury'); a.set('price-sort', 'price-asc'); assert.equal(a.$('cards').children[0].dataset.dishId, 'breakfast');
  a.set('budget', 0); a.click('show-all'); assert.equal(a.$('cards').children.length, 6); assert.equal(a.count(), 0); assert.equal(a.$('draw').disabled, true); assert.equal(a.actions().length, 1);
});
test('version-one storage and catalog migration preserve custom data, favorites and history', () => {
  const custom = {...fixture[0], id: 'custom', name: '我的自訂麵', price: 99}; const a = app({dishes: [custom], favorites: ['custom'], history: [{id: 'custom', name: custom.name, price: 99}], catalogRev: 3});
  assert.equal(a.count(), 7); assert.equal(a.saved().version, 1); assert.equal(a.saved().catalogRev, 4); assert.deepEqual(a.saved().dishes[0], custom); assert.deepEqual(a.saved().favorites, ['custom']); assert.equal(a.saved().history[0].name, custom.name); assert.equal([...a.storage.keys()][0], key);
});
test('reset remains explicit and clears all filters including diet and budget', () => {
  const a = app({dishes: fixture}); for (const [id, v] of Object.entries({budget: 0, vegetarian: true, 'favorite-only': true, 'dish-search': '不存在', category: '速食'})) a.set(id, v); a.click('reset-filters'); assert.equal(a.count(), 6); assert.equal(a.$('budget').value, ''); assert.equal(a.$('vegetarian').checked, false); assert.equal(a.$('favorite-only').checked, false);
});
test('comparison keeps three unique entries, rejects the fourth and preserves draw state', () => {
  const a = app({dishes: fixture}); a.click('draw'); const selected = a.$('result-title').textContent, saved = a.storage.get(key);
  for (const id of ['noodle', 'kfc', 'luxury']) { compareButton(a, id).emit('click'); assert.equal(compareButton(a, id).getAttribute('aria-pressed'), 'true'); }
  assert.deepEqual(a.$('comparison-items').children.map(el => el.dataset.compareId), ['noodle', 'kfc', 'luxury']);
  compareButton(a, 'breakfast').emit('click'); assert.match(a.$('comparison-status').textContent, /最多比較 3 道/); assert.equal(a.$('comparison-items').children.length, 3); assert.equal(compareButton(a, 'breakfast').getAttribute('aria-pressed'), 'false'); assert.equal(a.$('result-title').textContent, selected); assert.equal(a.count(), 6); assert.equal(a.storage.get(key), saved);
  compareButton(a, 'kfc').emit('click'); assert.equal(a.$('comparison-items').children.length, 2); assert.equal(compareButton(a, 'kfc').getAttribute('aria-pressed'), 'false'); compareButton(a, 'breakfast').emit('click'); assert.equal(a.$('comparison-items').children.length, 3);
});
test('comparison persists through filters and explains budget, diet and other exclusions accurately', () => {
  const a = app({dishes: fixture}); for (const id of ['noodle', 'kfc', 'luxury']) compareButton(a, id).emit('click');
  for (const [id, v] of Object.entries({budget: 100, vegetarian: true, category: '麵食', spice: '不辣', 'dish-search': '蛋'})) a.set(id, v);
  assert.equal(a.count(), 1); assert.equal(a.$('comparison-items').children.length, 3);
  const no = compared(a, 'noodle').textContent, kfc = compared(a, 'kfc').textContent;
  assert.match(no, /預算內，剩餘 NT\$ 15/); assert.match(no, /符合全部目前篩選條件/);
  for (const phrase of ['超出預算 NT$ 100', '類型不是「麵食」', '辣度不是「不辣」', '未標記為素食', '不符合搜尋「蛋」']) assert.ok(kfc.includes(phrase), phrase);
  a.click('draw'); a.click('result-favorite'); assert.match(compared(a, 'noodle').textContent, /已收藏/);
  a.set('budget', 3001); assert.match(compared(a, 'noodle').textContent, /預算輸入需修正，暫不判定/); assert.ok(!compared(a, 'noodle').textContent.includes('符合全部目前篩選條件'));
});
test('comparison reflects edits and removes deleted meals without restoring stale entries', () => {
  const a = app({dishes: fixture}); compareButton(a, 'noodle').emit('click'); a.set('dish-search', '蛋麵');
  a.$('cards').children[0].querySelectorAll('button').find(b => b.textContent === '修改').emit('click'); a.$('dish-name').value = '更新番茄蛋麵'; a.$('dish-price').value = '99'; a.$('dish-vegetarian').checked = false; a.$('dish-form').emit('submit');
  assert.match(compared(a, 'noodle').textContent, /更新番茄蛋麵/); assert.match(compared(a, 'noodle').textContent, /NT\$ 99/); assert.match(compared(a, 'noodle').textContent, /素食標記無/);
  a.$('cards').children[0].querySelectorAll('button').find(b => b.textContent === '刪除').emit('click'); assert.equal(a.$('comparison-items').children.length, 0); a.click('undo-delete'); assert.equal(a.count(), 1); assert.equal(a.$('comparison-items').children.length, 0); assert.equal(compareButton(a, 'noodle').getAttribute('aria-pressed'), 'false');
});
test('comparison removal, clearing and reload are accessible and do not change saved menu state', () => {
  const a = app({dishes: fixture, favorites: ['noodle']}); const initialSaved = a.storage.get(key); for (const id of ['noodle', 'kfc']) compareButton(a, id).emit('click');
  compared(a, 'noodle').querySelector('button').emit('click'); assert.equal(a.$('comparison-items').children.length, 1); assert.equal(a.doc.activeElement.dataset.removeCompareId, 'kfc');
  a.click('clear-comparison'); assert.equal(a.$('comparison-items').children.length, 0); assert.equal(a.doc.activeElement.id, 'comparison-title'); assert.equal(a.$('clear-comparison').disabled, true); assert.equal(a.storage.get(key), initialSaved);
  compareButton(a, 'kfc').emit('click'); const reloaded = app({raw: a.storage.get(key)}); assert.equal(reloaded.$('comparison-items').children.length, 0); assert.equal(reloaded.count(), 6); assert.deepEqual(reloaded.saved().favorites, ['noodle']);
});
console.log(`\n${passed} tests passed. No network, model, browser or external dependencies used.`);
