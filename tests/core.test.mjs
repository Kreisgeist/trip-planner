import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { TripPlannerCore, DEFAULT_SETTINGS, MAX_IMPORT_BYTES, tripRevision, validateResortUrl, validateSender, notificationMessage } from '../electron/core.mjs';

const NOW = Date.parse('2026-11-01T20:00:00.000Z');
const trip = (changes = {}) => ({
  name: 'Synthetic trip', destination: 'Seattle', origin: 'DEN', arrival: 'SEA',
  departureDate: '2027-02-01', returnDate: '2027-02-08', adults: 2, childAges: [7, 12],
  rooms: 1, currency: 'USD', budgetMinor: 300000, resortUrl: '', notes: '', ...changes,
});
const quote = (changes = {}) => ({
  kind: 'flight', source: 'Google Flights', product: 'Synthetic round trip',
  startDate: '2027-02-01', endDate: '2027-02-08', adults: 2, childAges: [7, 12],
  rooms: 1, currency: 'USD', totalMinor: 100000, feesIncluded: true, baggage: 'One bag',
  cancellation: 'Nonrefundable', notes: '', observedAt: new Date(NOW).toISOString(), confirmed: true, ...changes,
});
function fixture(t, configured = true) {
  const core = new TripPlannerCore(':memory:', { now: () => NOW });
  t.after(() => core.close());
  if (configured) core.saveTrip(trip());
  return core;
}
const at = (minutes) => new Date(NOW + minutes * 60_000).toISOString();

test('budget and name edits preserve target; home currency changes atomically disable only target', (t) => {
  const core = fixture(t);
  const settings = { locale: 'es', notifications: true, targetMinor: 90000, dropPercent: 12 };
  core.setSettings(settings);
  assert.deepEqual(core.saveTrip(trip({ name: 'Renamed synthetic trip', budgetMinor: 200000 })).settings, settings);
  const before = core.load();
  core.db.exec("CREATE TRIGGER synthetic_trip_failure BEFORE UPDATE ON config WHEN NEW.key = 'trip' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;");
  assert.throws(() => core.saveTrip(trip({ currency: 'EUR' })), /synthetic failure/);
  assert.deepEqual(core.load(), before);
  core.db.exec('DROP TRIGGER synthetic_trip_failure');
  const changed = core.saveTrip(trip({ currency: 'EUR' }));
  assert.equal(changed.trip.currency, 'EUR');
  assert.deepEqual(changed.settings, { ...settings, targetMinor: 0 });
  assert.deepEqual(core.load().settings, changed.settings);
});

