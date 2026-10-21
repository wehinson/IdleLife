const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function game(raw, options = {}) {
  const now = 1792562400000;
  const store = new Map(raw === undefined ? [] : [['primordial.save.v3', raw]]);
  const writes = [];
  const intervals = [];
  const windowEvents = {};
  const documentEvents = {};
  let time = now;
  class Clock extends Date { static now() { return time; } }
  const c = {
    Date: Clock,
    localStorage: {
      getItem(key) { if (options.readFails) throw Error('read blocked'); return store.get(key) ?? null; },
      setItem(key, value) { if (options.writeFails) throw Error('write blocked'); writes.push(value); store.set(key, value); },
      removeItem(key) { if (options.removeFails) throw Error('remove blocked'); store.delete(key); },
    },
    setInterval(fn, ms) { intervals.push({ fn, ms }); },
    addEventListener(name, fn) { windowEvents[name] = fn; },
    document: { hidden: false, addEventListener(name, fn) { documentEvents[name] = fn; } },
  };
  c.window = c;
  vm.createContext(c);
  for (const name of ['config', 'state', 'engine']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), c, { filename: name + '.js' });
  }
  return { G: c.G, c, store, writes, intervals, windowEvents, documentEvents, now, advance(ms) { time += ms; } };
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }

const corrupt = [
  'null', '[]', '42', '"save"', '{broken', '',
  '{"resources":null}', '{"resources":[]}', '{"resources":"oops"}',
  '{"resources":{"h2":"Infinity"}}', '{"resources":{"h2":1e999}}',
  '{"resources":{"h2":-1}}', '{"resources":{"h2":null}}',
  '{"resources":{"h2":true}}', '{"resources":{"h2":[]}}', '{"resources":{"h2":""}}',
  '{"highestRedox":"NaN"}', '{"highestRedox":-1}',
  '{"prestige":[]}', '{"prestige":{"points":"Infinity"}}',
  '{"prestige":{"count":1.5}}', '{"prestige":{"upgrades":null}}',
  '{"prestige":{"upgrades":{"celestial_chaos":6}}}',
  '{"prestige":{"draft":{}}}', '{"prestige":{"draft":[null]}}',
  '{"pathUpgrades":[]}', '{"pathUpgrades":{"catalyst":-1}}',
  '{"pathUpgrades":{"catalyst":0.5}}', '{"pathUpgrades":{"catalyst":"Infinity"}}',
  '{"stats":null}', '{"stats":{"totalStrikes":"Infinity"}}',
  '{"stats":{"prestiges":-1}}', '{"stats":{"totalStrikes":1.1}}',
  '{"lastSaved":1e999}', '{"lastSaved":-1}', '{"lastSaved":8640000000000001}',
  '{"milestones":[]}', '{"milestones":{"reducingEnvironment":"false"}}',
  '{"discovered":[]}', '{"rareDiscovered":{"meteor":{}}}',
  '{"firstMeteorDone":"false"}', '{"nextPhaseUnlocked":1}',
  '{"eventLog":{}}', '{"eventLog":[null]}', '{"eventLog":[{"msg":4}]}',
  '{"eventLog":[{"msg":"hello","t":-1}]}', '{"version":4}',
  '{"resources":{"rna":1e308}}',
];
for (const raw of corrupt) {
  test('rejects atomically and preserves original: ' + raw, () => {
    const h = game(raw);
    const before = plain(h.G.state);
    assert.equal(h.G.load(), false);
    assert.ok(h.G.loadError);
    assert.deepEqual(plain(h.G.state), before);
    assert.equal(h.G.save(false), false);
    assert.equal(h.G.save(true), false);
    assert.equal(h.store.get(h.G.config.SAVE_KEY), raw);
    assert.equal(h.writes.length, 0);
  });
}

test('direct validator rejects actual NaN and Infinity in all numeric categories', () => {
  const { G } = game();
  for (const n of [NaN, Infinity, -Infinity]) {
    for (const data of [
      { resources: { h2: n } }, { highestRedox: n }, { prestige: { points: n } },
      { prestige: { count: n } }, { prestige: { upgrades: { celestial_chaos: n } } },
      { pathUpgrades: { catalyst: n } }, { stats: { totalStrikes: n } },
      { stats: { prestiges: n } }, { lastSaved: n }, { eventLog: [{ t: n, msg: 'log' }] },
    ]) assert.throws(() => G.hydrateSave(data), /Invalid save field/);
  }
});

test('valid existing v3 save round-trips without changing progression', () => {
  const source = game();
  const s = source.G.state;
  s.resources.h2 = 250.25;
  s.milestones.reducingEnvironment = true;
  s.discovered.meteor = true;
  s.rareDiscovered.bigMeteor = true;
  s.highestRedox = 300;
  s.firstMeteorDone = true;
  s.nextPhaseUnlocked = true;
  s.prestige.points = 123;
  s.prestige.count = 4;
  s.prestige.upgrades.donor_strength = 2;
  s.prestige.draft = ['reaction_yield'];
  s.pathUpgrades.catalyst = 3;
  s.stats = { totalStrikes: 150, prestiges: 4 };
  s.eventLog = [{ t: source.now - 1000, msg: '<strong>Milestone</strong>' }];
  source.G.save(false);
  const h = game(source.store.get(source.G.config.SAVE_KEY));
  assert.equal(h.G.load(), true);
  const hydrated = plain(h.G.state);
  // Loader has always materialized zero levels for known configured upgrades.
  for (const u of h.G.config.prestigeUpgrades) s.prestige.upgrades[u.id] ??= 0;
  for (const u of h.G.config.pathUpgrades) s.pathUpgrades[u.id] ??= 0;
  assert.deepEqual(hydrated, plain(s));
  assert.equal(h.G.loadError, null);
  assert.equal(h.G.save(false), true);
});

test('missing-field migration retains defaults, numeric strings and removed-id filtering', () => {
  const h = game(JSON.stringify({
    resources: { h2: '12.5', removed: 'Infinity' },
    prestige: { points: '10', upgrades: { removed: -1 }, draft: ['removed', 'reaction_yield'] },
    stats: { totalStrikes: '5', removed: 'Infinity' },
  }));
  const defaultCO2 = 0; // established missing-resource migration
  assert.equal(h.G.load(), true);
  assert.equal(h.G.state.resources.h2, 12.5);
  assert.equal(h.G.state.resources.co2, defaultCO2);
  assert.equal(h.G.state.prestige.points, 10);
  assert.equal(h.G.state.stats.totalStrikes, 5);
  assert.equal(h.G.state.resources.removed, undefined);
  assert.equal(h.G.state.stats.removed, undefined);
  assert.deepEqual(plain(h.G.state.prestige.draft), ['reaction_yield']);
  assert.equal(game('{}').G.load(), true);
});

test('large finite resources have no arbitrary cap; zero and clock skew remain valid', () => {
  const h = game('{"resources":{"h2":1e100},"lastSaved":0}');
  assert.equal(h.G.load(), true);
  assert.equal(h.G.state.resources.h2, 1e100);
  assert.equal(h.G.state.lastSaved, 0);
  assert.ok(Number.isFinite(h.G.redoxCharge()));
  const future = game('{"lastSaved":8640000000000000}');
  assert.equal(future.G.load(), true);
});

test('no offline catch-up on reload; normal passive and hidden-time progression preserved', () => {
  const fixture = game();
  fixture.G.state.lastSaved = 1;
  const h = game(JSON.stringify(fixture.G.state));
  const initialCO2 = h.G.state.resources.co2;
  assert.equal(h.G.load(), true);
  assert.equal(h.G.state.resources.co2, initialCO2);
  h.G.engine.start();
  h.G.engine.start();
  assert.equal(h.intervals.length, 2);
  const tick = h.intervals.find(i => i.ms === h.G.config.TICK_MS).fn;
  const rate = h.G.config.resources.find(r => r.id === 'co2').passivePerSec;
  h.advance(1000); tick();
  assert.equal(h.G.state.resources.co2, initialCO2 + rate);
  h.c.document.hidden = true;
  h.advance(3000); tick();
  assert.equal(h.G.state.resources.co2, initialCO2 + rate * 4);
  h.advance(60000); tick(); // existing five-second clamp, not offline simulation
  assert.equal(h.G.state.resources.co2, initialCO2 + rate * 9);
});

test('autosave, manual, visibility and unload cannot overwrite a rejected save', () => {
  const h = game('null');
  h.G.load();
  h.G.engine.start();
  h.G.engine.strike(); // gameplay may continue in memory
  h.intervals.find(i => i.ms === 15000).fn();
  h.windowEvents.beforeunload();
  h.c.document.hidden = true;
  h.documentEvents.visibilitychange();
  const statuses = [];
  h.G.ui = { flashStatus(msg) { statuses.push(msg); } };
  h.G.save(true);
  assert.deepEqual(statuses, [h.G.config.ui.saveRecovery]);
  assert.equal(h.writes.length, 0);
  assert.equal(h.store.get(h.G.config.SAVE_KEY), 'null');
});

test('read failure guards saves until a later successful load', () => {
  const options = { readFails: true };
  const h = game('{"resources":{"h2":42}}', options);
  assert.equal(h.G.load(), false);
  assert.equal(h.G.save(false), false);
  options.readFails = false;
  assert.equal(h.G.load(), true);
  assert.equal(h.G.state.resources.h2, 42);
  assert.equal(h.G.save(false), true);
});

test('explicit Reset clears recovery guard only after successful removal', () => {
  const options = { removeFails: true };
  const h = game('null', options);
  h.G.load();
  assert.equal(h.G.resetSave(), false);
  assert.ok(h.G.loadError);
  assert.equal(h.store.get(h.G.config.SAVE_KEY), 'null');
  options.removeFails = false;
  assert.equal(h.G.resetSave(), true);
  assert.equal(h.G.loadError, null);
  assert.equal(h.store.has(h.G.config.SAVE_KEY), false);
  assert.equal(h.G.save(false), true);
  assert.equal(h.G.load(), true);
});

test('absent save allows normal saving; write failure does not advance lastSaved', () => {
  const options = { writeFails: true };
  const h = game(undefined, options);
  assert.equal(h.G.load(), false);
  assert.equal(h.G.loadError, null);
  const savedAt = h.G.state.lastSaved;
  h.advance(1000);
  assert.equal(h.G.save(false), false);
  assert.equal(h.G.state.lastSaved, savedAt);
  options.writeFails = false;
  assert.equal(h.G.save(false), true);
  assert.equal(h.G.state.lastSaved, savedAt + 1000);
});

test('event log remains bounded, detached and compatible with missing timestamps', () => {
  const { G } = game();
  const input = { eventLog: Array.from({ length: 45 }, (_, i) => ({ msg: 'log ' + i })) };
  const result = G.hydrateSave(input);
  assert.equal(result.eventLog.length, 40);
  assert.ok(Number.isFinite(result.eventLog[0].t));
  input.eventLog[0].msg = 'changed';
  assert.equal(result.eventLog[0].msg, 'log 0');
});