test('empty state has neutral sources and defaults, no personal startup data', (t) => {
  const core = fixture(t, false);
  const state = core.load();
  assert.equal(state.trip, null);
  assert.equal(state.revision, null);
  assert.deepEqual(state.settings, DEFAULT_SETTINGS);
  assert.deepEqual(state.quotes, []);
  assert.deepEqual(state.alerts, []);
  assert.deepEqual(state.sources.map((s) => s.id), ['google-flights', 'google-hotels', 'aeromexico', 'volaris', 'viva']);
  assert.throws(() => core.copySearch(), /Configure a trip/);
  assert.throws(() => core.saveQuote(quote()), /Configure a trip/);
});
test('trip comparison revision excludes name, budget and notes but includes selected property', (t) => {
  const core = fixture(t);
  const initial = core.saveQuote(quote());
  const changed = core.saveTrip(trip({ name: 'Renamed', budgetMinor: 5, notes: 'Synthetic note', childAges: [12, 7] }));
  assert.equal(changed.revision, initial.revision);
  assert.equal(changed.quotes[0].revision, changed.revision);
  for (const change of [{ origin: 'LAX' }, { arrival: 'PDX' }, { destination: 'Portland' }, { rooms: 2 },
    { currency: 'EUR' }, { adults: 1 }, { childAges: [7] }, { returnDate: '2027-02-09' }]) {
    assert.notEqual(tripRevision(trip(change)), initial.revision);
  }
  const next = core.saveTrip(trip({ arrival: 'PDX' }));
  assert.equal(next.quotes.length, 1);
  assert.notEqual(next.quotes[0].revision, next.revision);
});
test('canonical same resort URL keeps revision; a different property isolates same-name hotel comparisons', (t) => {
  const core = fixture(t);
  const propertyA = 'https://www.google.com/travel/hotels?property=synthetic-a';
  const propertyB = 'https://www.google.com/travel/hotels?property=synthetic-b';
  const first = core.saveTrip(trip({ resortUrl: propertyA }));
  const same = core.saveTrip(trip({ resortUrl: 'https://WWW.GOOGLE.COM:443/travel/hotels?property=synthetic-a' }));
  assert.equal(same.revision, first.revision);
  core.saveQuote(quote({ kind: 'hotel', source: 'Resort', product: 'Deluxe' }));
  const next = core.saveTrip(trip({ resortUrl: propertyB }));
  assert.notEqual(next.revision, first.revision);
  const state = core.saveQuote(quote({ kind: 'hotel', source: 'Resort', product: 'Deluxe', totalMinor: 50000, observedAt: at(1) }));
  assert.equal(state.quotes.length, 2);
  assert.equal(state.alerts.length, 0);
  assert.notEqual(state.quotes[0].fingerprint, state.quotes[1].fingerprint);
  assert.equal(state.quotes.filter((item) => item.revision === state.revision).length, 1);
  const restored = fixture(t, false);
  assert.deepEqual(restored.importData(JSON.stringify(core.exportData())).quotes, state.quotes);
});
test('pre-property snapshot exports stay archival, roundtrip and never supply a property baseline', (t) => {
  const snapshot = trip({ resortUrl: 'https://www.google.com/travel/hotels?property=synthetic-a' });
  const oldRevision = createHash('sha256').update(JSON.stringify([
    'seattle', 'den', 'sea', snapshot.departureDate, snapshot.returnDate,
    snapshot.adults, snapshot.childAges, snapshot.rooms, snapshot.currency,
  ])).digest('hex');
  const source = fixture(t);
  source.saveTrip(snapshot);
  source.saveQuote(quote({ kind: 'hotel', source: 'Resort', product: 'Deluxe' }));
  const data = source.exportData();
  data.quotes[0].revision = oldRevision;
  data.revisions = [{ revision: oldRevision, trip: snapshot }];
  const restored = fixture(t, false);
  const state = restored.importData(JSON.stringify(data));
  assert.equal(state.quotes.length, 1);
  assert.notEqual(state.quotes[0].revision, state.revision);
  assert.notEqual(state.quotes[0].revision, oldRevision);
  assert.equal(restored.importData(JSON.stringify(data)).quotes.length, 1);
  assert.equal(restored.exportData().revisions.find((context) => context.trip === null).legacyRevision, oldRevision);
  const again = fixture(t, false);
  assert.deepEqual(again.importData(JSON.stringify(restored.exportData())).quotes, state.quotes);
  assert.equal(restored.saveQuote(quote({ kind: 'hotel', source: 'Resort', product: 'Deluxe', totalMinor: 50000, observedAt: at(1) })).alerts.length, 0);
  const invalid = structuredClone(data);
  invalid.quotes[0].rooms = 2;
  assert.throws(() => again.importData(JSON.stringify(invalid)), /rooms/);
});
test('pre-property SQLite contexts export without rewriting or promoting unknown property observations', (t) => {
  const core = fixture(t);
  core.saveQuote(quote({ kind: 'hotel', source: 'Resort', product: 'Deluxe' }));
  const snapshot = trip();
  const oldRevision = createHash('sha256').update(JSON.stringify([
    'seattle', 'den', 'sea', snapshot.departureDate, snapshot.returnDate,
    snapshot.adults, snapshot.childAges, snapshot.rooms, snapshot.currency,
  ])).digest('hex');
  const currentQuote = core.load().quotes[0];
  const oldFingerprint = createHash('sha256').update(JSON.stringify([
    oldRevision, 'hotel', 'resort', 'deluxe', currentQuote.startDate, currentQuote.endDate,
    currentQuote.adults, currentQuote.childAges, currentQuote.rooms, currentQuote.currency, true, 'one bag', 'nonrefundable',
  ])).digest('hex');
  core.db.prepare('UPDATE quotes SET revision = ?, fingerprint = ?').run(oldRevision, oldFingerprint);
  core.db.prepare('INSERT INTO revisions(revision, value) VALUES (?, ?)').run(oldRevision, JSON.stringify({ revision: oldRevision, trip: snapshot }));
  const before = core.load().quotes;
  const data = core.exportData();
  assert.notEqual(data.quotes[0].revision, data.revisions.find((context) => context.trip)?.revision);
  assert.equal(data.revisions.find((context) => context.trip === null).legacyRevision, oldRevision);
  assert.deepEqual(core.load().quotes, before);
  assert.equal(core.importData(JSON.stringify(data)).quotes.length, 1);
  const restored = fixture(t, false);
  const imported = restored.importData(JSON.stringify(data));
  assert.notEqual(imported.quotes[0].revision, imported.revision);
});
test('strict calendar, party, currency and string validation precedes writes', (t) => {
  const core = fixture(t);
  const original = core.load();
  for (const change of [{ departureDate: '2027-02-30' }, { returnDate: '2027-02-01' },
    { adults: 0 }, { adults: 10 }, { childAges: [18] }, { childAges: [-1] },
    { childAges: [1.5] }, { rooms: 10 }, { currency: 'ZZZ' }, { budgetMinor: -1 },
    { budgetMinor: Number.MAX_SAFE_INTEGER + 1 }, { origin: '' }, { name: 'a'.repeat(121) },
    { notes: '\u0000' }, { rogue: true }, { resortUrl: 'https://hotel.test/' }]) {
    assert.throws(() => core.saveTrip(trip(change)));
    assert.deepEqual(core.load(), original);
  }
  assert.throws(() => core.saveTrip(null));
  assert.throws(() => core.saveTrip([]));
  assert.throws(() => core.setSettings({ ...DEFAULT_SETTINGS, notifications: 'true' }));
  assert.throws(() => core.setSettings({ ...DEFAULT_SETTINGS, dropPercent: 0 }));
  assert.throws(() => core.setSettings({ ...DEFAULT_SETTINGS, dropPercent: 1.5 }));
  assert.throws(() => core.setSettings({ ...DEFAULT_SETTINGS, locale: 'fr' }));
});
test('URL registry rejects arbitrary IDs and unsafe resort URLs', (t) => {
  const core = fixture(t);
  for (const url of ['javascript:alert(1)', 'http://hotel.test', 'https://localhost/',
    'https://127.0.0.1/', 'https://[::1]/', 'https://2130706433/', 'https://0x7f000001/',
    'https://user:pass@www.google.com/', 'https://www.google.com:444/', 'https://foo.local/',
    'https://www.google.com/\n', 'https://www.google.com\\@localhost/', 'not a URL']) {
    assert.throws(() => validateResortUrl(url));
  }
  assert.equal(validateResortUrl('https://www.google.com:443/travel/hotels'), 'https://www.google.com/travel/hotels');
  assert.throws(() => core.openSource('https://www.google.com/'), /source ID|registry/);
  assert.throws(() => core.openSource('resort'), /registry/);
  assert.deepEqual(core.openSource('google-flights'), { url: 'https://www.google.com/travel/flights', prefilled: false });
});
test('quotes require matching dates, adults, child ages, rooms and currency', (t) => {
  const core = fixture(t);
  for (const [change, pattern] of [
    [{ endDate: '2027-02-09' }, /dates/], [{ adults: 3 }, /adults/], [{ childAges: [7] }, /child ages/],
    [{ rooms: 2 }, /rooms/], [{ currency: 'EUR' }, /conversion/], [{ confirmed: false }, /Confirm/],
    [{ totalMinor: 0 }, /Total/], [{ totalMinor: 1.1 }, /Total/], [{ feesIncluded: 'yes' }, /Fees/],
    [{ observedAt: at(6) }, /five minutes/], [{ observedAt: '2026-02-30T20:00:00Z' }, /real/],
    [{ observedAt: '2026-11-01' }, /ISO/], [{ product: 'a'.repeat(301) }, /Product/],
    [{ kind: 'car' }, /kind/], [{ extra: 1 }, /fields/],
  ]) {
    assert.throws(() => core.saveQuote(quote(change)), pattern);
  }
  assert.equal(core.load().quotes.length, 0);
  assert.equal(core.saveQuote(quote({ childAges: [12, 7], kind: 'hotel' })).quotes.length, 1);
});
test('normalized product/source and comparison terms form a fingerprint', (t) => {
  const core = fixture(t);
  const a = core.saveQuote(quote()).quotes[0];
  const b = core.saveQuote(quote({ product: ' SYNTHETIC   ROUND TRIP ', source: 'google flights', observedAt: at(1) })).quotes[0];
  assert.equal(a.fingerprint, b.fingerprint);
  for (const change of [{ product: 'Other product' }, { baggage: 'Two bags' }, { cancellation: 'Refundable' },
    { feesIncluded: false }, { source: 'Volaris' }, { kind: 'hotel' }]) {
    const c = core.saveQuote(quote({ ...change, observedAt: at(2) })).quotes[0];
    assert.notEqual(c.fingerprint, a.fingerprint);
  }
});
test('first observation has no drop, exact threshold uses integer arithmetic', (t) => {
  const core = fixture(t);
  assert.equal(core.saveQuote(quote()).alerts.length, 0);
  assert.equal(core.saveQuote(quote({ totalMinor: 95001, observedAt: at(1) })).alerts.length, 0);
  const state = core.saveQuote(quote({ totalMinor: 90250, observedAt: at(2) }));
  assert.equal(state.alerts.length, 1);
  assert.match(state.alerts[0].body, /USD.*previous.*dropped/);
  assert.equal(state.alerts[0].quoteId, state.quotes[0].id);
});
test('a new product has no drop baseline', (t) => {
  const core = fixture(t);
  core.saveQuote(quote());
  assert.equal(core.saveQuote(quote({ product: 'Another product', totalMinor: 1, observedAt: at(1) })).alerts.length, 0);
});
test('target crossing and price drop produce one alert, intervening rise rearms', (t) => {
  const core = fixture(t);
  core.setSettings({ ...DEFAULT_SETTINGS, targetMinor: 90000 });
  core.saveQuote(quote());
  let state = core.saveQuote(quote({ totalMinor: 85000, observedAt: at(1) }));
  assert.equal(state.alerts.length, 1);
  assert.match(state.alerts[0].body, /Target reached.*Price dropped/);
  assert.equal(core.saveQuote(quote({ totalMinor: 85000, observedAt: at(2) })).alerts.length, 1);
  core.saveQuote(quote({ totalMinor: 100000, observedAt: at(3) }));
  state = core.saveQuote(quote({ totalMinor: 85000, observedAt: at(4) }));
  assert.equal(state.alerts.length, 2);
  assert.equal(core.markAlert(state.alerts[0].id).alerts[0].read, true);
  assert.throws(() => core.markAlert(9999), /not found/);
  assert.throws(() => core.markAlert('1'), /integer/);
});
test('first known-fee quote at target can alert, unknown fees never alert', (t) => {
  const core = fixture(t);
  core.setSettings({ ...DEFAULT_SETTINGS, targetMinor: 100000 });
  assert.equal(core.saveQuote(quote({ feesIncluded: false, totalMinor: 50000 })).alerts.length, 0);
  assert.equal(core.saveQuote(quote()).alerts.length, 1);
});
test('old quotes remain history but do not alert or form fresh baselines', (t) => {
  const core = fixture(t);
  core.setSettings({ ...DEFAULT_SETTINGS, targetMinor: 100000 });
  assert.equal(core.saveQuote(quote({ observedAt: at(-1441) })).alerts.length, 0);
  assert.equal(core.saveQuote(quote({ totalMinor: 50000 })).alerts.length, 0);
  assert.equal(core.load().quotes.length, 2);
});
test('backdated observation cannot create misleading drops', (t) => {
  const core = fixture(t);
  core.saveQuote(quote());
  assert.equal(core.saveQuote(quote({ totalMinor: 50000, observedAt: at(-1) })).alerts.length, 0);
});
test('exact observations deduplicate without mutating historical rows', (t) => {
  const core = fixture(t);
  core.saveQuote(quote());
  const state = core.saveQuote(quote({ notes: 'Another note' }));
  assert.equal(state.quotes.length, 1);
  assert.equal(state.quotes[0].notes, '');
});
test('complete checklist is only produced on explicit call', (t) => {
  const core = fixture(t);
  const checklist = core.copySearch();
  for (const value of ['DEN', 'SEA', 'Seattle', '2027-02-01', '2027-02-08', '7, 12', 'Rooms: 1', 'USD', 'taxes and fees']) {
    assert.ok(checklist.includes(value));
  }
});
test('SQLite persists and close is idempotent', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'trip-core-test-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, 'state.sqlite');
  const core = new TripPlannerCore(path, { now: () => NOW });
  core.saveTrip(trip());
  core.setSettings({ locale: 'es', notifications: true, targetMinor: 100000, dropPercent: 5 });
  core.saveQuote(quote());
  const expected = core.load();
  core.close(); core.close();
  const reopened = new TripPlannerCore(path, { now: () => NOW });
  try { assert.deepEqual(reopened.load(), expected); } finally { reopened.close(); }
});
test('export is versioned and omits storage paths; import recomputes IDs and fingerprints without alerts', (t) => {
  const source = fixture(t);
  source.setSettings({ ...DEFAULT_SETTINGS, targetMinor: 100000 });
  source.saveQuote(quote());
  const data = source.exportData();
  assert.equal(data.schemaVersion, 1);
  assert.equal(Object.hasOwn(data, 'storagePath'), false);
  assert.equal(data.alerts.length, 1);
  data.quotes[0].id = 999;
  data.quotes[0].fingerprint = 'a'.repeat(64);
  const destination = fixture(t, false);
  const imported = destination.importData(JSON.stringify(data));
  assert.equal(imported.quotes[0].id, 1);
  assert.notEqual(imported.quotes[0].fingerprint, 'a'.repeat(64));
  assert.equal(imported.alerts.length, 0);
  assert.deepEqual(imported.trip, trip());
  assert.equal(destination.importData(JSON.stringify(data)).quotes.length, 1);
});
test('import preserves all revision history and existing settings', (t) => {
  const source = fixture(t);
  source.saveQuote(quote());
  source.saveTrip(trip({ arrival: 'PDX', destination: 'Portland' }));
  source.saveQuote(quote({ observedAt: at(1) }));
  const destination = fixture(t, false);
  const imported = destination.importData(JSON.stringify(source.exportData()));
  assert.equal(imported.quotes.length, 2);
  assert.equal(imported.quotes[0].revision, imported.revision);
  assert.notEqual(imported.quotes[1].revision, imported.revision);
  destination.setSettings({ ...DEFAULT_SETTINGS, locale: 'es' });
  assert.equal(destination.importData(JSON.stringify(source.exportData())).settings.locale, 'es');
});
test('invalid import and incompatible trip leave database untouched', (t) => {
  const core = fixture(t);
  core.saveQuote(quote());
  const original = core.load();
  const incompatible = core.exportData();
  incompatible.trip = trip({ origin: 'LAX' });
  assert.throws(() => core.importData(JSON.stringify(incompatible)), /incompatible/);
  const invalid = core.exportData();
  invalid.quotes.push({ ...invalid.quotes[0], totalMinor: -1 });
  assert.throws(() => core.importData(JSON.stringify(invalid)), /Total/);
  invalid.quotes.pop();
  invalid.alerts.push({ id: 1, quoteId: 1, createdAt: 'no', read: false, title: 'Synthetic', body: 'Synthetic' });
  assert.throws(() => core.importData(JSON.stringify(invalid)), /timestamp/);
  assert.throws(() => core.importData('{'), /JSON/);
  assert.throws(() => core.importData(' '.repeat(MAX_IMPORT_BYTES + 1)), /5 MB/);
  assert.throws(() => core.importData(JSON.stringify({ ...core.exportData(), credentials: {} })), /fields/);
  assert.throws(() => core.importData(JSON.stringify({ ...core.exportData(), schemaVersion: 2 })), /version/);
  assert.deepEqual(core.load(), original);
});
test('failed empty-profile import rolls back trip, settings and prior inserts', (t) => {
  const source = fixture(t);
  source.saveQuote(quote());
  const data = source.exportData();
  data.quotes.push({ ...data.quotes[0], id: 2, adults: 3, observedAt: at(1) });
  const destination = fixture(t, false);
  assert.throws(() => destination.importData(JSON.stringify(data)), /adults/);
  assert.equal(destination.load().trip, null);
  assert.deepEqual(destination.load().settings, DEFAULT_SETTINGS);
  assert.deepEqual(destination.load().quotes, []);
});
test('multi-revision restoration and repeated merging preserve every observation without alerts', (t) => {
  const source = fixture(t);
  source.setSettings({ ...DEFAULT_SETTINGS, targetMinor: 100000 });
  source.saveQuote(quote());
  const firstRevision = source.load().revision;
  source.saveTrip(trip({ destination: 'Portland', arrival: 'PDX' }));
  source.saveQuote(quote({ totalMinor: 80000, observedAt: at(1) }));
  source.saveTrip(trip({ destination: 'Seattle', rooms: 2 }));
  source.saveQuote(quote({ rooms: 2, totalMinor: 70000, observedAt: at(2) }));
  const original = source.load();
  assert.equal(original.alerts.length, 3);
  const data = source.exportData();
  assert.equal(data.revisions.length, 3);
  assert.ok(data.revisions.every((context) => context.trip && tripRevision(context.trip) === context.revision));
  const restored = fixture(t, false);
  let state = restored.importData(JSON.stringify(data));
  assert.deepEqual(state.quotes, original.quotes);
  assert.equal(state.alerts.length, 0);
  assert.equal(state.quotes.filter((item) => item.revision === state.revision).length, 1);
  assert.equal(restored.importData(JSON.stringify(data)).quotes.length, 3);
  assert.deepEqual(source.importData(JSON.stringify(restored.exportData())).quotes, original.quotes);
  assert.deepEqual(source.load().alerts, original.alerts);
  state = restored.importData(JSON.stringify(source.exportData()));
  assert.equal(state.quotes.length, 3);
  assert.equal(state.alerts.length, 0);
  // A restored snapshot becomes comparable only when explicitly selecting that exact trip.
  state = restored.saveTrip(trip());
  assert.equal(state.revision, firstRevision);
  assert.equal(state.quotes.filter((item) => item.revision === state.revision).length, 1);
  state = restored.saveQuote(quote({ totalMinor: 96000, observedAt: at(3) }));
  assert.equal(state.alerts.length, 0);
});
test('legacy v1 without snapshots restores unknown revisions as isolated archives and roundtrips', (t) => {
  const source = fixture(t);
  source.saveQuote(quote());
  const oldRevision = source.load().revision;
  source.saveTrip(trip({ arrival: 'PDX', destination: 'Portland' }));
  source.saveQuote(quote({ totalMinor: 80000, observedAt: at(1) }));
  const legacy = source.exportData();
  delete legacy.revisions;
  const restored = fixture(t, false);
  const state = restored.importData(JSON.stringify(legacy));
  assert.equal(state.quotes.length, 2);
  const archived = state.quotes.find((item) => item.revision !== state.revision);
  assert.notEqual(archived.revision, oldRevision);
  const exported = restored.exportData();
  const context = exported.revisions.find((item) => item.revision === archived.revision);
  assert.equal(context.trip, null);
  assert.equal(context.legacyRevision, oldRevision);
  assert.equal(restored.importData(JSON.stringify(exported)).quotes.length, 2);
  assert.equal(restored.importData(JSON.stringify(legacy)).quotes.length, 2);
  const fresh = fixture(t, false);
  assert.deepEqual(fresh.importData(JSON.stringify(exported)).quotes, state.quotes);
  restored.saveTrip(trip());
  assert.equal(restored.load().quotes.filter((item) => item.revision === oldRevision).length, 0);
  assert.equal(restored.saveQuote(quote({ totalMinor: 50000, observedAt: at(2) })).alerts.length, 0);
});
test('legacy database export supplies archival context without rewriting or duplicating observations', (t) => {
  const source = fixture(t);
  source.saveQuote(quote());
  const oldRevision = source.load().revision;
  source.saveTrip(trip({ arrival: 'PDX', destination: 'Portland' }));
  source.db.prepare('DELETE FROM revisions WHERE revision = ?').run(oldRevision);
  const before = source.load().quotes;
  const data = source.exportData();
  assert.equal(data.revisions.find((context) => context.trip === null).legacyRevision, oldRevision);
  assert.deepEqual(source.load().quotes, before);
  assert.equal(source.importData(JSON.stringify(data)).quotes.length, 1);
  const restored = fixture(t, false);
  assert.equal(restored.importData(JSON.stringify(data)).quotes.length, 1);
  assert.equal(restored.importData(JSON.stringify(source.exportData())).quotes.length, 1);
});
test('merging snapshot-aware backup into a legacy restore neither duplicates nor promotes archival quotes', (t) => {
  const source = fixture(t);
  source.saveQuote(quote());
  source.saveTrip(trip({ arrival: 'PDX', destination: 'Portland' }));
  const withSnapshots = source.exportData();
  const legacy = structuredClone(withSnapshots);
  delete legacy.revisions;
  const restored = fixture(t, false);
  const before = restored.importData(JSON.stringify(legacy));
  const after = restored.importData(JSON.stringify(withSnapshots));
  assert.deepEqual(after.quotes, before.quotes);
  assert.deepEqual(after.alerts, []);
  restored.saveTrip(trip());
  assert.equal(restored.load().quotes.filter((item) => item.revision === restored.load().revision).length, 0);
  assert.equal(restored.importData(JSON.stringify(restored.exportData())).quotes.length, 1);
});
test('invalid or missing archival contexts reject the whole merge without success-shaped omissions', (t) => {
  const source = fixture(t);
  source.saveQuote(quote());
  source.saveTrip(trip({ arrival: 'PDX', destination: 'Portland' }));
  source.saveQuote(quote({ observedAt: at(1) }));
  const valid = source.exportData();
  const destination = fixture(t, false);
  const cases = [];
  const missing = structuredClone(valid);
  missing.revisions = missing.revisions.filter((context) => context.revision === tripRevision(valid.trip));
  cases.push(missing);
  const altered = structuredClone(valid);
  altered.revisions[1].trip.adults = 3;
  cases.push(altered);
  const mismatchedQuote = structuredClone(valid);
  mismatchedQuote.quotes[1].rooms = 2;
  cases.push(mismatchedQuote);
  const duplicate = structuredClone(valid);
  duplicate.revisions.push(duplicate.revisions[0]);
  cases.push(duplicate);
  const spoofedArchive = structuredClone(valid);
  spoofedArchive.revisions[1] = { revision: spoofedArchive.revisions[1].revision, trip: null, legacyRevision: 'a'.repeat(64) };
  cases.push(spoofedArchive);
  for (const data of cases) {
    assert.throws(() => destination.importData(JSON.stringify(data)), /revision|snapshot|match|rooms/i);
    assert.equal(destination.load().trip, null);
    assert.equal(destination.load().quotes.length, 0);
    assert.equal(destination.load().alerts.length, 0);
  }
});
test('persisted alert language switches on load without rewriting observations, reasons or alert identity', (t) => {
  const core = fixture(t);
  core.setSettings({ ...DEFAULT_SETTINGS, targetMinor: 90000 });
  core.saveQuote(quote({ product: '<script>Synthetic product</script>' }));
  core.saveQuote(quote({ product: '<script>Synthetic product</script>', totalMinor: 85000, observedAt: at(1) }));
  const en = core.load();
  const stored = core.db.prepare('SELECT * FROM alerts').all();
  const es = core.setSettings({ ...en.settings, locale: 'es' });
  assert.equal(es.alerts[0].title, 'Alerta de precio del viaje');
  assert.match(es.alerts[0].body, /Objetivo alcanzado.*El precio bajó al menos un 5%/);
  assert.match(es.alerts[0].body, /anterior/);
  assert.ok(es.alerts[0].body.includes('<script>Synthetic product</script>'));
  assert.equal(es.alerts[0].id, en.alerts[0].id);
  assert.equal(es.alerts[0].quoteId, en.alerts[0].quoteId);
  assert.equal(es.alerts[0].createdAt, en.alerts[0].createdAt);
  assert.deepEqual(es.quotes, en.quotes);
  assert.deepEqual(core.db.prepare('SELECT * FROM alerts').all(), stored);
  assert.deepEqual(core.setSettings({ ...en.settings, locale: 'en' }).alerts, en.alerts);
  assert.equal(core.markAlert(es.alerts[0].id).alerts[0].read, true);
});
test('pre-localization database alerts migrate once and localize after reopening', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'trip-core-locale-test-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, 'state.sqlite');
  const source = new TripPlannerCore(path, { now: () => NOW });
  source.saveTrip(trip());
  source.setSettings({ ...DEFAULT_SETTINGS, targetMinor: 90000 });
  source.saveQuote(quote());
  const before = source.saveQuote(quote({ totalMinor: 85000, observedAt: at(1) }));
  source.db.exec('ALTER TABLE alerts DROP COLUMN details');
  source.close();
  const reopened = new TripPlannerCore(path, { now: () => NOW });
  try {
    assert.deepEqual(reopened.load().alerts, before.alerts);
    const es = reopened.setSettings({ ...before.settings, locale: 'es' });
    assert.match(es.alerts[0].body, /Objetivo alcanzado.*El precio bajó al menos un 5%/);
    assert.equal(es.alerts[0].id, before.alerts[0].id);
    assert.deepEqual(es.quotes, before.quotes);
  } finally { reopened.close(); }
  const again = new TripPlannerCore(path, { now: () => NOW });
  try { assert.equal(again.load().alerts[0].title, 'Alerta de precio del viaje'); } finally { again.close(); }
});
test('notification diagnostics and test content have explicit EN and ES translations', () => {
  for (const key of ['unsupported', 'disabled', 'shown', 'failed', 'timeout', 'creationFailed', 'testTitle', 'testBody']) {
    const en = notificationMessage(key, 'en');
    const es = notificationMessage(key, 'es');
    assert.equal(typeof en, 'string');
    assert.equal(typeof es, 'string');
    assert.notEqual(en, es);
    assert.equal(notificationMessage(key, 'en'), en);
  }
  assert.match(notificationMessage('disabled', 'es'), /Activa las notificaciones/);
  assert.match(notificationMessage('shown', 'es'), /confirmó/);
  assert.throws(() => notificationMessage('__proto__', 'es'), /Unknown/);
});
test('legacy alert migration does not interpret product text as generated alert reasons', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'trip-core-reasons-test-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const path = join(folder, 'state.sqlite');
  const core = new TripPlannerCore(path, { now: () => NOW });
  const product = 'Synthetic Target reached; Price dropped at least 99%';
  core.saveTrip(trip());
  core.setSettings({ ...DEFAULT_SETTINGS, targetMinor: 100000 });
  core.saveQuote(quote({ product }));
  core.db.exec('ALTER TABLE alerts DROP COLUMN details');
  core.close();
  const reopened = new TripPlannerCore(path, { now: () => NOW });
  try {
    const details = JSON.parse(reopened.db.prepare('SELECT details FROM alerts').get().details);
    assert.equal(details.targetReached, true);
    assert.equal(details.dropPercent, null);
    const state = reopened.setSettings({ ...DEFAULT_SETTINGS, locale: 'es' });
    assert.ok(state.alerts[0].body.startsWith(product));
    assert.ok(state.alerts[0].body.endsWith('Objetivo alcanzado.'));
  } finally { reopened.close(); }
});
test('IPC sender authorization binds main window, main frame and exact loaded URL', () => {
  for (const url of ['file:///synthetic/dist/index.html', 'http://127.0.0.1:5173/']) {
    const frame = { url };
    const contents = { mainFrame: frame, getURL: () => url };
    const window = { webContents: contents, isDestroyed: () => false };
    const event = { sender: contents, senderFrame: frame };
    assert.doesNotThrow(() => validateSender(event, window, url));
    assert.throws(() => validateSender({ ...event, sender: {} }, window, url), /untrusted/);
    assert.throws(() => validateSender({ ...event, senderFrame: { url } }, window, url), /untrusted/);
    assert.throws(() => validateSender({ ...event, senderFrame: null }, window, url), /untrusted/);
    assert.throws(() => validateSender(event, null, url), /untrusted/);
    assert.throws(() => validateSender(event, { ...window, isDestroyed: () => true }, url), /untrusted/);
    frame.url = `${url}#other`;
    assert.throws(() => validateSender(event, window, url), /untrusted/);
    frame.url = url;
    contents.getURL = () => 'https://www.google.com/';
    assert.throws(() => validateSender(event, window, url), /untrusted/);
  }
});
test('ISO offset timestamps canonicalize and invalid normalized dates are rejected', (t) => {
  const core = fixture(t);
  const state = core.saveQuote(quote({ observedAt: '2026-11-01T14:00:00-06:00' }));
  assert.equal(state.quotes[0].observedAt, new Date(NOW).toISOString());
  for (const value of ['2026-11-01T24:00:00Z', '2026-02-30T14:00:00-06:00', '2026-11-01T14:00:00', '2026-11-01T20:00:61Z']) {
    assert.throws(() => core.saveQuote(quote({ observedAt: value })), /ISO/);
  }
});
test('SQLite failures roll back observation and alert as a unit', (t) => {
  const core = fixture(t);
  core.setSettings({ ...DEFAULT_SETTINGS, targetMinor: 100000 });
  core.db.exec("CREATE TRIGGER synthetic_alert_failure BEFORE INSERT ON alerts BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;");
  assert.throws(() => core.saveQuote(quote()), /synthetic failure/);
  assert.deepEqual(core.load().quotes, []);
  assert.deepEqual(core.load().alerts, []);
});
test('SQLite import failure rolls back trip, settings and every observation', (t) => {
  const source = fixture(t);
  source.saveQuote(quote());
  source.saveQuote(quote({ observedAt: at(1), totalMinor: 90000 }));
  const destination = fixture(t, false);
  destination.db.exec("CREATE TRIGGER synthetic_import_failure BEFORE INSERT ON quotes WHEN NEW.total_minor = 90000 BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END;");
  assert.throws(() => destination.importData(JSON.stringify(source.exportData())), /synthetic failure/);
  assert.equal(destination.load().trip, null);
  assert.deepEqual(destination.load().settings, DEFAULT_SETTINGS);
  assert.deepEqual(destination.load().quotes, []);
});
